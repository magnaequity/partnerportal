import json
import mimetypes
import os
import shutil
import sqlite3
import uuid
from io import BytesIO
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from flask import Flask, g, jsonify, request, send_file, send_from_directory
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
BINANCE_RATE_URL = "https://consulta-rates.insularcambios.com/v1/tasas/binance"
RATE_EDITABLE_STATUSES = ("pending_master", "in_negotiation", "rate_pending_approval", "expired")
UNASSIGNED_USE = "unassigned_use"
INCREASE_POSITION_USE = "increase_position"
DEFAULT_CURRENCIES = ("USD", "VES")
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
    requested_role = request.headers.get("X-Role") or request.args.get("role")
    if user_id:
        user = query("select * from users where id = ? and status = 'active'", (user_id,), one=True)
        if user:
            user_data = row_to_dict(user)
            if not requested_role or user_data["role"] == requested_role:
                return user_data
    return None


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


def normalize_currency(value, default="VES"):
    cleaned = "".join(ch for ch in str(value or default).upper().strip() if ch.isalnum())
    return cleaned or default


def normalize_currency_list(value):
    seen = set()
    currencies = []
    for item in str(value or "").replace("\n", ",").split(","):
        currency = normalize_currency(item, "")
        if currency and currency not in seen:
            seen.add(currency)
            currencies.append(currency)
    for currency in DEFAULT_CURRENCIES:
        if currency not in seen:
            currencies.append(currency)
            seen.add(currency)
    return ",".join(currencies)


def add_column_if_missing(conn, table, column, definition):
    columns = [row[1] for row in conn.execute(f"pragma table_info({table})").fetchall()]
    if column not in columns:
        conn.execute(f"alter table {table} add column {column} {definition}")


def migrate_expected_rates(conn):
    rows = conn.execute(
        """
        select id, type, status, rate, metadata
        from operations
        where type in ('buy_usd', 'sell_usd')
        """
    ).fetchall()
    for row in rows:
        try:
            metadata = json.loads(row["metadata"] or "{}")
        except json.JSONDecodeError:
            metadata = {}
        changed = False
        if row["type"] == "buy_usd" and metadata.get("usage_key") != INCREASE_POSITION_USE:
            metadata["usage_key"] = INCREASE_POSITION_USE
            metadata["usage_category_id"] = INCREASE_POSITION_USE
            metadata["use_unassigned"] = False
            changed = True
        is_pre_master_rate = row["status"] in ("pending_master", "in_negotiation") and row["rate"]
        if is_pre_master_rate and not metadata.get("expected_rate"):
            metadata["expected_rate"] = money(row["rate"])
            conn.execute("update operations set rate = null where id = ?", (row["id"],))
            changed = True
        if changed:
            conn.execute("update operations set metadata = ? where id = ?", (json.dumps(metadata), row["id"]))


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
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
          management_fee_percent real default 0,
          management_fee_amount real default 0,
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
    add_column_if_missing(conn, "operations", "bank_fee_percent", "real default 0")
    add_column_if_missing(conn, "operations", "bank_fee_amount", "real default 0")
    add_column_if_missing(conn, "operations", "management_fee_percent", "real default 0")
    add_column_if_missing(conn, "operations", "management_fee_amount", "real default 0")
    add_column_if_missing(conn, "operations", "binance_rate", "real default 0")
    add_column_if_missing(conn, "operations", "spread", "real default 0")
    add_column_if_missing(conn, "operations", "executed_at", "text")
    add_column_if_missing(conn, "attachments", "stored_path", "text")
    add_column_if_missing(conn, "attachments", "content_type", "text")
    migrate_expected_rates(conn)
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
        ("binance_range_percent", "1", ts),
        ("binance_fee_percent", "0", ts),
        ("buy_management_fee_percent", "0", ts),
        ("sell_management_fee_percent", "0", ts),
        ("trade_report_language", "en", ts),
        ("currencies", "USD,VES", ts),
        ("buy_statuses", "draft,pending_approval,approved,rejected,expired,executed,completed", ts),
        ("sell_statuses", "pending_master,in_negotiation,rate_pending_approval,approved,rejected,expired,executed,completed", ts),
        ("payment_statuses", "draft,pending_funding,funded,in_process,paid,completed,rejected,cancelled", ts),
    ]
    conn.executemany(
        """
        insert or ignore into settings values (?, ?, ?)
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


@app.get("/favicon.ico")
def favicon():
    return send_from_directory(app.static_folder, "assets/favicon.png", mimetype="image/png")


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
    current_user = actor()
    if not current_user:
        return jsonify({"error": "Sesion expirada. Inicia sesion nuevamente."}), 401
    operations = [operation_payload(row["id"]) for row in query("select id from operations order by created_at desc")]
    return jsonify(
        {
            "actor": current_user,
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
        normalize_currency(data.get("currency", "VES")),
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
            normalize_currency(data.get("currency", "VES")),
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
            normalize_currency(data.get("currency", "VES")),
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


def parse_payment_allocations(data, target_ves_amount=None, required=False, require_proofs=False, files=None):
    raw_allocations = data.get("payment_allocations") or "[]"
    if isinstance(raw_allocations, str):
        try:
            raw_allocations = json.loads(raw_allocations)
        except json.JSONDecodeError:
            return None, Decimal("0"), "La distribucion de beneficiarios no es valida."
    if not isinstance(raw_allocations, list):
        return None, Decimal("0"), "La distribucion de beneficiarios no es valida."
    allocations = []
    seen = set()
    total = Decimal("0")
    for item in raw_allocations:
        beneficiary_id = (item.get("beneficiary_id") or "").strip()
        if not beneficiary_id:
            continue
        if beneficiary_id in seen:
            return None, Decimal("0"), "Cada beneficiario solo puede aparecer una vez."
        beneficiary = query("select * from beneficiaries where id = ? and status != 'deleted'", (beneficiary_id,), one=True)
        if not beneficiary:
            return None, Decimal("0"), "Uno de los beneficiarios seleccionados no existe."
        amount = Decimal(str(item.get("amount_ves") or item.get("amount") or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if amount <= 0:
            return None, Decimal("0"), "Cada beneficiario debe tener un monto mayor a cero."
        proof_field = (item.get("proof_field") or f"payment_proof_{beneficiary_id}").strip()
        if require_proofs and (not files or proof_field not in files or not files[proof_field].filename):
            return None, Decimal("0"), "Cada beneficiario debe tener su factura, nota de entrega o soporte."
        seen.add(beneficiary_id)
        total += amount
        allocations.append(
            {
                "beneficiary_id": beneficiary_id,
                "beneficiary_name": beneficiary["name"],
                "beneficiary_category": beneficiary["category"],
                "amount_ves": money(amount),
                "proof_field": proof_field,
                "proof_attachment_id": item.get("proof_attachment_id"),
                "proof_filename": item.get("proof_filename"),
                "proof_stored_path": item.get("proof_stored_path"),
                "proof_content_type": item.get("proof_content_type"),
            }
        )
    if required and not allocations:
        return None, Decimal("0"), "Debes seleccionar al menos un beneficiario para la venta."
    if target_ves_amount is not None and total != abs(Decimal(str(target_ves_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)):
        return None, total, "La suma por beneficiario debe ser igual al total VES de la venta."
    return allocations, total, None


def recalculate_amounts_for_rate(op, rate):
    target_currency = (op.get("final_currency") or op.get("requested_currency") or "").upper()
    target_amount = Decimal(str(op.get("final_amount") or op.get("requested_amount") or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if not target_amount:
        return Decimal(str(op["usd_amount"])), Decimal(str(op["ves_amount"]))
    if op["type"] == "sell_usd":
        if target_currency == "VES":
            ves_amount = abs(target_amount)
            usd_amount = -(ves_amount / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            usd_amount = -abs(target_amount)
            ves_amount = (abs(usd_amount) * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    elif op["type"] == "buy_usd":
        if target_currency == "VES":
            ves_amount = -abs(target_amount)
            usd_amount = (abs(ves_amount) / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            usd_amount = abs(target_amount)
            ves_amount = -(usd_amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        usd_amount = Decimal(str(op["usd_amount"]))
        ves_amount = Decimal(str(op["ves_amount"]))
    return usd_amount, ves_amount


def bank_fee_for_operation(op_type, ves_amount, source_account_id=None, destination_account_id=None):
    if op_type not in ("buy_usd", "payment"):
        return Decimal("0"), Decimal("0")
    account = query("select currency, bank_fee_percent from accounts where id = ?", (source_account_id or destination_account_id,), one=True)
    if not account or account["currency"] != "VES":
        return Decimal("0"), Decimal("0")
    fee_percent = Decimal(str(account["bank_fee_percent"] or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    fee_amount = (abs(Decimal(str(ves_amount or 0))) * fee_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return fee_percent, fee_amount


def management_fee_for_operation(op_type, usd_amount):
    if op_type not in ("buy_usd", "sell_usd"):
        return Decimal("0"), Decimal("0")
    setting_key = "buy_management_fee_percent" if op_type == "buy_usd" else "sell_management_fee_percent"
    fee_percent = Decimal(str(get_setting(setting_key, "0") or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    fee_amount = (abs(Decimal(str(usd_amount or 0))) * fee_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return fee_percent, fee_amount


def decimal_setting(key, default="0"):
    return Decimal(str(get_setting(key, default) or default))


def binance_validation(rate, binance_rate=None):
    reference = Decimal(str(binance_rate or 0))
    range_pct = decimal_setting("binance_range_percent", "1")
    lower = Decimal("0")
    upper = Decimal("0")
    within_range = None
    if reference > 0:
        lower = (reference * (Decimal("1") - range_pct / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        upper = (reference * (Decimal("1") + range_pct / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        within_range = lower <= rate <= upper
    return {
        "range_percent": money(range_pct),
        "lower": money(lower),
        "upper": money(upper),
        "within_range": within_range,
    }


@app.get("/api/rates/binance")
def get_binance_rate():
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    pct = request.args.get("pct")
    if pct is None:
        pct = get_setting("binance_fee_percent", "0")
    try:
        pct_decimal = Decimal(str(pct or 0))
        query_string = urlencode({"pct": str(pct_decimal)})
        with urlopen(f"{BINANCE_RATE_URL}?{query_string}", timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        return jsonify({"error": f"No se pudo consultar la tasa Binance: {exc}"}), 502
    if not payload.get("ok"):
        return jsonify({"error": "La fuente Binance no respondio OK."}), 502
    rate = Decimal(str(payload.get("tasa") or 0))
    validation = binance_validation(rate, rate)
    return jsonify(
        {
            "source": BINANCE_RATE_URL,
            "rate": money(rate),
            "consulted_at": payload.get("consultadoEn"),
            "raw": payload,
            "validation": validation,
        }
    )


@app.post("/api/treasury-requests")
def create_treasury_request():
    user, error = require_roles(*CLIENT_ROLES)
    if error:
        return error
    data = request.form.to_dict()
    if request.is_json:
        data = request.get_json(force=True)
    op_type, usd_amount, ves_amount = normalize_treasury_amounts(data)
    usage_category_id = data.get("usage_category_id")
    if op_type == "buy_usd":
        usage_category_id = INCREASE_POSITION_USE
    requires_payment_allocation = op_type == "sell_usd" and usage_category_id != UNASSIGNED_USE
    allocation_target = ves_amount if requires_payment_allocation else None
    allocations, _allocation_total, allocation_error = parse_payment_allocations(
        data,
        allocation_target,
        required=requires_payment_allocation,
        require_proofs=requires_payment_allocation,
        files=request.files,
    )
    if allocation_error:
        return jsonify({"error": allocation_error}), 400
    operation_id = make_id("BUY" if op_type == "buy_usd" else "SELL")
    ts = now_iso()
    metadata = {
        "usage_category_id": usage_category_id,
        "use_unassigned": usage_category_id == UNASSIGNED_USE,
        "usage_key": INCREASE_POSITION_USE if op_type == "buy_usd" else "",
        "expected_rate": money(data.get("expected_rate") or 0),
        "input_currency": data.get("input_currency"),
        "comment": data.get("comment", ""),
        "document_type": data.get("document_type", ""),
        "payment_allocations": allocations or [],
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
            data.get("reason") or ("Aumentar posicion" if op_type == "buy_usd" else "Venta USD"),
            data.get("input_currency") or "USD",
            money(data.get("usd_amount") or data.get("ves_amount") or 0),
            None,
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
    saved_attachments = save_request_files(operation_id, user["id"])
    attachments_by_field = {attachment["field"]: attachment for attachment in saved_attachments}
    for allocation in allocations or []:
        attachment = attachments_by_field.get(allocation.get("proof_field"))
        if attachment:
            allocation["proof_attachment_id"] = attachment["id"]
            allocation["proof_filename"] = attachment["filename"]
            allocation["proof_stored_path"] = attachment["stored_path"]
            allocation["proof_content_type"] = attachment["content_type"]
    if allocations:
        metadata["payment_allocations"] = allocations
        execute("update operations set metadata = ? where id = ?", (json.dumps(metadata), operation_id))
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
    if op["status"] not in RATE_EDITABLE_STATUSES:
        return jsonify({"error": "La tasa solo puede editarse antes de la aprobacion del cliente."}), 400
    rate = Decimal(str(data["rate"]))
    if rate <= 0:
        return jsonify({"error": "La tasa debe ser mayor a cero."}), 400
    binance_rate = Decimal(str(data.get("binance_rate") or 0))
    spread = Decimal("0")
    if binance_rate:
        spread = ((rate - binance_rate) / binance_rate * Decimal("100")).quantize(Decimal("0.01"))
    minutes = int(get_setting("rate_expiration_minutes", "7"))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).replace(microsecond=0).isoformat()
    usd_amount, ves_amount = recalculate_amounts_for_rate(op, rate)
    validation = binance_validation(rate, binance_rate)
    rate_only_update = op["status"] in ("rate_pending_approval", "expired")
    source_account_id = None if rate_only_update else data.get("source_account_id")
    destination_account_id = None if rate_only_update else data.get("destination_account_id")
    effective_source_account_id = source_account_id or op.get("source_account_id")
    effective_destination_account_id = destination_account_id or op.get("destination_account_id")
    bank_fee_percent, bank_fee_amount = bank_fee_for_operation(op["type"], ves_amount, effective_source_account_id, effective_destination_account_id)
    management_fee_percent, management_fee_amount = management_fee_for_operation(op["type"], usd_amount)
    metadata = op.get("metadata") if isinstance(op.get("metadata"), dict) else {}
    metadata["binance_snapshot"] = {
        "reference_rate": money(binance_rate),
        "operation_rate": money(rate),
        "range_percent": validation["range_percent"],
        "lower": validation["lower"],
        "upper": validation["upper"],
        "within_range": validation["within_range"],
        "consulted_at": data.get("binance_consulted_at"),
        "source": data.get("binance_source") or BINANCE_RATE_URL,
    }
    execute(
        """
        update operations
        set status = 'rate_pending_approval', rate = ?, binance_rate = ?, spread = ?,
            source_account_id = coalesce(?, source_account_id),
            destination_account_id = coalesce(?, destination_account_id),
            usd_amount = ?, ves_amount = ?, bank_fee_percent = ?, bank_fee_amount = ?,
            management_fee_percent = ?, management_fee_amount = ?,
            metadata = ?, expires_at = ?, updated_at = ?
        where id = ?
        """,
        (
            money(rate),
            money(binance_rate),
            money(spread),
            source_account_id,
            destination_account_id,
            money(usd_amount),
            money(ves_amount),
            money(bank_fee_percent),
            money(bank_fee_amount),
            money(management_fee_percent),
            money(management_fee_amount),
            json.dumps(metadata),
            expires_at,
            now_iso(),
            operation_id,
        ),
    )
    description = "Master edito tasa y reinicio vigencia." if rate_only_update else "Master cargo tasa y referencia Binance."
    log_event(operation_id, "rate_loaded", description, user["id"], data.get("comment"), {"spread": money(spread), "binance_validation": validation})
    return jsonify({"operation": operation_payload(operation_id)})


@app.post("/api/operations/<operation_id>/decision")
def decide_operation(operation_id):
    user, error = require_roles(*CLIENT_ROLES)
    if error:
        return error
    data = parse_json()
    op = operation_payload(operation_id)
    if not op:
        return jsonify({"error": "Operacion no encontrada."}), 404
    if op["status"] != "rate_pending_approval":
        return jsonify({"error": "Solo se pueden aprobar o rechazar tasas pendientes de aprobacion."}), 400
    comment = (data.get("comment") or "").strip()
    if not comment:
        return jsonify({"error": "El comentario es obligatorio para trazabilidad."}), 400
    decision = data.get("decision")
    status = "approved" if decision == "approve" else "rejected"
    execute("update operations set status = ?, approved_by = ?, updated_at = ? where id = ?", (status, user["id"], now_iso(), operation_id))
    log_event(operation_id, status, f"Cliente marco la operacion como {status}.", user["id"], comment)
    return jsonify({"operation": operation_payload(operation_id)})


def save_request_files(operation_id, user_id):
    saved = []
    for key, file in request.files.items():
        if not file or not file.filename:
            continue
        label = request.form.get(f"{key}_label") or key.replace("_", " ").title()
        attachment = store_attachment(operation_id, label, file, user_id)
        attachment["field"] = key
        saved.append(attachment)
    return saved


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
    return {
        "id": attachment_id,
        "operation_id": operation_id,
        "label": label,
        "filename": original,
        "stored_path": stored_path,
        "content_type": content_type,
    }


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
    delta_decimal = Decimal(str(delta or 0))
    new_balance = money(Decimal(str(account["balance"] or 0)) + delta_decimal)
    execute("update accounts set balance = ?, updated_at = ? where id = ?", (new_balance, now_iso(), account_id))
    log_event(operation_id, "balance_updated", f"{reason}: {delta_decimal:+,.2f} {account['currency']}", metadata={"account_id": account_id, "new_balance": new_balance})


def copy_attachment_to_operation(source_attachment_id, target_operation_id, label, user_id):
    source = query("select * from attachments where id = ?", (source_attachment_id,), one=True)
    if not source or not source["stored_path"]:
        return None
    source_path = UPLOAD_DIR / source["stored_path"]
    if not source_path.exists():
        return None
    folder = UPLOAD_DIR / target_operation_id
    folder.mkdir(parents=True, exist_ok=True)
    original = source["filename"] or "attachment"
    stored_name = f"{uuid.uuid4().hex}_{secure_filename(original) or 'attachment'}"
    stored_path = f"{target_operation_id}/{stored_name}"
    shutil.copy2(source_path, folder / stored_name)
    attachment_id = make_id("ATT")
    content_type = source["content_type"] or mimetypes.guess_type(original)[0] or "application/octet-stream"
    execute(
        """
        insert into attachments
        (id, operation_id, label, filename, uploaded_by, created_at, stored_path, content_type)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (attachment_id, target_operation_id, label, original, user_id, now_iso(), stored_path, content_type),
    )
    log_event(target_operation_id, "attachment_added", f"Soporte cargado: {label}.", user_id, original)
    return attachment_id


def create_payment_requests_from_sale(sale_op, allocations, source_account_id, user_id):
    ts = now_iso()
    created_ids = []
    for allocation in allocations:
        payment_id = make_id("PAY")
        beneficiary_id = allocation["beneficiary_id"]
        beneficiary_name = allocation.get("beneficiary_name") or beneficiary_id
        amount = money(allocation["amount_ves"])
        payment_type = "partner" if allocation.get("beneficiary_category") == "partner" else "provider"
        bank_fee_percent, bank_fee_amount = bank_fee_for_operation("payment", amount, source_account_id)
        metadata = {
            "payment_type": payment_type,
            "source_sale_operation_id": sale_op["id"],
            "auto_generated": True,
        }
        execute(
            """
            insert into operations
            (id, partner_id, type, status, reason, requested_currency, requested_amount, rate,
             source_account_id, destination_account_id, beneficiary_id, linked_operation_id,
             final_currency, final_amount, created_by, metadata, usd_amount, ves_amount,
             bank_fee_percent, bank_fee_amount, created_at, updated_at)
            values (?, ?, 'payment', 'funded', ?, 'VES', ?, ?, ?, ?, ?, ?, 'VES', ?, ?, ?, 0, ?, ?, ?, ?, ?)
            """,
            (
                payment_id,
                sale_op["partner_id"],
                f"Pago a {beneficiary_name}",
                amount,
                sale_op.get("rate") or 0,
                source_account_id,
                None,
                beneficiary_id,
                sale_op["id"],
                amount,
                user_id,
                json.dumps(metadata),
                -abs(amount),
                money(bank_fee_percent),
                money(bank_fee_amount),
                ts,
                ts,
            ),
        )
        log_event(payment_id, "created", f"Solicitud de pago autogenerada desde {sale_op['id']}.", user_id)
        if allocation.get("proof_attachment_id"):
            copy_attachment_to_operation(allocation["proof_attachment_id"], payment_id, "Factura / nota de entrega", user_id)
        created_ids.append(payment_id)
    log_event(sale_op["id"], "payment_requests_created", f"Se generaron {len(created_ids)} solicitudes de pago.", user_id, metadata={"payment_ids": created_ids})
    return created_ids


@app.post("/api/operations/<operation_id>/execute")
def execute_operation(operation_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = request.form.to_dict() if not request.is_json else request.get_json(force=True)
    op = operation_payload(operation_id)
    if not op:
        return jsonify({"error": "Operacion no encontrada."}), 404
    if op["type"] == "payment":
        if op["status"] not in ("funded", "in_process", "approved"):
            return jsonify({"error": "Solo se pueden completar pagos fondeados o aprobados."}), 400
        required_files = ("payment_execution_support",)
    else:
        if op["status"] != "approved":
            return jsonify({"error": "Solo se pueden completar operaciones aprobadas."}), 400
        required_files = ("ves_exit_support",) if op["type"] == "buy_usd" else ("usd_exit_support",)
    missing_files = [key for key in required_files if key not in request.files or not request.files[key].filename]
    if missing_files:
        return jsonify({"error": "Debes cargar los soportes requeridos para completar la operacion."}), 400
    source_account = data.get("source_account_id") or op.get("source_account_id")
    destination_account = data.get("destination_account_id") or op.get("destination_account_id")
    if op["type"] == "payment":
        usd_amount = money(op.get("usd_amount") or 0)
        ves_amount = money(op.get("ves_amount") or op.get("requested_amount") or op.get("final_amount") or 0)
        ves_amount = -abs(ves_amount or op.get("requested_amount") or op.get("final_amount") or 0)
    else:
        usd_amount = money(op.get("usd_amount") or 0)
        ves_amount = money(op.get("ves_amount") or 0)
    bank_fee_percent, bank_fee_amount = bank_fee_for_operation(op["type"], ves_amount, source_account, destination_account)
    management_fee_percent, management_fee_amount = management_fee_for_operation(op["type"], usd_amount)
    allocations = []
    if op["type"] == "sell_usd":
        allocation_items = metadata_value(op, "payment_allocations", [])
        if allocation_items:
            allocations, _allocation_total, allocation_error = parse_payment_allocations(
                {"payment_allocations": allocation_items},
                ves_amount,
                required=True,
            )
            if allocation_error:
                return jsonify({"error": allocation_error}), 400
    execute(
        """
        update operations
        set status = 'completed', source_account_id = ?, destination_account_id = ?,
            usd_amount = ?, ves_amount = ?, bank_fee_percent = ?, bank_fee_amount = ?,
            management_fee_percent = ?, management_fee_amount = ?,
            executed_at = ?, updated_at = ?
        where id = ?
        """,
        (
            source_account,
            destination_account,
            usd_amount,
            ves_amount,
            money(bank_fee_percent),
            money(bank_fee_amount),
            money(management_fee_percent),
            money(management_fee_amount),
            now_iso(),
            now_iso(),
            operation_id,
        ),
    )
    save_request_files(operation_id, user["id"])
    if op["type"] == "buy_usd":
        update_balance(source_account, Decimal(str(ves_amount)) - bank_fee_amount, "Salida VES por compra USD y comision bancaria", operation_id)
        update_balance(destination_account, usd_amount, "Entrada USD por compra", operation_id)
    elif op["type"] == "sell_usd":
        update_balance(source_account, usd_amount, "Salida USD por venta", operation_id)
        update_balance(destination_account, ves_amount, "Entrada VES por venta", operation_id)
        if allocations:
            create_payment_requests_from_sale({**op, "destination_account_id": destination_account}, allocations, destination_account, user["id"])
    elif op["type"] == "payment":
        update_balance(source_account, -abs(Decimal(str(ves_amount or op.get("requested_amount") or 0))) - bank_fee_amount, "Dispersion de pago y comision bancaria", operation_id)
    log_event(operation_id, "completed", "Master completo la operacion y cargo los soportes requeridos.", user["id"], data.get("comment"))
    return jsonify({"operation": operation_payload(operation_id)})


@app.post("/api/operations/<operation_id>/complete")
def complete_operation(operation_id):
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    return jsonify({"error": "Completa la operacion cargando los soportes requeridos desde el flujo de completar."}), 400


REPORT_LABELS = {
    "en": {
        "title": "Trade Report",
        "subtitle": "Automated transaction report prepared from Partner Portal records.",
        "completed": "COMPLETED",
        "category": "Category",
        "partner": "Partner",
        "usage": "Use",
        "executed_rate": "Executed rate",
        "binance": "Binance",
        "spread": "Spread vs Binance",
        "fees": "Fees",
        "bank_fee": "Bank Fee",
        "bank_fee_short": "Bank",
        "management_fee_short": "Mgmt",
        "management_fee": "Management Fee",
        "narrative": "Executive Narrative",
        "settlement": "Settlement Accounts",
        "timeline": "Audit Timeline",
        "role": "Role",
        "account": "Account",
        "institution": "Institution / Platform",
        "currency": "Currency",
        "holder": "Holder",
        "source": "Source",
        "destination": "Destination",
        "time": "Time",
        "event": "Event",
        "comment": "Comment",
        "footer": "Magna Equity - Confidential Trade Report",
        "buy_usd": "Buy USD",
        "sell_usd": "Sell USD",
        "payment": "Payment",
        "not_available": "not available",
        "created_request": "created a treasury request for",
        "loaded_rate": "Magna Equity loaded an execution rate of",
        "compared": "compared against a Binance reference of",
        "recorded_spread": "resulting in a recorded spread of",
        "approved": "The client approved the rate on",
        "completed_on": "The transaction was completed on",
        "support_registered": "with support documentation registered in the portal.",
        "fee_summary": "The transaction generated a bank fee of <b>{bank_fee}</b> ({bank_fee_percent}) and a management fee of <b>{management_fee}</b> ({management_fee_percent}).",
        "generated": "Generated",
        "operation": "Operation",
        "on": "On",
    },
    "es": {
        "title": "Reporte de Trade",
        "subtitle": "Reporte automatico preparado desde los registros del Partner Portal.",
        "completed": "COMPLETADA",
        "category": "Categoria",
        "partner": "Partner",
        "usage": "Uso",
        "executed_rate": "Tasa ejecutada",
        "binance": "Binance",
        "spread": "Spread vs Binance",
        "fees": "Comisiones",
        "bank_fee": "Comision bancaria",
        "bank_fee_short": "Bancaria",
        "management_fee_short": "Mgmt",
        "management_fee": "Management Fee",
        "narrative": "Resumen Ejecutivo",
        "settlement": "Cuentas de Liquidacion",
        "timeline": "Timeline de Auditoria",
        "role": "Rol",
        "account": "Cuenta",
        "institution": "Banco / Plataforma",
        "currency": "Moneda",
        "holder": "Titular",
        "source": "Salida",
        "destination": "Entrada",
        "time": "Hora",
        "event": "Evento",
        "comment": "Comentario",
        "footer": "Magna Equity - Reporte confidencial de trade",
        "buy_usd": "Compra USD",
        "sell_usd": "Venta USD",
        "payment": "Pago",
        "not_available": "no disponible",
        "created_request": "creo una solicitud de tesoreria para",
        "loaded_rate": "Magna Equity cargo una tasa ejecutada de",
        "compared": "comparada contra una referencia Binance de",
        "recorded_spread": "dejando un spread registrado de",
        "approved": "El cliente aprobo la tasa el",
        "completed_on": "La transaccion fue completada el",
        "support_registered": "con soportes documentales registrados en el portal.",
        "fee_summary": "La transaccion genero una comision bancaria de <b>{bank_fee}</b> ({bank_fee_percent}) y un management fee de <b>{management_fee}</b> ({management_fee_percent}).",
        "generated": "Generado",
        "operation": "Operacion",
        "on": "El",
    },
}


def report_language():
    language = get_setting("trade_report_language", "en")
    return language if language in REPORT_LABELS else "en"


def report_type_label(op_type, language):
    return REPORT_LABELS[language].get(op_type, op_type or "-")


def report_datetime(value):
    if not value:
        return "-"
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone(timedelta(hours=-4)))
    except ValueError:
        return "-"
    return dt.strftime("%d %b %Y, %I:%M %p VET")


def report_money(value, currency="", signed=False):
    decimal = Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    prefix = "+" if signed and decimal > 0 else ""
    suffix = f" {currency}" if currency else ""
    return f"{prefix}{decimal:,.2f}{suffix}"


def report_percent(value):
    return f"{Decimal(str(value or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):,.2f}%"


def report_account_amounts(op, account):
    currency = (account or {}).get("currency")
    usd_amount = Decimal("0")
    ves_amount = Decimal("0")
    if currency == "USD":
        usd_amount = Decimal(str(op.get("usd_amount") or 0))
    if currency == "VES":
        ves_amount = Decimal(str(op.get("ves_amount") or 0))
    return usd_amount, ves_amount


def append_pdf_attachments(writer, attachments):
    from pypdf import PdfReader

    for attachment in attachments:
        stored_path = attachment.get("stored_path")
        if not stored_path:
            continue
        file_path = UPLOAD_DIR / stored_path
        if not file_path.exists():
            continue
        content_type = attachment.get("content_type") or mimetypes.guess_type(attachment.get("filename") or "")[0] or ""
        try:
            if "pdf" in content_type.lower() or file_path.suffix.lower() == ".pdf":
                with file_path.open("rb") as stream:
                    if stream.read(4) != b"%PDF":
                        continue
                reader = PdfReader(str(file_path))
                for page in reader.pages:
                    writer.add_page(page)
            elif content_type.lower().startswith("image/") or file_path.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
                if not valid_report_image(file_path):
                    continue
                image_pdf = BytesIO()
                draw_attachment_image_page(image_pdf, attachment, file_path)
                image_pdf.seek(0)
                reader = PdfReader(image_pdf)
                for page in reader.pages:
                    writer.add_page(page)
        except Exception:
            continue


def valid_report_image(file_path):
    try:
        from PIL import Image

        with Image.open(file_path) as image:
            image.verify()
        return True
    except Exception:
        return False


def draw_attachment_image_page(buffer, attachment, file_path):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    navy = colors.HexColor("#082C3A")
    cyan = colors.HexColor("#58C6E4")
    muted = colors.HexColor("#6B7F89")
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    margin = 42
    c.setFillColor(navy)
    c.rect(0, height - 72, width, 72, fill=1, stroke=0)
    c.setFillColor(cyan)
    c.rect(margin, height - 88, width - margin * 2, 3, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawRightString(width - margin, height - 35, attachment.get("label") or "Support Documentation")
    c.setFillColor(muted)
    c.setFont("Helvetica", 8)
    c.drawString(margin, height - 118, attachment.get("filename") or "")
    try:
        c.drawImage(str(file_path), margin, 90, width=width - margin * 2, height=height - 230, preserveAspectRatio=True, anchor="c", mask="auto")
    except Exception:
        c.setFillColor(muted)
        c.drawString(margin, height / 2, "Image preview unavailable.")
    c.showPage()
    c.save()


def generate_trade_report(operation_id):
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.pdfgen import canvas
    from reportlab.platypus import Paragraph, Table, TableStyle

    op = operation_payload(operation_id)
    if not op:
        return None, "Operacion no encontrada."
    if op["status"] not in ("completed", "executed"):
        return None, "Solo se pueden generar reportes de operaciones completadas."

    language = report_language()
    labels = REPORT_LABELS[language]
    metadata = op.get("metadata") if isinstance(op.get("metadata"), dict) else {}
    partner = row_to_dict(query("select * from partners where id = ?", (op["partner_id"],), one=True)) or {}
    creator = row_to_dict(query("select * from users where id = ?", (op.get("created_by"),), one=True)) or {}
    source_account = row_to_dict(query("select * from accounts where id = ?", (op.get("source_account_id"),), one=True)) or {}
    destination_account = row_to_dict(query("select * from accounts where id = ?", (op.get("destination_account_id"),), one=True)) or {}
    category = row_to_dict(query("select * from categories where id = ?", (metadata.get("usage_category_id"),), one=True)) or {}
    events = op.get("events") or []
    attachments = op.get("attachments") or []
    approval_event = next((event for event in events if event.get("event_type") == "approved"), None)
    execution_event = next((event for event in events if event.get("event_type") in ("completed", "executed")), None)

    navy = colors.HexColor("#082C3A")
    teal = colors.HexColor("#1FA4C4")
    cyan = colors.HexColor("#58C6E4")
    gold = colors.HexColor("#F5B700")
    green = colors.HexColor("#198F5B")
    red = colors.HexColor("#BE3548")
    muted = colors.HexColor("#6B7F89")
    border = colors.HexColor("#D8E5EA")
    soft = colors.HexColor("#F5FAFC")
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    margin = 42
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle("ReportBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.6, leading=12, textColor=navy)

    def draw_header():
        c.setFillColor(colors.white)
        c.rect(0, 0, width, height, fill=1, stroke=0)
        watermark = BASE_DIR / "static/assets/magna-watermark.jpg"
        if watermark.exists():
            c.saveState()
            c.setFillAlpha(0.055)
            c.drawImage(str(watermark), width - 190, height - 235, width=145, height=240, mask="auto", preserveAspectRatio=True)
            c.restoreState()
        c.setFillColor(navy)
        c.rect(0, height - 72, width, 72, fill=1, stroke=0)
        c.setFillColor(teal)
        c.rect(0, height - 72, 16, 72, fill=1, stroke=0)
        c.setFillColor(cyan)
        c.rect(16, height - 72, 6, 72, fill=1, stroke=0)
        c.setFillColor(gold)
        c.rect(22, height - 72, 3, 72, fill=1, stroke=0)
        logo = BASE_DIR / "static/assets/magna-logo.jpg"
        if logo.exists():
            c.drawImage(str(logo), margin, height - 55, width=104, height=46, preserveAspectRatio=True, mask="auto")
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 18)
        c.drawRightString(width - margin, height - 35, labels["title"])
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#CDEDF6"))
        generated_at = datetime.now(timezone(timedelta(hours=-4))).strftime("%d %b %Y, %I:%M %p VET")
        c.drawRightString(width - margin, height - 50, f"{labels['operation']} {op['id']} - {labels['generated']} {generated_at}")
        c.setFillColor(cyan)
        c.rect(margin, height - 88, width - margin * 2, 3, fill=1, stroke=0)

    def draw_footer():
        c.setStrokeColor(border)
        c.line(margin, 34, width - margin, 34)
        c.setFillColor(muted)
        c.setFont("Helvetica", 7)
        c.drawString(margin, 22, labels["footer"])
        c.drawRightString(width - margin, 22, "Page 1")

    def draw_card(x, y, label, value, card_width, color=navy):
        c.setFillColor(soft)
        c.roundRect(x, y - 45, card_width, 45, 8, fill=1, stroke=0)
        c.setStrokeColor(border)
        c.roundRect(x, y - 45, card_width, 45, 8, fill=0, stroke=1)
        c.setFillColor(muted)
        c.setFont("Helvetica-Bold", 6.8)
        c.drawString(x + 10, y - 15, label.upper())
        c.setFillColor(color)
        value_lines = list(value) if isinstance(value, (list, tuple)) else [str(value or "-")]
        value_lines = value_lines[:2] or ["-"]
        for line_index, line in enumerate(value_lines):
            font_size = 8.5 if len(value_lines) > 1 else 10.2
            if stringWidth(str(line), "Helvetica-Bold", font_size) > card_width - 20:
                font_size = 7.4 if len(value_lines) > 1 else 8.6
            c.setFont("Helvetica-Bold", font_size)
            c.drawString(x + 10, y - (29 + line_index * 11), str(line))

    def draw_cards(y, cards):
        gap = 10
        card_width = (width - margin * 2 - gap * 2) / 3
        for idx, card in enumerate(cards):
            draw_card(margin + idx * (card_width + gap), y, card[0], card[1], card_width, card[2] if len(card) > 2 else navy)

    def draw_paragraph(text, x, y, paragraph_width):
        paragraph = Paragraph(text, body_style)
        _, paragraph_height = paragraph.wrap(paragraph_width, 500)
        paragraph.drawOn(c, x, y - paragraph_height)
        return y - paragraph_height

    spread = Decimal(str(op.get("spread") or 0))
    binance_rate = Decimal(str(op.get("binance_rate") or 0))
    range_pct = Decimal(str(get_setting("binance_range_percent", "1") or 1))
    binance_status = "-"
    if binance_rate:
        binance_status = "OK" if abs(spread) <= range_pct else "NO OK"
    status_label = labels["completed"] if op["status"] in ("completed", "executed") else str(op["status"]).upper()
    usage = category.get("name") or metadata.get("usage_category_id") or "-"
    if language == "en":
        usage_map = {"Pago a partners": "Partner payment", "Pago a proveedor": "Provider payment", INCREASE_POSITION_USE: "Increase position", UNASSIGNED_USE: "Use not determined"}
        usage = usage_map.get(usage, usage)
    bank_fee_amount = Decimal(str(op.get("bank_fee_amount") or 0))
    bank_fee_percent = Decimal(str(op.get("bank_fee_percent") or 0))
    management_fee_amount = Decimal(str(op.get("management_fee_amount") or 0))
    management_fee_percent = Decimal(str(op.get("management_fee_percent") or 0))
    fees_card = [
        f"{labels['bank_fee_short']}: {report_money(bank_fee_amount, 'VES')}",
        f"{labels['management_fee_short']}: {report_money(management_fee_amount, 'USD')}",
    ]

    draw_header()
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(margin, height - 126, op["id"])
    c.setFont("Helvetica", 8)
    c.setFillColor(muted)
    c.drawString(margin, height - 141, labels["subtitle"])
    c.setFillColor(green)
    c.roundRect(width - margin - 106, height - 137, 106, 24, 12, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(width - margin - 53, height - 129, status_label)

    top = height - 181
    draw_cards(top, [(labels["category"], report_type_label(op["type"], language)), (labels["partner"], partner.get("name", "-")), (labels["usage"], usage)])
    top -= 55
    draw_cards(
        top,
        [
            ("USD", report_money(op.get("usd_amount"), "USD", True), red if Decimal(str(op.get("usd_amount") or 0)) < 0 else green),
            ("VES", report_money(op.get("ves_amount"), "VES", True), green if Decimal(str(op.get("ves_amount") or 0)) >= 0 else red),
            (labels["executed_rate"], report_money(op.get("rate"))),
        ],
    )
    top -= 55
    draw_cards(
        top,
        [
            (labels["binance"], report_money(op.get("binance_rate")) if binance_rate else "-"),
            (labels["spread"], f"{report_percent(op.get('spread'))} / {binance_status}", green if binance_status == "OK" else red if binance_status == "NO OK" else navy),
            (labels["fees"], fees_card),
        ],
    )
    top -= 66

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin, top, labels["narrative"])
    top -= 9
    reference_rate = report_money(op.get("binance_rate")) if binance_rate else labels["not_available"]
    narrative = (
        f"{labels['on']} <b>{report_datetime(op.get('created_at'))}</b>, <b>{creator.get('name', 'Client')}</b> {labels['created_request']} "
        f"<b>{report_type_label(op['type'], language)}</b>. {labels['loaded_rate']} <b>{report_money(op.get('rate'))}</b>, "
        f"{labels['compared']} <b>{reference_rate}</b>, {labels['recorded_spread']} <b>{report_percent(op.get('spread'))}</b>. "
        f"{labels['approved']} <b>{report_datetime(approval_event.get('created_at') if approval_event else None)}</b>. "
        f"{labels['completed_on']} <b>{report_datetime(op.get('executed_at') or (execution_event.get('created_at') if execution_event else None))}</b>, "
        f"{labels['support_registered']} "
        f"{labels['fee_summary'].format(bank_fee=report_money(bank_fee_amount, 'VES'), bank_fee_percent=report_percent(bank_fee_percent), management_fee=report_money(management_fee_amount, 'USD'), management_fee_percent=report_percent(management_fee_percent))}"
    )
    top = draw_paragraph(narrative, margin, top, width - margin * 2) - 14

    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(navy)
    c.drawString(margin, top, labels["settlement"])
    top -= 12
    source_usd, source_ves = report_account_amounts(op, source_account)
    destination_usd, destination_ves = report_account_amounts(op, destination_account)
    account_data = [
        [labels["role"], labels["account"], labels["institution"], labels["currency"], "USD", "VES", labels["holder"]],
        [labels["source"], source_account.get("name", "-"), source_account.get("institution") or source_account.get("wallet_address") or "-", source_account.get("currency", "-"), report_money(source_usd, "USD", True), report_money(source_ves, "VES", True), source_account.get("beneficiary_name", "-")],
        [labels["destination"], destination_account.get("name", "-"), destination_account.get("institution") or destination_account.get("wallet_address") or "-", destination_account.get("currency", "-"), report_money(destination_usd, "USD", True), report_money(destination_ves, "VES", True), destination_account.get("beneficiary_name", "-")],
    ]
    table = Table(account_data, colWidths=[50, 112, 112, 45, 70, 70, 58])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), navy),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.8),
                ("TEXTCOLOR", (0, 1), (-1, -1), navy),
                ("GRID", (0, 0), (-1, -1), 0.35, border),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    _, table_height = table.wrap(width - margin * 2, 100)
    table.drawOn(c, margin, top - table_height)
    top -= table_height + 18

    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(navy)
    c.drawString(margin, top, labels["timeline"])
    top -= 12
    rows = [[labels["time"], labels["event"], labels["comment"]]]
    for event in events[:8]:
        rows.append([report_datetime(event.get("created_at")), event.get("description", "-"), event.get("comment") or "-"])
    timeline = Table(rows, colWidths=[106, 270, 114])
    timeline.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAF7FB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), navy),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.6),
                ("TEXTCOLOR", (0, 1), (-1, -1), navy),
                ("GRID", (0, 0), (-1, -1), 0.3, border),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    _, timeline_height = timeline.wrap(width - margin * 2, 180)
    timeline.drawOn(c, margin, max(52, top - timeline_height))
    draw_footer()
    c.showPage()
    c.save()
    buffer.seek(0)

    writer = PdfWriter()
    reader = PdfReader(buffer)
    for page in reader.pages:
        writer.add_page(page)
    append_pdf_attachments(writer, attachments)
    output = BytesIO()
    writer.write(output)
    output.seek(0)
    return output, None


@app.get("/api/operations/<operation_id>/report")
def download_operation_report(operation_id):
    user, error = require_roles(ROLE_MASTER, *CLIENT_ROLES)
    if error:
        return error
    report, report_error = generate_trade_report(operation_id)
    if report_error:
        return jsonify({"error": report_error}), 400
    return send_file(
        report,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"trade-report-{operation_id}.pdf",
    )


@app.post("/api/settings")
def update_settings():
    user, error = require_roles(ROLE_MASTER)
    if error:
        return error
    data = parse_json()
    for key, value in data.items():
        if key == "currencies":
            value = normalize_currency_list(value)
        if key == "trade_report_language":
            value = value if value in ("es", "en") else "en"
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
