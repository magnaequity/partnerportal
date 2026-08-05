const state = {
  role: localStorage.getItem("partnerportal_role") || "",
  userId: localStorage.getItem("partnerportal_user_id") || "",
  lang: localStorage.getItem("partnerportal_lang") || "es",
  theme: localStorage.getItem("partnerportal_theme") || "light",
  view: "dashboard",
  data: null,
  filters: {},
  dashboardFilters: {},
  dashboardGranularity: localStorage.getItem("partnerportal_dashboard_granularity") || "day",
  lastActionableIds: new Set(),
  actionableBaselineReady: false,
  notificationOpen: false,
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];
const UNASSIGNED_USE = "unassigned_use";
const INCREASE_POSITION_USE = "increase_position";
const REFRESH_INTERVAL_MS = 20000;
let refreshTimer = null;

const labels = {
  es: {
    landingEyebrow: "Portal de Tesorería Partner",
    landingTitle: "Infraestructura privada para FX, pagos y conciliación.",
    landingBody: "Flujos seguros de aprobación, trazabilidad por cuenta y ejecución auditable para operaciones institucionales.",
    login: "Login",
    loginTitle: "Acceso al portal",
    emailAddress: "Email",
    password: "Clave",
    signIn: "Entrar",
    userPassword: "Clave de usuario",
    optionalPassword: "Nueva clave (opcional)",
    viewEyebrow: "Centro de comando de tesorería",
    dashboard: "Dashboard",
    treasury: "Tesorería",
    approvals: "Aprobaciones",
    operations: "Operaciones",
    accounts: "Beneficiarios",
    clientAccounts: "Cuentas Cliente",
    users: "User Management",
    settings: "Configuración",
    darkMode: "Modo oscuro",
    recentActivity: "Actividad reciente",
    dailySummary: "Resumen diario",
    weeklySummary: "Resumen semanal",
    monthlySummary: "Resumen mensual",
    granularity: "Granularidad",
    dailyGranularity: "Diario",
    weeklyGranularity: "Semanal",
    monthlyGranularity: "Mensual",
    weekOf: "Semana",
    currentBalances: "Saldos actuales",
    operationalSummary: "Resumen operativo",
    usdFlow: "Compras y ventas USD",
    usdFlowTitle: "Compra USD / Venta USD",
    dailyRates: "Tasas diarias",
    qtyOperations: "Qty operaciones",
    actionables: "Accionables",
    notifications: "Notificaciones",
    noNotifications: "Sin accionables pendientes.",
    newActionables: "accionable(s) nuevo(s) pendiente(s).",
    viewPending: "Ver pendientes",
    pendingApprovals: "Aprobaciones pendientes",
    pendingExecution: "Pendientes por ejecutar",
    awaitingClientApproval: "Tasas esperando aprobación cliente",
    approvedOrFunded: "Operaciones aprobadas o fondeadas",
    buyRate: "Tasa compra",
    sellRate: "Tasa venta",
    binanceRate: "Tasa Binance",
    partnerPayments: "Pagos a partners",
    providerPayments: "Pagos a proveedores",
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
    closeOperation: "Completar operación",
    approve: "Aprobar",
    reject: "Rechazar",
    reopen: "Reabrir",
    rate: "Tasa",
    binance: "Tasa Binance",
    fetchBinance: "Consultar Binance",
    binanceFeePercent: "Deducción Binance %",
    binanceRangePercent: "Rango permitido Binance %",
    withinRange: "OK",
    outsideRange: "NO OK",
    binanceRange: "Binance",
    rateRanges: "Rangos",
    binanceOkRate: "Binance OK %",
    weightedBinanceSpread: "Spread ponderado Binance",
    spread: "Spread",
    status: "Status",
    account: "Cuenta",
    transaction: "Transacción",
    category: "Categoría",
    code: "Código",
    type: "Tipo",
    allTypes: "Tipo",
    allStatuses: "Status",
    dateFilter: "Fecha",
    allDates: "Todas las fechas",
    today: "Hoy",
    yesterday: "Ayer",
    thisWeek: "Esta semana",
    previousWeek: "Semana anterior",
    last7Days: "7 días anteriores",
    last30Days: "30 días anteriores",
    previousMonth: "Mes anterior",
    last3Months: "3 meses anteriores",
    last12Months: "12 meses anteriores",
    customRange: "Rango de fechas fijo",
    amountFilter: "Monto",
    amountUsd: "Monto USD",
    amountVes: "Monto VES",
    clearFilters: "Limpiar",
    noOperations: "Sin operaciones.",
    noAccounts: "Sin cuentas.",
    noBeneficiaries: "Sin beneficiarios.",
    noBeneficiariesSelected: "Sin beneficiarios agregados.",
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
    bankFeeAmount: "Comisión bancaria",
    accountNumber: "Número de cuenta",
    accountType: "Tipo cuenta",
    identification: "Identificación",
    currency: "Currency",
    externalLink: "Link externo",
    notes: "Notas",
    client: "Cliente",
    magna: "Magna",
    operationalSettings: "Configuración operativa",
    rateExpirationMinutes: "Vigencia aprobación de tasa (minutos)",
    newTreasuryRequest: "Nueva solicitud de tesorería",
    operationSide: "Tipo",
    inputCurrency: "Imputar monto en",
    expectedRate: "Tasa esperada",
    increasePosition: "Aumentar posición",
    usage: "Uso",
    unassignedUse: "Sin uso asignado todavía",
    beneficiary: "Beneficiario",
    paymentDistribution: "Distribución de pagos",
    selectBeneficiaries: "Selecciona un beneficiario y agrégalo a la distribución.",
    addBeneficiary: "Agregar beneficiario",
    remove: "Quitar",
    invoiceProof: "Factura / nota de entrega",
    paymentExecutionSupport: "Soporte de ejecución del pago",
    approvedAmountLocked: "Monto aprobado bloqueado",
    allocationTotal: "Total distribuido",
    allocationTarget: "Total venta VES",
    allocationMatches: "Cuadre correcto",
    allocationMismatch: "La suma debe ser igual al total VES de la venta.",
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
    editRate: "Editar tasa",
    achievedRate: "Tasa conseguida",
    outboundAccount: "Cuenta salida",
    inboundAccount: "Cuenta entrada",
    sendClientApproval: "Enviar a aprobación cliente",
    executeOperation: "Completar operación",
    usdExitSupport: "Prueba movimiento USD",
    vesExitSupport: "Prueba salida VES",
    usdReceiptSupport: "Prueba recepción USD (opcional)",
    vesReceiptSupport: "Prueba recepción VES (opcional)",
    inNegotiation: "En negociación",
    reopened: "Solicitud reabierta.",
    requiredComment: "Comentario obligatorio",
    decisionTitleApprove: "Aprobar operación",
    decisionTitleReject: "Rechazar operación",
    decisionCommentHelp: "Deja el comentario de trazabilidad para completar esta acción.",
    saved: "Guardado.",
    decisionSaved: "Decisión registrada.",
    requestCreated: "Solicitud creada.",
    operationExecuted: "Operación completada.",
    deleteAccountConfirm: "¿Borrar cuenta?",
    deleteBeneficiaryConfirm: "¿Borrar beneficiario?",
    deleteUserConfirm: "¿Desactivar usuario?",
    deleteCategoryConfirm: "¿Borrar categoría?",
    masterRole: "Master · Magna",
    superApproverRole: "Cliente · Super-approver",
    treasuryRole: "Cliente · Tesorería",
    financeRole: "Cliente · Finanzas",
    currentRole: "Rol activo",
    logout: "Salir",
    sessionExpired: "Tu sesión expiró. Inicia sesión nuevamente.",
    usd: "USD",
    ves: "VES",
    date: "Fecha",
  },
  en: {
    landingEyebrow: "Partner Treasury Portal",
    landingTitle: "Private operating infrastructure for FX, payments and reconciliation.",
    landingBody: "Secure approval workflows, account-level traceability and auditable execution for institutional operations.",
    login: "Login",
    loginTitle: "Portal access",
    emailAddress: "Email",
    password: "Password",
    signIn: "Sign in",
    userPassword: "User password",
    optionalPassword: "New password (optional)",
    viewEyebrow: "Treasury command center",
    dashboard: "Dashboard",
    treasury: "Treasury",
    approvals: "Approvals",
    operations: "Operations",
    accounts: "Beneficiaries",
    clientAccounts: "Client Accounts",
    users: "User Management",
    settings: "Settings",
    darkMode: "Dark mode",
    recentActivity: "Recent activity",
    dailySummary: "Daily summary",
    weeklySummary: "Weekly summary",
    monthlySummary: "Monthly summary",
    granularity: "Granularity",
    dailyGranularity: "Daily",
    weeklyGranularity: "Weekly",
    monthlyGranularity: "Monthly",
    weekOf: "Week of",
    currentBalances: "Current balances",
    operationalSummary: "Operating summary",
    usdFlow: "USD buys and sells",
    usdFlowTitle: "Buy USD / Sell USD",
    dailyRates: "Daily rates",
    qtyOperations: "Qty operations",
    actionables: "Actionables",
    notifications: "Notifications",
    noNotifications: "No pending actionables.",
    newActionables: "new pending actionable(s).",
    viewPending: "View pending",
    pendingApprovals: "Pending approvals",
    pendingExecution: "Pending execution",
    awaitingClientApproval: "Rates waiting for client approval",
    approvedOrFunded: "Approved or funded operations",
    buyRate: "Buy rate",
    sellRate: "Sell rate",
    binanceRate: "Binance rate",
    partnerPayments: "Partner payments",
    providerPayments: "Provider payments",
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
    closeOperation: "Complete transaction",
    approve: "Approve",
    reject: "Reject",
    reopen: "Reopen",
    rate: "Rate",
    binance: "Binance rate",
    fetchBinance: "Fetch Binance",
    binanceFeePercent: "Binance deduction %",
    binanceRangePercent: "Allowed Binance range %",
    withinRange: "OK",
    outsideRange: "NO OK",
    binanceRange: "Binance",
    rateRanges: "Ranges",
    binanceOkRate: "Binance OK %",
    weightedBinanceSpread: "Weighted Binance spread",
    spread: "Spread",
    status: "Status",
    account: "Account",
    transaction: "Transaction",
    category: "Category",
    code: "Code",
    type: "Type",
    allTypes: "Type",
    allStatuses: "Status",
    dateFilter: "Date",
    allDates: "All dates",
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This week",
    previousWeek: "Previous week",
    last7Days: "Previous 7 days",
    last30Days: "Previous 30 days",
    previousMonth: "Previous month",
    last3Months: "Previous 3 months",
    last12Months: "Previous 12 months",
    customRange: "Fixed date range",
    amountFilter: "Amount",
    amountUsd: "USD amount",
    amountVes: "VES amount",
    clearFilters: "Clear",
    noOperations: "No operations.",
    noAccounts: "No accounts.",
    noBeneficiaries: "No beneficiaries.",
    noBeneficiariesSelected: "No beneficiaries added.",
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
    bankFeeAmount: "Bank fee",
    accountNumber: "Account number",
    accountType: "Account type",
    identification: "Identification",
    currency: "Currency",
    externalLink: "External link",
    notes: "Notes",
    client: "Client",
    magna: "Magna",
    operationalSettings: "Operational settings",
    rateExpirationMinutes: "Rate approval validity (minutes)",
    newTreasuryRequest: "New treasury request",
    operationSide: "Type",
    inputCurrency: "Input amount in",
    expectedRate: "Expected rate",
    increasePosition: "Increase position",
    usage: "Use",
    unassignedUse: "Use is not determined yet",
    beneficiary: "Beneficiary",
    paymentDistribution: "Payment distribution",
    selectBeneficiaries: "Select a beneficiary and add it to the distribution.",
    addBeneficiary: "Add beneficiary",
    remove: "Remove",
    invoiceProof: "Invoice / delivery note",
    paymentExecutionSupport: "Payment execution support",
    approvedAmountLocked: "Approved amount locked",
    allocationTotal: "Allocated total",
    allocationTarget: "Sale total VES",
    allocationMatches: "Matched",
    allocationMismatch: "The sum must equal the sale VES total.",
    comment: "Comment",
    deliveryNoteInvoice: "Delivery note / invoice",
    editAccount: "Edit account",
    editBeneficiary: "Edit beneficiary",
    editUser: "Edit user",
    editCategory: "Edit category",
    categoryManagement: "Category Management",
    kind: "Kind",
    operationDetail: "Operation detail",
    support: "Support documentation",
    openSupport: "Open attachment",
    download: "Download",
    timeline: "Timeline",
    loadRate: "Load rate",
    editRate: "Edit rate",
    achievedRate: "Achieved rate",
    outboundAccount: "Outbound account",
    inboundAccount: "Inbound account",
    sendClientApproval: "Send to client approval",
    executeOperation: "Complete transaction",
    usdExitSupport: "USD movement proof",
    vesExitSupport: "VES outbound proof",
    usdReceiptSupport: "USD receipt proof (optional)",
    vesReceiptSupport: "VES receipt proof (optional)",
    inNegotiation: "In negotiation",
    reopened: "Request reopened.",
    requiredComment: "Required comment",
    decisionTitleApprove: "Approve operation",
    decisionTitleReject: "Reject operation",
    decisionCommentHelp: "Add the traceability comment to complete this action.",
    saved: "Saved.",
    decisionSaved: "Decision saved.",
    requestCreated: "Request created.",
    operationExecuted: "Operation completed.",
    deleteAccountConfirm: "Delete account?",
    deleteBeneficiaryConfirm: "Delete beneficiary?",
    deleteUserConfirm: "Deactivate user?",
    deleteCategoryConfirm: "Delete category?",
    masterRole: "Master · Magna",
    superApproverRole: "Client · Super-approver",
    treasuryRole: "Client · Treasury",
    financeRole: "Client · Finance",
    currentRole: "Active role",
    logout: "Log out",
    sessionExpired: "Your session expired. Please sign in again.",
    usd: "USD",
    ves: "VES",
    date: "Date",
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
  ["settings", "settings", "master"],
];

function t(key) {
  return labels[state.lang]?.[key] || labels.es[key] || key;
}

function roleLabel(role) {
  const roleLabels = {
    magna_admin: t("masterRole"),
    super_approver: t("superApproverRole"),
    treasury: t("treasuryRole"),
    finance: t("financeRole"),
  };
  return roleLabels[role] || role || "—";
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  qsa("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  const roleBadge = qs("#roleBadge");
  if (roleBadge) roleBadge.textContent = roleLabel(state.role);
  const toggleLabel = state.lang.toUpperCase();
  const languageToggle = qs("#languageToggle");
  const landingLang = qs("#landingLang");
  if (languageToggle) languageToggle.textContent = toggleLabel;
  if (landingLang) landingLang.textContent = toggleLabel;
  const themeLabel = qs("[data-theme-toggle-label]");
  if (themeLabel) themeLabel.textContent = t("darkMode");
}

function applyTheme() {
  document.body.classList.toggle("dark-mode", state.theme === "dark");
  const toggle = qs("#themeToggle");
  if (toggle) {
    toggle.classList.toggle("active", state.theme === "dark");
    toggle.setAttribute("aria-pressed", state.theme === "dark" ? "true" : "false");
  }
}

function money(value, currency = "") {
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
  return currency ? `${formatted} ${currency}` : formatted;
}

function binanceSnapshot(op) {
  return op.metadata?.binance_snapshot || null;
}

function binanceRangeFor(rate, reference) {
  const rangePct = Number(state.data?.settings?.binance_range_percent || 1);
  const ref = Number(reference || 0);
  const operationRate = Number(rate || 0);
  if (!ref) return null;
  const lower = ref * (1 - rangePct / 100);
  const upper = ref * (1 + rangePct / 100);
  const withinRange = operationRate ? operationRate >= lower && operationRate <= upper : null;
  return { lower, upper, withinRange, rangePct };
}

function binancePill(op) {
  const snapshot = binanceSnapshot(op);
  if (!snapshot || snapshot.within_range === null || snapshot.within_range === undefined) return "—";
  const ok = snapshot.within_range === true;
  return `<span class="range-pill ${ok ? "ok" : "warning"}">${ok ? t("withinRange") : t("outsideRange")}</span>`;
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

function expectedRate(op) {
  return Number(op.metadata?.expected_rate || 0);
}

function achievedRate(op) {
  return Number(op.rate || 0);
}

function operationUsageName(op) {
  const metadata = op.metadata || {};
  if (metadata.usage_key === INCREASE_POSITION_USE || metadata.usage_category_id === INCREASE_POSITION_USE || op.type === "buy_usd") return t("increasePosition");
  if (metadata.use_unassigned || metadata.usage_category_id === UNASSIGNED_USE) return t("unassignedUse");
  if (metadata.usage_category_id) return categoryName(metadata.usage_category_id);
  return "—";
}

function accountName(id) {
  return state.data?.accounts.find((item) => item.id === id)?.name || "—";
}

function accountById(id) {
  return state.data?.accounts.find((item) => item.id === id);
}

function bankFeeForAccount(accountId, vesAmount) {
  const account = accountById(accountId);
  const percent = account?.currency === "VES" ? Number(account.bank_fee_percent || 0) : 0;
  return { percent, amount: Math.abs(Number(vesAmount || 0)) * percent / 100 };
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

function showAppShell() {
  qs("#landing").classList.add("hidden");
  qs("#appShell").classList.remove("hidden");
}

function showLanding() {
  qs("#appShell").classList.add("hidden");
  qs("#landing").classList.remove("hidden");
}

function clearSession() {
  state.role = "";
  state.userId = "";
  state.data = null;
  state.view = "dashboard";
  state.filters = {};
  state.dashboardFilters = {};
  state.lastActionableIds = new Set();
  state.actionableBaselineReady = false;
  stopAutoRefresh();
  localStorage.removeItem("partnerportal_role");
  localStorage.removeItem("partnerportal_user_id");
}

function updateActionableState(notify = true) {
  const actionables = actionableOperations();
  const currentIds = new Set(actionables.map((op) => op.id));
  const newOps = state.actionableBaselineReady
    ? actionables.filter((op) => !state.lastActionableIds.has(op.id))
    : actionables;
  state.lastActionableIds = currentIds;
  state.actionableBaselineReady = true;
  if (notify && newOps.length) showActionablePopup(newOps);
}

async function load(options = {}) {
  const { render = true, notify = true } = options;
  state.data = await api("/api/bootstrap");
  if (state.data.actor?.id) {
    state.userId = state.data.actor.id;
    state.role = state.data.actor.role;
    localStorage.setItem("partnerportal_user_id", state.userId);
    localStorage.setItem("partnerportal_role", state.role);
  }
  updateActionableState(notify);
  if (render) {
    renderShell();
    renderView();
  } else {
    renderNotifications();
  }
  startAutoRefresh();
}

function startAutoRefresh() {
  if (refreshTimer || !state.userId) return;
  refreshTimer = setInterval(async () => {
    if (!state.userId) return;
    try {
      const hasModal = Boolean(qs("#modalRoot")?.children.length);
      await load({ render: !hasModal, notify: true });
      if (hasModal) renderShell();
    } catch (error) {
      if (/Sesion|session/i.test(error.message)) {
        clearSession();
        showLanding();
        applyLanguage();
        toast(error.message || t("sessionExpired"));
      }
    }
  }, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

function renderShell() {
  qs("#actorName").textContent = state.data.actor.name;
  qs("#roleBadge").textContent = roleLabel(state.role);
  applyLanguage();
  if (state.role !== "magna_admin" && navItems.find(([view, , scope]) => view === state.view && scope === "master")) {
    state.view = "dashboard";
  }
  const actionableCount = actionableOperations().length;
  qs("#nav").innerHTML = navItems
    .filter(([, , scope]) => scope !== "master" || state.role === "magna_admin")
    .map(([view, label]) => {
      const badge = view === "approvals" && actionableCount ? `<b>${actionableCount}</b>` : "";
      return `<button class="nav-item ${state.view === view ? "active" : ""}" data-nav="${view}" type="button"><span>${t(label)}</span>${badge}</button>`;
    })
    .join("");
  qs("#viewTitle").textContent = t(state.view);
  const topDateFilter = qs("#topDateFilter");
  if (topDateFilter) {
    topDateFilter.innerHTML = state.view === "dashboard" ? dateFilterMarkup(state.dashboardFilters, "data-dashboard-filter", "topbar-date-bar") : "";
  }
  renderNotifications();
  applyTheme();
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
    settings: renderSettings,
  };
  qs("#viewBody").innerHTML = "";
  renderers[state.view]?.();
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateRangeForPreset(preset) {
  const today = new Date();
  const startOfThisWeek = addDays(today, -((today.getDay() + 6) % 7));
  const startOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const ranges = {
    today: [today, today],
    yesterday: [addDays(today, -1), addDays(today, -1)],
    this_week: [startOfThisWeek, today],
    previous_week: [addDays(startOfThisWeek, -7), addDays(startOfThisWeek, -1)],
    last_7_days: [addDays(today, -7), today],
    last_30_days: [addDays(today, -30), today],
    previous_month: [startOfPreviousMonth, endOfPreviousMonth],
    last_3_months: [new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()), today],
    last_12_months: [new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()), today],
  };
  const range = ranges[preset];
  return range ? { from: localDateString(range[0]), to: localDateString(range[1]) } : null;
}

function dateOptions() {
  return [
    ["", t("allDates")],
    ["today", t("today")],
    ["yesterday", t("yesterday")],
    ["this_week", t("thisWeek")],
    ["previous_week", t("previousWeek")],
    ["last_7_days", t("last7Days")],
    ["last_30_days", t("last30Days")],
    ["previous_month", t("previousMonth")],
    ["last_3_months", t("last3Months")],
    ["last_12_months", t("last12Months")],
    ["custom", t("customRange")],
  ];
}

function selectedDateRange(filters) {
  const presetRange = filters.date_preset && filters.date_preset !== "custom" ? dateRangeForPreset(filters.date_preset) : null;
  return { from: presetRange?.from || filters.date_from, to: presetRange?.to || filters.date_to };
}

function dateFilterMarkup(filters, attributeName = "data-dashboard-filter", className = "dashboard-filter-bar") {
  const datePreset = filters.date_preset || "";
  return `
    <div class="toolbar ${className}">
      <div class="filter-field date-filter">
        <span>${t("dateFilter")}</span>
        <select ${attributeName}="date_preset">
          ${dateOptions().map(([value, label]) => `<option value="${value}" ${datePreset === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <div class="custom-date-range ${datePreset === "custom" ? "" : "hidden"}">
          <input ${attributeName}="date_from" type="date" value="${filters.date_from || ""}" />
          <input ${attributeName}="date_to" type="date" value="${filters.date_to || ""}" />
        </div>
      </div>
      <button class="subtle clear-filters" data-clear-dashboard-filters type="button">${t("clearFilters")}</button>
    </div>
  `;
}

function operationsInDateRange(ops, filters) {
  const { from, to } = selectedDateRange(filters);
  return ops.filter((op) => {
    const date = operationDate(op) || op.created_at?.slice(0, 10);
    return (!from || date >= from) && (!to || date <= to);
  });
}

function filteredOperations() {
  const f = state.filters;
  const { from: dateFrom, to: dateTo } = selectedDateRange(f);
  const amountCurrency = f.amount_currency || "USD";
  const amountValue = Number(f.amount || 0);
  return state.data.operations.filter((op) => {
    const created = op.created_at?.slice(0, 10);
    const account = op.source_account_id || op.destination_account_id || "";
    const amountToCheck = amountCurrency === "VES" ? op.ves_amount : op.usd_amount;
    const pendingExecution = op.status === "approved" || (op.type === "payment" && ["funded", "in_process"].includes(op.status));
    return (!f.type || op.type === f.type)
      && (!f.status || op.status === f.status)
      && (!f.actionables || actionableOperations({ operations: [op] }).length)
      && (!f.pending_execution || pendingExecution)
      && (!f.account || account === f.account)
      && (!dateFrom || created >= dateFrom)
      && (!dateTo || created <= dateTo)
      && (!amountValue || Math.abs(Number(amountToCheck || 0)) >= amountValue);
  });
}

function actionableOperations(data = state.data) {
  if (!data?.operations) return [];
  return data.operations.filter((op) => {
    if (state.role === "magna_admin") {
      return ["pending_master", "in_negotiation", "approved", "expired", "rejected"].includes(op.status)
        || (op.type === "payment" && ["funded", "in_process"].includes(op.status));
    }
    return op.status === "rate_pending_approval";
  });
}

function actionLabel(op) {
  if (state.role === "magna_admin") {
    if (op.status === "pending_master") return t("loadRate");
    if (op.status === "in_negotiation") return t("loadRate");
    if (op.status === "approved" || (op.type === "payment" && ["funded", "in_process"].includes(op.status))) return t("closeOperation");
    if (op.status === "expired") return t("editRate");
    if (op.status === "rejected") return t("reopen");
  }
  if (op.status === "rate_pending_approval") return `${t("approve")} / ${t("reject")}`;
  return t("view");
}

function renderNotifications() {
  const actionables = actionableOperations();
  const count = actionables.length;
  const countNode = qs("#notificationCount");
  const menu = qs("#notificationMenu");
  const button = qs("#notificationButton");
  if (!countNode || !menu || !button) return;
  countNode.textContent = count;
  countNode.hidden = !count;
  button.classList.toggle("has-items", Boolean(count));
  menu.hidden = !state.notificationOpen;
  menu.innerHTML = `
    <header>${t("notifications")}</header>
    <div class="notification-list">
      ${actionables.slice(0, 8).map((op) => `
        <button data-notification-op="${op.id}" type="button">
          <strong>${op.id}</strong>
          <span>${typeLabel(op.type, op.metadata || {})} · ${op.status}</span>
          <small>${actionLabel(op)}</small>
        </button>
      `).join("") || `<p>${t("noNotifications")}</p>`}
    </div>
    ${count ? `<button class="notification-all" data-view-actionables type="button">${t("viewPending")}</button>` : ""}
  `;
}

function showActionablePopup(newOps) {
  const existing = qs("[data-actionable-popup]");
  if (existing) existing.remove();
  if (!newOps.length) return;
  document.body.insertAdjacentHTML("beforeend", `
    <section class="actionable-popup" data-actionable-popup>
      <button class="icon-button" data-dismiss-actionable type="button">×</button>
      <span>${t("actionables")}</span>
      <strong>${newOps.length} ${t("newActionables")}</strong>
      <button class="primary" data-view-actionables type="button">${t("viewPending")}</button>
    </section>
  `);
  setTimeout(() => qs("[data-actionable-popup]")?.remove(), 9000);
}

function openActionablesView() {
  state.view = "operations";
  state.filters = { actionables: "1" };
  state.notificationOpen = false;
  renderShell();
  renderView();
}

function operationStats(ops) {
  const usd = ops.reduce((sum, op) => sum + Number(op.usd_amount || 0), 0);
  const ves = ops.reduce((sum, op) => sum + Number(op.ves_amount || 0), 0);
  const rated = ops.filter((op) => Number(op.rate) && (Math.abs(Number(op.usd_amount)) || Math.abs(Number(op.ves_amount))));
  const weightedRate = rated.reduce((sum, op) => sum + Number(op.rate) * Math.abs(Number(op.usd_amount || 0)), 0);
  const weight = rated.reduce((sum, op) => sum + Math.abs(Number(op.usd_amount || 0)), 0);
  const buyRated = rated.filter((op) => op.type === "buy_usd");
  const buyWeight = buyRated.reduce((sum, op) => sum + Math.abs(Number(op.usd_amount || 0)), 0);
  const buyWeightedRate = buyRated.reduce((sum, op) => sum + Number(op.rate) * Math.abs(Number(op.usd_amount || 0)), 0);
  const sellRated = rated.filter((op) => op.type === "sell_usd");
  const sellWeight = sellRated.reduce((sum, op) => sum + Math.abs(Number(op.usd_amount || 0)), 0);
  const sellWeightedRate = sellRated.reduce((sum, op) => sum + Number(op.rate) * Math.abs(Number(op.usd_amount || 0)), 0);
  const binanceEligible = ops.filter((op) => ["buy_usd", "sell_usd"].includes(op.type) && Number(op.rate));
  const binanceOk = binanceEligible.filter((op) => binanceSnapshot(op)?.within_range === true).length;
  const binanceOkPercent = binanceEligible.length ? (binanceOk / binanceEligible.length) * 100 : null;
  const binanceRated = binanceEligible.filter((op) => Number(op.binance_rate || binanceSnapshot(op)?.reference_rate) && Math.abs(Number(op.usd_amount || 0)));
  const spreadWeight = binanceRated.reduce((sum, op) => sum + Math.abs(Number(op.usd_amount || 0)), 0);
  const weightedSpreadTotal = binanceRated.reduce((sum, op) => {
    const reference = Number(op.binance_rate || binanceSnapshot(op)?.reference_rate || 0);
    const spread = Number(op.spread || ((Number(op.rate) - reference) / reference) * 100);
    return sum + spread * Math.abs(Number(op.usd_amount || 0));
  }, 0);
  const weightedBinanceSpread = spreadWeight ? weightedSpreadTotal / spreadWeight : null;
  return {
    count: ops.length,
    usd,
    ves,
    weighted: weight ? weightedRate / weight : 0,
    buyWeighted: buyWeight ? buyWeightedRate / buyWeight : 0,
    sellWeighted: sellWeight ? sellWeightedRate / sellWeight : 0,
    binanceEligible: binanceEligible.length,
    binanceOk,
    binanceOkPercent,
    weightedBinanceSpread,
  };
}

function metricCards(ops) {
  const stats = operationStats(ops);
  const spreadClass = stats.weightedBinanceSpread === null ? "" : Math.abs(stats.weightedBinanceSpread) <= Number(state.data?.settings?.binance_range_percent || 1) ? "amount-positive" : "amount-negative";
  return `
    <div class="summary-grid">
      <article class="metric-card"><span>${t("operationCount")}</span><strong>${stats.count}</strong></article>
      <article class="metric-card"><span>${t("netUsd")}</span><strong class="${stats.usd < 0 ? "amount-negative" : "amount-positive"}">${money(stats.usd, "USD")}</strong></article>
      <article class="metric-card"><span>${t("netVes")}</span><strong class="${stats.ves < 0 ? "amount-negative" : "amount-positive"}">${money(stats.ves, "VES")}</strong></article>
      <article class="metric-card rate-metric">
        <span>${t("weightedRate")}</span>
        <strong>${stats.weighted ? money(stats.weighted) : "—"}</strong>
        <div class="mini-rate-pills">
          <em class="buy">${t("buyRate")}: ${stats.buyWeighted ? money(stats.buyWeighted) : "—"}</em>
          <em class="sell">${t("sellRate")}: ${stats.sellWeighted ? money(stats.sellWeighted) : "—"}</em>
        </div>
      </article>
      <article class="metric-card"><span>${t("binanceOkRate")}</span><strong class="${stats.binanceOkPercent !== null && stats.binanceOkPercent < 95 ? "amount-negative" : "amount-positive"}">${stats.binanceOkPercent === null ? "—" : `${money(stats.binanceOkPercent)}%`}</strong><div class="muted">${stats.binanceOk}/${stats.binanceEligible} ${t("operations")}</div></article>
      <article class="metric-card"><span>${t("weightedBinanceSpread")}</span><strong class="${spreadClass}">${stats.weightedBinanceSpread === null ? "—" : `${money(stats.weightedBinanceSpread)}%`}</strong></article>
    </div>
  `;
}

function balanceCards() {
  const accounts = state.data.accounts.filter((account) => account.status !== "deleted");
  return `
    <section class="balance-strip">
      ${accounts.map((account) => `
        <article class="metric-card balance-card">
          <span>${account.owner === "client" ? t("client") : t("magna")} · ${account.currency}</span>
          <strong>${money(account.balance, account.currency)}</strong>
          <div class="muted">${account.name}</div>
        </article>
      `).join("") || `<p class="muted">${t("noAccounts")}</p>`}
    </section>
  `;
}

function dashboardSection(titleKey, body) {
  return `
    <section class="dashboard-section">
      <div class="dashboard-section-title"><h2>${t(titleKey)}</h2></div>
      ${body}
    </section>
  `;
}

function pendingDashboardCards(ops) {
  const pendingApprovals = ops.filter((op) => op.status === "rate_pending_approval");
  const pendingExecution = ops.filter((op) => op.status === "approved" || (op.type === "payment" && ["funded", "in_process"].includes(op.status)));
  return `
    <section class="pending-grid">
      <button class="pending-card approval" data-dashboard-shortcut="approvals" type="button">
        <span>${t("pendingApprovals")}</span>
        <strong>${pendingApprovals.length}</strong>
        <small>${t("awaitingClientApproval")}</small>
      </button>
      <button class="pending-card execution" data-dashboard-shortcut="execution" type="button">
        <span>${t("pendingExecution")}</span>
        <strong>${pendingExecution.length}</strong>
        <small>${t("approvedOrFunded")}</small>
      </button>
    </section>
  `;
}

function weightedAverage(total, weight) {
  return weight ? total / weight : 0;
}

function operationDate(op) {
  return (op.executed_at || op.created_at || "").slice(0, 10);
}

function periodStart(date, granularity) {
  const parsed = new Date(`${date}T00:00:00`);
  if (granularity === "month") return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-01`;
  if (granularity === "week") {
    const day = parsed.getDay() || 7;
    parsed.setDate(parsed.getDate() - day + 1);
  }
  return localDateString(parsed);
}

function periodLabel(date, granularity) {
  if (granularity === "month") {
    return new Date(`${date}T00:00:00`).toLocaleDateString(state.lang === "es" ? "es-VE" : "en-US", { month: "short", year: "numeric" });
  }
  if (granularity === "week") return `${t("weekOf")} ${compactDate(date)}`;
  return compactDate(date);
}

function summaryTitleKey() {
  if (state.dashboardGranularity === "week") return "weeklySummary";
  if (state.dashboardGranularity === "month") return "monthlySummary";
  return "dailySummary";
}

function dashboardGranularityControl() {
  return `
    <label class="granularity-control">
      <span>${t("granularity")}</span>
      <select data-dashboard-granularity>
        <option value="day" ${state.dashboardGranularity === "day" ? "selected" : ""}>${t("dailyGranularity")}</option>
        <option value="week" ${state.dashboardGranularity === "week" ? "selected" : ""}>${t("weeklyGranularity")}</option>
        <option value="month" ${state.dashboardGranularity === "month" ? "selected" : ""}>${t("monthlyGranularity")}</option>
      </select>
    </label>
  `;
}

function dashboardRowsByPeriod(ops, granularity = "day", limit = 10) {
  const periods = new Map();
  ops.forEach((op) => {
    const date = operationDate(op);
    if (!date) return;
    const periodDate = periodStart(date, granularity);
    if (!periods.has(periodDate)) {
      periods.set(periodDate, {
        date: periodDate,
        label: periodLabel(periodDate, granularity),
        count: 0,
        buyUsd: 0,
        sellUsd: 0,
        partnerPayments: 0,
        providerPayments: 0,
        buyRateTotal: 0,
        buyRateWeight: 0,
        sellRateTotal: 0,
        sellRateWeight: 0,
        binanceTotal: 0,
        binanceWeight: 0,
      });
    }
    const period = periods.get(periodDate);
    const absUsd = Math.abs(Number(op.usd_amount || 0));
    period.count += 1;
    if (op.type === "buy_usd") {
      period.buyUsd += absUsd;
      period.buyRateTotal += Number(op.rate || 0) * absUsd;
      period.buyRateWeight += absUsd;
    }
    if (op.type === "sell_usd") {
      period.sellUsd += absUsd;
      period.sellRateTotal += Number(op.rate || 0) * absUsd;
      period.sellRateWeight += absUsd;
    }
    if (op.type === "payment" && op.status === "completed") {
      const paymentAmount = Math.abs(Number(op.ves_amount || op.final_amount || op.requested_amount || 0));
      if (op.metadata?.payment_type === "partner") period.partnerPayments += paymentAmount;
      if (op.metadata?.payment_type === "provider") period.providerPayments += paymentAmount;
    }
    if (["buy_usd", "sell_usd"].includes(op.type) && Number(op.binance_rate) && absUsd) {
      period.binanceTotal += Number(op.binance_rate) * absUsd;
      period.binanceWeight += absUsd;
    }
  });
  return [...periods.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((period) => ({
      ...period,
      buyRate: weightedAverage(period.buyRateTotal, period.buyRateWeight),
      sellRate: weightedAverage(period.sellRateTotal, period.sellRateWeight),
      binanceRate: weightedAverage(period.binanceTotal, period.binanceWeight),
    }));
}

function dailyDashboardRows(ops, limit = 10) {
  return dashboardRowsByPeriod(ops, "day", limit);
}

function compactDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(state.lang === "es" ? "es-VE" : "en-US", { month: "short", day: "numeric" });
}

function dailySummaryTable(rows) {
  return `
    <div class="table-wrap compact-table dashboard-summary-table">
      <table>
        <thead>
          <tr>
            <th>${t("date")}</th>
            <th>${t("qtyOperations")}</th>
            <th>${t("buyUsd")}</th>
            <th>${t("sellUsd")}</th>
            <th>${t("partnerPayments")}</th>
            <th>${t("providerPayments")}</th>
            <th>${t("buyRate")}</th>
            <th>${t("sellRate")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><strong>${row.label || compactDate(row.date)}</strong></td>
              <td>${row.count}</td>
              <td class="amount-positive">${money(row.buyUsd, "USD")}</td>
              <td class="amount-negative">${money(row.sellUsd, "USD")}</td>
              <td>${money(row.partnerPayments, "VES")}</td>
              <td>${money(row.providerPayments, "VES")}</td>
              <td>${row.buyRate ? money(row.buyRate) : "—"}</td>
              <td>${row.sellRate ? money(row.sellRate) : "—"}</td>
            </tr>
          `).join("") || `<tr><td colspan="8" class="muted">${t("noOperations")}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function usdFlowChart(rows) {
  const chronological = [...rows].reverse();
  const maxValue = Math.max(...chronological.map((row) => Math.max(row.buyUsd, row.sellUsd)), 1);
  return `
    <div class="bar-chart">
      <div class="bar-axis-labels">
        <span></span>
        <div>
          <b class="sell">${t("sellUsd")}</b>
          <b class="buy">${t("buyUsd")}</b>
        </div>
        <span></span>
      </div>
      ${chronological.map((row) => `
        <div class="bar-row">
          <span>${compactDate(row.date)}</span>
          <div class="bar-track">
            <i class="bar positive" style="width:${Math.max((row.buyUsd / maxValue) * 48, row.buyUsd ? 4 : 0)}%"></i>
            <i class="bar negative" style="width:${Math.max((row.sellUsd / maxValue) * 48, row.sellUsd ? 4 : 0)}%"></i>
          </div>
          <strong>${money(row.buyUsd, "USD")} / ${money(row.sellUsd, "USD")}</strong>
        </div>
      `).join("") || `<p class="muted">${t("noOperations")}</p>`}
    </div>
  `;
}

function ratePolyline(points, values, minRate, maxRate) {
  const width = 620;
  const height = 220;
  const pad = 24;
  const rateRange = maxRate - minRate || 1;
  return points.map((_, index) => {
    const value = values[index];
    if (!value) return "";
    const x = pad + (index * (width - pad * 2)) / Math.max(points.length - 1, 1);
    const y = height - pad - ((value - minRate) / rateRange) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).filter(Boolean).join(" ");
}

function rateCircles(points, values, minRate, maxRate, className) {
  const width = 620;
  const height = 220;
  const pad = 24;
  const rateRange = maxRate - minRate || 1;
  return points.map((_, index) => {
    const value = values[index];
    if (!value) return "";
    const x = pad + (index * (width - pad * 2)) / Math.max(points.length - 1, 1);
    const y = height - pad - ((value - minRate) / rateRange) * (height - pad * 2);
    return `<circle class="point ${className}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"><title>${money(value)}</title></circle>`;
  }).join("");
}

function ratesChart(rows) {
  const chronological = [...rows].reverse();
  const values = chronological.flatMap((row) => [row.buyRate, row.sellRate, row.binanceRate]).filter(Boolean);
  if (!values.length) return `<p class="muted">${t("noOperations")}</p>`;
  const minRate = Math.min(...values) * 0.995;
  const maxRate = Math.max(...values) * 1.005;
  const buyPoints = ratePolyline(chronological, chronological.map((row) => row.buyRate), minRate, maxRate);
  const sellPoints = ratePolyline(chronological, chronological.map((row) => row.sellRate), minRate, maxRate);
  const binancePoints = ratePolyline(chronological, chronological.map((row) => row.binanceRate), minRate, maxRate);
  const buyValues = chronological.map((row) => row.buyRate);
  const sellValues = chronological.map((row) => row.sellRate);
  const binanceValues = chronological.map((row) => row.binanceRate);
  return `
    <div class="rate-chart">
      <svg viewBox="0 0 620 220" role="img" aria-label="${t("dailyRates")}">
        <line x1="24" y1="196" x2="596" y2="196"></line>
        <polyline class="line buy" points="${buyPoints}"></polyline>
        <polyline class="line sell" points="${sellPoints}"></polyline>
        <polyline class="line binance" points="${binancePoints}"></polyline>
        ${rateCircles(chronological, buyValues, minRate, maxRate, "buy")}
        ${rateCircles(chronological, sellValues, minRate, maxRate, "sell")}
        ${rateCircles(chronological, binanceValues, minRate, maxRate, "binance")}
        ${chronological.map((row, index) => {
          const x = 24 + (index * (620 - 48)) / Math.max(chronological.length - 1, 1);
          return `<text x="${x.toFixed(1)}" y="214">${compactDate(row.date)}</text>`;
        }).join("")}
      </svg>
      <div class="chart-legend">
        <span class="buy">${t("buyRate")}</span>
        <span class="sell">${t("sellRate")}</span>
        <span class="binance">${t("binanceRate")}</span>
      </div>
    </div>
  `;
}

function renderDashboard() {
  const ops = operationsInDateRange(state.data.operations, state.dashboardFilters);
  const rows = dailyDashboardRows(ops);
  const summaryRows = dashboardRowsByPeriod(ops, state.dashboardGranularity, 12);
  qs("#viewBody").innerHTML = `
    ${dashboardSection("currentBalances", balanceCards())}
    ${dashboardSection("operationalSummary", `${metricCards(ops)}${pendingDashboardCards(state.data.operations)}`)}
    <section class="grid-2 dashboard-visuals">
      <article class="panel">
        <div class="panel-header"><h2>${t("usdFlow")}</h2></div>
        ${usdFlowChart(rows)}
      </article>
      <article class="panel">
        <div class="panel-header"><h2>${t("dailyRates")}</h2></div>
        ${ratesChart(rows)}
      </article>
    </section>
    <section class="panel">
      <div class="panel-header dashboard-summary-header">
        <h2>${t(summaryTitleKey())}</h2>
        ${dashboardGranularityControl()}
      </div>
      ${dailySummaryTable(summaryRows)}
    </section>
    <section class="panel">
      <div class="panel-header"><h2>${t("recentActivity")}</h2></div>
      <div class="timeline">
        ${ops.flatMap((op) => (op.events || []).map((event) => ({ ...event, op })))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 5)
          .map((event) => `<div class="timeline-item"><strong>${event.description}</strong><div class="muted">${event.op.id} · ${new Date(event.created_at).toLocaleString()}</div></div>`)
          .join("") || `<p class="muted">${t("noActivity")}</p>`}
      </div>
    </section>
  `;
}

function renderTreasury() {
  const ops = state.data.operations.filter((op) => ["buy_usd", "sell_usd"].includes(op.type));
  qs("#viewBody").innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2>${t("treasuryRequests")}</h2>
        ${state.role === "magna_admin" ? "" : `<button class="primary" data-action="open-treasury" type="button">${t("newRequest")}</button>`}
      </div>
      ${operationTable(ops, true)}
    </section>
  `;
}

function renderApprovals() {
  const statuses = state.role === "magna_admin" ? ["pending_master", "in_negotiation", "rate_pending_approval", "approved", "rejected", "expired"] : ["rate_pending_approval"];
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
  const datePreset = state.filters.date_preset || "";
  const amountCurrency = state.filters.amount_currency || "USD";
  qs("#viewBody").innerHTML = `
    ${metricCards(ops)}
    <section class="panel">
      <div class="panel-header">
        <h2>${t("operationsLedger")}</h2>
        ${state.filters.actionables ? `<span class="filter-chip">${t("actionables")}</span>` : ""}
        ${state.filters.pending_execution ? `<span class="filter-chip">${t("pendingExecution")}</span>` : ""}
      </div>
      <div class="toolbar operation-filters">
        <label class="filter-field">
          <span>${t("type")}</span>
          <select data-filter="type">
            <option value="">${t("allTypes")}</option>
            <option value="buy_usd" ${state.filters.type === "buy_usd" ? "selected" : ""}>${t("buyUsd")}</option>
            <option value="sell_usd" ${state.filters.type === "sell_usd" ? "selected" : ""}>${t("sellUsd")}</option>
            <option value="payment" ${state.filters.type === "payment" ? "selected" : ""}>${t("payment")}</option>
          </select>
        </label>
        <label class="filter-field">
          <span>${t("status")}</span>
          <select data-filter="status"><option value="">${t("allStatuses")}</option>${statuses.map((status) => `<option ${state.filters.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>
        </label>
        <div class="filter-field date-filter">
          <span>${t("dateFilter")}</span>
          <select data-filter="date_preset">
            ${dateOptions().map(([value, label]) => `<option value="${value}" ${datePreset === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <div class="custom-date-range ${datePreset === "custom" ? "" : "hidden"}">
            <input data-filter="date_from" type="date" value="${state.filters.date_from || ""}" />
            <input data-filter="date_to" type="date" value="${state.filters.date_to || ""}" />
          </div>
        </div>
        <div class="filter-field amount-filter">
          <span>${t("amountFilter")}</span>
          <div class="amount-filter-row">
            <input data-filter="amount" type="number" step="0.01" value="${state.filters.amount || ""}" placeholder="${t("amountFilter")}" />
            <select data-filter="amount_currency">
              <option value="USD" ${amountCurrency === "USD" ? "selected" : ""}>USD</option>
              <option value="VES" ${amountCurrency === "VES" ? "selected" : ""}>VES</option>
            </select>
          </div>
        </div>
        <label class="filter-field">
          <span>${t("account")}</span>
          <select data-filter="account"><option value="">${t("account")}</option>${accountOptions}</select>
        </label>
        <button class="subtle clear-filters" data-clear-filters type="button">${t("clearFilters")}</button>
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
            <th>${t("bankFeeAmount")}</th>
            <th>${t("expectedRate")}</th>
            <th>${t("achievedRate")}</th>
            <th>${t("binanceRange")}</th>
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
              <td>${Number(op.bank_fee_amount || 0) ? money(op.bank_fee_amount, "VES") : "—"}</td>
              <td>${expectedRate(op) ? money(expectedRate(op)) : "—"}</td>
              <td>${achievedRate(op) ? money(achievedRate(op)) : "—"}</td>
              <td>${binancePill(op)}</td>
              <td><span class="status ${statusClass(op.status)}">${op.status}</span></td>
              <td>${accountName(op.source_account_id || op.destination_account_id)}</td>
              <td>${new Date(op.created_at).toLocaleDateString()}</td>
              ${actions ? `<td><button class="subtle" data-open-operation="${op.id}" type="button">${t("view")}</button></td>` : ""}
            </tr>
          `).join("") || `<tr><td colspan="${actions ? 12 : 11}" class="muted">${t("noOperations")}</td></tr>`}
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

function renderSettings() {
  qs("#viewBody").innerHTML = `
    <section class="panel">
      <div class="panel-header"><h2>${t("operationalSettings")}</h2></div>
      <form data-settings-form class="form-grid">
        <label>${t("rateExpirationMinutes")}<input name="rate_expiration_minutes" type="number" min="1" max="60" value="${state.data.settings.rate_expiration_minutes || 7}" /></label>
        <label>${t("binanceRangePercent")}<input name="binance_range_percent" type="number" min="0" max="20" step="0.01" value="${state.data.settings.binance_range_percent || 1}" /></label>
        <label>${t("binanceFeePercent")}<input name="binance_fee_percent" type="number" min="0" max="20" step="0.01" value="${state.data.settings.binance_fee_percent || 0}" /></label>
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
        <select name="input_currency" data-input-currency>
          <option value="VES">VES</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label>${t("amountUsd")}<input name="usd_amount" type="number" step="0.01" data-treasury-usd /></label>
      <label>${t("amountVes")}<input name="ves_amount" type="number" step="0.01" data-treasury-ves /></label>
      <label>${t("expectedRate")}<input name="expected_rate" type="number" step="0.0001" data-treasury-rate /></label>
      <div class="readonly-amount hidden" data-buy-usage>
        <span>${t("usage")}</span>
        <strong>${t("increasePosition")}</strong>
      </div>
      <label data-usage-field>${t("usage")}
        <select name="usage_category_id" data-usage-category>
          <option value="${UNASSIGNED_USE}">${t("unassignedUse")}</option>
          ${categories.map((cat) => `<option value="${cat.id}">${cat.name}</option>`).join("")}
        </select>
      </label>
      <input type="hidden" name="payment_allocations" data-payment-allocations />
      <div class="full allocation-panel" data-allocation-panel>
        ${paymentAllocationMarkup(UNASSIGNED_USE)}
      </div>
      <label class="full">${t("comment")}<textarea name="comment" rows="3"></textarea></label>
      <div class="full"><button class="primary" type="submit">${t("save")}</button></div>
    </form>
  `);
  const form = qs("[data-treasury-form]");
  syncTreasuryUsage(form);
  syncTreasuryAmounts(form);
}

function beneficiariesForCategory(categoryId) {
  if (categoryId === UNASSIGNED_USE) return [];
  const category = categoryName(categoryId).toLowerCase();
  const beneficiaryCategory = category.includes("partner") ? "partner" : "provider";
  return state.data.beneficiaries.filter((ben) => ben.category === beneficiaryCategory);
}

function paymentAllocationMarkup(categoryId) {
  const beneficiaries = beneficiariesForCategory(categoryId);
  return `
    <div class="allocation-head">
      <div>
        <h3>${t("paymentDistribution")}</h3>
        <p class="muted">${t("selectBeneficiaries")}</p>
      </div>
      <span class="allocation-proof" data-allocation-proof>—</span>
    </div>
    <div class="allocation-picker">
      <select data-allocation-select>
        ${beneficiaries.map((ben) => `<option value="${ben.id}">${ben.name} · ${ben.bank || "—"}</option>`).join("")}
      </select>
      <button class="subtle" data-add-allocation type="button">${t("addBeneficiary")}</button>
    </div>
    <div class="allocation-list">
      <p class="muted" data-allocation-empty>${t("noBeneficiariesSelected")}</p>
    </div>
    <div class="allocation-summary">
      <span>${t("allocationTotal")}: <strong data-allocation-total>0.00 VES</strong></span>
      <span>${t("allocationTarget")}: <strong data-allocation-target>0.00 VES</strong></span>
    </div>
  `;
}

function allocationBeneficiaryById(id) {
  return state.data.beneficiaries.find((ben) => ben.id === id);
}

function refreshAllocationPicker(form) {
  const select = form.querySelector("[data-allocation-select]");
  if (!select) return;
  const selectedIds = new Set([...form.querySelectorAll("[data-allocation-row]")].map((row) => row.dataset.allocationRow));
  const categoryId = form.elements.usage_category_id?.value;
  const options = beneficiariesForCategory(categoryId)
    .filter((ben) => !selectedIds.has(ben.id))
    .map((ben) => `<option value="${ben.id}">${ben.name} · ${ben.bank || "—"}</option>`)
    .join("");
  select.innerHTML = options;
  select.disabled = !options;
  const addButton = form.querySelector("[data-add-allocation]");
  if (addButton) addButton.disabled = !options;
}

function addPaymentAllocationRow(form, beneficiaryId) {
  const beneficiary = allocationBeneficiaryById(beneficiaryId);
  const list = form.querySelector(".allocation-list");
  if (!beneficiary || !list || form.querySelector(`[data-allocation-row="${beneficiaryId}"]`)) return;
  form.querySelector("[data-allocation-empty]")?.remove();
  const fileField = `payment_proof_${beneficiaryId}`;
  list.insertAdjacentHTML("beforeend", `
    <div class="allocation-row" data-allocation-row="${beneficiaryId}">
      <div class="allocation-beneficiary">
        <strong>${beneficiary.name}</strong>
        <small>${beneficiary.bank || "—"} · ${beneficiary.account_number || "—"}</small>
      </div>
      <input type="number" step="0.01" min="0" placeholder="VES" data-allocation-amount="${beneficiaryId}" required />
      <label class="allocation-file">${t("invoiceProof")}<input name="${fileField}" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" required /></label>
      <input name="${fileField}_label" type="hidden" value="${t("invoiceProof")} · ${beneficiary.name}" />
      <button class="danger" data-remove-allocation="${beneficiaryId}" type="button">${t("remove")}</button>
    </div>
  `);
  refreshAllocationPicker(form);
  updatePaymentAllocationSummary(form);
}

function targetVesForTreasuryForm(form) {
  const ves = Number(form.elements.ves_amount?.value || 0);
  const usd = Number(form.elements.usd_amount?.value || 0);
  const rate = Number(form.elements.expected_rate?.value || 0);
  if (ves) return Math.abs(ves);
  if (usd && rate) return Math.abs(usd * rate);
  return 0;
}

function decimalInput(value) {
  return Number(value || 0).toFixed(2);
}

function syncTreasuryUsage(form) {
  if (!form) return;
  const isBuy = form.elements.operation_side?.value === "buy";
  const buyUsage = form.querySelector("[data-buy-usage]");
  const usageField = form.querySelector("[data-usage-field]");
  if (buyUsage) buyUsage.classList.toggle("hidden", !isBuy);
  if (usageField) usageField.classList.toggle("hidden", isBuy);
  if (isBuy && form.elements.usage_category_id) {
    form.elements.usage_category_id.value = UNASSIGNED_USE;
  }
}

function syncTreasuryAmounts(form) {
  if (!form) return;
  const inputCurrency = form.elements.input_currency?.value || "VES";
  const usdInput = form.elements.usd_amount;
  const vesInput = form.elements.ves_amount;
  const rate = Number(form.elements.expected_rate?.value || 0);
  if (!usdInput || !vesInput) return;
  syncTreasuryUsage(form);
  usdInput.readOnly = inputCurrency === "VES";
  vesInput.readOnly = inputCurrency === "USD";
  if (rate > 0 && inputCurrency === "USD" && Number(usdInput.value || 0)) {
    vesInput.value = decimalInput(Number(usdInput.value || 0) * rate);
  }
  if (rate > 0 && inputCurrency === "VES" && Number(vesInput.value || 0)) {
    usdInput.value = decimalInput(Number(vesInput.value || 0) / rate);
  }
  updatePaymentAllocationSummary(form);
}

function selectedPaymentAllocations(form) {
  return [...form.querySelectorAll("[data-allocation-row]")]
    .map((row) => {
      const beneficiaryId = row.dataset.allocationRow;
      const amountInput = form.querySelector(`[data-allocation-amount="${beneficiaryId}"]`);
      return { beneficiary_id: beneficiaryId, amount_ves: Number(amountInput?.value || 0), proof_field: `payment_proof_${beneficiaryId}` };
    });
}

function updatePaymentAllocationSummary(form) {
  if (!form) return;
  const panel = form.querySelector("[data-allocation-panel]");
  const requiresAllocations = form.elements.operation_side?.value === "sell" && form.elements.usage_category_id?.value !== UNASSIGNED_USE;
  if (panel) panel.hidden = !requiresAllocations;
  refreshAllocationPicker(form);
  const target = requiresAllocations ? targetVesForTreasuryForm(form) : 0;
  const total = selectedPaymentAllocations(form).reduce((sum, item) => sum + item.amount_ves, 0);
  const matches = !requiresAllocations || (target > 0 && Math.round(total * 100) === Math.round(target * 100));
  const totalNode = form.querySelector("[data-allocation-total]");
  const targetNode = form.querySelector("[data-allocation-target]");
  const proofNode = form.querySelector("[data-allocation-proof]");
  if (totalNode) totalNode.textContent = money(total, "VES");
  if (targetNode) targetNode.textContent = money(target, "VES");
  if (proofNode) {
    proofNode.textContent = matches ? t("allocationMatches") : t("allocationMismatch");
    proofNode.classList.toggle("ok", matches);
  }
  const hidden = form.querySelector("[data-payment-allocations]");
  if (hidden) hidden.value = requiresAllocations ? JSON.stringify(selectedPaymentAllocations(form)) : "[]";
  return matches;
}

function operationAllocationDetail(op) {
  const allocations = op.metadata?.payment_allocations || [];
  if (!allocations.length) return "";
  const total = allocations.reduce((sum, item) => sum + Number(item.amount_ves || 0), 0);
  return `
    <section>
      <h3>${t("paymentDistribution")}</h3>
      <div class="allocation-detail">
        ${allocations.map((item) => `
          <div class="allocation-detail-row">
            <span>
              ${item.beneficiary_name || beneficiaryName(item.beneficiary_id)}
              ${item.proof_stored_path ? `<button class="subtle inline-proof" data-preview-file="${item.proof_stored_path}" data-preview-name="${item.proof_filename || t("invoiceProof")}" data-preview-type="${item.proof_content_type || ""}" type="button">${item.proof_filename || t("invoiceProof")}</button>` : ""}
            </span>
            <strong>${money(item.amount_ves, "VES")}</strong>
          </div>
        `).join("")}
        <div class="allocation-detail-row total">
          <span>${t("allocationTotal")}</span>
          <strong>${money(total, "VES")}</strong>
        </div>
      </div>
    </section>
  `;
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
  const canMasterComplete = canMaster && (op.status === "approved" || (op.type === "payment" && ["funded", "in_process"].includes(op.status)));
  openModal(op.id, `
    <div class="detail-list">
      <div class="detail-item"><span>${t("category")}</span><strong>${typeLabel(op.type, op.metadata || {})}</strong></div>
      <div class="detail-item"><span>${t("status")}</span><strong>${op.status}</strong></div>
      <div class="detail-item"><span>${t("usage")}</span><strong>${operationUsageName(op)}</strong></div>
      <div class="detail-item"><span>${t("expectedRate")}</span><strong>${expectedRate(op) ? money(expectedRate(op)) : "—"}</strong></div>
      <div class="detail-item"><span>${t("achievedRate")}</span><strong>${achievedRate(op) ? money(achievedRate(op)) : "—"}</strong></div>
      <div class="detail-item"><span>Binance</span><strong>${op.binance_rate ? money(op.binance_rate) : "—"}</strong></div>
      <div class="detail-item"><span>Spread</span><strong>${op.spread ? `${money(op.spread)}%` : "—"}</strong></div>
      <div class="detail-item"><span>${t("binanceRange")}</span><strong>${binancePill(op)}</strong></div>
      <div class="detail-item"><span>${t("beneficiary")}</span><strong>${beneficiaryName(op.beneficiary_id)}</strong></div>
      <div class="detail-item"><span>USD</span><strong class="${Number(op.usd_amount) < 0 ? "amount-negative" : "amount-positive"}">${money(op.usd_amount, "USD")}</strong></div>
      <div class="detail-item"><span>VES</span><strong class="${Number(op.ves_amount) < 0 ? "amount-negative" : "amount-positive"}">${money(op.ves_amount, "VES")}</strong></div>
      <div class="detail-item"><span>${t("bankFeeAmount")}</span><strong>${Number(op.bank_fee_amount || 0) ? `${money(op.bank_fee_amount, "VES")} · ${money(op.bank_fee_percent)}%` : "—"}</strong></div>
      <div class="detail-item"><span>${t("account")}</span><strong>${accountName(op.source_account_id || op.destination_account_id)}</strong></div>
    </div>
    <section>
      <h3>${t("support")}</h3>
      <div class="timeline">${(op.attachments || []).map((file) => `<div class="timeline-item"><strong>${file.label}</strong><div>${file.stored_path ? `<button class="subtle" data-preview-file="${file.stored_path}" data-preview-name="${file.filename}" data-preview-type="${file.content_type || ""}" type="button">${file.filename}</button>` : file.filename}</div></div>`).join("") || `<p class="muted">${t("noSupport")}</p>`}</div>
    </section>
    ${operationAllocationDetail(op)}
    <section>
      <h3>${t("timeline")}</h3>
      <div class="timeline">${(op.events || []).map((event) => `<div class="timeline-item"><strong>${event.description}</strong><div class="muted">${new Date(event.created_at).toLocaleString()} ${event.comment ? `· ${event.comment}` : ""}</div></div>`).join("")}</div>
    </section>
  `, `
    ${canMaster && op.status === "rejected" ? `<button class="subtle" data-status-op="${op.id}" data-status="pending_master" data-status-message="${t("reopened")}" type="button">${t("reopen")}</button>` : ""}
    ${canMaster && op.status === "pending_master" ? `<button class="subtle" data-status-op="${op.id}" data-status="in_negotiation" type="button">${t("inNegotiation")}</button>` : ""}
    ${canMaster && ["in_negotiation", "pending_master", "rate_pending_approval", "expired"].includes(op.status) ? `<button class="primary" data-rate-op="${op.id}" type="button">${["rate_pending_approval", "expired"].includes(op.status) ? t("editRate") : t("loadRate")}</button>` : ""}
    ${canClientApprove ? `<button class="danger" data-decision-op="${op.id}" data-decision="reject" type="button">${t("reject")}</button><button class="primary" data-decision-op="${op.id}" data-decision="approve" type="button">${t("approve")}</button>` : ""}
    ${canMasterComplete ? `<button class="primary" data-execute-op="${op.id}" type="button">${t("closeOperation")}</button>` : ""}
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
  const rateOnly = ["rate_pending_approval", "expired"].includes(op.status);
  const accountFields = rateOnly ? "" : `
      <label>${t("outboundAccount")}<select name="source_account_id">${accountOptions(op.type === "sell_usd" ? "USD" : "VES", op.source_account_id)}</select></label>
      <label>${t("inboundAccount")}<select name="destination_account_id">${accountOptions(op.type === "sell_usd" ? "VES" : "USD", op.destination_account_id)}</select></label>
  `;
  openModal(rateOnly ? t("editRate") : t("loadRate"), `
    <form data-rate-form="${id}" class="form-grid">
      <div class="readonly-amount">
        <span>${t("expectedRate")}</span>
        <strong>${expectedRate(op) ? money(expectedRate(op)) : "—"}</strong>
      </div>
      <label>${t("achievedRate")}<input name="rate" type="number" step="0.0001" value="${achievedRate(op) || ""}" data-operation-rate required /></label>
      <label class="binance-field">${t("binance")}
        <span class="binance-input-wrap">
          <input name="binance_rate" type="number" step="0.0001" value="${op.binance_rate || ""}" data-binance-rate />
          <button class="binance-fetch" data-fetch-binance type="button" aria-label="${t("fetchBinance")}" title="${t("fetchBinance")}"><img src="/static/assets/binance-icon.svg" alt="" /></button>
        </span>
        <span class="rate-range" data-rate-range></span>
      </label>
      <input name="binance_consulted_at" type="hidden" value="${binanceSnapshot(op)?.consulted_at || ""}" data-binance-consulted-at />
      <input name="binance_source" type="hidden" value="${binanceSnapshot(op)?.source || ""}" data-binance-source />
      ${accountFields}
      <label class="full">${t("comment")}<textarea name="comment" rows="3"></textarea></label>
      <div class="full"><button class="primary" type="submit">${t("sendClientApproval")}</button></div>
    </form>
  `);
  updateRateRangePreview(qs("[data-rate-form]"));
}

function updateRateRangePreview(form) {
  if (!form) return;
  const operationRate = Number(form.elements.rate?.value || 0);
  const binanceRate = Number(form.elements.binance_rate?.value || 0);
  const range = binanceRangeFor(operationRate, binanceRate);
  const node = form.querySelector("[data-rate-range]");
  if (!node) return;
  if (!range) {
    node.innerHTML = `<span class="muted">${t("rateRanges")}: —</span>`;
    return;
  }
  const rangePill = range.withinRange === null
    ? ""
    : `<span class="range-pill ${range.withinRange ? "ok" : "warning"}">${range.withinRange ? t("withinRange") : t("outsideRange")}</span>`;
  node.innerHTML = `
    <span>${t("rateRanges")}: ${money(range.lower)} - ${money(range.upper)}</span>
    ${rangePill}
  `;
}

async function fetchBinanceRate(form) {
  const result = await api("/api/rates/binance");
  form.elements.binance_rate.value = result.rate;
  form.querySelector("[data-binance-consulted-at]").value = result.consulted_at || "";
  form.querySelector("[data-binance-source]").value = result.source || "";
  updateRateRangePreview(form);
  toast(`${t("binance")}: ${money(result.rate)}`);
}

function updateBankFeePreview(form) {
  const preview = form?.querySelector("[data-bank-fee-preview]");
  if (!preview) return;
  const amount = Number(preview.dataset.bankFeeAmount || 0);
  const fee = bankFeeForAccount(form.elements.source_account_id?.value, amount);
  preview.querySelector("strong").textContent = money(fee.amount, "VES");
  preview.querySelector("small").textContent = `${money(fee.percent)}%`;
}

function openExecuteModal(id) {
  const op = state.data.operations.find((item) => item.id === id);
  if (op.type === "payment") {
    const paymentVesAmount = Math.abs(Number(op.ves_amount || op.requested_amount || 0));
    const paymentFee = bankFeeForAccount(op.source_account_id, paymentVesAmount);
    openModal(t("executeOperation"), `
      <form data-execute-form="${id}" class="form-grid" enctype="multipart/form-data">
        <div class="readonly-amount">
          <span>${t("amountVes")}</span>
          <strong>${money(paymentVesAmount, "VES")}</strong>
          <small>${t("approvedAmountLocked")}</small>
        </div>
        <div class="readonly-amount" data-bank-fee-preview data-bank-fee-amount="${paymentVesAmount}">
          <span>${t("bankFeeAmount")}</span>
          <strong>${money(paymentFee.amount, "VES")}</strong>
          <small>${money(paymentFee.percent)}%</small>
        </div>
        <input name="ves_amount" type="hidden" value="${paymentVesAmount}" />
        <label>${t("outboundAccount")}<select name="source_account_id">${accountOptions("VES", op.source_account_id)}</select></label>
        <label class="full">${t("paymentExecutionSupport")}<input name="payment_execution_support" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" required /></label>
        <label class="full">${t("comment")}<textarea name="comment" rows="3"></textarea></label>
        <div class="full"><button class="primary" type="submit">${t("closeOperation")}</button></div>
      </form>
    `);
    return;
  }
  const usdAmount = Number(op.usd_amount || 0);
  const vesAmount = Number(op.ves_amount || 0);
  const fxFee = bankFeeForAccount(op.source_account_id, vesAmount);
  const outboundProof = op.type === "buy_usd"
    ? { name: "ves_exit_support", label: t("vesExitSupport"), accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" }
    : { name: "usd_exit_support", label: t("usdExitSupport"), accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" };
  const receiptProof = op.type === "buy_usd"
    ? { name: "usd_receipt_support", label: t("usdReceiptSupport"), accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" }
    : { name: "ves_receipt_support", label: t("vesReceiptSupport"), accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" };
  openModal(t("executeOperation"), `
    <form data-execute-form="${id}" class="form-grid" enctype="multipart/form-data">
      <div class="readonly-amount">
        <span>${t("amountUsd")}</span>
        <strong>${money(usdAmount, "USD")}</strong>
        <small>${t("approvedAmountLocked")}</small>
      </div>
      <div class="readonly-amount">
        <span>${t("amountVes")}</span>
        <strong>${money(vesAmount, "VES")}</strong>
        <small>${t("approvedAmountLocked")}</small>
      </div>
      <div class="readonly-amount" data-bank-fee-preview data-bank-fee-amount="${vesAmount}">
        <span>${t("bankFeeAmount")}</span>
        <strong>${money(fxFee.amount, "VES")}</strong>
        <small>${money(fxFee.percent)}%</small>
      </div>
      <input name="usd_amount" type="hidden" value="${usdAmount}" />
      <input name="ves_amount" type="hidden" value="${vesAmount}" />
      <label>${t("outboundAccount")}<select name="source_account_id">${accountOptions("", op.source_account_id)}</select></label>
      <label>${t("inboundAccount")}<select name="destination_account_id">${accountOptions("", op.destination_account_id)}</select></label>
      <label class="full">${outboundProof.label}<input name="${outboundProof.name}" type="file" accept="${outboundProof.accept}" required /></label>
      <label class="full">${receiptProof.label}<input name="${receiptProof.name}" type="file" accept="${receiptProof.accept}" /></label>
      <label class="full">${t("comment")}<textarea name="comment" rows="3"></textarea></label>
      <div class="full"><button class="primary" type="submit">${t("closeOperation")}</button></div>
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
  if (event.target.closest("#logoutButton")) {
    clearSession();
    closeDrawer();
    closeModal();
    showLanding();
    applyLanguage();
    return;
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
  if (event.target.closest("#themeToggle")) {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("partnerportal_theme", state.theme);
    applyTheme();
    return;
  }
  if (event.target.closest("#notificationButton")) {
    state.notificationOpen = !state.notificationOpen;
    renderNotifications();
    return;
  }
  if (event.target.closest("[data-dismiss-actionable]")) {
    event.target.closest("[data-actionable-popup]")?.remove();
    return;
  }
  if (event.target.closest("[data-view-actionables]")) {
    qs("[data-actionable-popup]")?.remove();
    openActionablesView();
    return;
  }
  const notificationOp = event.target.closest("[data-notification-op]");
  if (notificationOp) {
    state.notificationOpen = false;
    renderNotifications();
    openOperationDetail(notificationOp.dataset.notificationOp);
    return;
  }
  if (event.target.closest("[data-action='open-treasury']") && state.role !== "magna_admin") openTreasuryModal();
  if (event.target.closest("[data-action='new-account']")) openAccountModal(event.target.closest("[data-action]").dataset.owner);
  if (event.target.closest("[data-action='new-beneficiary']")) openBeneficiaryModal();
  if (event.target.closest("[data-action='new-user']")) openUserModal();
  if (event.target.closest("[data-action='new-category']")) openCategoryModal();
  if (event.target.closest("[data-clear-filters]")) {
    state.filters = {};
    renderOperations();
  }
  if (event.target.closest("[data-clear-dashboard-filters]")) {
    state.dashboardFilters = {};
    renderShell();
    renderDashboard();
  }
  const dashboardShortcut = event.target.closest("[data-dashboard-shortcut]");
  if (dashboardShortcut) {
    state.view = "operations";
    state.filters = dashboardShortcut.dataset.dashboardShortcut === "approvals"
      ? { status: "rate_pending_approval" }
      : { pending_execution: "1" };
    renderShell();
    renderView();
    return;
  }

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
  if (statusOp) {
    const operationId = statusOp.dataset.statusOp;
    await api(`/api/operations/${operationId}/status`, { method: "POST", body: JSON.stringify({ status: statusOp.dataset.status }) });
    closeModal();
    await load();
    openOperationDetail(operationId);
    if (statusOp.dataset.statusMessage) toast(statusOp.dataset.statusMessage);
  }
  const rateOp = event.target.closest("[data-rate-op]");
  if (rateOp) openRateModal(rateOp.dataset.rateOp);
  const execOp = event.target.closest("[data-execute-op]");
  if (execOp) openExecuteModal(execOp.dataset.executeOp);
  const decision = event.target.closest("[data-decision-op]");
  if (decision) {
    openDecisionModal(decision.dataset.decisionOp, decision.dataset.decision);
  }
  const addAllocation = event.target.closest("[data-add-allocation]");
  if (addAllocation) {
    const form = addAllocation.closest("[data-treasury-form]");
    const select = form?.querySelector("[data-allocation-select]");
    if (form && select?.value) addPaymentAllocationRow(form, select.value);
  }
  const removeAllocation = event.target.closest("[data-remove-allocation]");
  if (removeAllocation) {
    const form = removeAllocation.closest("[data-treasury-form]");
    removeAllocation.closest("[data-allocation-row]")?.remove();
    const list = form?.querySelector(".allocation-list");
    if (list && !list.querySelector("[data-allocation-row]")) {
      list.innerHTML = `<p class="muted" data-allocation-empty>${t("noBeneficiariesSelected")}</p>`;
    }
    updatePaymentAllocationSummary(form);
  }
  const fetchBinance = event.target.closest("[data-fetch-binance]");
  if (fetchBinance) {
    await fetchBinanceRate(fetchBinance.closest("[data-rate-form]"));
  }
});

document.addEventListener("change", (event) => {
  const dashboardGranularity = event.target.closest("[data-dashboard-granularity]");
  if (dashboardGranularity) {
    state.dashboardGranularity = dashboardGranularity.value;
    localStorage.setItem("partnerportal_dashboard_granularity", state.dashboardGranularity);
    renderDashboard();
    return;
  }
  const dashboardFilter = event.target.closest("[data-dashboard-filter]");
  if (dashboardFilter) {
    state.dashboardFilters[dashboardFilter.dataset.dashboardFilter] = dashboardFilter.value;
    renderShell();
    renderDashboard();
  }
  const filter = event.target.closest("[data-filter]");
  if (filter) {
    state.filters[filter.dataset.filter] = filter.value;
    renderOperations();
  }
  const usage = event.target.closest("[data-usage-category]");
  if (usage) {
    const form = usage.closest("[data-treasury-form]");
    const panel = form?.querySelector("[data-allocation-panel]");
    if (panel) panel.innerHTML = paymentAllocationMarkup(usage.value);
    if (usage.value === UNASSIGNED_USE) {
      const hidden = form?.querySelector("[data-payment-allocations]");
      if (hidden) hidden.value = "[]";
    }
    updatePaymentAllocationSummary(form);
  }
  const treasurySide = event.target.closest("[data-treasury-side]");
  if (treasurySide) syncTreasuryAmounts(treasurySide.closest("[data-treasury-form]"));
  const inputCurrency = event.target.closest("[data-input-currency]");
  if (inputCurrency) syncTreasuryAmounts(inputCurrency.closest("[data-treasury-form]"));
  if (event.target.closest("[data-allocation-row] input[type='file']")) {
    updatePaymentAllocationSummary(event.target.closest("[data-treasury-form]"));
  }
  if (event.target.closest("[data-execute-form] select[name='source_account_id']")) {
    updateBankFeePreview(event.target.closest("[data-execute-form]"));
  }
});

document.addEventListener("input", (event) => {
  const dashboardFilter = event.target.closest("[data-dashboard-filter]");
  if (dashboardFilter) {
    state.dashboardFilters[dashboardFilter.dataset.dashboardFilter] = dashboardFilter.value;
    renderDashboard();
  }
  const filter = event.target.closest("[data-filter]");
  if (filter) {
    state.filters[filter.dataset.filter] = filter.value;
    renderOperations();
  }
  if (event.target.closest("[data-treasury-usd]") || event.target.closest("[data-treasury-ves]") || event.target.closest("[data-treasury-rate]")) {
    syncTreasuryAmounts(event.target.closest("[data-treasury-form]"));
  }
  if (event.target.closest("[data-allocation-amount]")) {
    updatePaymentAllocationSummary(event.target.closest("[data-treasury-form]"));
  }
  if (event.target.closest("[data-operation-rate]") || event.target.closest("[data-binance-rate]")) {
    updateRateRangePreview(event.target.closest("[data-rate-form]"));
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
      showAppShell();
      await load();
      openDrawer();
      toast(`${t("loginTitle")}: ${result.user.name}`);
    }
    if (form.matches("[data-treasury-form]")) {
      event.preventDefault();
      const requiresAllocations = form.elements.operation_side?.value === "sell" && form.elements.usage_category_id?.value !== UNASSIGNED_USE;
      if (requiresAllocations && !updatePaymentAllocationSummary(form)) {
        toast(t("allocationMismatch"));
        return;
      }
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
      const supportLabels = {
        payment_execution_support: t("paymentExecutionSupport"),
        usd_exit_support: t("usdExitSupport"),
        ves_exit_support: t("vesExitSupport"),
        usd_receipt_support: t("usdReceiptSupport"),
        ves_receipt_support: t("vesReceiptSupport"),
      };
      Object.entries(supportLabels).forEach(([field, label]) => {
        if (data.has(field)) data.append(`${field}_label`, label);
      });
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

applyLanguage();
applyTheme();
if (state.userId) {
  showAppShell();
  load().catch((error) => {
    clearSession();
    showLanding();
    applyLanguage();
    toast(error.message || t("sessionExpired"));
  });
} else {
  showLanding();
}
