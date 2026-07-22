const state = {
  role: localStorage.getItem("partnerportal_role") || "magna_admin",
  lang: localStorage.getItem("partnerportal_lang") || "es",
  view: "dashboard",
  data: null,
  filters: {},
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

const labels = {
  es: {
    dashboard: "Dashboard",
    treasury: "Tesorería",
    approvals: "Aprobaciones",
    operations: "Operaciones",
    accounts: "Cuentas Beneficiarios",
    clientAccounts: "Cuentas Cliente",
    users: "User Management",
    balances: "Saldos",
    settings: "Configuración",
    newRequest: "Nueva solicitud",
    newAccount: "Nueva cuenta",
    newBeneficiary: "Nuevo beneficiario",
    edit: "Editar",
    delete: "Borrar",
    save: "Guardar",
    close: "Cerrar",
    execute: "Ejecutar",
    approve: "Aprobar",
    reject: "Rechazar",
    rate: "Tasa",
    binance: "Tasa Binance",
    spread: "Spread",
    status: "Status",
    account: "Cuenta",
    transaction: "Transacción",
    category: "Categoría",
    usd: "USD",
    ves: "VES",
    date: "Fecha",
    roleView: "Vista / rol",
  },
  en: {
    dashboard: "Dashboard",
    treasury: "Treasury",
    approvals: "Approvals",
    operations: "Operations",
    accounts: "Beneficiary Accounts",
    clientAccounts: "Client Accounts",
    users: "User Management",
    balances: "Balances",
    settings: "Settings",
    newRequest: "New request",
    newAccount: "New account",
    newBeneficiary: "New beneficiary",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    close: "Close",
    execute: "Execute",
    approve: "Approve",
    reject: "Reject",
    rate: "Rate",
    binance: "Binance rate",
    spread: "Spread",
    status: "Status",
    account: "Account",
    transaction: "Transaction",
    category: "Category",
    usd: "USD",
    ves: "VES",
    date: "Date",
    roleView: "Role view",
  },
};

const navItems = [
  ["dashboard", "dashboard"],
  ["treasury", "treasury"],
  ["approvals", "approvals"],
  ["operations", "operations"],
  ["accounts", "accounts"],
  ["clientAccounts", "clientAccounts", "master"],
  ["users", "users", "master"],
  ["balances", "balances"],
  ["settings", "settings", "master"],
];

function t(key) {
  return labels[state.lang][key] || labels.es[key] || key;
}

function money(value, currency = "") {
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
  return currency ? `${formatted} ${currency}` : formatted;
}

function statusClass(status = "") {
  return status.replaceAll(" ", "_");
}

function typeLabel(type, metadata = {}) {
  if (type === "buy_usd") return state.lang === "es" ? "Compra USD" : "Buy USD";
  if (type === "sell_usd") return state.lang === "es" ? "Venta USD" : "Sell USD";
  if (type === "payment") return metadata.payment_type === "partner" ? "Pago a partner" : "Pago a proveedor";
  return type;
}

function accountName(id) {
  return state.data?.accounts.find((item) => item.id === id)?.name || "—";
}

function beneficiaryName(id) {
  return state.data?.beneficiaries.find((item) => item.id === id)?.name || "—";
}

function categoryName(id) {
  return state.data?.categories.find((item) => item.id === id)?.name || "—";
}

function headers(extra = {}) {
  return { "X-Role": state.role, ...extra };
}

async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(path, {
    ...options,
    headers: {
      ...headers(isForm ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "No se pudo completar la accion.");
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
  renderShell();
  renderView();
}

function renderShell() {
  qs("#roleSelect").value = state.role;
  qs("#actorName").textContent = state.data.actor.name;
  qs("#languageToggle").textContent = state.lang.toUpperCase();
  qsa("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  qs("#nav").innerHTML = navItems
    .filter(([, , scope]) => scope !== "master" || state.role === "magna_admin")
    .map(([view, label]) => `<button class="nav-item ${state.view === view ? "active" : ""}" data-nav="${view}" type="button">${t(label)}</button>`)
    .join("");
  qs("#viewTitle").textContent = t(state.view);
}

function openDrawer() {
  qs("#drawer").classList.add("open");
  qs("#drawerBackdrop").hidden = false;
}

function closeDrawer() {
  qs("#drawer").classList.remove("open");
  qs("#drawerBackdrop").hidden = true;
}

function setView(view) {
  state.view = view;
  renderShell();
  renderView();
  closeDrawer();
}

function renderView() {
  const renderers = {
    dashboard: renderDashboard,
    treasury: renderTreasury,
    approvals: renderApprovals,
    operations: renderOperations,
    accounts: renderAccountsBeneficiaries,
    clientAccounts: renderClientAccounts,
    users: renderUsers,
    balances: renderBalances,
    settings: renderSettings,
  };
  qs("#viewBody").innerHTML = "";
  renderers[state.view]?.();
}

function filteredOperations() {
  const f = state.filters;
  return state.data.operations.filter((op) => {
    const created = op.created_at?.slice(0, 10);
    const account = op.source_account_id || op.destination_account_id || "";
    return (!f.type || op.type === f.type)
      && (!f.status || op.status === f.status)
      && (!f.account || account === f.account)
      && (!f.date_from || created >= f.date_from)
      && (!f.date_to || created <= f.date_to)
      && (!f.min_usd || Math.abs(Number(op.usd_amount || 0)) >= Number(f.min_usd))
      && (!f.min_ves || Math.abs(Number(op.ves_amount || 0)) >= Number(f.min_ves));
  });
}

function operationStats(ops) {
  const usd = ops.reduce((sum, op) => sum + Number(op.usd_amount || 0), 0);
  const ves = ops.reduce((sum, op) => sum + Number(op.ves_amount || 0), 0);
  const rated = ops.filter((op) => Number(op.rate) && (Math.abs(Number(op.usd_amount)) || Math.abs(Number(op.ves_amount))));
  const weightedRate = rated.reduce((sum, op) => sum + Number(op.rate) * Math.abs(Number(op.usd_amount || 0)), 0);
  const weight = rated.reduce((sum, op) => sum + Math.abs(Number(op.usd_amount || 0)), 0);
  return { count: ops.length, usd, ves, weighted: weight ? weightedRate / weight : 0 };
}

function metricCards(ops) {
  const stats = operationStats(ops);
  return `
    <div class="summary-grid">
      <article class="metric-card"><span>Operaciones</span><strong>${stats.count}</strong></article>
      <article class="metric-card"><span>USD neto</span><strong class="${stats.usd < 0 ? "amount-negative" : "amount-positive"}">${money(stats.usd, "USD")}</strong></article>
      <article class="metric-card"><span>VES neto</span><strong class="${stats.ves < 0 ? "amount-negative" : "amount-positive"}">${money(stats.ves, "VES")}</strong></article>
      <article class="metric-card"><span>Tasa ponderada</span><strong>${stats.weighted ? money(stats.weighted) : "—"}</strong></article>
    </div>
  `;
}

function renderDashboard() {
  const ops = state.data.operations;
  qs("#viewBody").innerHTML = `
    ${metricCards(ops)}
    <section class="grid-2">
      <article class="panel">
        <div class="panel-header"><h2>Pipeline operativo</h2></div>
        ${operationTable(ops.slice(0, 8), false)}
      </article>
      <article class="panel">
        <div class="panel-header"><h2>Actividad reciente</h2></div>
        <div class="timeline">
          ${ops.flatMap((op) => (op.events || []).map((event) => ({ ...event, op })))
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 8)
            .map((event) => `<div class="timeline-item"><strong>${event.description}</strong><div class="muted">${event.op.id} · ${new Date(event.created_at).toLocaleString()}</div></div>`)
            .join("") || `<p class="muted">Sin actividad.</p>`}
        </div>
      </article>
    </section>
  `;
}

function renderTreasury() {
  const ops = state.data.operations.filter((op) => ["buy_usd", "sell_usd"].includes(op.type));
  qs("#viewBody").innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2>Solicitudes de tesorería</h2>
        <button class="primary" data-action="open-treasury" type="button">${t("newRequest")}</button>
      </div>
      ${operationTable(ops, true)}
    </section>
  `;
}

function renderApprovals() {
  const statuses = state.role === "magna_admin" ? ["pending_master", "in_negotiation", "approved"] : ["rate_pending_approval"];
  const ops = state.data.operations.filter((op) => statuses.includes(op.status));
  qs("#viewBody").innerHTML = `
    <section class="panel">
      <div class="panel-header"><h2>Bandeja de aprobaciones</h2><span class="muted">Rates, negotiation and execution</span></div>
      ${operationTable(ops, true)}
    </section>
  `;
}

function renderOperations() {
  const ops = filteredOperations();
  const accountOptions = state.data.accounts.map((account) => `<option value="${account.id}" ${state.filters.account === account.id ? "selected" : ""}>${account.name}</option>`).join("");
  const statuses = [...new Set(state.data.operations.map((op) => op.status))].sort();
  qs("#viewBody").innerHTML = `
    ${metricCards(ops)}
    <section class="panel">
      <div class="panel-header"><h2>Libro de operaciones</h2></div>
      <div class="toolbar">
        <select data-filter="type">
          <option value="">Tipo</option>
          <option value="buy_usd" ${state.filters.type === "buy_usd" ? "selected" : ""}>Compra USD</option>
          <option value="sell_usd" ${state.filters.type === "sell_usd" ? "selected" : ""}>Venta USD</option>
          <option value="payment" ${state.filters.type === "payment" ? "selected" : ""}>Pago</option>
        </select>
        <select data-filter="status"><option value="">Status</option>${statuses.map((status) => `<option ${state.filters.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>
        <input data-filter="date_from" type="date" value="${state.filters.date_from || ""}" />
        <input data-filter="date_to" type="date" value="${state.filters.date_to || ""}" />
        <input data-filter="min_usd" type="number" step="0.01" placeholder="Min USD" value="${state.filters.min_usd || ""}" />
        <input data-filter="min_ves" type="number" step="0.01" placeholder="Min VES" value="${state.filters.min_ves || ""}" />
        <select data-filter="account"><option value="">Cuenta</option>${accountOptions}</select>
      </div>
    </section>
    ${operationTable(ops, true)}
  `;
}

function operationTable(ops, actions = true) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Categoría</th>
            <th>USD</th>
            <th>VES</th>
            <th>Tasa</th>
            <th>Status</th>
            <th>Cuenta</th>
            <th>Fecha</th>
            ${actions ? "<th></th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${ops.map((op) => `
            <tr data-open-operation="${op.id}">
              <td><strong>${op.id}</strong></td>
              <td>${typeLabel(op.type, op.metadata || {})}</td>
              <td class="${Number(op.usd_amount) < 0 ? "amount-negative" : "amount-positive"}">${money(op.usd_amount, "USD")}</td>
              <td class="${Number(op.ves_amount) < 0 ? "amount-negative" : "amount-positive"}">${money(op.ves_amount, "VES")}</td>
              <td>${op.rate ? money(op.rate) : "—"}</td>
              <td><span class="status ${statusClass(op.status)}">${op.status}</span></td>
              <td>${accountName(op.source_account_id || op.destination_account_id)}</td>
              <td>${new Date(op.created_at).toLocaleDateString()}</td>
              ${actions ? `<td><button class="subtle" data-open-operation="${op.id}" type="button">Ver</button></td>` : ""}
            </tr>
          `).join("") || `<tr><td colspan="${actions ? 9 : 8}" class="muted">Sin operaciones.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderAccountsBeneficiaries() {
  const magnaAccounts = state.data.accounts.filter((account) => account.owner === "magna");
  qs("#viewBody").innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2>Cuentas Beneficiarios</h2>
        <div class="row-actions">
          <button class="primary" data-action="new-account" data-owner="magna" type="button">${t("newAccount")}</button>
          <button class="ghost-button" data-action="new-beneficiary" type="button">${t("newBeneficiary")}</button>
        </div>
      </div>
      ${accountsTable(magnaAccounts)}
    </section>
    <section class="panel">
      <div class="panel-header"><h2>Beneficiarios</h2></div>
      ${beneficiariesTable(state.data.beneficiaries)}
    </section>
  `;
}

function renderClientAccounts() {
  const clientAccounts = state.data.accounts.filter((account) => account.owner === "client");
  qs("#viewBody").innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2>Cuentas Cliente</h2>
        <button class="primary" data-action="new-account" data-owner="client" type="button">${t("newAccount")}</button>
      </div>
      ${accountsTable(clientAccounts)}
    </section>
  `;
}

function accountsTable(accounts) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Currency</th><th>Banco / plataforma</th><th>Titular</th><th>Saldo inicial</th><th>Saldo actual</th><th>Comisión</th><th></th></tr></thead>
        <tbody>
          ${accounts.map((account) => `
            <tr>
              <td><strong>${account.name}</strong></td>
              <td>${account.currency}</td>
              <td>${account.institution || "—"}</td>
              <td>${account.beneficiary_name || "—"}</td>
              <td>${money(account.initial_balance, account.currency)}</td>
              <td>${money(account.balance, account.currency)}</td>
              <td>${money(account.bank_fee_percent)}%</td>
              <td class="row-actions">
                <button class="subtle" data-edit-account="${account.id}" type="button">${t("edit")}</button>
                <button class="danger" data-delete-account="${account.id}" type="button">${t("delete")}</button>
              </td>
            </tr>
          `).join("") || `<tr><td colspan="8" class="muted">Sin cuentas.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function beneficiariesTable(items) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Categoría</th><th>Banco</th><th>Cuenta</th><th>Identificación</th><th>Currency</th><th></th></tr></thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td><strong>${item.name}</strong></td>
              <td>${item.category}</td>
              <td>${item.bank || "—"}</td>
              <td>${item.account_number || "—"}</td>
              <td>${item.identification || "—"}</td>
              <td>${item.currency}</td>
              <td class="row-actions">
                <button class="subtle" data-edit-beneficiary="${item.id}" type="button">${t("edit")}</button>
                <button class="danger" data-delete-beneficiary="${item.id}" type="button">${t("delete")}</button>
              </td>
            </tr>
          `).join("") || `<tr><td colspan="7" class="muted">Sin beneficiarios.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderUsers() {
  qs("#viewBody").innerHTML = `
    <section class="grid-2">
      <article class="panel">
        <div class="panel-header"><h2>User Management</h2><button class="primary" data-action="new-user" type="button">Nuevo usuario</button></div>
        ${usersTable()}
      </article>
      <article class="panel">
        <div class="panel-header"><h2>Category Management</h2><button class="primary" data-action="new-category" type="button">Nueva categoría</button></div>
        ${categoriesTable()}
      </article>
    </section>
  `;
}

function usersTable() {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Status</th><th></th></tr></thead>
        <tbody>${state.data.users.map((user) => `
          <tr><td><strong>${user.name}</strong></td><td>${user.email}</td><td>${user.role}</td><td>${user.status}</td><td class="row-actions"><button class="subtle" data-edit-user="${user.id}" type="button">${t("edit")}</button><button class="danger" data-delete-user="${user.id}" type="button">${t("delete")}</button></td></tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function categoriesTable() {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Tipo</th><th>Status</th><th></th></tr></thead>
        <tbody>${state.data.categories.map((cat) => `
          <tr><td><strong>${cat.name}</strong></td><td>${cat.kind}</td><td>${cat.status}</td><td class="row-actions"><button class="subtle" data-edit-category="${cat.id}" type="button">${t("edit")}</button><button class="danger" data-delete-category="${cat.id}" type="button">${t("delete")}</button></td></tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderBalances() {
  qs("#viewBody").innerHTML = `
    <div class="summary-grid">
      ${state.data.accounts.map((account) => `
        <article class="metric-card">
          <span>${account.owner === "client" ? "Cliente" : "Magna"} · ${account.currency}</span>
          <strong>${money(account.balance, account.currency)}</strong>
          <div class="muted">${account.name}</div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSettings() {
  qs("#viewBody").innerHTML = `
    <section class="panel">
      <div class="panel-header"><h2>Configuración operativa</h2></div>
      <form data-settings-form class="form-grid">
        <label>Vigencia tasa minutos<input name="rate_expiration_minutes" type="number" min="1" max="60" value="${state.data.settings.rate_expiration_minutes || 7}" /></label>
        <div class="full"><button class="primary" type="submit">${t("save")}</button></div>
      </form>
    </section>
  `;
}

function accountOptions(currency = "", selected = "") {
  return state.data.accounts
    .filter((account) => !currency || account.currency === currency)
    .map((account) => `<option value="${account.id}" ${account.id === selected ? "selected" : ""}>${account.name} · ${account.currency}</option>`)
    .join("");
}

function openModal(title, body, footer = "") {
  qs("#modalRoot").innerHTML = `
    <div class="modal-backdrop">
      <section class="modal">
        <header class="modal-header"><h2>${title}</h2><button class="icon-button" data-close-modal type="button">×</button></header>
        <div class="modal-body">${body}</div>
        ${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}
      </section>
    </div>
  `;
}

function closeModal() {
  qs("#modalRoot").innerHTML = "";
}

function openTreasuryModal() {
  const categories = state.data.categories.filter((cat) => cat.kind === "treasury_usage");
  openModal("Nueva solicitud de tesorería", `
    <form data-treasury-form class="form-grid" enctype="multipart/form-data">
      <label>Tipo
        <select name="operation_side" data-treasury-side>
          <option value="sell">Venta USD</option>
          <option value="buy">Compra USD</option>
        </select>
      </label>
      <label>Imputar monto en
        <select name="input_currency">
          <option value="VES">VES</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label>Monto USD<input name="usd_amount" type="number" step="0.01" /></label>
      <label>Monto VES<input name="ves_amount" type="number" step="0.01" /></label>
      <label>Tasa esperada<input name="expected_rate" type="number" step="0.0001" /></label>
      <label>Uso
        <select name="usage_category_id" data-usage-category>
          ${categories.map((cat) => `<option value="${cat.id}">${cat.name}</option>`).join("")}
        </select>
      </label>
      <label>Beneficiario
        <select name="beneficiary_id" data-beneficiary-select>${beneficiaryOptionsForCategory(categories[0]?.id)}</select>
      </label>
      <label class="full">Comentario<textarea name="comment" rows="3"></textarea></label>
      <label class="full">Nota de entrega / factura<input name="support" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" /></label>
      <div class="full"><button class="primary" type="submit">${t("save")}</button></div>
    </form>
  `);
}

function beneficiaryOptionsForCategory(categoryId) {
  const category = categoryName(categoryId).toLowerCase();
  const beneficiaryCategory = category.includes("partner") ? "partner" : "provider";
  return state.data.beneficiaries
    .filter((ben) => ben.category === beneficiaryCategory)
    .map((ben) => `<option value="${ben.id}">${ben.name}</option>`)
    .join("");
}

function openAccountModal(owner, account = {}) {
  openModal(account.id ? "Editar cuenta" : "Nueva cuenta", `
    <form data-account-form="${account.id || ""}" class="form-grid">
      <input type="hidden" name="owner" value="${owner || account.owner || "magna"}" />
      <label>Nombre<input name="name" value="${account.name || ""}" required /></label>
      <label>Currency<select name="currency"><option ${account.currency === "USD" ? "selected" : ""}>USD</option><option ${account.currency !== "USD" ? "selected" : ""}>VES</option></select></label>
      <label>Banco / plataforma<input name="institution" value="${account.institution || ""}" /></label>
      <label>Número de cuenta<input name="account_number" value="${account.account_number || ""}" /></label>
      <label>Titular<input name="beneficiary_name" value="${account.beneficiary_name || ""}" /></label>
      <label>Tipo<select name="account_type"><option value="bank" ${account.account_type === "bank" ? "selected" : ""}>Banco</option><option value="wallet" ${account.account_type === "wallet" ? "selected" : ""}>Wallet / custodia</option></select></label>
      <label>Comisión bancaria %<input name="bank_fee_percent" type="number" step="0.01" value="${account.bank_fee_percent || 0}" /></label>
      <label>Saldo inicial<input name="initial_balance" type="number" step="0.01" value="${account.initial_balance ?? account.balance ?? 0}" /></label>
      <label class="full">Link externo<input name="external_url" value="${account.external_url || ""}" /></label>
      <label class="full">Notas<textarea name="notes" rows="3">${account.notes || ""}</textarea></label>
      <div class="full"><button class="primary" type="submit">${t("save")}</button></div>
    </form>
  `);
}

function openBeneficiaryModal(item = {}) {
  openModal(item.id ? "Editar beneficiario" : "Nuevo beneficiario", `
    <form data-beneficiary-form="${item.id || ""}" class="form-grid">
      <label>Nombre<input name="name" value="${item.name || ""}" required /></label>
      <label>Categoría<select name="category"><option value="partner" ${item.category === "partner" ? "selected" : ""}>Partner</option><option value="provider" ${item.category === "provider" ? "selected" : ""}>Proveedor</option></select></label>
      <label>Banco<input name="bank" value="${item.bank || ""}" /></label>
      <label>Número de cuenta<input name="account_number" value="${item.account_number || ""}" /></label>
      <label>Tipo cuenta<input name="account_type" value="${item.account_type || "corriente"}" /></label>
      <label>Currency<select name="currency"><option ${item.currency === "USD" ? "selected" : ""}>USD</option><option ${item.currency !== "USD" ? "selected" : ""}>VES</option></select></label>
      <label class="full">Identificación<input name="identification" value="${item.identification || ""}" /></label>
      <div class="full"><button class="primary" type="submit">${t("save")}</button></div>
    </form>
  `);
}

function openUserModal(user = {}) {
  openModal(user.id ? "Editar usuario" : "Nuevo usuario", `
    <form data-user-form="${user.id || ""}" class="form-grid">
      <label>Nombre<input name="name" value="${user.name || ""}" required /></label>
      <label>Email<input name="email" type="email" value="${user.email || ""}" required /></label>
      <label>Rol<select name="role">
        ${["magna_admin", "super_approver", "treasury", "finance"].map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>`).join("")}
      </select></label>
      <label>Status<select name="status"><option value="active" ${user.status !== "inactive" ? "selected" : ""}>active</option><option value="inactive" ${user.status === "inactive" ? "selected" : ""}>inactive</option></select></label>
      <div class="full"><button class="primary" type="submit">${t("save")}</button></div>
    </form>
  `);
}

function openCategoryModal(category = {}) {
  openModal(category.id ? "Editar categoría" : "Nueva categoría", `
    <form data-category-form="${category.id || ""}" class="form-grid">
      <label>Nombre<input name="name" value="${category.name || ""}" required /></label>
      <label>Tipo<input name="kind" value="${category.kind || "treasury_usage"}" required /></label>
      <label>Status<select name="status"><option value="active" ${category.status !== "inactive" ? "selected" : ""}>active</option><option value="inactive" ${category.status === "inactive" ? "selected" : ""}>inactive</option></select></label>
      <div class="full"><button class="primary" type="submit">${t("save")}</button></div>
    </form>
  `);
}

function openOperationDetail(id) {
  const op = state.data.operations.find((item) => item.id === id);
  if (!op) return;
  const canMaster = state.role === "magna_admin";
  const canClientApprove = state.role !== "magna_admin" && op.status === "rate_pending_approval";
  openModal(op.id, `
    <div class="detail-list">
      <div class="detail-item"><span>Categoría</span><strong>${typeLabel(op.type, op.metadata || {})}</strong></div>
      <div class="detail-item"><span>Status</span><strong>${op.status}</strong></div>
      <div class="detail-item"><span>Tasa</span><strong>${op.rate ? money(op.rate) : "—"}</strong></div>
      <div class="detail-item"><span>Binance</span><strong>${op.binance_rate ? money(op.binance_rate) : "—"}</strong></div>
      <div class="detail-item"><span>Spread</span><strong>${op.spread ? `${money(op.spread)}%` : "—"}</strong></div>
      <div class="detail-item"><span>Beneficiario</span><strong>${beneficiaryName(op.beneficiary_id)}</strong></div>
      <div class="detail-item"><span>USD</span><strong class="${Number(op.usd_amount) < 0 ? "amount-negative" : "amount-positive"}">${money(op.usd_amount, "USD")}</strong></div>
      <div class="detail-item"><span>VES</span><strong class="${Number(op.ves_amount) < 0 ? "amount-negative" : "amount-positive"}">${money(op.ves_amount, "VES")}</strong></div>
      <div class="detail-item"><span>Cuenta</span><strong>${accountName(op.source_account_id || op.destination_account_id)}</strong></div>
    </div>
    <section>
      <h3>Soportes</h3>
      <div class="timeline">${(op.attachments || []).map((file) => `<div class="timeline-item"><strong>${file.label}</strong><div>${file.stored_path ? `<a href="/uploads/${file.stored_path}" target="_blank">${file.filename}</a>` : file.filename}</div></div>`).join("") || `<p class="muted">Sin soportes.</p>`}</div>
    </section>
    <section>
      <h3>Timeline</h3>
      <div class="timeline">${(op.events || []).map((event) => `<div class="timeline-item"><strong>${event.description}</strong><div class="muted">${new Date(event.created_at).toLocaleString()} ${event.comment ? `· ${event.comment}` : ""}</div></div>`).join("")}</div>
    </section>
  `, `
    ${canMaster && op.status === "pending_master" ? `<button class="subtle" data-status-op="${op.id}" data-status="in_negotiation" type="button">En negociación</button>` : ""}
    ${canMaster && ["in_negotiation", "pending_master"].includes(op.status) ? `<button class="primary" data-rate-op="${op.id}" type="button">Cargar tasa</button>` : ""}
    ${canClientApprove ? `<button class="danger" data-decision-op="${op.id}" data-decision="reject" type="button">${t("reject")}</button><button class="primary" data-decision-op="${op.id}" data-decision="approve" type="button">${t("approve")}</button>` : ""}
    ${canMaster && op.status === "approved" ? `<button class="primary" data-execute-op="${op.id}" type="button">${t("execute")}</button>` : ""}
  `);
}

function openRateModal(id) {
  const op = state.data.operations.find((item) => item.id === id);
  openModal("Cargar tasa", `
    <form data-rate-form="${id}" class="form-grid">
      <label>Tasa conseguida<input name="rate" type="number" step="0.0001" value="${op.rate || ""}" required /></label>
      <label>Tasa Binance<input name="binance_rate" type="number" step="0.0001" value="${op.binance_rate || ""}" /></label>
      <label>Cuenta salida<select name="source_account_id">${accountOptions(op.type === "sell_usd" ? "USD" : "VES", op.source_account_id)}</select></label>
      <label>Cuenta entrada<select name="destination_account_id">${accountOptions(op.type === "sell_usd" ? "VES" : "USD", op.destination_account_id)}</select></label>
      <label class="full">Comentario<textarea name="comment" rows="3"></textarea></label>
      <div class="full"><button class="primary" type="submit">Enviar a aprobación cliente</button></div>
    </form>
  `);
}

function openExecuteModal(id) {
  const op = state.data.operations.find((item) => item.id === id);
  openModal("Ejecutar operación", `
    <form data-execute-form="${id}" class="form-grid" enctype="multipart/form-data">
      <label>USD<input name="usd_amount" type="number" step="0.01" value="${op.usd_amount || 0}" /></label>
      <label>VES<input name="ves_amount" type="number" step="0.01" value="${op.ves_amount || 0}" /></label>
      <label>Cuenta salida<select name="source_account_id">${accountOptions("", op.source_account_id)}</select></label>
      <label>Cuenta entrada<select name="destination_account_id">${accountOptions("", op.destination_account_id)}</select></label>
      <label class="full">Comprobante salida USD<input name="usd_exit_support" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" /></label>
      <label class="full">Comprobante entrada VES<input name="ves_entry_support" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" /></label>
      <label class="full">Comentario<textarea name="comment" rows="3"></textarea></label>
      <div class="full"><button class="primary" type="submit">${t("execute")}</button></div>
    </form>
  `);
}

function objectFromForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function submitJson(path, method, form) {
  await api(path, { method, body: JSON.stringify(objectFromForm(form)) });
  closeModal();
  await load();
  toast("Guardado.");
}

document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) setView(nav.dataset.nav);
  if (event.target.closest("#openDrawer")) openDrawer();
  if (event.target.closest("#closeDrawer") || event.target.closest("#drawerBackdrop") || event.target.closest("[data-close-modal]")) closeDrawer(), closeModal();
  if (event.target.closest("#enterApp")) {
    qs("#landing").classList.add("hidden");
    qs("#appShell").classList.remove("hidden");
    openDrawer();
  }
  if (event.target.closest("#languageToggle") || event.target.closest("#landingLang")) {
    state.lang = state.lang === "es" ? "en" : "es";
    localStorage.setItem("partnerportal_lang", state.lang);
    renderShell();
    renderView();
  }
  if (event.target.closest("[data-action='open-treasury']")) openTreasuryModal();
  if (event.target.closest("[data-action='new-account']")) openAccountModal(event.target.closest("[data-action]").dataset.owner);
  if (event.target.closest("[data-action='new-beneficiary']")) openBeneficiaryModal();
  if (event.target.closest("[data-action='new-user']")) openUserModal();
  if (event.target.closest("[data-action='new-category']")) openCategoryModal();

  const openOp = event.target.closest("[data-open-operation]");
  if (openOp) openOperationDetail(openOp.dataset.openOperation);

  const editAccount = event.target.closest("[data-edit-account]");
  if (editAccount) openAccountModal(null, state.data.accounts.find((item) => item.id === editAccount.dataset.editAccount));
  const editBen = event.target.closest("[data-edit-beneficiary]");
  if (editBen) openBeneficiaryModal(state.data.beneficiaries.find((item) => item.id === editBen.dataset.editBeneficiary));
  const editUser = event.target.closest("[data-edit-user]");
  if (editUser) openUserModal(state.data.users.find((item) => item.id === editUser.dataset.editUser));
  const editCategory = event.target.closest("[data-edit-category]");
  if (editCategory) openCategoryModal(state.data.categories.find((item) => item.id === editCategory.dataset.editCategory));

  const deleteAccount = event.target.closest("[data-delete-account]");
  if (deleteAccount && confirm("¿Borrar cuenta?")) await api(`/api/accounts/${deleteAccount.dataset.deleteAccount}`, { method: "DELETE" }), await load();
  const deleteBen = event.target.closest("[data-delete-beneficiary]");
  if (deleteBen && confirm("¿Borrar beneficiario?")) await api(`/api/beneficiaries/${deleteBen.dataset.deleteBeneficiary}`, { method: "DELETE" }), await load();
  const deleteUser = event.target.closest("[data-delete-user]");
  if (deleteUser && confirm("¿Desactivar usuario?")) await api(`/api/users/${deleteUser.dataset.deleteUser}`, { method: "DELETE" }), await load();
  const deleteCategory = event.target.closest("[data-delete-category]");
  if (deleteCategory && confirm("¿Borrar categoría?")) await api(`/api/categories/${deleteCategory.dataset.deleteCategory}`, { method: "DELETE" }), await load();

  const statusOp = event.target.closest("[data-status-op]");
  if (statusOp) await api(`/api/operations/${statusOp.dataset.statusOp}/status`, { method: "POST", body: JSON.stringify({ status: statusOp.dataset.status }) }), closeModal(), await load();
  const rateOp = event.target.closest("[data-rate-op]");
  if (rateOp) openRateModal(rateOp.dataset.rateOp);
  const execOp = event.target.closest("[data-execute-op]");
  if (execOp) openExecuteModal(execOp.dataset.executeOp);
  const decision = event.target.closest("[data-decision-op]");
  if (decision) {
    const comment = prompt("Comentario obligatorio");
    if (comment) await api(`/api/operations/${decision.dataset.decisionOp}/decision`, { method: "POST", body: JSON.stringify({ decision: decision.dataset.decision, comment }) }), closeModal(), await load();
  }
});

document.addEventListener("change", (event) => {
  const filter = event.target.closest("[data-filter]");
  if (filter) {
    state.filters[filter.dataset.filter] = filter.value;
    renderOperations();
  }
  const usage = event.target.closest("[data-usage-category]");
  if (usage) {
    const select = qs("[data-beneficiary-select]");
    if (select) select.innerHTML = beneficiaryOptionsForCategory(usage.value);
  }
});

document.addEventListener("input", (event) => {
  const filter = event.target.closest("[data-filter]");
  if (filter) {
    state.filters[filter.dataset.filter] = filter.value;
    renderOperations();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  try {
    if (form.matches("[data-treasury-form]")) {
      event.preventDefault();
      const data = new FormData(form);
      await api("/api/treasury-requests", { method: "POST", body: data });
      closeModal();
      await load();
      toast("Solicitud creada.");
    }
    if (form.matches("[data-account-form]")) {
      event.preventDefault();
      const id = form.dataset.accountForm;
      await submitJson(id ? `/api/accounts/${id}` : "/api/accounts", id ? "PUT" : "POST", form);
    }
    if (form.matches("[data-beneficiary-form]")) {
      event.preventDefault();
      const id = form.dataset.beneficiaryForm;
      await submitJson(id ? `/api/beneficiaries/${id}` : "/api/beneficiaries", id ? "PUT" : "POST", form);
    }
    if (form.matches("[data-user-form]")) {
      event.preventDefault();
      const id = form.dataset.userForm;
      await submitJson(id ? `/api/users/${id}` : "/api/users", id ? "PUT" : "POST", form);
    }
    if (form.matches("[data-category-form]")) {
      event.preventDefault();
      const id = form.dataset.categoryForm;
      await submitJson(id ? `/api/categories/${id}` : "/api/categories", id ? "PUT" : "POST", form);
    }
    if (form.matches("[data-rate-form]")) {
      event.preventDefault();
      await submitJson(`/api/operations/${form.dataset.rateForm}/rate`, "POST", form);
    }
    if (form.matches("[data-execute-form]")) {
      event.preventDefault();
      const data = new FormData(form);
      data.append("usd_exit_support_label", "Comprobante salida USD");
      data.append("ves_entry_support_label", "Comprobante entrada VES");
      await api(`/api/operations/${form.dataset.executeForm}/execute`, { method: "POST", body: data });
      closeModal();
      await load();
      toast("Operación ejecutada.");
    }
    if (form.matches("[data-settings-form]")) {
      event.preventDefault();
      await submitJson("/api/settings", "POST", form);
    }
  } catch (error) {
    toast(error.message);
  }
});

qs("#roleSelect").addEventListener("change", async (event) => {
  state.role = event.target.value;
  localStorage.setItem("partnerportal_role", state.role);
  await load();
});

load().catch((error) => toast(error.message));
