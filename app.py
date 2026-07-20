import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DATABASE_PATH", BASE_DIR / "partnerportal.db"))
UPLOAD_DIR = BASE_DIR / "uploads"

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def money(value):
    return float(Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def make_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def db():
    if "db" not in g:
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
    data = dict(row)
    for key in ("metadata", "rules"):
        if key in data and data[key]:
            data[key] = json.loads(data[key])
    return data


def actor():
    role = request.headers.get("X-Role") or request.args.get("role") or "magna_admin"
    user = query("select * from users where role = ? order by id limit 1", (role,), one=True)
    if not user:
        user = query("select * from users where role = 'magna_admin' limit 1", one=True)
    return row_to_dict(user)


def require_roles(*roles):
    user = actor()
    if user["role"] not in roles:
        return None, (jsonify({"error": "No tienes permisos para esta accion."}), 403)
    return user, None


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


def update_balance(account_id, delta, reason, operation_id):
    account = query("select * from accounts where id = ?", (account_id,), one=True)
    if not account:
        return
    new_balance = money(account["balance"] + delta)
    execute("update accounts set balance = ?, updated_at = ? where id = ?", (new_balance, now_iso(), account_id))
    log_event(operation_id, "balance_updated", f"{reason}: {delta:+,.2f} {account['currency']}", metadata={"account_id": account_id, "new_balance": new_balance})


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


def init_db():
    UPLOAD_DIR.mkdir(exist_ok=True)
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
          created_at text not null,
          foreign key(partner_id) references partners(id)
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
          created_at text not null,
          foreign key(operation_id) references operations(id)
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
    conn.commit()
    conn.close()
    seed_db()


def seed_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    exists = conn.execute("select id from partners limit 1").fetchone()
    if exists:
        conn.close()
        return

    ts = now_iso()
    partner_id = "partner-yango"
    conn.execute("insert into partners values (?, ?, ?, ?)", (partner_id, "Yango", "active", ts))
    users = [
        ("usr-magna-admin", None, "Mesa Magna Equity", "ops@magnaequity.com", "magna_admin", "active", ts),
        ("usr-yango-super", partner_id, "Aprobador Yango", "approver@yango.com", "super_approver", "active", ts),
        ("usr-yango-treasury", partner_id, "Tesoreria Yango", "treasury", "treasury", "active", ts),
        ("usr-yango-finance", partner_id, "Finanzas Yango", "finance@yango.com", "finance", "active", ts),
    ]
    conn.executemany("insert into users values (?, ?, ?, ?, ?, ?, ?)", users)
    accounts = [
        ("acct-ves-magna", partner_id, "magna", "Cuenta operativa VES", "Banco Nacional", "0102-0000-0000-0000", "Magna Equity", "bank", "VES", "", 0.35, 3850000, "", "Cuenta receptora de bolivares.", "active", ts, ts),
        ("acct-usd-magna", partner_id, "magna", "Custodia USD Magna", "BitGo", "", "Magna Equity", "wallet", "USD", "0x8d1...demo", 0, 132500, "https://www.bitgo.com/", "Wallet visible para consulta externa.", "active", ts, ts),
        ("acct-ves-payments", partner_id, "magna", "Cuenta dispersion VES", "Banco Mercantil", "0105-1111-2222-3333", "Magna Equity", "bank", "VES", "", 0.15, 1240000, "", "Cuenta de salida para pagos.", "active", ts, ts),
    ]
    conn.executemany("insert into accounts values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", accounts)
    beneficiaries = [
        ("ben-driver-partner", partner_id, "Partner Flota Caracas", "partner", "Banesco", "0134-1000-2000-3000", "corriente", "J-00000001-1", "VES", "active", ts),
        ("ben-provider-tech", partner_id, "Proveedor Tecnologia", "provider", "Provincial", "0108-2000-3000-4000", "corriente", "J-00000002-2", "VES", "active", ts),
    ]
    conn.executemany("insert into beneficiaries values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", beneficiaries)
    settings = [
        ("rate_expiration_minutes", "7", ts),
        ("buy_statuses", "draft,pending_approval,approved,rejected,expired,executed,completed", ts),
        ("sell_statuses", "request_created,in_review,rate_pending_approval,approved,in_process,executed,completed,expired", ts),
        ("payment_statuses", "draft,pending_funding,funded,in_process,paid,completed,rejected,cancelled", ts),
    ]
    conn.executemany("insert into settings values (?, ?, ?)", settings)
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


@app.get("/api/bootstrap")
def bootstrap():
    current_actor = actor()
    operations = [operation_payload(row["id"]) for row in query("select id from operations order by created_at desc")]
    return jsonify(
        {
            "actor": current_actor,
            "partners": [row_to_dict(x) for x in query("select * from partners order by name")],
            "users": [row_to_dict(x) for x in query("select * from users order by role, name")],
            "accounts": [row_to_dict(x) for x in query("select * from accounts order by currency, name")],
            "beneficiaries": [row_to_dict(x) for x in query("select * from beneficiaries order by category, name")],
            "operations": operations,
            "settings": {x["key"]: x["value"] for x in query("select * from settings")},
        }
    )


def operation_payload(operation_id):
    op = query("select * from operations where id = ?", (operation_id,), one=True)
    if not op:
        return None
    data = row_to_dict(op)
    data["attachments"] = [row_to_dict(x) for x in query("select * from attachments where operation_id = ? order by created_at", (operation_id,))]
    data["events"] = [row_to_dict(x) for x in query("select * from audit_events where operation_id = ? order by created_at", (operation_id,))]
    return data


@app.post("/api/partners")
def create_partner():
    user, error = require_roles("magna_admin")
    if error:
        return error
    data = request.get_json(force=True)
    partner_id = make_id("PARTNER")
    execute("insert into partners values (?, ?, 'active', ?)", (partner_id, data["name"], now_iso()))
    return jsonify({"partner": row_to_dict(query("select * from partners where id = ?", (partner_id,), one=True))}), 201


@app.post("/api/accounts")
def create_account():
    user, error = require_roles("magna_admin")
    if error:
        return error
    data = request.get_json(force=True)
    account_id = make_id("ACCT")
    ts = now_iso()
    execute(
        """
        insert into accounts
        values (?, ?, 'magna', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        """,
        (
            account_id,
            data.get("partner_id", "partner-yango"),
            data["name"],
            data.get("institution", ""),
            data.get("account_number", ""),
            data.get("beneficiary_name", "Magna Equity"),
            data.get("account_type", "bank"),
            data.get("currency", "VES"),
            data.get("wallet_address", ""),
            money(data.get("bank_fee_percent", 0)),
            money(data.get("balance", 0)),
            data.get("external_url", ""),
            data.get("notes", ""),
            ts,
            ts,
        ),
    )
    return jsonify({"account": row_to_dict(query("select * from accounts where id = ?", (account_id,), one=True))}), 201


@app.post("/api/beneficiaries")
def create_beneficiary():
    user, error = require_roles("magna_admin", "super_approver", "treasury", "finance")
    if error:
        return error
    data = request.get_json(force=True)
    beneficiary_id = make_id("BEN")
    execute(
        """
        insert into beneficiaries
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        """,
        (
            beneficiary_id,
            data.get("partner_id", user.get("partner_id") or "partner-yango"),
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


@app.post("/api/buy-requests")
def create_buy_request():
    user, error = require_roles("magna_admin")
    if error:
        return error
    data = request.get_json(force=True)
    ves_amount = Decimal(str(data["ves_amount"]))
    rate = Decimal(str(data["rate"]))
    account = query("select * from accounts where id = ?", (data["ves_account_id"],), one=True)
    fee_percent = Decimal(str(data.get("bank_fee_percent", account["bank_fee_percent"] if account else 0)))
    fee_amount = (ves_amount * fee_percent / Decimal("100")).quantize(Decimal("0.01"))
    net_ves = ves_amount - fee_amount
    usd_amount = (net_ves / rate).quantize(Decimal("0.01"))
    minutes = int(get_setting("rate_expiration_minutes", "7"))
    operation_id = make_id("BUY")
    ts = now_iso()
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).replace(microsecond=0).isoformat()
    execute(
        """
        insert into operations
        (id, partner_id, type, status, reason, requested_currency, requested_amount, rate,
         bank_fee_percent, bank_fee_amount, source_account_id, destination_account_id,
         final_currency, final_amount, created_by, expires_at, metadata, created_at, updated_at)
        values (?, ?, 'buy_usd', 'pending_approval', ?, 'VES', ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?)
        """,
        (
            operation_id,
            data.get("partner_id", "partner-yango"),
            data.get("reason", "Compra de dolares"),
            money(ves_amount),
            money(rate),
            money(fee_percent),
            money(fee_amount),
            data["ves_account_id"],
            data["usd_account_id"],
            money(usd_amount),
            user["id"],
            expires_at,
            json.dumps({"net_ves": money(net_ves), "expiration_minutes": minutes}),
            ts,
            ts,
        ),
    )
    log_event(operation_id, "created", f"Magna creo solicitud de compra por {money(usd_amount):,.2f} USD.", user["id"])
    return jsonify({"operation": operation_payload(operation_id)}), 201


@app.post("/api/sell-requests")
def create_sell_request():
    user, error = require_roles("super_approver", "treasury", "finance")
    if error:
        return error
    data = request.get_json(force=True)
    operation_id = make_id("SELL")
    ts = now_iso()
    execute(
        """
        insert into operations
        (id, partner_id, type, status, reason, requested_currency, requested_amount, final_currency,
         created_by, metadata, created_at, updated_at)
        values (?, ?, 'sell_usd', 'in_review', ?, 'VES', ?, 'VES', ?, ?, ?, ?)
        """,
        (
            operation_id,
            user["partner_id"],
            data["reason"],
            money(data["ves_needed"]),
            user["id"],
            json.dumps({"usage_type": data.get("usage_type", "payment")}),
            ts,
            ts,
        ),
    )
    log_event(operation_id, "created", "Yango solicito bolivares; se autogenero venta de USD para Magna.", user["id"], data.get("comment"))
    return jsonify({"operation": operation_payload(operation_id)}), 201


@app.post("/api/payments")
def create_payment():
    user, error = require_roles("super_approver", "finance")
    if error:
        return error
    data = request.get_json(force=True)
    sale_id = make_id("SELL")
    payment_id = make_id("PAY")
    ts = now_iso()
    execute(
        """
        insert into operations
        (id, partner_id, type, status, reason, requested_currency, requested_amount, beneficiary_id,
         final_currency, created_by, metadata, created_at, updated_at)
        values (?, ?, 'sell_usd', 'in_review', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            sale_id,
            user["partner_id"],
            f"Fondeo para pago: {data['payment_type']}",
            data.get("currency", "VES"),
            money(data["amount"]),
            data["beneficiary_id"],
            data.get("currency", "VES"),
            user["id"],
            json.dumps({"usage_type": data["payment_type"], "source": "payment_request"}),
            ts,
            ts,
        ),
    )
    execute(
        """
        insert into operations
        (id, partner_id, type, status, reason, requested_currency, requested_amount, beneficiary_id,
         linked_operation_id, final_currency, created_by, metadata, created_at, updated_at)
        values (?, ?, 'payment', 'pending_funding', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payment_id,
            user["partner_id"],
            data["payment_type"],
            data.get("currency", "VES"),
            money(data["amount"]),
            data["beneficiary_id"],
            sale_id,
            data.get("currency", "VES"),
            user["id"],
            json.dumps({"document_type": data.get("document_type", "invoice"), "notes": data.get("notes", "")}),
            ts,
            ts,
        ),
    )
    log_event(sale_id, "created", "Venta de USD autogenerada para fondear pago.", user["id"], data.get("notes"))
    log_event(payment_id, "created", "Solicitud de pago creada y vinculada a venta de USD.", user["id"], data.get("notes"), {"linked_sale": sale_id})
    if data.get("support_name"):
        add_attachment(payment_id, "Soporte documental", data["support_name"], user["id"])
    return jsonify({"payment": operation_payload(payment_id), "sale": operation_payload(sale_id)}), 201


@app.post("/api/sell-requests/<operation_id>/rate")
def set_sell_rate(operation_id):
    user, error = require_roles("magna_admin")
    if error:
        return error
    data = request.get_json(force=True)
    minutes = int(get_setting("rate_expiration_minutes", "7"))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).replace(microsecond=0).isoformat()
    requested_amount = Decimal(str(query("select requested_amount from operations where id = ?", (operation_id,), one=True)["requested_amount"]))
    rate = Decimal(str(data["rate"]))
    usd_to_sell = (requested_amount / rate).quantize(Decimal("0.01"))
    execute(
        """
        update operations
        set status = 'rate_pending_approval', rate = ?, final_currency = 'USD', final_amount = ?,
            source_account_id = ?, destination_account_id = ?, expires_at = ?, updated_at = ?, metadata = json_set(metadata, '$.expiration_minutes', ?)
        where id = ? and type = 'sell_usd'
        """,
        (money(rate), money(usd_to_sell), data["usd_account_id"], data["ves_account_id"], expires_at, now_iso(), minutes, operation_id),
    )
    log_event(operation_id, "rate_loaded", f"Magna cargo tasa para vender {money(usd_to_sell):,.2f} USD.", user["id"], data.get("comment"))
    return jsonify({"operation": operation_payload(operation_id)})


@app.post("/api/operations/<operation_id>/decision")
def decide_operation(operation_id):
    user, error = require_roles("super_approver", "treasury", "finance")
    if error:
        return error
    data = request.get_json(force=True)
    comment = (data.get("comment") or "").strip()
    decision = data.get("decision")
    if not comment:
        return jsonify({"error": "El comentario es obligatorio para trazabilidad."}), 400
    op = query("select * from operations where id = ?", (operation_id,), one=True)
    if not op:
        return jsonify({"error": "Operacion no encontrada."}), 404
    if op["status"] == "expired":
        return jsonify({"error": "La solicitud ya expiro. Magna debe emitir una nueva tasa."}), 400
    new_status = "approved" if decision == "approve" else "rejected"
    execute("update operations set status = ?, approved_by = ?, updated_at = ? where id = ?", (new_status, user["id"], now_iso(), operation_id))
    log_event(operation_id, new_status, f"Yango marco la operacion como {new_status}.", user["id"], comment)
    return jsonify({"operation": operation_payload(operation_id)})


def add_attachment(operation_id, label, filename, user_id):
    attachment_id = make_id("ATT")
    execute(
        "insert into attachments values (?, ?, ?, ?, ?, ?)",
        (attachment_id, operation_id, label, filename, user_id, now_iso()),
    )
    log_event(operation_id, "attachment_added", f"Soporte cargado: {label}.", user_id, filename)


@app.post("/api/operations/<operation_id>/execute")
def execute_operation(operation_id):
    user, error = require_roles("magna_admin")
    if error:
        return error
    data = request.get_json(force=True)
    op = query("select * from operations where id = ?", (operation_id,), one=True)
    if not op:
        return jsonify({"error": "Operacion no encontrada."}), 404
    final_amount = money(data.get("final_amount", op["final_amount"] or op["requested_amount"]))
    status = "paid" if op["type"] == "payment" else "executed"
    execute(
        """
        update operations
        set status = ?, final_amount = ?, source_account_id = coalesce(?, source_account_id),
            destination_account_id = coalesce(?, destination_account_id), updated_at = ?
        where id = ?
        """,
        (status, final_amount, data.get("source_account_id"), data.get("destination_account_id"), now_iso(), operation_id),
    )
    for item in data.get("attachments", []):
        if item.get("filename"):
            add_attachment(operation_id, item.get("label", "Soporte"), item["filename"], user["id"])

    refreshed = query("select * from operations where id = ?", (operation_id,), one=True)
    if refreshed["type"] == "buy_usd":
        update_balance(refreshed["source_account_id"], money(refreshed["requested_amount"]), "Recepcion de bolivares", operation_id)
        update_balance(refreshed["source_account_id"], -money(refreshed["bank_fee_amount"]), "Comision bancaria categorizada", operation_id)
        update_balance(refreshed["destination_account_id"], money(refreshed["final_amount"]), "Recepcion de dolares", operation_id)
    elif refreshed["type"] == "sell_usd":
        update_balance(refreshed["source_account_id"], -money(refreshed["final_amount"]), "Salida de dolares vendidos", operation_id)
        update_balance(refreshed["destination_account_id"], money(refreshed["requested_amount"]), "Recepcion de bolivares por venta", operation_id)
        linked_payment = query("select id from operations where linked_operation_id = ? and type = 'payment'", (operation_id,), one=True)
        if linked_payment:
            execute("update operations set status = 'funded', updated_at = ? where id = ?", (now_iso(), linked_payment["id"]))
            log_event(linked_payment["id"], "funded", "Pago marcado como fondeado por venta ejecutada.", user["id"], metadata={"sale_id": operation_id})
    elif refreshed["type"] == "payment":
        update_balance(refreshed["source_account_id"], -final_amount, "Dispersion de pago", operation_id)

    log_event(operation_id, "executed", "Magna ejecuto la operacion.", user["id"], data.get("comment"))
    return jsonify({"operation": operation_payload(operation_id)})


@app.post("/api/operations/<operation_id>/complete")
def complete_operation(operation_id):
    user, error = require_roles("magna_admin")
    if error:
        return error
    execute("update operations set status = 'completed', updated_at = ? where id = ?", (now_iso(), operation_id))
    log_event(operation_id, "completed", "Operacion cerrada y conciliada.", user["id"], request.get_json(silent=True, force=False) or {})
    return jsonify({"operation": operation_payload(operation_id)})


@app.post("/api/settings")
def update_settings():
    user, error = require_roles("magna_admin")
    if error:
        return error
    data = request.get_json(force=True)
    ts = now_iso()
    for key, value in data.items():
        execute(
            "insert into settings(key, value, updated_at) values (?, ?, ?) on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at",
            (key, str(value), ts),
        )
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
