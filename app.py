import json
import mimetypes
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename


BASE_DIR = Path(__file__).resolve().parent


def default_data_dir():
    configured = os.environ.get("DATA_DIR") or os.environ.get("RAILWAY_VOLUME_MOUNT_PATH")
    if configured:
        return Path(configured)
    railway_volume = Path("/data")
    if railway_volume.exists():
        return railway_volume
    return BASE_DIR


DATA_DIR = default_data_dir()
DB_PATH = Path(os.environ.get("DATABASE_PATH", DATA_DIR / "partnerportal.db"))
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", DATA_DIR / "uploads"))

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024


ROLE_MASTER = "magna_admin"
CLIENT_ROLES = ("super_approver", "treasury", "finance")
INITIAL_PASSWORD_ENVS = {
    "usr-magna-admin": "MAGNA_ADMIN_PASSWORD",
    "usr-yango-super": "YANGO_APPROVER_PASSWORD",
    "usr-yango-treasury": "YANGO_TREASURY_PASSWORD",
    "usr-yango-finance": "YANGO_FINANCE_PASSWORD",
}


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def money(value):
    return float(Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def make_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def db():
    if "db" not in g:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def query(sql, args=(), one=False):
    cur = db().execute(sql, args)
    rows = cur.fetchall()
    return (rows[0] if rows else None) if one else rows


def execute(sql, args=()):
    db().execute(sql, args)
    db().commit()


def row_to_dict(row):
    if row is None:
        return None
    data = dict(row)
    for key in ("metadata", "rules"):
        if key in data and data[key]:
            try:
                data[key] = json.loads(data[key])
            except json.JSONDecodeError:
                data[key] = {}
    data.pop("password_hash", None)
    return data


def actor():
    user_id = request.headers.get("X-User-Id") or request.args.get("user_id")
    if user_id:
        user = query("select * from users where id = ? and status = 'active'", (user_id,), one=True)
        if user:
            return row_to_dict(user)
    role = request.headers.get("X-Role") or request.args.get("role") or ROLE_MASTER
    user = query("select * from users where role = ? order by id limit 1", (role,), one=True)
    if not user:
        user = query("select * from users where role = ? limit 1", (ROLE_MASTER,), one=True)
    return row_to_dict(user)


def require_roles(*roles):
    user = actor()
    if not user or user["role"] not in roles:
        return None, (jsonify({"error": "No tienes permisos para esta accion."}), 403)
    return user, None


def parse_json():
    return request.get_json(force=True) if request.is_json else request.form.to_dict()


def metadata_value(op, key, default=None):
    metadata = op["metadata"] if isinstance(op.get("metadata"), dict) else {}
    return metadata.get(key, default)


def log_event(operation_id, event_type, description, user_id=None, comment=None, metadata=None):
    execute(
        """
        insert into audit_events
        (id, operation_id, user_id, event_type, description, comment, metadata, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            make_id("EVT"),
            operation_id,
            user_id,
            event_type,
            description,
            comment,
            json.dumps(metadata or {}),
            now_iso(),
        ),
    )


def get_setting(key, default=None):
    item = query("select value from settings where key = ?", (key,), one=True)
    return item["value"] if item else default


def set_setting(key, value):
    execute(
        """
        insert into settings(key, value, updated_at) values (?, ?, ?)
        on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
        """,
        (key, str(value), now_iso()),
    )


def add_column_if_missing(conn, table, column, definition):
    columns = [row[1] for row in conn.execute(f"pragma table_info({table})").fetchall()]
    if column not in columns:
        conn.execute(f"alter table {table} add column {column} {definition}")


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(
        """
        create table if not exists partners (
          id text primary key,
          name text not null,
          status text not null,
          created_at text not null
        );

        create table if not exists users (
          id text primary key,
          partner_id text,
          name text not null,
          email text not null,
          role text not null,
          status text not null,
          created_at text not null
        );

        create table if not exists accounts (
          id text primary key,
          partner_id text,
          owner text not null,
          name text not null,
          institution text,
          account_number text,
          beneficiary_name text,
          account_type text not null,
          currency text not null,
          wallet_address text,
          bank_fee_percent real default 0,
          balance real default 0,
          external_url text,
          notes text,
          status text not null,
          created_at text not null,
          updated_at text not null
        );

        create table if not exists beneficiaries (
          id text primary key,
          partner_id text not null,
          name text not null,
          category text not null,
          bank text,
          account_number text,
          account_type text,
          identification text,
          currency text not null,
          status text not null,
          created_at text not null
        );

        create table if not exists categories (
          id text primary key,
          name text not null,
          kind text not null,
          status text not null,
          created_at text not null
        );

        create table if not exists operations (
          id text primary key,
          partner_id text not null,
          type text not null,
          status text not null,
          reason text,
          requested_currency text,
          requested_amount real,
          rate real,
          bank_fee_percent real default 0,
          bank_fee_amount real default 0,
          source_account_id text,
          destination_account_id text,
          beneficiary_id text,
          linked_operation_id text,
          final_currency text,
          final_amount real,
          created_by text,
          approved_by text,
          expires_at text,
          metadata text not null default '{}',
          created_at text not null,
          updated_at text not null
        );

        create table if not exists attachments (
          id text primary key,
          operation_id text not null,
          label text not null,
          filename text not null,
          uploaded_by text,
          created_at text not null
        );

        create table if not exists audit_events (
          id text primary key,
          operation_id text not null,
          user_id text,
          event_type text not null,
          description text not null,
          comment text,
          metadata text not null default '{}',
          created_at text not null
        );

        create table if not exists settings (
          key text primary key,
          value text not null,
          updated_at text not null
        );
        """
    )
    add_column_if_missing(conn, "accounts", "initial_balance", "real default 0")
    add_column_if_missing(conn, "accounts", "account_category", "text default 'operational'")
    add_column_if_missing(conn, "users", "password_hash", "text")
    add_column_if_missing(conn, "operations", "usd_amount", "real default 0")
    add_column_if_missing(conn, "operations", "ves_amount", "real default 0")
    add_column_if_missing(conn, "operations", "binance_rate", "real default 0")
    add_column_if_missing(conn, "operations", "spread", "real default 0")
    add_column_if_missing(conn, "operations", "executed_at", "text")
    add_column_if_missing(conn, "attachments", "stored_path", "text")
    add_column_if_missing(conn, "attachments", "content_type", "text")
    conn.commit()
    conn.close()
    seed_db()


def seed_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ts = now_iso()
    partner_id = "partner-yango"

    conn.execute("insert or ignore into partners values (?, ?, ?, ?)", (partner_id, "Yango", "active", ts))
    users = [
        ("usr-magna-admin", None, "Mesa Magna Equity", "ops@magnaequity.com", ROLE_MASTER, "active", ts),
        ("usr-yango-super", partner_id, "Aprobador Yango", "approver@yango.com", "super_approver", "active", ts),
        ("usr-yango-treasury", partner_id, "Tesoreria Yango", "treasury@yango.com", "treasury", "active", ts),
        ("usr-yango-finance", partner_id, "Finanzas Yango", "finance@yango.com", "finance", "active", ts),
    ]
    conn.executemany(
        """
        insert or ignore into users
        (id, partner_id, name, email, role, status, created_at)
        values (?, ?, ?, ?, ?, ?, ?)
        """,
        users,
    )
    conn.execute("update users set email = ? where id = ?", ("treasury@yango.com", "usr-yango-treasury"))
    for user_id, env_name in INITIAL_PASSWORD_ENVS.items():
        initial_password = os.environ.get(env_name)
        if initial_password:
            conn.execute(
                "update users set password_hash = coalesce(password_hash, ?) where id = ?",
                (generate_password_hash(initial_password, method="pbkdf2:sha256", salt_length=16), user_id),
            )
    accounts = [
        ("acct-ves-magna", partner_id, "magna", "Cuenta operativa VES", "Banco Nacional", "0102-0000-0000-0000", "Magna Equity", "bank", "VES", "", 0.35, 3850000, "", "Cuenta receptora de bolivares.", "active", ts, ts, 3850000, "operational"),
        ("acct-usd-magna", partner_id, "magna", "Custodia USD Magna", "BitGo", "", "Magna Equity", "wallet", "USD", "0x8d1...demo", 0, 132500, "https://www.bitgo.com/", "Wallet visible para consulta externa.", "active", ts, ts, 132500, "operational"),
        ("acct-ves-client", partner_id, "client", "Yango VES Settlement", "Banco Mercantil", "0105-1111-2222-3333", "Yango", "bank", "VES", "", 0.15, 1240000, "", "Cuenta cliente en bolivares.", "active", ts, ts, 1240000, "client"),
        ("acct-usd-client", partner_id, "client", "Yango USD Treasury", "BitGo", "USD-CUSTODY-001", "Yango", "wallet", "USD", "0xYango...demo", 0, 84000, "https://www.bitgo.com/", "Cuenta cliente en USD.", "active", ts, ts, 84000, "client"),
    ]
    conn.executemany(
        """
        insert or ignore into accounts
        (id, partner_id, owner, name, institution, account_number, beneficiary_name, account_type, currency,
         wallet_address, bank_fee_percent, balance, external_url, notes, status, created_at, updated_at,
         initial_balance, account_category)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        accounts,
    )
    beneficiaries = [
        ("ben-driver-partner", partner_id, "Partner Flota Caracas", "partner", "Banesco", "0134-1000-2000-3000", "corriente", "J-00000001-1", "VES", "active", ts),
        ("ben-provider-tech", partner_id, "Proveedor Tecnologia", "provider", "Provincial", "0108-2000-3000-4000", "corriente", "J-00000002-2", "VES", "active", ts),
    ]
    conn.executemany("insert or ignore into beneficiaries values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", beneficiaries)
    categories = [
        ("cat-pay-partners", "Pago a partners", "treasury_usage", "active", ts),
        ("cat-pay-providers", "Pago a proveedor", "treasury_usage", "active", ts),
    ]
    conn.executemany("insert or ignore into categories values (?, ?, ?, ?, ?)", categories)
    settings = [
        ("rate_expiration_minutes", "7", ts),
        ("buy_statuses", "draft,pending_approval,approved,rejected,expired,executed,completed", ts),
        ("sell_statuses", "pending_master,in_negotiation,rate_pending_approval,approved,rejected,expired,executed,completed", ts),
        ("payment_statuses", "draft,pending_funding,funded,in_process,paid,completed,rejected,cancelled", ts),
    ]
    conn.executemany(
        """
        insert into settings values (?, ?, ?)
        on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
        """,
        settings,
    )
    conn.commit()
    conn.close()


@app.before_request
def before_request():
    init_db()
    if request.path.startswith("/api"):
        expire_pending_rates()


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


def expire_pending_rates():
    rows = query(
        """
        select id from operations
        where status in ('pending_approval', 'rate_pending_approval')
        and expires_at is not null
        and datetime(expires_at) < datetime(?)
        """,
        (now_iso(),),
    )
    for row in rows:
        execute("update operations set status = 'expired', updated_at = ? where id = ?", (now_iso(), row["id"]))
        log_event(row["id"], "expired", "La solicitud expiro automaticamente por vigencia de tasa.")


def operation_payload(operation_id):
    op = query("select * from operations where id = ?", (operation_id,), one=True)
    if not op:
        return None
    data = row_to_dict(op)
    data["attachments"] = [row_to_dict(x) for x in query("select * from attachments where operation_id = ? order by created_at", (operation_id,))]
    data["events"] = [row_to_dict(x) for x in query("select * from audit_events where operation_id = ? order by created_at", (operation_id,))]
    return enrich_operation(data)


def enrich_operation(op):
    usd = Decimal(str(op.get("usd_amount") or 0))
    ves = Decimal(str(op.get("ves_amount") or 0))
    if usd == 0 and ves == 0:
        amount = Decimal(str(op.get("final_amount") or op.get("requested_amount") or 0))
        currency = op.get("final_currency") or op.get("requested_currency")
        if currency == "USD":
            usd = amount
        elif currency == "VES":
            ves = amount
    op["usd_amount"] = money(usd)
    op["ves_amount"] = money(ves)
    op["account_for_table"] = op.get("source_account_id") or op.get("destination_account_id")
    return op


@app.get("/api/bootstrap")
def bootstrap():
    operations = [operation_payload(row["id"]) for row in query("select id from operations order by created_at desc")]
    return jsonify(
        {
            "actor": actor(),
            "partners": [row_to_dict(x) for x in query("select * from partners order by name")],
            "users": [row_to_dict(x) for x in query("select * from users order by role, name")],
            "accounts": [row_to_dict(x) for x in query("select * from accounts where status != 'deleted' order by owner, currency, name")],
            "beneficiaries": [row_to_dict(x) for x in query("select * from beneficiaries where status != 'deleted' order by category, name")],
            "categories": [row_to_dict(x) for x in query("select * from categories where status != 'deleted' order by kind, name")],
            "operations": operations,
            "settings": {x["key"]: x["value"] for x in query("select * from settings")},
        }
    )


@app.post("/api/login")
def login():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = query("select * from users where lower(email) = ? and status = 'active'", (email,), one=True)
    if not user or not user["password_hash"] or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Credenciales invalidas."}), 401
    return jsonify({"user": row_to_dict(user), "role": user["role"]})


def password_hash_from_data(data, required=False):
    password = data.get("password") or ""
    if required and not password:
        return None, (jsonify({"error": "La clave es obligatoria."}), 400)
    if not password:
        return None, None
    if len(password) < 10:
        return None, (jsonify({"error": "La clave debe tener al menos 10 caracteres."}), 400)
    return generate_password_hash(password, method="pbkdf2:sha256", salt_length=16), None


@app.post("/api/users/<user_id>/password")
def update_user_password(user_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    password_hash, password_error = password_hash_from_data(data, required=True)
    if password_error:
        return password_error
    target = query("select * from users where id = ?", (user_id,), one=True)
    if not target:
        return jsonify({"error": "Usuario no encontrado."}), 404
    execute("update users set password_hash = ? where id = ?", (password_hash, user_id))
    return jsonify({"ok": True})


@app.post("/api/users")
def create_user():
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    password_hash, password_error = password_hash_from_data(data, required=True)
    if password_error:
        return password_error
    user_id = data.get("id") or make_id("USR")
    execute(
        """
        insert into users
        (id, partner_id, name, email, role, status, created_at, password_hash)
        values (?, ?, ?, ?, ?, 'active', ?, ?)
        """,
        (user_id, data.get("partner_id") or "partner-yango", data["name"], data["email"], data["role"], now_iso(), password_hash),
    )
    return jsonify({"user": row_to_dict(query("select * from users where id = ?", (user_id,), one=True))}), 201


@app.put("/api/users/<user_id>")
def update_user(user_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    password_hash, password_error = password_hash_from_data(data)
    if password_error:
        return password_error
    execute(
        "update users set name = ?, email = ?, role = ?, status = ?, partner_id = ? where id = ?",
        (data["name"], data["email"], data["role"], data.get("status", "active"), data.get("partner_id") or "partner-yango", user_id),
    )
    if password_hash:
        execute("update users set password_hash = ? where id = ?", (password_hash, user_id))
    return jsonify({"user": row_to_dict(query("select * from users where id = ?", (user_id,), one=True))})


@app.delete("/api/users/<user_id>")
def delete_user(user_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    execute("update users set status = 'inactive' where id = ?", (user_id,))
    return jsonify({"ok": True})


@app.post("/api/categories")
def create_category():
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    category_id = data.get("id") or make_id("CAT")
    execute("insert into categories values (?, ?, ?, 'active', ?)", (category_id, data["name"], data.get("kind", "treasury_usage"), now_iso()))
    return jsonify({"category": row_to_dict(query("select * from categories where id = ?", (category_id,), one=True))}), 201


@app.put("/api/categories/<category_id>")
def update_category(category_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    execute("update categories set name = ?, kind = ?, status = ? where id = ?", (data["name"], data.get("kind", "treasury_usage"), data.get("status", "active"), category_id))
    return jsonify({"category": row_to_dict(query("select * from categories where id = ?", (category_id,), one=True))})


@app.delete("/api/categories/<category_id>")
def delete_category(category_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    execute("update categories set status = 'deleted' where id = ?", (category_id,))
    return jsonify({"ok": True})


def account_payload(data, owner):
    return (
        data.get("partner_id") or "partner-yango",
        owner,
        data["name"],
        data.get("institution", ""),
        data.get("account_number", ""),
        data.get("beneficiary_name", data.get("holder", "")),
        data.get("account_type", "bank"),
        data.get("currency", "VES"),
        data.get("wallet_address", ""),
        money(data.get("bank_fee_percent", 0)),
        money(data.get("balance", data.get("initial_balance", 0))),
        data.get("external_url", ""),
        data.get("notes", ""),
        data.get("status", "active"),
        money(data.get("initial_balance", data.get("balance", 0))),
        "client" if owner == "client" else "operational",
    )


@app.post("/api/accounts")
def create_account():
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    owner = data.get("owner", "magna")
    account_id = make_id("ACCT")
    ts = now_iso()
    payload = account_payload(data, owner)
    execute(
        """
        insert into accounts
        (id, partner_id, owner, name, institution, account_number, beneficiary_name, account_type, currency,
         wallet_address, bank_fee_percent, balance, external_url, notes, status, created_at, updated_at,
         initial_balance, account_category)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (account_id, *payload[:14], ts, ts, payload[14], payload[15]),
    )
    return jsonify({"account": row_to_dict(query("select * from accounts where id = ?", (account_id,), one=True))}), 201


@app.put("/api/accounts/<account_id>")
def update_account(account_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    current = query("select * from accounts where id = ?", (account_id,), one=True)
    if not current:
        return jsonify({"error": "Cuenta no encontrada."}), 404
    owner = data.get("owner", current["owner"])
    payload = account_payload(data, owner)
    execute(
        """
        update accounts
        set partner_id = ?, owner = ?, name = ?, institution = ?, account_number = ?, beneficiary_name = ?,
            account_type = ?, currency = ?, wallet_address = ?, bank_fee_percent = ?, balance = ?,
            external_url = ?, notes = ?, status = ?, initial_balance = ?, account_category = ?, updated_at = ?
        where id = ?
        """,
        (*payload, now_iso(), account_id),
    )
    return jsonify({"account": row_to_dict(query("select * from accounts where id = ?", (account_id,), one=True))})


@app.delete("/api/accounts/<account_id>")
def delete_account(account_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    execute("update accounts set status = 'deleted', updated_at = ? where id = ?", (now_iso(), account_id))
    return jsonify({"ok": True})


@app.post("/api/beneficiaries")
def create_beneficiary():
    user, error = require_roles(ROLE_MASTER, *CLIENT_ROLES)
    if error:
        return error
    data = parse_json()
    beneficiary_id = make_id("BEN")
    execute(
        """
        insert into beneficiaries
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        """,
        (
            beneficiary_id,
            data.get("partner_id") or user.get("partner_id") or "partner-yango",
            data["name"],
            data["category"],
            data.get("bank", ""),
            data.get("account_number", ""),
            data.get("account_type", "corriente"),
            data.get("identification", ""),
            data.get("currency", "VES"),
            now_iso(),
        ),
    )
    return jsonify({"beneficiary": row_to_dict(query("select * from beneficiaries where id = ?", (beneficiary_id,), one=True))}), 201


@app.put("/api/beneficiaries/<beneficiary_id>")
def update_beneficiary(beneficiary_id):
    user, error = require_roles(ROLE_MASTER, *CLIENT_ROLES)
    if error:
        return error
    data = parse_json()
    execute(
        """
        update beneficiaries
        set name = ?, category = ?, bank = ?, account_number = ?, account_type = ?,
            identification = ?, currency = ?, status = ?
        where id = ?
        """,
        (
            data["name"],
            data["category"],
            data.get("bank", ""),
            data.get("account_number", ""),
            data.get("account_type", "corriente"),
            data.get("identification", ""),
            data.get("currency", "VES"),
            data.get("status", "active"),
            beneficiary_id,
        ),
    )
    return jsonify({"beneficiary": row_to_dict(query("select * from beneficiaries where id = ?", (beneficiary_id,), one=True))})


@app.delete("/api/beneficiaries/<beneficiary_id>")
def delete_beneficiary(beneficiary_id):
    user, error = require_roles(ROLE_MASTER, *CLIENT_ROLES)
    if error:
        return error
    execute("update beneficiaries set status = 'deleted' where id = ?", (beneficiary_id,))
    return jsonify({"ok": True})


def normalize_treasury_amounts(data):
    operation_side = data["operation_side"]
    input_currency = data.get("input_currency")
    rate = Decimal(str(data.get("expected_rate") or data.get("rate") or 0))
    usd_amount = Decimal(str(data.get("usd_amount") or 0))
    ves_amount = Decimal(str(data.get("ves_amount") or 0))
    if input_currency == "USD" and usd_amount and rate:
        ves_amount = (usd_amount * rate).quantize(Decimal("0.01"))
    if input_currency == "VES" and ves_amount and rate:
        usd_amount = (ves_amount / rate).quantize(Decimal("0.01"))
    op_type = "buy_usd" if operation_side == "buy" else "sell_usd"
    if op_type == "buy_usd":
        usd_signed = abs(usd_amount)
        ves_signed = -abs(ves_amount)
    else:
        usd_signed = -abs(usd_amount)
        ves_signed = abs(ves_amount)
    return op_type, money(usd_signed), money(ves_signed)


@app.post("/api/treasury-requests")
def create_treasury_request():
    user, error = require_roles(ROLE_MASTER, *CLIENT_ROLES)
    if error:
        return error
    data = request.form.to_dict()
    if request.is_json:
        data = request.get_json(force=True)
    op_type, usd_amount, ves_amount = normalize_treasury_amounts(data)
    operation_id = make_id("BUY" if op_type == "buy_usd" else "SELL")
    ts = now_iso()
    metadata = {
        "usage_category_id": data.get("usage_category_id"),
        "input_currency": data.get("input_currency"),
        "comment": data.get("comment", ""),
        "document_type": data.get("document_type", ""),
    }
    execute(
        """
        insert into operations
        (id, partner_id, type, status, reason, requested_currency, requested_amount, rate,
         source_account_id, destination_account_id, beneficiary_id, final_currency, final_amount,
         created_by, metadata, usd_amount, ves_amount, created_at, updated_at)
        values (?, ?, ?, 'pending_master', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            operation_id,
            data.get("partner_id") or user.get("partner_id") or "partner-yango",
            op_type,
            data.get("reason") or ("Compra USD" if op_type == "buy_usd" else "Venta USD"),
            data.get("input_currency") or "USD",
            money(data.get("usd_amount") or data.get("ves_amount") or 0),
            money(data.get("expected_rate") or 0),
            data.get("source_account_id") or None,
            data.get("destination_account_id") or None,
            data.get("beneficiary_id") or None,
            "USD" if data.get("input_currency") == "USD" else "VES",
            abs(usd_amount if data.get("input_currency") == "USD" else ves_amount),
            user["id"],
            json.dumps(metadata),
            usd_amount,
            ves_amount,
            ts,
            ts,
        ),
    )
    log_event(operation_id, "created", "Solicitud de tesoreria creada.", user["id"], data.get("comment"))
    save_request_files(operation_id, user["id"])
    return jsonify({"operation": operation_payload(operation_id)}), 201


@app.post("/api/operations/<operation_id>/status")
def update_operation_status(operation_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    status = data["status"]
    execute("update operations set status = ?, updated_at = ? where id = ?", (status, now_iso(), operation_id))
    log_event(operation_id, "status_changed", f"Master cambio estatus a {status}.", user["id"], data.get("comment"))
    return jsonify({"operation": operation_payload(operation_id)})


@app.post("/api/operations/<operation_id>/rate")
def set_operation_rate(operation_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    op = operation_payload(operation_id)
    if not op:
        return jsonify({"error": "Operacion no encontrada."}), 404
    rate = Decimal(str(data["rate"]))
    binance_rate = Decimal(str(data.get("binance_rate") or 0))
    spread = Decimal("0")
    if binance_rate:
        spread = ((rate - binance_rate) / binance_rate * Decimal("100")).quantize(Decimal("0.01"))
    minutes = int(get_setting("rate_expiration_minutes", "7"))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).replace(microsecond=0).isoformat()
    usd_amount = Decimal(str(op["usd_amount"]))
    ves_amount = Decimal(str(op["ves_amount"]))
    if usd_amount and not ves_amount:
        ves_amount = -usd_amount * rate if op["type"] == "buy_usd" else abs(usd_amount) * rate
    if ves_amount and not usd_amount:
        usd_amount = abs(ves_amount) / rate
        usd_amount = usd_amount if op["type"] == "buy_usd" else -usd_amount
    execute(
        """
        update operations
        set status = 'rate_pending_approval', rate = ?, binance_rate = ?, spread = ?,
            source_account_id = coalesce(?, source_account_id),
            destination_account_id = coalesce(?, destination_account_id),
            usd_amount = ?, ves_amount = ?, expires_at = ?, updated_at = ?
        where id = ?
        """,
        (
            money(rate),
            money(binance_rate),
            money(spread),
            data.get("source_account_id"),
            data.get("destination_account_id"),
            money(usd_amount),
            money(ves_amount),
            expires_at,
            now_iso(),
            operation_id,
        ),
    )
    log_event(operation_id, "rate_loaded", "Master cargo tasa y referencia Binance.", user["id"], data.get("comment"), {"spread": money(spread)})
    return jsonify({"operation": operation_payload(operation_id)})


@app.post("/api/operations/<operation_id>/decision")
def decide_operation(operation_id):
    user, error = require_roles(*CLIENT_ROLES)
    if error:
        return error
    data = parse_json()
    comment = (data.get("comment") or "").strip()
    if not comment:
        return jsonify({"error": "El comentario es obligatorio para trazabilidad."}), 400
    decision = data.get("decision")
    status = "approved" if decision == "approve" else "rejected"
    execute("update operations set status = ?, approved_by = ?, updated_at = ? where id = ?", (status, user["id"], now_iso(), operation_id))
    log_event(operation_id, status, f"Cliente marco la operacion como {status}.", user["id"], comment)
    return jsonify({"operation": operation_payload(operation_id)})


def save_request_files(operation_id, user_id):
    for key, file in request.files.items():
        if not file or not file.filename:
            continue
        label = request.form.get(f"{key}_label") or key.replace("_", " ").title()
        store_attachment(operation_id, label, file, user_id)


def store_attachment(operation_id, label, file, user_id):
    original = secure_filename(file.filename) or "attachment"
    folder = UPLOAD_DIR / operation_id
    folder.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}_{original}"
    stored_path = f"{operation_id}/{stored_name}"
    file.save(folder / stored_name)
    content_type = file.mimetype or mimetypes.guess_type(original)[0] or "application/octet-stream"
    attachment_id = make_id("ATT")
    execute(
        """
        insert into attachments
        (id, operation_id, label, filename, uploaded_by, created_at, stored_path, content_type)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (attachment_id, operation_id, label, original, user_id, now_iso(), stored_path, content_type),
    )
    log_event(operation_id, "attachment_added", f"Soporte cargado: {label}.", user_id, original)


@app.post("/api/operations/<operation_id>/attachments")
def upload_operation_attachment(operation_id):
    user, error = require_roles(ROLE_MASTER, *CLIENT_ROLES)
    if error:
        return error
    save_request_files(operation_id, user["id"])
    return jsonify({"operation": operation_payload(operation_id)})


def update_balance(account_id, delta, reason, operation_id):
    if not account_id:
        return
    account = query("select * from accounts where id = ?", (account_id,), one=True)
    if not account:
        return
    new_balance = money(account["balance"] + delta)
    execute("update accounts set balance = ?, updated_at = ? where id = ?", (new_balance, now_iso(), account_id))
    log_event(operation_id, "balance_updated", f"{reason}: {delta:+,.2f} {account['currency']}", metadata={"account_id": account_id, "new_balance": new_balance})


@app.post("/api/operations/<operation_id>/execute")
def execute_operation(operation_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = request.form.to_dict() if not request.is_json else request.get_json(force=True)
    op = operation_payload(operation_id)
    if not op:
        return jsonify({"error": "Operacion no encontrada."}), 404
    source_account = data.get("source_account_id") or op.get("source_account_id")
    destination_account = data.get("destination_account_id") or op.get("destination_account_id")
    usd_amount = money(data.get("usd_amount", op.get("usd_amount") or 0))
    ves_amount = money(data.get("ves_amount", op.get("ves_amount") or 0))
    execute(
        """
        update operations
        set status = 'executed', source_account_id = ?, destination_account_id = ?,
            usd_amount = ?, ves_amount = ?, executed_at = ?, updated_at = ?
        where id = ?
        """,
        (source_account, destination_account, usd_amount, ves_amount, now_iso(), now_iso(), operation_id),
    )
    save_request_files(operation_id, user["id"])
    if op["type"] == "buy_usd":
        update_balance(source_account, ves_amount, "Salida VES por compra USD", operation_id)
        update_balance(destination_account, usd_amount, "Entrada USD por compra", operation_id)
    elif op["type"] == "sell_usd":
        update_balance(source_account, usd_amount, "Salida USD por venta", operation_id)
        update_balance(destination_account, ves_amount, "Entrada VES por venta", operation_id)
    elif op["type"] == "payment":
        update_balance(source_account, -abs(ves_amount or op.get("requested_amount") or 0), "Dispersion de pago", operation_id)
    log_event(operation_id, "executed", "Master ejecuto la operacion y cargo soportes.", user["id"], data.get("comment"))
    return jsonify({"operation": operation_payload(operation_id)})


@app.post("/api/operations/<operation_id>/complete")
def complete_operation(operation_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    execute("update operations set status = 'completed', updated_at = ? where id = ?", (now_iso(), operation_id))
    log_event(operation_id, "completed", "Operacion cerrada y conciliada.", user["id"])
    return jsonify({"operation": operation_payload(operation_id)})


@app.post("/api/settings")
def update_settings():
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    for key, value in data.items():
        set_setting(key, value)
    return jsonify({"settings": {x["key"]: x["value"] for x in query("select * from settings")}})


@app.get("/api/operations/<operation_id>")
def get_operation(operation_id):
    op = operation_payload(operation_id)
    if not op:
        return jsonify({"error": "Operacion no encontrada."}), 404
    return jsonify({"operation": op})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)), debug=True)
