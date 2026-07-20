const state = {
  role: localStorage.getItem("partnerportal_role") || "magna_admin",
  data: null,
  selectedOperationId: null,
};

const views = {
  dashboard: "Dashboard operativo",
  approvals: "Bandeja de aprobaciones",
  operations: "Libro de operaciones",
  payments: "Pagos y dispersión",
  accounts: "Cuentas y beneficiarios",
  balances: "Saldos y conciliación",
  admin: "Administración Magna",
};

const money = (value, currency = "") =>
  new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(value || 0)) + (currency ? ` ${currency}` : "");

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

function headers() {
  return { "Content-Type": "application/json", "X-Role": state.role };
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "No se pudo completar la acción.");
  return body;
}

function toast(message) {
  const node = qs("#toast");
  node.textContent = message;
  node.hidden = false;
  setTimeout(() => {
    node.hidden = true;
  }, 3600);
}

async function load() {
  state.data = await api("/api/bootstrap");
  renderAll();
}

function byId(collection, id) {
  return (state.data?.[collection] || []).find((item) => item.id === id);
}

function statusClass(status) {
  if (!status) return "";
  if (status.includes("pending")) return "pending";
  if (status.includes("rate")) return "rate";
  if (["approved", "executed", "completed", "funded", "paid"].includes(status)) return status;
  if (["rejected", "expired", "cancelled"].includes(status)) return status;
  if (status.includes("review")) return "review";
  if (status.includes("process")) return "process";
  return "";
}

function typeLabel(type) {
  return {
    buy_usd: "Compra USD",
    sell_usd: "Venta USD",
    payment: "Pago",
  }[type] || type;
}

function partnerName(id) {
  return byId("partners", id)?.name || "Partner";
}

function accountName(id) {
  return byId("accounts", id)?.name || "Sin cuenta";
}

function beneficiaryName(id) {
  return byId("beneficiaries", id)?.name || "Sin beneficiario";
}

function operationCard(op, withActions = false) {
  const requested = money(op.requested_amount, op.requested_currency);
  const final = op.final_amount ? money(op.final_amount, op.final_currency) : "Pendiente";
  return `
    <article class="op-card" data-operation-id="${op.id}">
      <div class="op-top">
        <span class="tag">${typeLabel(op.type)}</span>
        <span class="tag ${statusClass(op.status)}">${op.status}</span>
      </div>
      <h3>${op.id}</h3>
      <p class="op-meta">${partnerName(op.partner_id)} · ${op.reason || "Sin razón"}</p>
      <p class="op-meta">Solicitado: <strong>${requested}</strong> · Final: <strong>${final}</strong></p>
      ${op.rate ? `<p class="op-meta">Tasa: <strong>${money(op.rate)}</strong>${op.expires_at ? ` · vence ${new Date(op.expires_at).toLocaleTimeString("es-VE")}` : ""}</p>` : ""}
      ${withActions ? approvalActions(op) : ""}
    </article>
  `;
}

function approvalActions(op) {
  return `
    <div class="actions">
      <button class="primary" data-approve="${op.id}">Aprobar</button>
      <button class="danger" data-reject="${op.id}">Rechazar</button>
    </div>
  `;
}

function renderAll() {
  qs("#roleSelect").value = state.role;
  qs("#actorName").textContent = state.data.actor.name;
  renderDashboard();
  renderApprovals();
  renderOperations();
  renderAccounts();
  renderBalances();
  fillForms();
}

function renderDashboard() {
  const ops = state.data.operations;
  const pending = ops.filter((op) => ["pending_approval", "rate_pending_approval", "in_review", "pending_funding"].includes(op.status)).length;
  const usd = state.data.accounts.filter((acct) => acct.currency === "USD").reduce((sum, acct) => sum + Number(acct.balance), 0);
  const ves = state.data.accounts.filter((acct) => acct.currency === "VES").reduce((sum, acct) => sum + Number(acct.balance), 0);
  qs("#metrics").innerHTML = [
    ["Operaciones abiertas", pending],
    ["Saldo USD", money(usd, "USD")],
    ["Saldo VES", money(ves, "VES")],
    ["Beneficiarios", state.data.beneficiaries.length],
  ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");

  const events = ops.flatMap((op) => (op.events || []).map((event) => ({ ...event, operation_id: op.id }))).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);
  qs("#recentActivity").innerHTML = events.length ? events.map((event) => `
    <div class="timeline-item">
      <strong>${event.description}</strong>
      <span>${event.operation_id} · ${new Date(event.created_at).toLocaleString("es-VE")}</span>
    </div>
  `).join("") : `<div class="empty-state">Sin actividad todavía.</div>`;

  qs("#criticalOps").innerHTML = ops.filter((op) => ["pending_approval", "rate_pending_approval", "expired"].includes(op.status)).slice(0, 6).map((op) => operationCard(op)).join("") || `<div class="empty-state">Sin operaciones críticas.</div>`;
}

function renderApprovals() {
  const approvals = state.data.operations.filter((op) => ["pending_approval", "rate_pending_approval"].includes(op.status));
  qs("#approvalList").innerHTML = approvals.map((op) => operationCard(op, true)).join("") || `<div class="empty-state">No hay tasas pendientes.</div>`;
}

function renderOperations() {
  const type = qs("#filterType").value;
  const status = qs("#filterStatus").value;
  const search = qs("#filterSearch").value.toLowerCase();
  const statuses = [...new Set(state.data.operations.map((op) => op.status))].sort();
  qs("#filterStatus").innerHTML = `<option value="">Estatus</option>` + statuses.map((item) => `<option value="${item}" ${status === item ? "selected" : ""}>${item}</option>`).join("");
  const filtered = state.data.operations.filter((op) => {
    const haystack = `${op.id} ${op.reason} ${op.status} ${op.type}`.toLowerCase();
    return (!type || op.type === type) && (!status || op.status === status) && (!search || haystack.includes(search));
  });
  qs("#operationList").innerHTML = filtered.map((op) => operationCard(op)).join("") || `<div class="empty-state">Sin resultados.</div>`;
  const selected = state.data.operations.find((op) => op.id === state.selectedOperationId) || filtered[0];
  if (selected) {
    state.selectedOperationId = selected.id;
    renderOperationDetail(selected);
  }
}

function renderOperationDetail(op) {
  const linked = op.linked_operation_id ? `<a class="link" href="#" data-open-op="${op.linked_operation_id}">${op.linked_operation_id}</a>` : "N/A";
  qs("#operationDetail").innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><p>ID</p><strong>${op.id}</strong></div>
      <div class="detail-item"><p>Estatus</p><strong>${op.status}</strong></div>
      <div class="detail-item"><p>Solicitado</p><strong>${money(op.requested_amount, op.requested_currency)}</strong></div>
      <div class="detail-item"><p>Final</p><strong>${op.final_amount ? money(op.final_amount, op.final_currency) : "Pendiente"}</strong></div>
      <div class="detail-item"><p>Origen</p><strong>${accountName(op.source_account_id)}</strong></div>
      <div class="detail-item"><p>Destino</p><strong>${op.beneficiary_id ? beneficiaryName(op.beneficiary_id) : accountName(op.destination_account_id)}</strong></div>
      <div class="detail-item"><p>Tasa</p><strong>${op.rate ? money(op.rate) : "Pendiente"}</strong></div>
      <div class="detail-item"><p>Relacionada</p><strong>${linked}</strong></div>
    </div>
    ${magnaExecutionForm(op)}
    <h2>Soportes</h2>
    <div class="timeline compact">
      ${(op.attachments || []).map((file) => `<div class="timeline-item"><strong>${file.label}</strong><span>${file.filename}</span></div>`).join("") || `<p class="op-meta">Sin soportes cargados.</p>`}
    </div>
    <h2>Timeline</h2>
    <div class="timeline">
      ${(op.events || []).map((event) => `<div class="timeline-item"><strong>${event.description}</strong><span>${new Date(event.created_at).toLocaleString("es-VE")}${event.comment ? ` · ${event.comment}` : ""}</span></div>`).join("")}
    </div>
  `;
}

function magnaExecutionForm(op) {
  const vesAccounts = state.data.accounts.filter((acct) => acct.currency === "VES");
  const usdAccounts = state.data.accounts.filter((acct) => acct.currency === "USD");
  const sourceOptions = state.data.accounts.map((acct) => `<option value="${acct.id}" ${acct.id === op.source_account_id ? "selected" : ""}>${acct.name} · ${acct.currency}</option>`).join("");
  const destinationOptions = state.data.accounts.map((acct) => `<option value="${acct.id}" ${acct.id === op.destination_account_id ? "selected" : ""}>${acct.name} · ${acct.currency}</option>`).join("");
  if (state.role !== "magna_admin") return "";
  if (op.type === "sell_usd" && op.status === "in_review") {
    return `
      <form class="inline-form" data-rate-form="${op.id}">
        <label>Tasa de venta<input name="rate" type="number" step="0.0001" required /></label>
        <label>Cuenta salida USD<select name="usd_account_id">${usdAccounts.map((acct) => `<option value="${acct.id}">${acct.name}</option>`).join("")}</select></label>
        <label>Cuenta entrada VES<select name="ves_account_id">${vesAccounts.map((acct) => `<option value="${acct.id}">${acct.name}</option>`).join("")}</select></label>
        <label>Comentario<input name="comment" /></label>
        <button class="primary" type="submit">Enviar tasa</button>
      </form>
    `;
  }
  if (!["approved", "funded"].includes(op.status)) return "";
  return `
    <form class="inline-form" data-execute-form="${op.id}">
      <label>Monto final<input name="final_amount" type="number" step="0.01" value="${op.final_amount || op.requested_amount || 0}" required /></label>
      <label>Cuenta origen<select name="source_account_id">${sourceOptions}</select></label>
      <label>Cuenta destino<select name="destination_account_id">${destinationOptions}</select></label>
      <label>Soporte 1<input name="support_one" placeholder="soporte-pago-bs.pdf" /></label>
      <label>Soporte 2<input name="support_two" placeholder="soporte-recepcion-usd.pdf" /></label>
      <label>Comentario<input name="comment" /></label>
      <button class="primary" type="submit">Ejecutar</button>
    </form>
  `;
}

function renderAccounts() {
  qs("#accountList").innerHTML = state.data.accounts.map((acct) => `
    <article class="account-card">
      <div class="op-top">
        <span class="tag">${acct.currency}</span>
        <span class="tag ${acct.status === "active" ? "approved" : "cancelled"}">${acct.status}</span>
      </div>
      <h3>${acct.name}</h3>
      <p>${acct.institution || acct.account_type} · ${acct.account_number || acct.wallet_address || "Sin referencia"}</p>
      <p>Titular: ${acct.beneficiary_name}</p>
      <p>Comisión bancaria: ${money(acct.bank_fee_percent)}%</p>
    </article>
  `).join("");
}

function renderBalances() {
  qs("#balanceGrid").innerHTML = state.data.accounts.map((acct) => `
    <article class="balance-card">
      <div class="op-top">
        <span class="tag">${acct.currency}</span>
        ${acct.external_url ? `<a class="link" href="${acct.external_url}" target="_blank" rel="noreferrer">Ver externo</a>` : `<span class="muted">Sin link externo</span>`}
      </div>
      <h3>${acct.name}</h3>
      <strong>${money(acct.balance, acct.currency)}</strong>
      <p>${acct.notes || "Cuenta conciliable del vehículo operativo."}</p>
    </article>
  `).join("");
}

function fillForms() {
  const beneficiaries = state.data.beneficiaries.map((ben) => `<option value="${ben.id}">${ben.name} · ${ben.category}</option>`).join("");
  qs("#paymentBeneficiary").innerHTML = beneficiaries;
  const ves = state.data.accounts.filter((acct) => acct.currency === "VES").map((acct) => `<option value="${acct.id}">${acct.name} · fee ${money(acct.bank_fee_percent)}%</option>`).join("");
  const usd = state.data.accounts.filter((acct) => acct.currency === "USD").map((acct) => `<option value="${acct.id}">${acct.name}</option>`).join("");
  qs("#buyVesAccount").innerHTML = ves;
  qs("#buyUsdAccount").innerHTML = usd;
  qs("#expirationMinutes").value = state.data.settings.rate_expiration_minutes || 7;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = formData(form);
  try {
    if (form.id === "buyForm") {
      await api("/api/buy-requests", { method: "POST", body: JSON.stringify(data) });
      toast("Solicitud de compra enviada a aprobación.");
    }
    if (form.id === "sellForm") {
      await api("/api/sell-requests", { method: "POST", body: JSON.stringify(data) });
      toast("Solicitud de bolívares creada.");
    }
    if (form.id === "paymentForm") {
      await api("/api/payments", { method: "POST", body: JSON.stringify(data) });
      toast("Pago creado y venta USD autogenerada.");
    }
    if (form.id === "beneficiaryForm") {
      await api("/api/beneficiaries", { method: "POST", body: JSON.stringify(data) });
      toast("Beneficiario guardado.");
    }
    if (form.id === "settingsForm") {
      await api("/api/settings", { method: "POST", body: JSON.stringify(data) });
      toast("Configuración actualizada.");
    }
    form.reset();
    await load();
  } catch (error) {
    toast(error.message);
  }
}

async function handleDocumentClick(event) {
  const nav = event.target.closest(".nav-item");
  if (nav) {
    qsa(".nav-item").forEach((item) => item.classList.toggle("active", item === nav));
    qsa(".view").forEach((view) => view.classList.toggle("active", view.id === nav.dataset.view));
    qs("#viewTitle").textContent = views[nav.dataset.view];
  }

  const card = event.target.closest("[data-operation-id]");
  if (card && !event.target.closest("button")) {
    state.selectedOperationId = card.dataset.operationId;
    qsa(".nav-item").find((item) => item.dataset.view === "operations").click();
    renderOperations();
  }

  const openOp = event.target.closest("[data-open-op]");
  if (openOp) {
    event.preventDefault();
    state.selectedOperationId = openOp.dataset.openOp;
    renderOperations();
  }

  const approve = event.target.closest("[data-approve]");
  const reject = event.target.closest("[data-reject]");
  if (approve || reject) {
    const id = (approve || reject).dataset.approve || (approve || reject).dataset.reject;
    const decision = approve ? "approve" : "reject";
    const comment = prompt("Comentario obligatorio");
    if (!comment) return;
    try {
      await api(`/api/operations/${id}/decision`, { method: "POST", body: JSON.stringify({ decision, comment }) });
      toast(decision === "approve" ? "Operación aprobada." : "Operación rechazada.");
      await load();
    } catch (error) {
      toast(error.message);
    }
  }
}

async function handleDynamicSubmit(event) {
  const rateForm = event.target.closest("[data-rate-form]");
  const executeForm = event.target.closest("[data-execute-form]");
  if (!rateForm && !executeForm) return;
  event.preventDefault();
  try {
    if (rateForm) {
      await api(`/api/sell-requests/${rateForm.dataset.rateForm}/rate`, { method: "POST", body: JSON.stringify(formData(rateForm)) });
      toast("Tasa enviada a aprobación.");
    }
    if (executeForm) {
      const data = formData(executeForm);
      const attachments = [
        { label: "Soporte de pago de bolívares", filename: data.support_one },
        { label: "Soporte de recepción de dólares", filename: data.support_two },
      ].filter((item) => item.filename);
      await api(`/api/operations/${executeForm.dataset.executeForm}/execute`, {
        method: "POST",
        body: JSON.stringify({ ...data, attachments }),
      });
      toast("Operación ejecutada y saldos actualizados.");
    }
    await load();
  } catch (error) {
    toast(error.message);
  }
}

qsa("form").forEach((form) => form.addEventListener("submit", handleSubmit));
document.addEventListener("click", handleDocumentClick);
document.addEventListener("submit", handleDynamicSubmit);
["#filterType", "#filterStatus", "#filterSearch"].forEach((selector) => qs(selector).addEventListener("input", renderOperations));
qs("#roleSelect").addEventListener("change", async (event) => {
  state.role = event.target.value;
  localStorage.setItem("partnerportal_role", state.role);
  await load();
});

load().catch((error) => toast(error.message));
