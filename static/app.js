const state = {
  role: localStorage.getItem("partnerportal_role") || "magna_admin",
  userId: localStorage.getItem("partnerportal_user_id") || "",
  lang: localStorage.getItem("partnerportal_lang") || "es",
  view: "dashboard",
  data: null,
  filters: {},
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

const labels = {
  es: {
    landingEyebrow: "Portal de Tesorería Partner",
    landingTitle: "Infraestructura privada para FX, pagos y conciliación.",
    landingBody: "Flujos seguros de aprobación, trazabilidad por cuenta y ejecución auditable entre Magna Equity y Yango.",
    login: "Login",
    loginTitle: "Acceso al portal",
    emailAddress: "Email",
    password: "Clave",
    signIn: "Entrar",
    userPassword: "Clave de usuario",
    optionalPassword: "Nueva clave (opcional)",
    secureAccess: "Acceso seguro",
    loginPanelBody: "Ingresa con tu usuario autorizado para acceder al portal operativo.",
    viewEyebrow: "Centro de comando de tesorería",
    dashboard: "Dashboard",
    treasury: "Tesorería",
    approvals: "Aprobaciones",
    operations: "Operaciones",
    accounts: "Beneficiarios",
    clientAccounts: "Cuentas Cliente",
    users: "User Management",
    balances: "Saldos",
    settings: "Configuración",
    pipeline: "Pipeline operativo",
    recentActivity: "Actividad reciente",
    treasuryRequests: "Solicitudes de tesorería",
    approvalsInbox: "Bandeja de aprobaciones",
    approvalsSubtitle: "Tasas, negociación y ejecución",
    operationsLedger: "Libro de operaciones",
    newRequest: "Nueva solicitud",
    newAccount: "Nueva cuenta",
    newBeneficiary: "Nuevo beneficiario",
    newUser: "Nuevo usuario",
    newCategory: "Nueva categoría",
    edit: "Editar",
    delete: "Borrar",
    cancel: "Cancelar",
    save: "Guardar",
    view: "Ver",
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
    code: "Código",
    type: "Tipo",
    allTypes: "Tipo",
    allStatuses: "Status",
    dateFrom: "Desde",
    dateTo: "Hasta",
    minUsd: "Min USD",
    minVes: "Min VES",
    amountUsd: "Monto USD",
    amountVes: "Monto VES",
    noOperations: "Sin operaciones.",
    noAccounts: "Sin cuentas.",
    noBeneficiaries: "Sin beneficiarios.",
    noSupport: "Sin soportes.",
    noActivity: "Sin actividad.",
    netUsd: "USD neto",
    netVes: "VES neto",
    operationCount: "Operaciones",
    weightedRate: "Tasa ponderada",
    buyUsd: "Compra USD",
    sellUsd: "Venta USD",
    payment: "Pago",
    partnerPayment: "Pago a partner",
    providerPayment: "Pago a proveedor",
    beneficiaries: "Beneficiarios",
    name: "Nombre",
    email: "Email",
    role: "Rol",
    bankPlatform: "Banco / plataforma",
    holder: "Titular",
    initialBalance: "Saldo inicial",
    currentBalance: "Saldo actual",
    bankFee: "Comisión",
    bankFeePercent: "Comisión bancaria %",
    accountNumber: "Número de cuenta",
    accountType: "Tipo cuenta",
    identification: "Identificación",
    currency: "Currency",
    externalLink: "Link externo",
    notes: "Notas",
    client: "Cliente",
    magna: "Magna",
    operationalSettings: "Configuración operativa",
    rateExpirationMinutes: "Vigencia tasa minutos",
    newTreasuryRequest: "Nueva solicitud de tesorería",
    operationSide: "Tipo",
    inputCurrency: "Imputar monto en",
    expectedRate: "Tasa esperada",
    usage: "Uso",
    beneficiary: "Beneficiario",
    comment: "Comentario",
    deliveryNoteInvoice: "Nota de entrega / factura",
    editAccount: "Editar cuenta",
    editBeneficiary: "Editar beneficiario",
    editUser: "Editar usuario",
    editCategory: "Editar categoría",
    categoryManagement: "Category Management",
    kind: "Tipo",
    operationDetail: "Detalle de operación",
    support: "Soportes",
    openSupport: "Abrir soporte",
    download: "Descargar",
    timeline: "Timeline",
    loadRate: "Cargar tasa",
    achievedRate: "Tasa conseguida",
    outboundAccount: "Cuenta salida",
    inboundAccount: "Cuenta entrada",
    sendClientApproval: "Enviar a aprobación cliente",
    executeOperation: "Ejecutar operación",
    usdExitSupport: "Comprobante salida USD",
    vesEntrySupport: "Comprobante entrada VES",
    inNegotiation: "En negociación",
    requiredComment: "Comentario obligatorio",
    decisionTitleApprove: "Aprobar operación",
    decisionTitleReject: "Rechazar operación",
    decisionCommentHelp: "Deja el comentario de trazabilidad para completar esta acción.",
    saved: "Guardado.",
    decisionSaved: "Decisión registrada.",
    requestCreated: "Solicitud creada.",
    operationExecuted: "Operación ejecutada.",
    deleteAccountConfirm: "¿Borrar cuenta?",
    deleteBeneficiaryConfirm: "¿Borrar beneficiario?",
    deleteUserConfirm: "¿Desactivar usuario?",
    deleteCategoryConfirm: "¿Borrar categoría?",
    masterRole: "Master · Magna",
    superApproverRole: "Cliente · Super-approver",
    treasuryRole: "Cliente · Tesorería",
    financeRole: "Cliente · Finanzas",
    usd: "USD",
    ves: "VES",
    date: "Fecha",
    roleView: "Vista / rol",
  },
  en: {
    landingEyebrow: "Partner Treasury Portal",
    landingTitle: "Private operating infrastructure for FX, payments and reconciliation.",
    landingBody: "Secure approval workflows, account-level traceability and auditable execution between Magna Equity and Yango.",
    login: "Login",
    loginTitle: "Portal access",
    emailAddress: "Email",
    password: "Password",
    signIn: "Sign in",
    userPassword: "User password",
    optionalPassword: "New password (optional)",
    secureAccess: "Secure access",
    loginPanelBody: "Sign in with your authorized user to access the operating portal.",
    viewEyebrow: "Treasury command center",
    dashboard: "Dashboard",
    treasury: "Treasury",
    approvals: "Approvals",
    operations: "Operations",
    accounts: "Beneficiaries",
    clientAccounts: "Client Accounts",
    users: "User Management",
    balances: "Balances",
    settings: "Settings",
    pipeline: "Operating pipeline",
    recentActivity: "Recent activity",
    treasuryRequests: "Treasury requests",
    approvalsInbox: "Approvals inbox",
    approvalsSubtitle: "Rates, negotiation and execution",
    operationsLedger: "Operations ledger",
    newRequest: "New request",
    newAccount: "New account",
    newBeneficiary: "New beneficiary",
    newUser: "New user",
    newCategory: "New category",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    view: "View",
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
    code: "Code",
    type: "Type",
    allTypes: "Type",
    allStatuses: "Status",
    dateFrom: "From",
    dateTo: "To",
    minUsd: "Min USD",
    minVes: "Min VES",
    amountUsd: "USD amount",
    amountVes: "VES amount",
    noOperations: "No operations.",
    noAccounts: "No accounts.",
    noBeneficiaries: "No beneficiaries.",
    noSupport: "No attachments.",
    noActivity: "No activity.",
    netUsd: "Net USD",
    netVes: "Net VES",
    operationCount: "Operations",
    weightedRate: "Weighted rate",
    buyUsd: "Buy USD",
    sellUsd: "Sell USD",
    payment: "Payment",
    partnerPayment: "Partner payment",
    providerPayment: "Provider payment",
    beneficiaries: "Beneficiaries",
    name: "Name",
    email: "Email",
    role: "Role",
    bankPlatform: "Bank / platform",
    holder: "Holder",
    initialBalance: "Initial balance",
    currentBalance: "Current balance",
    bankFee: "Fee",
    bankFeePercent: "Bank fee %",
    accountNumber: "Account number",
    accountType: "Account type",
    identification: "Identification",
    currency: "Currency",
    externalLink: "External link",
    notes: "Notes",
    client: "Client",
    magna: "Magna",
    operationalSettings: "Operational settings",
    rateExpirationMinutes: "Rate expiration minutes",
    newTreasuryRequest: "New treasury request",
    operationSide: "Type",
    inputCurrency: "Input amount in",
    expectedRate: "Expected rate",
    usage: "Use",
    beneficiary: "Beneficiary",
    comment: "Comment",
    deliveryNoteInvoice: "Delivery note / invoice",
    editAccount: "Edit account",
    editBeneficiary: "Edit beneficiary",
    editUser: "Edit user",
    editCategory: "Edit category",
    categoryManagement: "Category Management",
    kind: "Kind",
    operationDetail: "Operation detail",
    support: "Attachments",
    openSupport: "Open attachment",
    download: "Download",
    timeline: "Timeline",
    loadRate: "Load rate",
    achievedRate: "Achieved rate",
    outboundAccount: "Outbound account",
    inboundAccount: "Inbound account",
    sendClientApproval: "Send to client approval",
    executeOperation: "Execute operation",
    usdExitSupport: "USD outbound receipt",
    vesEntrySupport: "VES inbound receipt",
    inNegotiation: "In negotiation",
    requiredComment: "Required comment",
    decisionTitleApprove: "Approve operation",
    decisionTitleReject: "Reject operation",
    decisionCommentHelp: "Add the traceability comment to complete this action.",
    saved: "Saved.",
    decisionSaved: "Decision saved.",
    requestCreated: "Request created.",
    operationExecuted: "Operation executed.",
    deleteAccountConfirm: "Delete account?",
    deleteBeneficiaryConfirm: "Delete beneficiary?",
    deleteUserConfirm: "Deactivate user?",
    deleteCategoryConfirm: "Delete category?",
    masterRole: "Master · Magna",
    superApproverRole: "Client · Super-approver",
    treasuryRole: "Client · Treasury",
    financeRole: "Client · Finance",
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
  return labels[state.lang]?.[key] || labels.es[key] || key;
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  qsa("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  const roleLabels = {
    magna_admin: t("masterRole"),
    super_approver: t("superApproverRole"),
    treasury: t("treasuryRole"),
    finance: t("financeRole"),
  };
  qsa("[data-role-option]").forEach((node) => {
    node.textContent = roleLabels[node.dataset.roleOption] || node.textContent;
  });
  const toggleLabel = state.lang.toUpperCase();
  const languageToggle = qs("#languageToggle");
  const landingLang = qs("#landingLang");
  if (languageToggle) languageToggle.textContent = toggleLabel;
  if (landingLang) landingLang.textContent = toggleLabel;
}

function money(value, currency = "") {
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
  return currency ? `${formatted} ${currency}` : formatted;
}

function statusClass(status = "") {
  return status.replaceAll(" ", "_");
}

function typeLabel(type, metadata = {}) {
  if (type === "buy_usd") return t("buyUsd");
  if (type === "sell_usd") return t("sellUsd");
  if (type === "payment") return metadata.payment_type === "partner" ? t("partnerPayment") : t("providerPayment");
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
  return { "X-Role": state.role, "X-User-Id": state.userId, ...extra };
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
  applyLanguage();
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
      <article class="metric-card"><span>${t("operationCount")}</span><strong>${stats.count}</strong></article>
      <article class="metric-card"><span>${t("netUsd")}</span><strong class="${stats.usd < 0 ? "amount-negative" : "amount-positive"}">${money(stats.usd, "USD")}</strong></article>
      <article class="metric-card"><span>${t("netVes")}</span><strong class="${stats.ves < 0 ? "amount-negative" : "amount-positive"}">${money(stats.ves, "VES")}</strong></article>
      <article class="metric-card"><span>${t("weightedRate")}</span><strong>${stats.weighted ? money(stats.weighted) : "—"}</strong></article>
    </div>
  `;
}

function renderDashboard() {
  const ops = state.data.operations;
  qs("#viewBody").innerHTML = `
    ${metricCards(ops)}
    <section class="grid-2">
      <article class="panel">
        <div class="panel-header"><h2>${t("pipeline")}</h2></div>
        ${operationTable(ops.slice(0, 8), false)}
      </article>
      <article class="panel">
        <div class="panel-header"><h2>${t("recentActivity")}</h2></div>
        <div class="timeline">
          ${ops.flatMap((op) => (op.events || []).map((event) => ({ ...event, op })))
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 8)
            .map((event) => `<div class="timeline-item"><strong>${event.description}</strong><div class="muted">${event.op.id} · ${new Date(event.created_at).toLocaleString()}</div></div>`)
            .join("") || `<p class="muted">${t("noActivity")}</p>`}
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
        <h2>${t("treasuryRequests")}</h2>
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
      <div class="panel-header"><h2>${t("approvalsInbox")}</h2><span class="muted">${t("approvalsSubtitle")}</span></div>
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
      <div class="panel-header"><h2>${t("operationsLedger")}</h2></div>
      <div class="toolbar">
        <select data-filter="type">
          <option value="">${t("allTypes")}</option>
          <option value="buy_usd" ${state.filters.type === "buy_usd" ? "selected" : ""}>${t("buyUsd")}</option>
          <option value="sell_usd" ${state.filters.type === "sell_usd" ? "selected" : ""}>${t("sellUsd")}</option>
          <option value="payment" ${state.filters.type === "payment" ? "selected" : ""}>${t("payment")}</option>
        </select>
        <select data-filter="status"><option value="">${t("allStatuses")}</option>${statuses.map((status) => `<option ${state.filters.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>
        <input data-filter="date_from" type="date" value="${state.filters.date_from || ""}" />
        <input data-filter="date_to" type="date" value="${state.filters.date_to || ""}" />
        <input data-filter="min_usd" type="number" step="0.01" placeholder="${t("minUsd")}" value="${state.filters.min_usd || ""}" />
        <input data-filter="min_ves" type="number" step="0.01" placeholder="${t("minVes")}" value="${state.filters.min_ves || ""}" />
        <select data-filter="account"><option value="">${t("account")}</option>${accountOptions}</select>
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
            <th>${t("code")}</th>
            <th>${t("category")}</th>
            <th>USD</th>
            <th>VES</th>
            <th>${t("rate")}</th>
            <th>${t("status")}</th>
            <th>${t("account")}</th>
            <th>${t("date")}</th>
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
              ${actions ? `<td><button class="subtle" data-open-operation="${op.id}" type="button">${t("view")}</button></td>` : ""}
            </tr>
          `).join("") || `<tr><td colspan="${actions ? 9 : 8}" class="muted">${t("noOperations")}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderAccountsBeneficiaries() {
  qs("#viewBody").innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2>${t("beneficiaries")}</h2>
        <div class="row-actions">
          <button class="ghost-button" data-action="new-beneficiary" type="button">${t("newBeneficiary")}</button>
        </div>
      </div>
      ${beneficiariesTable(state.data.beneficiaries)}
    </section>
  `;
}

function renderClientAccounts() {
  const clientAccounts = state.data.accounts.filter((account) => account.owner === "client");
  qs("#viewBody").innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2>${t("clientAccounts")}</h2>
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
        <thead><tr><th>${t("name")}</th><th>${t("currency")}</th><th>${t("bankPlatform")}</th><th>${t("holder")}</th><th>${t("initialBalance")}</th><th>${t("currentBalance")}</th><th>${t("bankFee")}</th><th></th></tr></thead>
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
          `).join("") || `<tr><td colspan="8" class="muted">${t("noAccounts")}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function beneficiariesTable(items) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>${t("name")}</th><th>${t("category")}</th><th>${t("bankPlatform")}</th><th>${t("account")}</th><th>${t("identification")}</th><th>${t("currency")}</th><th></th></tr></thead>
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
          `).join("") || `<tr><td colspan="7" class="muted">${t("noBeneficiaries")}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderUsers() {
  qs("#viewBody").innerHTML = `
    <section class="grid-2">
      <article class="panel">
        <div class="panel-header"><h2>${t("users")}</h2><button class="primary" data-action="new-user" type="button">${t("newUser")}</button></div>
        ${usersTable()}
      </article>
      <article class="panel">
        <div class="panel-header"><h2>${t("categoryManagement")}</h2><button class="primary" data-action="new-category" type="button">${t("newCategory")}</button></div>
        ${categoriesTable()}
      </article>
    </section>
  `;
}

function usersTable() {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>${t("name")}</th><th>${t("email")}</th><th>${t("role")}</th><th>${t("status")}</th><th></th></tr></thead>
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
        <thead><tr><th>${t("name")}</th><th>${t("kind")}</th><th>${t("status")}</th><th></th></tr></thead>
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
          <span>${account.owner === "client" ? t("client") : t("magna")} · ${account.currency}</span>
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
      <div class="panel-header"><h2>${t("operationalSettings")}</h2></div>
      <form data-settings-form class="form-grid">
        <label>${t("rateExpirationMinutes")}<input name="rate_expiration_minutes" type="number" min="1" max="60" value="${state.data.settings.rate_expiration_minutes || 7}" /></label>
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

function openAttachmentViewer(path, filename, contentType = "") {
  const url = `/uploads/${path}`;
  const lowerName = (filename || "").toLowerCase();
  const isPdf = contentType.includes("pdf") || lowerName.endsWith(".pdf");
  const isImage = contentType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName);
  const preview = isPdf
    ? `<iframe class="file-preview-frame" src="${url}" title="${filename}"></iframe>`
    : isImage
      ? `<img class="file-preview-image" src="${url}" alt="${filename}" />`
      : `<div class="file-preview-empty"><p class="muted">${filename}</p><a class="primary" href="${url}" target="_blank" rel="noreferrer">${t("download")}</a></div>`;
  qs("#modalRoot").insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop attachment-backdrop" data-attachment-modal>
      <section class="modal attachment-modal">
        <header class="modal-header">
          <h2>${filename}</h2>
          <button class="icon-button" data-close-attachment type="button">×</button>
        </header>
        <div class="modal-body">${preview}</div>
      </section>
    </div>
  `);
}

function closeAttachmentViewer() {
  qs("[data-attachment-modal]")?.remove();
}

function openLoginModal() {
  openModal(t("loginTitle"), `
    <form data-login-form class="form-grid">
      <label class="full">${t("emailAddress")}<input name="email" type="email" autocomplete="username" required /></label>
      <label class="full">${t("password")}<input name="password" type="password" autocomplete="current-password" required /></label>
      <div class="full"><button class="primary" type="submit">${t("signIn")}</button></div>
    </form>
  `);
}

function openTreasuryModal() {
  const categories = state.data.categories.filter((cat) => cat.kind === "treasury_usage");
  openModal(t("newTreasuryRequest"), `
    <form data-treasury-form class="form-grid" enctype="multipart/form-data">
      <label>${t("operationSide")}
        <select name="operation_side" data-treasury-side>
          <option value="sell">${t("sellUsd")}</option>
          <option value="buy">${t("buyUsd")}</option>
        </select>
      </label>
      <label>${t("inputCurrency")}
        <select name="input_currency">
          <option value="VES">VES</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label>${t("amountUsd")}<input name="usd_amount" type="number" step="0.01" /></label>
      <label>${t("amountVes")}<input name="ves_amount" type="number" step="0.01" /></label>
      <label>${t("expectedRate")}<input name="expected_rate" type="number" step="0.0001" /></label>
      <label>${t("usage")}
        <select name="usage_category_id" data-usage-category>
          ${categories.map((cat) => `<option value="${cat.id}">${cat.name}</option>`).join("")}
        </select>
      </label>
      <label>${t("beneficiary")}
        <select name="beneficiary_id" data-beneficiary-select>${beneficiaryOptionsForCategory(categories[0]?.id)}</select>
      </label>
      <label class="full">${t("comment")}<textarea name="comment" rows="3"></textarea></label>
      <label class="full">${t("deliveryNoteInvoice")}<input name="support" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" /></label>
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
  openModal(account.id ? t("editAccount") : t("newAccount"), `
    <form data-account-form="${account.id || ""}" class="form-grid">
      <input type="hidden" name="owner" value="${owner || account.owner || "magna"}" />
      <label>${t("name")}<input name="name" value="${account.name || ""}" required /></label>
      <label>${t("currency")}<select name="currency"><option ${account.currency === "USD" ? "selected" : ""}>USD</option><option ${account.currency !== "USD" ? "selected" : ""}>VES</option></select></label>
      <label>${t("bankPlatform")}<input name="institution" value="${account.institution || ""}" /></label>
      <label>${t("accountNumber")}<input name="account_number" value="${account.account_number || ""}" /></label>
      <label>${t("holder")}<input name="beneficiary_name" value="${account.beneficiary_name || ""}" /></label>
      <label>${t("accountType")}<select name="account_type"><option value="bank" ${account.account_type === "bank" ? "selected" : ""}>Bank</option><option value="wallet" ${account.account_type === "wallet" ? "selected" : ""}>Wallet / custody</option></select></label>
      <label>${t("bankFeePercent")}<input name="bank_fee_percent" type="number" step="0.01" value="${account.bank_fee_percent || 0}" /></label>
      <label>${t("initialBalance")}<input name="initial_balance" type="number" step="0.01" value="${account.initial_balance ?? account.balance ?? 0}" /></label>
      <label class="full">${t("externalLink")}<input name="external_url" value="${account.external_url || ""}" /></label>
      <label class="full">${t("notes")}<textarea name="notes" rows="3">${account.notes || ""}</textarea></label>
      <div class="full"><button class="primary" type="submit">${t("save")}</button></div>
    </form>
  `);
}

function openBeneficiaryModal(item = {}) {
  openModal(item.id ? t("editBeneficiary") : t("newBeneficiary"), `
    <form data-beneficiary-form="${item.id || ""}" class="form-grid">
      <label>${t("name")}<input name="name" value="${item.name || ""}" required /></label>
      <label>${t("category")}<select name="category"><option value="partner" ${item.category === "partner" ? "selected" : ""}>Partner</option><option value="provider" ${item.category === "provider" ? "selected" : ""}>Provider</option></select></label>
      <label>${t("bankPlatform")}<input name="bank" value="${item.bank || ""}" /></label>
      <label>${t("accountNumber")}<input name="account_number" value="${item.account_number || ""}" /></label>
      <label>${t("accountType")}<input name="account_type" value="${item.account_type || "corriente"}" /></label>
      <label>${t("currency")}<select name="currency"><option ${item.currency === "USD" ? "selected" : ""}>USD</option><option ${item.currency !== "USD" ? "selected" : ""}>VES</option></select></label>
      <label class="full">${t("identification")}<input name="identification" value="${item.identification || ""}" /></label>
      <div class="full"><button class="primary" type="submit">${t("save")}</button></div>
    </form>
  `);
}

function openUserModal(user = {}) {
  openModal(user.id ? t("editUser") : t("newUser"), `
    <form data-user-form="${user.id || ""}" class="form-grid">
      <label>${t("name")}<input name="name" value="${user.name || ""}" required /></label>
      <label>${t("email")}<input name="email" type="email" value="${user.email || ""}" required /></label>
      <label>${t("role")}<select name="role">
        ${["magna_admin", "super_approver", "treasury", "finance"].map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>`).join("")}
      </select></label>
      <label>${t("status")}<select name="status"><option value="active" ${user.status !== "inactive" ? "selected" : ""}>active</option><option value="inactive" ${user.status === "inactive" ? "selected" : ""}>inactive</option></select></label>
      <label class="full">${user.id ? t("optionalPassword") : t("userPassword")}<input name="password" type="password" autocomplete="new-password" ${user.id ? "" : "required"} /></label>
      <div class="full"><button class="primary" type="submit">${t("save")}</button></div>
    </form>
  `);
}

function openCategoryModal(category = {}) {
  openModal(category.id ? t("editCategory") : t("newCategory"), `
    <form data-category-form="${category.id || ""}" class="form-grid">
      <label>${t("name")}<input name="name" value="${category.name || ""}" required /></label>
      <label>${t("kind")}<input name="kind" value="${category.kind || "treasury_usage"}" required /></label>
      <label>${t("status")}<select name="status"><option value="active" ${category.status !== "inactive" ? "selected" : ""}>active</option><option value="inactive" ${category.status === "inactive" ? "selected" : ""}>inactive</option></select></label>
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
      <div class="detail-item"><span>${t("category")}</span><strong>${typeLabel(op.type, op.metadata || {})}</strong></div>
      <div class="detail-item"><span>${t("status")}</span><strong>${op.status}</strong></div>
      <div class="detail-item"><span>${t("rate")}</span><strong>${op.rate ? money(op.rate) : "—"}</strong></div>
      <div class="detail-item"><span>Binance</span><strong>${op.binance_rate ? money(op.binance_rate) : "—"}</strong></div>
      <div class="detail-item"><span>Spread</span><strong>${op.spread ? `${money(op.spread)}%` : "—"}</strong></div>
      <div class="detail-item"><span>${t("beneficiary")}</span><strong>${beneficiaryName(op.beneficiary_id)}</strong></div>
      <div class="detail-item"><span>USD</span><strong class="${Number(op.usd_amount) < 0 ? "amount-negative" : "amount-positive"}">${money(op.usd_amount, "USD")}</strong></div>
      <div class="detail-item"><span>VES</span><strong class="${Number(op.ves_amount) < 0 ? "amount-negative" : "amount-positive"}">${money(op.ves_amount, "VES")}</strong></div>
      <div class="detail-item"><span>${t("account")}</span><strong>${accountName(op.source_account_id || op.destination_account_id)}</strong></div>
    </div>
    <section>
      <h3>${t("support")}</h3>
      <div class="timeline">${(op.attachments || []).map((file) => `<div class="timeline-item"><strong>${file.label}</strong><div>${file.stored_path ? `<button class="subtle" data-preview-file="${file.stored_path}" data-preview-name="${file.filename}" data-preview-type="${file.content_type || ""}" type="button">${file.filename}</button>` : file.filename}</div></div>`).join("") || `<p class="muted">${t("noSupport")}</p>`}</div>
    </section>
    <section>
      <h3>${t("timeline")}</h3>
      <div class="timeline">${(op.events || []).map((event) => `<div class="timeline-item"><strong>${event.description}</strong><div class="muted">${new Date(event.created_at).toLocaleString()} ${event.comment ? `· ${event.comment}` : ""}</div></div>`).join("")}</div>
    </section>
  `, `
    ${canMaster && op.status === "pending_master" ? `<button class="subtle" data-status-op="${op.id}" data-status="in_negotiation" type="button">${t("inNegotiation")}</button>` : ""}
    ${canMaster && ["in_negotiation", "pending_master"].includes(op.status) ? `<button class="primary" data-rate-op="${op.id}" type="button">${t("loadRate")}</button>` : ""}
    ${canClientApprove ? `<button class="danger" data-decision-op="${op.id}" data-decision="reject" type="button">${t("reject")}</button><button class="primary" data-decision-op="${op.id}" data-decision="approve" type="button">${t("approve")}</button>` : ""}
    ${canMaster && op.status === "approved" ? `<button class="primary" data-execute-op="${op.id}" type="button">${t("execute")}</button>` : ""}
  `);
}

function openDecisionModal(id, decision) {
  const op = state.data.operations.find((item) => item.id === id);
  if (!op) return;
  const isApprove = decision === "approve";
  openModal(isApprove ? t("decisionTitleApprove") : t("decisionTitleReject"), `
    <form data-decision-form="${id}" data-decision="${decision}" class="form-grid">
      <p class="full muted">${op.id} · ${typeLabel(op.type, op.metadata || {})}</p>
      <label class="full">${t("requiredComment")}
        <textarea name="comment" rows="4" required autofocus placeholder="${t("decisionCommentHelp")}"></textarea>
      </label>
      <div class="full decision-actions">
        <button class="subtle" data-close-modal type="button">${t("cancel")}</button>
        <button class="${isApprove ? "primary" : "danger"}" type="submit">${isApprove ? t("approve") : t("reject")}</button>
      </div>
    </form>
  `);
}

function openRateModal(id) {
  const op = state.data.operations.find((item) => item.id === id);
  openModal(t("loadRate"), `
    <form data-rate-form="${id}" class="form-grid">
      <label>${t("achievedRate")}<input name="rate" type="number" step="0.0001" value="${op.rate || ""}" required /></label>
      <label>${t("binance")}<input name="binance_rate" type="number" step="0.0001" value="${op.binance_rate || ""}" /></label>
      <label>${t("outboundAccount")}<select name="source_account_id">${accountOptions(op.type === "sell_usd" ? "USD" : "VES", op.source_account_id)}</select></label>
      <label>${t("inboundAccount")}<select name="destination_account_id">${accountOptions(op.type === "sell_usd" ? "VES" : "USD", op.destination_account_id)}</select></label>
      <label class="full">${t("comment")}<textarea name="comment" rows="3"></textarea></label>
      <div class="full"><button class="primary" type="submit">${t("sendClientApproval")}</button></div>
    </form>
  `);
}

function openExecuteModal(id) {
  const op = state.data.operations.find((item) => item.id === id);
  openModal(t("executeOperation"), `
    <form data-execute-form="${id}" class="form-grid" enctype="multipart/form-data">
      <label>${t("amountUsd")}<input name="usd_amount" type="number" step="0.01" value="${op.usd_amount || 0}" /></label>
      <label>${t("amountVes")}<input name="ves_amount" type="number" step="0.01" value="${op.ves_amount || 0}" /></label>
      <label>${t("outboundAccount")}<select name="source_account_id">${accountOptions("", op.source_account_id)}</select></label>
      <label>${t("inboundAccount")}<select name="destination_account_id">${accountOptions("", op.destination_account_id)}</select></label>
      <label class="full">${t("usdExitSupport")}<input name="usd_exit_support" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" /></label>
      <label class="full">${t("vesEntrySupport")}<input name="ves_entry_support" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" /></label>
      <label class="full">${t("comment")}<textarea name="comment" rows="3"></textarea></label>
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
  toast(t("saved"));
}

document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) setView(nav.dataset.nav);
  if (event.target.closest("#openDrawer")) openDrawer();
  if (event.target.closest("[data-close-attachment]")) {
    closeAttachmentViewer();
    return;
  }
  const previewFile = event.target.closest("[data-preview-file]");
  if (previewFile) {
    openAttachmentViewer(previewFile.dataset.previewFile, previewFile.dataset.previewName, previewFile.dataset.previewType);
    return;
  }
  if (event.target.closest("#closeDrawer") || event.target.closest("#drawerBackdrop") || event.target.closest("[data-close-modal]")) closeDrawer(), closeModal();
  if (event.target.closest("#enterApp")) {
    openLoginModal();
  }
  if (event.target.closest("#languageToggle") || event.target.closest("#landingLang")) {
    state.lang = state.lang === "es" ? "en" : "es";
    localStorage.setItem("partnerportal_lang", state.lang);
    applyLanguage();
    if (state.data) {
      renderShell();
      renderView();
    }
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
  if (deleteAccount && confirm(t("deleteAccountConfirm"))) await api(`/api/accounts/${deleteAccount.dataset.deleteAccount}`, { method: "DELETE" }), await load();
  const deleteBen = event.target.closest("[data-delete-beneficiary]");
  if (deleteBen && confirm(t("deleteBeneficiaryConfirm"))) await api(`/api/beneficiaries/${deleteBen.dataset.deleteBeneficiary}`, { method: "DELETE" }), await load();
  const deleteUser = event.target.closest("[data-delete-user]");
  if (deleteUser && confirm(t("deleteUserConfirm"))) await api(`/api/users/${deleteUser.dataset.deleteUser}`, { method: "DELETE" }), await load();
  const deleteCategory = event.target.closest("[data-delete-category]");
  if (deleteCategory && confirm(t("deleteCategoryConfirm"))) await api(`/api/categories/${deleteCategory.dataset.deleteCategory}`, { method: "DELETE" }), await load();

  const statusOp = event.target.closest("[data-status-op]");
  if (statusOp) await api(`/api/operations/${statusOp.dataset.statusOp}/status`, { method: "POST", body: JSON.stringify({ status: statusOp.dataset.status }) }), closeModal(), await load();
  const rateOp = event.target.closest("[data-rate-op]");
  if (rateOp) openRateModal(rateOp.dataset.rateOp);
  const execOp = event.target.closest("[data-execute-op]");
  if (execOp) openExecuteModal(execOp.dataset.executeOp);
  const decision = event.target.closest("[data-decision-op]");
  if (decision) {
    openDecisionModal(decision.dataset.decisionOp, decision.dataset.decision);
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
    if (form.matches("[data-login-form]")) {
      event.preventDefault();
      const result = await api("/api/login", { method: "POST", body: JSON.stringify(objectFromForm(form)) });
      state.role = result.role;
      state.userId = result.user.id;
      localStorage.setItem("partnerportal_role", state.role);
      localStorage.setItem("partnerportal_user_id", state.userId);
      closeModal();
      qs("#landing").classList.add("hidden");
      qs("#appShell").classList.remove("hidden");
      await load();
      openDrawer();
      toast(`${t("loginTitle")}: ${result.user.name}`);
    }
    if (form.matches("[data-treasury-form]")) {
      event.preventDefault();
      const data = new FormData(form);
      await api("/api/treasury-requests", { method: "POST", body: data });
      closeModal();
      await load();
      toast(t("requestCreated"));
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
    if (form.matches("[data-decision-form]")) {
      event.preventDefault();
      await api(`/api/operations/${form.dataset.decisionForm}/decision`, {
        method: "POST",
        body: JSON.stringify({
          decision: form.dataset.decision,
          comment: objectFromForm(form).comment,
        }),
      });
      closeModal();
      await load();
      toast(t("decisionSaved"));
    }
    if (form.matches("[data-execute-form]")) {
      event.preventDefault();
      const data = new FormData(form);
      data.append("usd_exit_support_label", "Comprobante salida USD");
      data.append("ves_entry_support_label", "Comprobante entrada VES");
      await api(`/api/operations/${form.dataset.executeForm}/execute`, { method: "POST", body: data });
      closeModal();
      await load();
      toast(t("operationExecuted"));
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

applyLanguage();
load().catch((error) => toast(error.message));
