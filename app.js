
const STORAGE_KEYS = {
  records: "expense_records_v1",
  settings: "expense_settings_v1",
  recurringRules: "expense_recurring_rules_v1",
  recurringSuppressions: "expense_recurring_suppressions_v1",
  wallets: "expense_wallets_v1",
};
const SYNC_STATUS = { synced: "synced", pending: "pending", failed: "failed", local: "local" };
const THEMES = { light: "light", dark: "dark" };
const RECORD_SOURCE = { manual: "manual", recurring: "recurring", transfer: "transfer" };
const MAX_RECORDS = 8000;
const MAX_RECORDS_PER_PAGE = 50;
const PERFORMANCE_LITE_RECORDS_PER_PAGE = 30;
const RECORDS_FILTER_INPUT_DEBOUNCE_MS = 120;
const SYNC_MAX_RETRIES = 3;
const SYNC_RETRY_DELAY_MS = 1000;
const AUTO_SYNC_INTERVALS = [
  { value: 5, label: "5 phút" },
  { value: 15, label: "15 phút" },
  { value: 30, label: "30 phút" },
  { value: 60, label: "1 giờ" },
  { value: 120, label: "2 giờ" },
];
const MOJIBAKE_MARKER_REGEX = /Ãƒ|Ã‚|Ã„|Ã…|Ã†|Ã|Ã‘|Ã˜|Ã¡Â»|Ã¡Âº|Ã¡Â¼|Ã¡Â½|Ã¢â‚¬|ï¿½/;
const DEFAULT_CATEGORIES = ["Ăn uống", "Di chuyển", "Nhà ở", "Hóa đơn", "Giải trí", "Sức khỏe", "Mua sắm", "Khác"];
const DEFAULT_METHODS = ["Tiền mặt", "Chuyển khoản", "Thẻ tín dụng", "Ví điện tử"];
const DAILY_REMINDER_CONFIG = Object.freeze({
  hour: 21,
  minute: 0,
  title: "Nhắc nhập chi tiêu",
  message: "Hôm nay bạn chưa nhập chi tiêu. Hãy cập nhật trước khi kết thúc ngày.",
});

// Cấu hình ví mặc định
const WALLET_COLORS = [
  "linear-gradient(140deg, #b2541b 0%, #db7f2e 100%)",
  "linear-gradient(140deg, #0a7f7a 0%, #44aa92 100%)",
  "linear-gradient(140deg, #2e8f4d 0%, #66b96d 100%)",
  "linear-gradient(140deg, #466372 0%, #5a8a8b 100%)",
  "linear-gradient(140deg, #7c3aed 0%, #a855f7 100%)",
  "linear-gradient(140deg, #db2777 0%, #f472b6 100%)",
  "linear-gradient(140deg, #0891b2 0%, #22d3ee 100%)",
  "linear-gradient(140deg, #65a30d 0%, #a3e635 100%)",
];

const DEFAULT_WALLETS = [
  { id: "wallet_tienmat", name: "Tiền mặt", balance: 0, icon: "💵", isDefault: true },
  { id: "wallet_chuyenkhoan", name: "Chuyển khoản", balance: 0, icon: "🏦", isDefault: true },
  { id: "wallet_thetindung", name: "Thẻ tín dụng", balance: 0, icon: "💳", isDefault: true },
  { id: "wallet_vidientu", name: "Ví điện tử", balance: 0, icon: "📱", isDefault: true },
];
const NUMBER_FORMATTERS = {
  currency: new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }),
  date: new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
  monthYear: new Intl.DateTimeFormat("vi-VN", { month: "2-digit", year: "numeric" }),
  percent: new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }),
  budgetInput: new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }),
};

const state = {
  records: [],
  recurringRules: [],
  recurringSuppressions: [],
  wallets: [],
  settings: {
    sheetEndpoint: "",
    apiKey: "",
    monthlyBudget: 0,
    categories: [...DEFAULT_CATEGORIES],
    hideAmounts: false,
    theme: THEMES.light,
    dailyReminderEnabled: false,
    autoSyncEnabled: false,
    autoSyncInterval: 15,
  },
  runtime: {
    recordsFilter: { query: "" },
    recordsVersion: 0,
    sortedRecordsCache: [],
    sortedRecordsVersion: -1,
    categorySummaryCache: null,
    categorySummaryCacheVersion: -1,
    recordsDerivedCache: null,
    recordsDerivedCacheVersion: -1,
    filteredRecordsCache: [],
    filteredRecordsVersion: -1,
    filteredRecordsQuery: "",
    recordSearchCache: new Map(),
    recurringSuppressionCache: new Set(),
    recurringSuppressionCacheVersion: -1,
    recurringSuppressionsVersion: 0,
    statsRenderKey: "",
    monthlySummaryRenderKey: "",
    recurringRulesRenderKey: "",
    recordsRenderKey: "",
    pendingRecordsRenderHandle: null,
    recordsFilterInputHandle: null,
    currentPage: 1,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    autoSyncIntervalId: null,
  },
};

const HAS_DOCUMENT = typeof document !== "undefined" && document && typeof document.querySelector === "function";
const dom = HAS_DOCUMENT
  ? {
      form: document.querySelector("#expense-form"),
      formStatus: document.querySelector("#form-status"),
      recordsBody: document.querySelector("#records-body"),
      recordsSection: document.querySelector("#records-section"),
      recordsCollapse: document.querySelector("#records-collapse"),
      recordTemplate: document.querySelector("#record-row-template"),
      emptyState: document.querySelector("#empty-state"),
      recordsFilterSummary: document.querySelector("#records-filter-summary"),
      recordsFilterQueryInput: document.querySelector("#records-filter-query"),
      recordsFilterResetBtn: document.querySelector("#records-filter-reset"),
      statToday: document.querySelector("#stat-today"),
      statMonth: document.querySelector("#stat-month"),
      statCount: document.querySelector("#stat-count"),
      statBudget: document.querySelector("#stat-budget"),
      budgetWarning: document.querySelector("#budget-warning"),
      monthlySummaryMonthInput: document.querySelector("#monthly-summary-month"),
      monthlySummaryTotal: document.querySelector("#monthly-summary-total"),
      monthlySummaryList: document.querySelector("#monthly-summary-list"),
      monthlySummaryEmpty: document.querySelector("#monthly-summary-empty"),
      dateInput: document.querySelector("#expense-date"),
      amountInput: document.querySelector("#expense-amount"),
      categoryInput: document.querySelector("#expense-category"),
      methodInput: document.querySelector("#expense-method"),
      monthlyBudgetInput: document.querySelector("#monthly-budget"),
      endpointInput: document.querySelector("#sheet-endpoint"),
      apiKeyInput: document.querySelector("#sheet-api-key"),
      recurringRuleForm: document.querySelector("#recurring-rule-form"),
      recurringRuleIdInput: document.querySelector("#recurring-rule-id"),
      recurringRuleAmountInput: document.querySelector("#recurring-rule-amount"),
      recurringRuleCategoryInput: document.querySelector("#recurring-rule-category"),
      recurringRuleMethodInput: document.querySelector("#recurring-rule-method"),
      recurringRuleDayInput: document.querySelector("#recurring-rule-day"),
      recurringRuleStartDateInput: document.querySelector("#recurring-rule-start-date"),
      recurringRuleNoteInput: document.querySelector("#recurring-rule-note"),
      recurringRuleActiveInput: document.querySelector("#recurring-rule-active"),
      recurringRuleSubmitBtn: document.querySelector("#recurring-rule-submit"),
      recurringRuleCancelBtn: document.querySelector("#recurring-rule-cancel"),
      recurringRulesList: document.querySelector("#recurring-rules-list"),
      recurringRulesEmpty: document.querySelector("#recurring-rules-empty"),
      saveSettingsBtn: document.querySelector("#save-settings"),
      syncPendingBtn: document.querySelector("#sync-pending"),
      settingsPanel: document.querySelector("#settings-panel"),
      settingsBackdrop: document.querySelector("#settings-backdrop"),
      toggleSettingsBtn: document.querySelector("#toggle-settings"),
      closeSettingsBtn: document.querySelector("#close-settings"),
      toggleThemeBtn: document.querySelector("#toggle-theme"),
      toggleAmountVisibilityBtn: document.querySelector("#toggle-amount-visibility"),
      toggleDailyReminderBtn: document.querySelector("#toggle-daily-reminder"),
      toggleAutoSyncBtn: document.querySelector("#toggle-auto-sync"),
      autoSyncIntervalSelect: document.querySelector("#auto-sync-interval"),
      toggleRecordsContentBtn: document.querySelector("#toggle-records-content"),
      versionUpdateLinks: document.querySelectorAll(".version-update-link"),
      updateLinkDialog: document.querySelector("#update-link-dialog"),
      updateLinkValueInput: document.querySelector("#update-link-value"),
      updateLinkCloseBtn: document.querySelector("#update-link-close"),
      clearAllBtn: document.querySelector("#clear-all"),
      editRecordDialog: document.querySelector("#edit-record-dialog"),
      editRecordForm: document.querySelector("#edit-record-form"),
      editRecordIdInput: document.querySelector("#edit-record-id"),
      editRecordDateInput: document.querySelector("#edit-expense-date"),
      editRecordCategoryInput: document.querySelector("#edit-expense-category"),
      editRecordAmountInput: document.querySelector("#edit-expense-amount"),
      editRecordMethodInput: document.querySelector("#edit-expense-method"),
      editRecordNoteInput: document.querySelector("#edit-expense-note"),
      editRecordCancelBtn: document.querySelector("#edit-record-cancel"),
      deleteConfirmDialog: document.querySelector("#delete-confirm-dialog"),
      deleteConfirmRecordIdInput: document.querySelector("#delete-confirm-record-id"),
      deleteConfirmCancelBtn: document.querySelector("#delete-confirm-cancel"),
      clearAllConfirmDialog: document.querySelector("#clear-all-confirm-dialog"),
      clearAllConfirmCancelBtn: document.querySelector("#clear-all-confirm-cancel"),
      offlineIndicator: document.querySelector("#offline-indicator"),
      paginationControls: document.querySelector("#records-pagination"),
      paginationPrevBtn: document.querySelector("#pagination-prev"),
      paginationNextBtn: document.querySelector("#pagination-next"),
      paginationInfo: document.querySelector("#pagination-info"),
      walletsGrid: document.querySelector("#wallets-grid"),
      walletTransferBtn: document.querySelector("#wallet-transfer-btn"),
      walletAddBtn: document.querySelector("#wallet-add-btn"),
      transferDialog: document.querySelector("#transfer-dialog"),
      addWalletDialog: document.querySelector("#add-wallet-dialog"),
      walletBalanceList: document.querySelector("#wallet-balance-list"),
      saveWalletBalancesBtn: document.querySelector("#save-wallet-balances"),
    }
  : {};

function getRuntimeUiProfile() {
  const hasAndroidBridge =
    typeof window !== "undefined" &&
    window.AndroidReminderBridge &&
    typeof window.AndroidReminderBridge === "object";
  const hardwareConcurrency =
    typeof navigator !== "undefined"
      ? Number(navigator.hardwareConcurrency || 0)
      : 0;
  const deviceMemory =
    typeof navigator !== "undefined"
      ? Number(navigator.deviceMemory || 0)
      : 0;
  const hasCoarsePointer =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return {
    hasAndroidBridge: Boolean(hasAndroidBridge),
    prefersPerformanceLite:
      Boolean(hasAndroidBridge) ||
      prefersReducedMotion ||
      hasCoarsePointer ||
      (deviceMemory > 0 && deviceMemory <= 4) ||
      (hardwareConcurrency > 0 && hardwareConcurrency <= 4),
  };
}

function applyRuntimePlatformClass() {
  if (typeof document === "undefined") return;
  const profile = getRuntimeUiProfile();
  const targets = [document.documentElement, document.body].filter(
    (element) => element && typeof element.classList?.toggle === "function"
  );
  for (const target of targets) {
    target.classList.toggle("android-webview", profile.hasAndroidBridge);
    target.classList.toggle("performance-lite", profile.prefersPerformanceLite);
  }
}

applyRuntimePlatformClass();

function safeGetLocalStorage(key) {
  try {
    return typeof localStorage !== "undefined" && localStorage ? localStorage.getItem(key) : null;
  } catch (_error) {
    return null;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return false;
    localStorage.setItem(key, String(value));
    return true;
  } catch (_error) {
    return false;
  }
}

function scoreTextEncodingQuality(value) {
  const text = String(value || "");
  if (!text) return 0;
  const markerMatches = text.match(new RegExp(MOJIBAKE_MARKER_REGEX.source, "g"));
  const replacementMatches = text.match(/\uFFFD/g);
  const controlMatches = text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
  const vietnameseLetterMatches = text.match(
    /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]/g
  );
  return -((markerMatches?.length || 0) * 6 + (replacementMatches?.length || 0) * 10 + (controlMatches?.length || 0) * 8) +
    (vietnameseLetterMatches?.length || 0) * 2;
}

function countMojibakeMarkers(value) {
  return (String(value || "").match(/Ã|Â|Ä|Å|Æ|Ð|Ñ|Ø|â|ï¿½|�/g) || []).length;
}

function countExtendedLetters(value) {
  return (String(value || "").match(/[\u0100-\u024F\u1E00-\u1EFF]/g) || []).length;
}

function decodeUtf8FromLatin1(value) {
  const text = String(value || "");
  if (!text) return text;
  let encoded = "";
  for (let index = 0; index < text.length; index += 1) {
    const byte = text.charCodeAt(index) & 0xff;
    encoded += `%${byte.toString(16).padStart(2, "0")}`;
  }
  try {
    return decodeURIComponent(encoded);
  } catch (_error) {
    return text;
  }
}

function repairMojibakeText(value) {
  let text = String(value || "");
  if (!text) return "";
  for (let i = 0; i < 4; i += 1) {
    const decoded = decodeUtf8FromLatin1(text);
    if (!decoded || decoded === text) break;
    const currentMarkers = countMojibakeMarkers(text);
    const decodedMarkers = countMojibakeMarkers(decoded);
    const currentExtended = countExtendedLetters(text);
    const decodedExtended = countExtendedLetters(decoded);
    const currentScore = scoreTextEncodingQuality(text);
    const decodedScore = scoreTextEncodingQuality(decoded);
    if (decodedExtended > currentExtended || decodedMarkers < currentMarkers || decodedScore > currentScore) {
      text = decoded;
      continue;
    }
    break;
  }
  return text;
}

function normalizeHumanText(value, maxLength) {
  const text = String(repairMojibakeText(value) || "").trim();
  return Number.isFinite(maxLength) && maxLength > 0 ? text.slice(0, maxLength) : text;
}

function normalizeTextLoose(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function canonicalizeByLooseMatch(value, candidates) {
  const normalized = normalizeTextLoose(value);
  if (!normalized) return "";
  for (const candidate of candidates) if (normalizeTextLoose(candidate) === normalized) return candidate;
  return "";
}

function normalizeCategoryName(value, fallback = "Khác") {
  const candidate = normalizeHumanText(value, 40) || fallback;
  return canonicalizeByLooseMatch(candidate, DEFAULT_CATEGORIES) || candidate;
}

function normalizePaymentMethodName(value, fallback = "Tiền mặt") {
  const candidate = normalizeHumanText(value, 40) || fallback;
  return canonicalizeByLooseMatch(candidate, DEFAULT_METHODS) || candidate;
}

function normalizeTheme(value) {
  if (value === THEMES.dark || value === THEMES.light) return value;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return THEMES.dark;
  }
  return THEMES.light;
}

function normalizeMonthFilter(value) {
  const key = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(key) ? key : "";
}

function sanitizeBudgetValue(value) {
  const parsed = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function formatBudgetInput(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? NUMBER_FORMATTERS.budgetInput.format(Math.round(numeric)) : "";
}

function normalizeCategories(values) {
  const merged = Array.isArray(values) ? values : [];
  const unique = new Map();
  for (const name of [...DEFAULT_CATEGORIES, ...merged]) {
    const category = normalizeCategoryName(name, "");
    if (!category) continue;
    const key = normalizeTextLoose(category);
    if (!key || unique.has(key)) continue;
    unique.set(key, category);
  }
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, "vi"));
}

function normalizeSyncStatus(value) {
  return value === SYNC_STATUS.synced || value === SYNC_STATUS.pending || value === SYNC_STATUS.failed
    ? value
    : SYNC_STATUS.local;
}

function normalizeRecordSource(value) {
  return value === RECORD_SOURCE.recurring ? RECORD_SOURCE.recurring : RECORD_SOURCE.manual;
}

function normalizeDayOfMonth(value) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(31, Math.max(1, numeric));
}

function getLocalDateKey(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, "0");
  const day = String(baseDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalMonthKey(baseDate = new Date()) {
  return getLocalDateKey(baseDate).slice(0, 7);
}

function getMonthKeyFromDate(value) {
  const dateKey = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(dateKey)) return dateKey;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey.slice(0, 7);
  return "";
}

function normalizeDateKey(value, fallbackIso) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const fallback = fallbackIso ? new Date(fallbackIso) : new Date();
  return !Number.isNaN(fallback.getTime()) ? getLocalDateKey(fallback) : getLocalDateKey();
}

function normalizeCreatedAt(value, dateKey) {
  const parsed = new Date(String(value || ""));
  return !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date(`${dateKey}T00:00:00`).toISOString();
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `rec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function makeRecurringRuleId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `rule_${crypto.randomUUID()}`;
  return `rule_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function makeRecurringOccurrenceKey(ruleId, monthKey) {
  const recurringRuleId = String(ruleId || "").trim();
  const normalizedMonthKey = normalizeMonthFilter(monthKey);
  return recurringRuleId && normalizedMonthKey ? `${recurringRuleId}:${normalizedMonthKey}` : "";
}

function makeRecurringLookupKey(recurringRuleId, recurringOccurrenceKey) {
  const ruleId = String(recurringRuleId || "").trim();
  const occurrenceKey = String(recurringOccurrenceKey || "").trim();
  return ruleId && occurrenceKey ? `${ruleId}|${occurrenceKey}` : "";
}

function normalizeRecurringOccurrenceKey(value, ruleId, fallbackDate) {
  const raw = String(value || "").trim();
  if (raw) {
    const match = raw.match(/^(.+):(\d{4}-\d{2})$/);
    if (match) return makeRecurringOccurrenceKey(match[1], match[2]);
  }
  const recurringRuleId = String(ruleId || "").trim();
  const monthKey = getMonthKeyFromDate(fallbackDate);
  return recurringRuleId && monthKey ? makeRecurringOccurrenceKey(recurringRuleId, monthKey) : "";
}

function normalizeRecurringRule(rule) {
  if (!rule || typeof rule !== "object") return null;
  const rawAmount = Number(rule.amount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return null;
  const startDate = normalizeDateKey(rule.startDate, rule.createdAt);
  return {
    id: String(rule.id || makeRecurringRuleId()),
    amount: Math.round(rawAmount),
    category: normalizeCategoryName(rule.category, "Khác"),
    method: normalizePaymentMethodName(rule.method, "Tiền mặt"),
    note: normalizeHumanText(rule.note, 120),
    dayOfMonth: normalizeDayOfMonth(rule.dayOfMonth),
    startDate,
    active: rule.active !== false,
    createdAt: normalizeCreatedAt(rule.createdAt, startDate),
    updatedAt: normalizeCreatedAt(rule.updatedAt || rule.createdAt, startDate),
  };
}

function normalizeRecurringSuppression(entry) {
  if (!entry || typeof entry !== "object") return null;
  const recurringRuleId = String(entry.recurringRuleId || "").trim();
  const recurringOccurrenceKey = normalizeRecurringOccurrenceKey(
    entry.recurringOccurrenceKey,
    recurringRuleId,
    entry.date || entry.monthKey || ""
  );
  if (!recurringRuleId || !recurringOccurrenceKey) return null;
  return {
    recurringRuleId,
    recurringOccurrenceKey,
    deletedAt: normalizeCreatedAt(entry.deletedAt, getMonthKeyFromDate(recurringOccurrenceKey.split(":").pop()) ? `${recurringOccurrenceKey.split(":").pop()}-01` : getLocalDateKey()),
  };
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getScheduledDateForRecurringMonth(rule, monthKey) {
  const normalizedMonthKey = normalizeMonthFilter(monthKey);
  if (!normalizedMonthKey) return "";
  const parts = normalizedMonthKey.split("-");
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return "";
  const day = Math.min(getDaysInMonth(year, monthIndex), normalizeDayOfMonth(rule?.dayOfMonth));
  return `${normalizedMonthKey}-${String(day).padStart(2, "0")}`;
}

function getRecurringDueMonthKeys(rule, asOfDate = getLocalDateKey()) {
  const normalizedRule = normalizeRecurringRule(rule);
  const asOfDateKey = normalizeDateKey(asOfDate);
  if (!normalizedRule || !normalizedRule.active) return [];
  const startMonthKey = getMonthKeyFromDate(normalizedRule.startDate);
  const endMonthKey = getMonthKeyFromDate(asOfDateKey);
  if (!startMonthKey || !endMonthKey || startMonthKey.localeCompare(endMonthKey) > 0) return [];

  const months = [];
  let current = `${startMonthKey}-01`;
  const end = `${endMonthKey}-01`;
  while (current <= end) {
    const monthKey = current.slice(0, 7);
    const scheduledDate = getScheduledDateForRecurringMonth(normalizedRule, monthKey);
    if (scheduledDate && scheduledDate >= normalizedRule.startDate && scheduledDate <= asOfDateKey) {
      months.push(monthKey);
    }
    const next = new Date(`${current}T00:00:00`);
    next.setMonth(next.getMonth() + 1);
    current = `${getLocalMonthKey(next)}-01`;
  }
  return months;
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object") return null;
  const rawAmount = Number(record.amount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return null;
  const date = normalizeDateKey(record.date, record.createdAt);
  const source = normalizeRecordSource(record.source);
  const recurringRuleId = source === RECORD_SOURCE.recurring ? String(record.recurringRuleId || "").trim() : "";
  const recurringOccurrenceKey = source === RECORD_SOURCE.recurring
    ? normalizeRecurringOccurrenceKey(record.recurringOccurrenceKey, recurringRuleId, date)
    : "";
  const hasRecurringIdentity = Boolean(recurringRuleId && recurringOccurrenceKey);
  const sourceValue = hasRecurringIdentity ? RECORD_SOURCE.recurring : (source === RECORD_SOURCE.transfer ? RECORD_SOURCE.transfer : RECORD_SOURCE.manual);
  return {
    id: String(record.id || makeId()),
    date,
    category: normalizeCategoryName(record.category, "Khác"),
    amount: Math.round(rawAmount),
    method: normalizePaymentMethodName(record.method, "Tiền mặt"),
    note: normalizeHumanText(record.note, 120),
    createdAt: normalizeCreatedAt(record.createdAt, date),
    updatedAt: normalizeCreatedAt(record.updatedAt || record.createdAt, date),
    syncStatus: normalizeSyncStatus(record.syncStatus),
    source: sourceValue,
    recurringRuleId: hasRecurringIdentity ? recurringRuleId : "",
    recurringOccurrenceKey: hasRecurringIdentity ? recurringOccurrenceKey : "",
    walletId: String(record.walletId || "").trim() || findWalletIdByName(record.method) || "wallet_tienmat",
  };
}

function normalizeSettings(rawSettings) {
  if (!rawSettings || typeof rawSettings !== "object") {
    return {
      sheetEndpoint: "",
      apiKey: "",
      monthlyBudget: 0,
      categories: [...DEFAULT_CATEGORIES],
      hideAmounts: false,
      theme: normalizeTheme(),
      dailyReminderEnabled: false,
      autoSyncEnabled: false,
      autoSyncInterval: 15,
    };
  }
  const monthlyBudget = Number(rawSettings.monthlyBudget);
  const rawInterval = Number(rawSettings.autoSyncInterval);
  const validInterval = AUTO_SYNC_INTERVALS.some((i) => i.value === rawInterval) ? rawInterval : 15;
  return {
    sheetEndpoint: String(rawSettings.sheetEndpoint || "").trim(),
    apiKey: String(rawSettings.apiKey || "").trim(),
    monthlyBudget: Number.isFinite(monthlyBudget) && monthlyBudget >= 0 ? Math.round(monthlyBudget) : 0,
    categories: normalizeCategories(rawSettings.categories),
    hideAmounts: Boolean(rawSettings.hideAmounts),
    theme: normalizeTheme(rawSettings.theme),
    dailyReminderEnabled: Boolean(rawSettings.dailyReminderEnabled),
    autoSyncEnabled: Boolean(rawSettings.autoSyncEnabled),
    autoSyncInterval: validInterval,
  };
}

function formatCurrency(value) {
  return NUMBER_FORMATTERS.currency.format(Math.round(Number(value) || 0));
}

function formatCurrencyForUI(value) {
  return shouldHideAmounts() ? "••••••" : formatCurrency(value);
}

function formatDate(value) {
  const date = new Date(`${String(value || "")}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value || "") : NUMBER_FORMATTERS.date.format(date);
}

function formatMonthKey(value) {
  const key = normalizeMonthFilter(value);
  if (!key) return String(value || "");
  const date = new Date(`${key}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? key : NUMBER_FORMATTERS.monthYear.format(date);
}

function formatPercent(value, total) {
  if (!Number.isFinite(total) || total <= 0) return "0%";
  return `${NUMBER_FORMATTERS.percent.format((Number(value) / total) * 100)}%`;
}

function shouldHideAmounts() {
  return Boolean(state.settings.hideAmounts);
}

function isLikelyHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function getAndroidReminderBridge() {
  if (typeof window === "undefined") return null;
  const bridge = window.AndroidReminderBridge;
  return bridge && typeof bridge === "object" ? bridge : null;
}

function normalizeNotificationPermissionState(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "granted" || normalized === "denied" || normalized === "default" || normalized === "pending") {
    return normalized;
  }
  return "denied";
}

function getNotificationPermissionStateForDevice() {
  const bridge = getAndroidReminderBridge();
  if (bridge && typeof bridge.getNotificationPermissionState === "function") {
    try {
      return normalizeNotificationPermissionState(bridge.getNotificationPermissionState());
    } catch (_error) {
      return "denied";
    }
  }
  if (typeof Notification !== "undefined" && typeof Notification.permission === "string") {
    return normalizeNotificationPermissionState(Notification.permission);
  }
  return "denied";
}

function requestAndroidNotificationPermission(bridge) {
  return new Promise((resolve) => {
    let settled = false;

    function onPermissionResult(nextState) {
      settle(nextState);
    }

    function settle(nextState) {
      if (settled) return;
      settled = true;
      if (typeof window !== "undefined" && window.__onAndroidNotificationPermissionResult === onPermissionResult) {
        window.__onAndroidNotificationPermissionResult = null;
      }
      resolve(normalizeNotificationPermissionState(nextState));
    }

    if (typeof window !== "undefined") {
      window.__onAndroidNotificationPermissionResult = onPermissionResult;
    }

    let immediateState = "denied";
    try {
      immediateState = bridge.requestNotificationPermission();
    } catch (_error) {
      settle("denied");
      return;
    }

    const normalizedImmediateState = normalizeNotificationPermissionState(immediateState);
    if (normalizedImmediateState !== "pending") {
      settle(normalizedImmediateState);
      return;
    }

    setTimeout(() => {
      if (typeof bridge.getNotificationPermissionState === "function") {
        try {
          settle(bridge.getNotificationPermissionState());
          return;
        } catch (_error) {
          settle("denied");
          return;
        }
      }
      settle("denied");
    }, 12000);
  });
}

async function requestNotificationPermissionForDevice() {
  const bridge = getAndroidReminderBridge();
  if (bridge && typeof bridge.requestNotificationPermission === "function") {
    return requestAndroidNotificationPermission(bridge);
  }
  if (typeof Notification !== "undefined" && typeof Notification.requestPermission === "function") {
    try {
      const permission = await Notification.requestPermission();
      return normalizeNotificationPermissionState(permission);
    } catch (_error) {
      return "denied";
    }
  }
  return "denied";
}

function applyDailyReminderToggleState() {
  if (!dom.toggleDailyReminderBtn) return;
  const enabled = Boolean(state.settings.dailyReminderEnabled);
  dom.toggleDailyReminderBtn.textContent = enabled ? "Tắt nhắc 21:00" : "Bật nhắc 21:00";
  dom.toggleDailyReminderBtn.setAttribute("aria-pressed", String(enabled));
  dom.toggleDailyReminderBtn.classList.toggle("is-enabled", enabled);
}

function applyAutoSyncToggleState() {
  if (!dom.toggleAutoSyncBtn) return;
  const enabled = Boolean(state.settings.autoSyncEnabled);
  const intervalLabel = AUTO_SYNC_INTERVALS.find((i) => i.value === state.settings.autoSyncInterval)?.label || "15 phút";
  dom.toggleAutoSyncBtn.textContent = enabled ? `Tự động đồng bộ: Bật (${intervalLabel})` : "Tự động đồng bộ: Tắt";
  dom.toggleAutoSyncBtn.setAttribute("aria-pressed", String(enabled));
  dom.toggleAutoSyncBtn.classList.toggle("is-enabled", enabled);
  if (dom.autoSyncIntervalSelect) dom.autoSyncIntervalSelect.value = String(state.settings.autoSyncInterval);
}

function onToggleAutoSync() {
  state.settings.autoSyncEnabled = !state.settings.autoSyncEnabled;
  persistSettings();
  applyAutoSyncToggleState();
  updateAutoSyncState();
  setFormStatus(state.settings.autoSyncEnabled ? "Đã bật tự động đồng bộ." : "Đã tắt tự động đồng bộ.", "success");
}

function onAutoSyncIntervalChange() {
  if (!dom.autoSyncIntervalSelect) return;
  const interval = Number(dom.autoSyncIntervalSelect.value);
  state.settings.autoSyncInterval = interval;
  persistSettings();
  applyAutoSyncToggleState();
  updateAutoSyncState();
}

function hasRecordOnDate(dateKey) {
  const normalizedDateKey = normalizeDateKey(dateKey);
  return state.records.some((record) => normalizeDateKey(record?.date, record?.createdAt) === normalizedDateKey);
}

function syncReminderTodayRecordState(options = {}) {
  const bridge = getAndroidReminderBridge();
  if (!bridge || typeof bridge.updateTodayRecordState !== "function") return;
  const todayDateKey = getLocalDateKey();
  const hasRecordToday = hasRecordOnDate(todayDateKey);
  try {
    bridge.updateTodayRecordState(todayDateKey, hasRecordToday);
  } catch (_error) {
    return;
  }
  if (!options.sendNow || !state.settings.dailyReminderEnabled || typeof bridge.maybeSendReminderNow !== "function") return;
  try {
    bridge.maybeSendReminderNow();
  } catch (_error) {
    // Ignore runtime bridge errors to avoid breaking the app flow.
  }
}

function syncDailyReminderScheduleForAndroid() {
  const bridge = getAndroidReminderBridge();
  if (!bridge) return;
  if (state.settings.dailyReminderEnabled) {
    if (typeof bridge.scheduleDailyReminder !== "function") return;
    try {
      bridge.scheduleDailyReminder(
        DAILY_REMINDER_CONFIG.hour,
        DAILY_REMINDER_CONFIG.minute,
        DAILY_REMINDER_CONFIG.title,
        DAILY_REMINDER_CONFIG.message
      );
    } catch (_error) {
      // Ignore runtime bridge errors to avoid breaking the app flow.
    }
    return;
  }
  if (typeof bridge.cancelDailyReminder !== "function") return;
  try {
    bridge.cancelDailyReminder();
  } catch (_error) {
    // Ignore runtime bridge errors to avoid breaking the app flow.
  }
}

function ensureRuntimeCaches() {
  if (!state.runtime || typeof state.runtime !== "object") state.runtime = {};
  if (!state.runtime.recordsFilter || typeof state.runtime.recordsFilter !== "object") {
    state.runtime.recordsFilter = { query: "" };
  }
  if (!Number.isFinite(state.runtime.recordsVersion)) state.runtime.recordsVersion = 0;
  if (!Number.isFinite(state.runtime.sortedRecordsVersion)) state.runtime.sortedRecordsVersion = -1;
  if (!Array.isArray(state.runtime.sortedRecordsCache)) state.runtime.sortedRecordsCache = [];
  if (!Number.isFinite(state.runtime.categorySummaryCacheVersion)) state.runtime.categorySummaryCacheVersion = -1;
  if (!state.runtime.categorySummaryCache || typeof state.runtime.categorySummaryCache !== "object") state.runtime.categorySummaryCache = null;
  if (!Number.isFinite(state.runtime.recordsDerivedCacheVersion)) state.runtime.recordsDerivedCacheVersion = -1;
  if (!state.runtime.recordsDerivedCache || typeof state.runtime.recordsDerivedCache !== "object") state.runtime.recordsDerivedCache = null;
  if (!Number.isFinite(state.runtime.filteredRecordsVersion)) state.runtime.filteredRecordsVersion = -1;
  if (!Array.isArray(state.runtime.filteredRecordsCache)) state.runtime.filteredRecordsCache = [];
  if (typeof state.runtime.filteredRecordsQuery !== "string") state.runtime.filteredRecordsQuery = "";
  if (!(state.runtime.recordSearchCache instanceof Map)) state.runtime.recordSearchCache = new Map();
  if (!(state.runtime.recurringSuppressionCache instanceof Set)) state.runtime.recurringSuppressionCache = new Set();
  if (!Number.isFinite(state.runtime.recurringSuppressionCacheVersion)) state.runtime.recurringSuppressionCacheVersion = -1;
  if (!Number.isFinite(state.runtime.recurringSuppressionsVersion)) state.runtime.recurringSuppressionsVersion = 0;
  if (typeof state.runtime.statsRenderKey !== "string") state.runtime.statsRenderKey = "";
  if (typeof state.runtime.monthlySummaryRenderKey !== "string") state.runtime.monthlySummaryRenderKey = "";
  if (typeof state.runtime.recurringRulesRenderKey !== "string") state.runtime.recurringRulesRenderKey = "";
  if (typeof state.runtime.recordsRenderKey !== "string") state.runtime.recordsRenderKey = "";
  if (state.runtime.pendingRecordsRenderHandle === undefined) state.runtime.pendingRecordsRenderHandle = null;
  if (state.runtime.recordsFilterInputHandle === undefined) state.runtime.recordsFilterInputHandle = null;
  if (!Number.isFinite(state.runtime.currentPage) || state.runtime.currentPage < 1) state.runtime.currentPage = 1;
  if (typeof state.runtime.isOnline !== "boolean") state.runtime.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
}

function clearPendingFilterInputRender() {
  ensureRuntimeCaches();
  if (state.runtime.recordsFilterInputHandle !== null) {
    clearTimeout(state.runtime.recordsFilterInputHandle);
    state.runtime.recordsFilterInputHandle = null;
  }
}

function cancelScheduledRecordsRender() {
  ensureRuntimeCaches();
  const handle = state.runtime.pendingRecordsRenderHandle;
  if (handle === null) return;
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
  else clearTimeout(handle);
  state.runtime.pendingRecordsRenderHandle = null;
}

function scheduleRecordsRender() {
  ensureRuntimeCaches();
  if (state.runtime.pendingRecordsRenderHandle !== null) return;
  const run = () => {
    state.runtime.pendingRecordsRenderHandle = null;
    renderRecords();
  };
  if (typeof requestAnimationFrame === "function") {
    state.runtime.pendingRecordsRenderHandle = requestAnimationFrame(run);
  } else {
    state.runtime.pendingRecordsRenderHandle = setTimeout(run, 0);
  }
}

function markRecordsDirty() {
  ensureRuntimeCaches();
  state.runtime.recordsVersion += 1;
  state.runtime.sortedRecordsVersion = -1;
  state.runtime.sortedRecordsCache = [];
  state.runtime.categorySummaryCacheVersion = -1;
  state.runtime.categorySummaryCache = null;
  state.runtime.recordsDerivedCacheVersion = -1;
  state.runtime.recordsDerivedCache = null;
  state.runtime.filteredRecordsVersion = -1;
  state.runtime.filteredRecordsCache = [];
  state.runtime.filteredRecordsQuery = "";
  state.runtime.recordSearchCache.clear();
}

function markRecurringSuppressionsDirty() {
  ensureRuntimeCaches();
  state.runtime.recurringSuppressionsVersion += 1;
  state.runtime.recurringSuppressionCacheVersion = -1;
  state.runtime.recurringSuppressionCache = new Set();
}

function persistRecords() {
  safeSetLocalStorage(STORAGE_KEYS.records, JSON.stringify(state.records));
  syncReminderTodayRecordState({ sendNow: true });
}

function persistSettings() {
  safeSetLocalStorage(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

function persistRecurringState() {
  safeSetLocalStorage(STORAGE_KEYS.recurringRules, JSON.stringify(state.recurringRules));
  safeSetLocalStorage(STORAGE_KEYS.recurringSuppressions, JSON.stringify(state.recurringSuppressions));
}

// ==================== WALLET FUNCTIONS ====================

function persistWallets() {
  safeSetLocalStorage(STORAGE_KEYS.wallets, JSON.stringify(state.wallets));
}

function findWalletById(walletId) {
  const id = String(walletId || "").trim();
  return id ? state.wallets.find(w => w.id === id) || null : null;
}

function findWalletIdByName(name) {
  const normalizedName = normalizeTextLoose(String(name || ""));
  for (const wallet of state.wallets) {
    if (normalizeTextLoose(wallet.name) === normalizedName) {
      return wallet.id;
    }
  }
  return "";
}

function getWalletByName(name) {
  const id = findWalletIdByName(name);
  return id ? findWalletById(id) : null;
}

function updateWalletBalance(walletId, amountDelta) {
  const wallet = findWalletById(walletId);
  if (!wallet) return false;
  wallet.balance = Math.max(0, wallet.balance + amountDelta);
  persistWallets();
  return true;
}

function initializeWalletBalances() {
  // Tính số dư cho mỗi ví từ các bản ghi hiện có
  const walletBalances = {};
  for (const wallet of state.wallets) {
    walletBalances[wallet.id] = 0;
  }

  for (const record of state.records) {
    const walletId = record.walletId || findWalletIdByName(record.method);
    if (walletId && walletBalances[walletId] !== undefined) {
      if (record.source === RECORD_SOURCE.transfer) {
        // Transfer không ảnh hưởng đến tổng chi tiêu
      } else {
        // Chi tiêu giảm số dư
        walletBalances[walletId] -= record.amount;
      }
    }
  }

  for (const wallet of state.wallets) {
    if (walletBalances[wallet.id] !== undefined) {
      wallet.balance = walletBalances[wallet.id];
    }
  }
  persistWallets();
}

function renderWallets() {
  if (!dom.walletsGrid) return;
  const fragment = document.createDocumentFragment();

  state.wallets.forEach((wallet, index) => {
    const card = document.createElement("div");
    card.className = "wallet-card";
    card.dataset.walletId = wallet.id;
    card.style.background = WALLET_COLORS[index % WALLET_COLORS.length];

    const displayBalance = shouldHideAmounts()
      ? "••••••"
      : formatCurrency(wallet.balance);

    card.innerHTML = `
      <div class="wallet-card-icon">${wallet.icon || "👛"}</div>
      <div class="wallet-card-info">
        <p class="wallet-card-name">${wallet.name}</p>
        <p class="wallet-card-balance">${displayBalance}</p>
      </div>
      ${wallet.isDefault ? '<span class="wallet-default-badge">Mặc định</span>' : ""}
    `;
    fragment.appendChild(card);
  });

  dom.walletsGrid.replaceChildren(fragment);
}

function refreshWalletMethodOptions() {
  const walletNames = state.wallets.map(w => w.name);

  // Cập nhật dropdown trong expense form
  replaceSelectOptions(dom.methodInput, walletNames);

  // Cập nhật dropdown trong edit form
  replaceSelectOptions(dom.editRecordMethodInput, walletNames);

  // Cập nhật dropdown trong recurring rule form
  if (dom.recurringRuleMethodInput) {
    replaceSelectOptions(dom.recurringRuleMethodInput, walletNames);
  }
}

// ==================== TRANSFER FUNCTIONS ====================

function populateTransferWalletOptions() {
  const fromSelect = dom.transferDialog?.querySelector("#transfer-from");
  const toSelect = dom.transferDialog?.querySelector("#transfer-to");
  if (!fromSelect || !toSelect) return;

  const options = state.wallets.map(w =>
    `<option value="${w.id}">${w.icon || "👛"} ${w.name}</option>`
  ).join("");

  fromSelect.innerHTML = options;
  toSelect.innerHTML = options;

  // Set defaults
  if (state.wallets.length >= 2) {
    fromSelect.value = state.wallets[0]?.id || "";
    toSelect.value = state.wallets[1]?.id || "";
  }
}

function openTransferDialog() {
  if (!dom.transferDialog || typeof dom.transferDialog.showModal !== "function") {
    setFormStatus("Thiết bị không hỗ trợ hộp thoại chuyển tiền.", "error");
    return;
  }
  populateTransferWalletOptions();
  const amountInput = dom.transferDialog.querySelector("#transfer-amount");
  const noteInput = dom.transferDialog.querySelector("#transfer-note");
  if (amountInput) amountInput.value = "";
  if (noteInput) noteInput.value = "";
  dom.transferDialog.showModal();
}

function closeTransferDialog() {
  if (dom.transferDialog && typeof dom.transferDialog.close === "function") {
    dom.transferDialog.close();
  }
}

function onSubmitTransfer(event) {
  event.preventDefault();
  const fromSelect = dom.transferDialog.querySelector("#transfer-from");
  const toSelect = dom.transferDialog.querySelector("#transfer-to");
  const amountInput = dom.transferDialog.querySelector("#transfer-amount");
  const noteInput = dom.transferDialog.querySelector("#transfer-note");

  const fromWalletId = fromSelect?.value;
  const toWalletId = toSelect?.value;
  const amount = Number(amountInput?.value || 0);

  if (!fromWalletId || !toWalletId) {
    setFormStatus("Vui lòng chọn ví nguồn và ví đích.", "error");
    return;
  }
  if (fromWalletId === toWalletId) {
    setFormStatus("Ví nguồn và ví đích phải khác nhau.", "error");
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    setFormStatus("Vui lòng nhập số tiền hợp lệ.", "error");
    return;
  }

  const fromWallet = findWalletById(fromWalletId);
  const toWallet = findWalletById(toWalletId);
  if (!fromWallet || !toWallet) {
    setFormStatus("Ví không hợp lệ.", "error");
    return;
  }

  // Tạo bản ghi chuyển tiền (2 bản ghi: 1 trừ, 1 cộng)
  const now = new Date().toISOString();
  const dateKey = getLocalDateKey();

  const recordOut = normalizeRecord({
    id: makeId(),
    date: dateKey,
    category: "Chuyển tiền",
    amount: amount,
    method: fromWallet.name,
    note: `Chuyển sang ${toWallet.name}${noteInput?.value ? " - " + noteInput.value : ""}`,
    createdAt: now,
    updatedAt: now,
    syncStatus: SYNC_STATUS.local,
    source: RECORD_SOURCE.transfer,
    walletId: fromWalletId,
  });

  const recordIn = normalizeRecord({
    id: makeId(),
    date: dateKey,
    category: "Nhận tiền",
    amount: amount,
    method: toWallet.name,
    note: `Nhận từ ${fromWallet.name}${noteInput?.value ? " - " + noteInput.value : ""}`,
    createdAt: now,
    updatedAt: now,
    syncStatus: SYNC_STATUS.local,
    source: RECORD_SOURCE.transfer,
    walletId: toWalletId,
  });

  if (!recordOut || !recordIn) {
    setFormStatus("Không thể tạo bản ghi chuyển tiền.", "error");
    return;
  }

  // Cập nhật số dư
  updateWalletBalance(fromWalletId, -amount);
  updateWalletBalance(toWalletId, amount);

  // Thêm bản ghi
  state.records.unshift(recordOut, recordIn);
  if (state.records.length > MAX_RECORDS) state.records = state.records.slice(0, MAX_RECORDS);

  markRecordsDirty();
  persistRecords();
  closeTransferDialog();
  renderWallets();
  render();
  setFormStatus(`Đã chuyển ${formatCurrency(amount)} từ ${fromWallet.name} sang ${toWallet.name}.`, "success");
}

// ==================== ADD WALLET FUNCTIONS ====================

function openAddWalletDialog() {
  if (!dom.addWalletDialog || typeof dom.addWalletDialog.showModal !== "function") {
    setFormStatus("Thiết bị không hỗ trợ hộp thoại thêm ví.", "error");
    return;
  }
  const nameInput = dom.addWalletDialog.querySelector("#wallet-name");
  const iconInput = dom.addWalletDialog.querySelector("#wallet-icon");
  if (nameInput) nameInput.value = "";
  if (iconInput) iconInput.value = "👛";
  dom.addWalletDialog.showModal();
}

function closeAddWalletDialog() {
  if (dom.addWalletDialog && typeof dom.addWalletDialog.close === "function") {
    dom.addWalletDialog.close();
  }
}

function onSubmitAddWallet(event) {
  event.preventDefault();
  const nameInput = dom.addWalletDialog.querySelector("#wallet-name");
  const iconInput = dom.addWalletDialog.querySelector("#wallet-icon");
  const name = String(nameInput?.value || "").trim();
  const icon = String(iconInput?.value || "👛").trim();

  if (!name) {
    setFormStatus("Vui lòng nhập tên ví.", "error");
    return;
  }

  // Kiểm tra trùng tên
  if (state.wallets.some(w => normalizeTextLoose(w.name) === normalizeTextLoose(name))) {
    setFormStatus("Tên ví đã tồn tại.", "error");
    return;
  }

  const newWallet = {
    id: `wallet_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name,
    balance: 0,
    icon,
    isDefault: false,
  };

  state.wallets.push(newWallet);
  persistWallets();
  refreshWalletMethodOptions();
  renderWallets();
  closeAddWalletDialog();
  setFormStatus(`Đã thêm ví "${name}".`, "success");
}

// ==================== WALLET BALANCE MANAGEMENT ====================

function renderWalletBalanceInputs() {
  if (!dom.walletBalanceList) return;
  const fragment = document.createDocumentFragment();

  state.wallets.forEach((wallet, index) => {
    const item = document.createElement("div");
    item.className = "wallet-balance-item";
    item.innerHTML = `
      <div class="wallet-balance-info">
        <span class="wallet-balance-icon">${wallet.icon || "👛"}</span>
        <span class="wallet-balance-name">${wallet.name}</span>
      </div>
      <div class="wallet-balance-input-wrap">
        <input
          type="text"
          class="wallet-balance-input"
          data-wallet-id="${wallet.id}"
          value="${formatBudgetInput(wallet.balance)}"
          placeholder="0"
          inputmode="numeric"
        />
        <span class="wallet-balance-currency">đ</span>
      </div>
    `;
    fragment.appendChild(item);
  });

  dom.walletBalanceList.replaceChildren(fragment);
}

function onSaveWalletBalances() {
  if (!dom.walletBalanceList) return;

  const inputs = dom.walletBalanceList.querySelectorAll(".wallet-balance-input");
  let changed = false;

  inputs.forEach(input => {
    const walletId = input.dataset.walletId;
    const wallet = findWalletById(walletId);
    if (!wallet) return;

    const newBalance = sanitizeBudgetValue(input.value);
    if (wallet.balance !== newBalance) {
      wallet.balance = newBalance;
      changed = true;
    }
  });

  if (changed) {
    persistWallets();
    renderWallets();
    setFormStatus("Đã lưu số dư ví.", "success");
  } else {
    setFormStatus("Số dư không thay đổi.", "info");
  }
}

function onWalletBalanceInputBlur(event) {
  const input = event.target;
  if (!input.classList.contains("wallet-balance-input")) return;
  input.value = formatBudgetInput(sanitizeBudgetValue(input.value));
}

// ==================== END WALLET FUNCTIONS ====================

function dedupeRecurringSuppressions(entries) {
  const unique = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const normalized = normalizeRecurringSuppression(entry);
    if (!normalized) continue;
    const key = `${normalized.recurringRuleId}|${normalized.recurringOccurrenceKey}`;
    if (!unique.has(key)) unique.set(key, normalized);
  }
  return Array.from(unique.values());
}

function loadStateFromStorage() {
  try {
    const raw = safeGetLocalStorage(STORAGE_KEYS.records);
    state.records = raw ? JSON.parse(raw).map((item) => normalizeRecord(item)).filter(Boolean).slice(0, MAX_RECORDS) : [];
  } catch (_error) {
    state.records = [];
  }
  try {
    const raw = safeGetLocalStorage(STORAGE_KEYS.settings);
    state.settings = raw ? normalizeSettings(JSON.parse(raw)) : normalizeSettings(null);
  } catch (_error) {
    state.settings = normalizeSettings(null);
  }
  try {
    const raw = safeGetLocalStorage(STORAGE_KEYS.recurringRules);
    state.recurringRules = raw ? JSON.parse(raw).map((item) => normalizeRecurringRule(item)).filter(Boolean) : [];
  } catch (_error) {
    state.recurringRules = [];
  }
  try {
    const raw = safeGetLocalStorage(STORAGE_KEYS.recurringSuppressions);
    state.recurringSuppressions = raw ? dedupeRecurringSuppressions(JSON.parse(raw)) : [];
  } catch (_error) {
    state.recurringSuppressions = [];
  }
  // Khởi tạo ví nếu chưa có
  try {
    const raw = safeGetLocalStorage(STORAGE_KEYS.wallets);
    state.wallets = raw ? JSON.parse(raw) : null;
  } catch (_error) {
    state.wallets = null;
  }
  if (!state.wallets) {
    state.wallets = DEFAULT_WALLETS.map(w => ({ ...w }));
    persistWallets();
  }
  markRecurringSuppressionsDirty();
  markRecordsDirty();
  updateAutoSyncState();
}

function getRecurringSuppressionKeySet() {
  ensureRuntimeCaches();
  if (state.runtime.recurringSuppressionCacheVersion === state.runtime.recurringSuppressionsVersion) {
    return state.runtime.recurringSuppressionCache;
  }
  const cache = new Set();
  for (const entry of state.recurringSuppressions) {
    const lookupKey = makeRecurringLookupKey(entry.recurringRuleId, entry.recurringOccurrenceKey);
    if (lookupKey) cache.add(lookupKey);
  }
  state.runtime.recurringSuppressionCache = cache;
  state.runtime.recurringSuppressionCacheVersion = state.runtime.recurringSuppressionsVersion;
  return cache;
}

function isRecurringOccurrenceSuppressed(recurringRuleId, recurringOccurrenceKey) {
  const lookupKey = makeRecurringLookupKey(recurringRuleId, recurringOccurrenceKey);
  return Boolean(lookupKey) && getRecurringSuppressionKeySet().has(lookupKey);
}

function addRecurringSuppression(recurringRuleId, recurringOccurrenceKey, deletedAt = new Date().toISOString()) {
  const normalized = normalizeRecurringSuppression({ recurringRuleId, recurringOccurrenceKey, deletedAt });
  if (!normalized) return false;
  const lookupKey = makeRecurringLookupKey(normalized.recurringRuleId, normalized.recurringOccurrenceKey);
  if (!lookupKey || getRecurringSuppressionKeySet().has(lookupKey)) return false;
  state.recurringSuppressions = [...state.recurringSuppressions, normalized];
  markRecurringSuppressionsDirty();
  persistRecurringState();
  return true;
}

function removeRecurringSuppressionsForRule(recurringRuleId) {
  const normalizedRuleId = String(recurringRuleId || "").trim();
  if (!normalizedRuleId) return false;
  const next = state.recurringSuppressions.filter((entry) => entry.recurringRuleId !== normalizedRuleId);
  if (next.length === state.recurringSuppressions.length) return false;
  state.recurringSuppressions = next;
  markRecurringSuppressionsDirty();
  persistRecurringState();
  return true;
}

function findRecordByRecurringOccurrence(recurringRuleId, recurringOccurrenceKey) {
  const lookupKey = makeRecurringLookupKey(recurringRuleId, recurringOccurrenceKey);
  if (!lookupKey) return null;
  return getRecordsDerivedData().recurringRecordByKey.get(lookupKey) || null;
}

function isRecurringOccurrenceHandled(recurringRuleId, recurringOccurrenceKey) {
  return Boolean(
    findRecordByRecurringOccurrence(recurringRuleId, recurringOccurrenceKey) ||
    isRecurringOccurrenceSuppressed(recurringRuleId, recurringOccurrenceKey)
  );
}

function createRecurringRecord(rule, monthKey) {
  const scheduledDate = getScheduledDateForRecurringMonth(rule, monthKey);
  const recurringOccurrenceKey = makeRecurringOccurrenceKey(rule.id, monthKey);
  if (!scheduledDate || !recurringOccurrenceKey) return null;
  return normalizeRecord({
    id: makeId(),
    date: scheduledDate,
    category: rule.category,
    amount: rule.amount,
    method: rule.method,
    note: rule.note,
    createdAt: new Date(`${scheduledDate}T00:00:00`).toISOString(),
    updatedAt: new Date(`${scheduledDate}T00:00:00`).toISOString(),
    syncStatus: SYNC_STATUS.local,
    source: RECORD_SOURCE.recurring,
    recurringRuleId: rule.id,
    recurringOccurrenceKey,
  });
}

function generateRecurringRecords(options = {}) {
  const asOfDate = normalizeDateKey(options.asOfDate, new Date().toISOString());
  const generated = [];
  for (const rule of state.recurringRules) {
    if (!rule.active) continue;
    const dueMonths = getRecurringDueMonthKeys(rule, asOfDate);
    for (const monthKey of dueMonths) {
      const recurringOccurrenceKey = makeRecurringOccurrenceKey(rule.id, monthKey);
      if (!recurringOccurrenceKey || isRecurringOccurrenceHandled(rule.id, recurringOccurrenceKey)) continue;
      const record = createRecurringRecord(rule, monthKey);
      if (record) generated.push(record);
    }
  }
  if (generated.length === 0) return 0;
  state.records = [...generated, ...state.records].sort(compareRecordsByUpdatedAt).slice(0, MAX_RECORDS);
  markRecordsDirty();
  if (options.persist !== false) persistRecords();
  return generated.length;
}

function getAvailableCategories() {
  const categories = new Map();
  for (const category of normalizeCategories(state.settings.categories)) {
    const key = normalizeTextLoose(category);
    if (key) categories.set(key, category);
  }
  for (const category of getRecordsDerivedData().availableRecordCategories) {
    const key = normalizeTextLoose(category);
    if (key && !categories.has(key)) categories.set(key, category);
  }
  return Array.from(categories.values()).sort((a, b) => a.localeCompare(b, "vi"));
}

function replaceSelectOptions(selectElement, values) {
  if (!selectElement || typeof selectElement.replaceChildren !== "function" || typeof document === "undefined") return;
  const current = String(selectElement.value || "").trim();
  const fragment = document.createDocumentFragment();
  const unique = Array.from(new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean)));
  for (const value of unique) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    fragment.appendChild(option);
  }
  selectElement.replaceChildren(fragment);
  selectElement.value = unique.includes(current) ? current : unique[0] || "";
}

function refreshCategoryOptionsFromSettings() {
  state.settings.categories = normalizeCategories(state.settings.categories);
  const categories = getAvailableCategories();
  replaceSelectOptions(dom.categoryInput, categories);
  replaceSelectOptions(dom.editRecordCategoryInput, categories);
  replaceSelectOptions(dom.recurringRuleCategoryInput, categories);
}

function normalizeCategoryValue(value) {
  const trimmed = normalizeCategoryName(value, "Khác");
  for (const category of getAvailableCategories()) {
    if (normalizeTextLoose(category) === normalizeTextLoose(trimmed)) return category;
  }
  return trimmed || "Khác";
}

function normalizeMethodValue(value) {
  const trimmed = normalizePaymentMethodName(value, "Tiền mặt");
  for (const method of DEFAULT_METHODS) {
    if (normalizeTextLoose(method) === normalizeTextLoose(trimmed)) return method;
  }
  return trimmed.slice(0, 40);
}

function isPerformanceLiteActive() {
  if (typeof document !== "undefined") {
    if (document.documentElement?.classList?.contains("performance-lite")) return true;
    if (document.body?.classList?.contains("performance-lite")) return true;
  }
  return getRuntimeUiProfile().prefersPerformanceLite;
}

function getRecordsPerPage() {
  return isPerformanceLiteActive() ? PERFORMANCE_LITE_RECORDS_PER_PAGE : MAX_RECORDS_PER_PAGE;
}

function findRecurringRuleById(ruleId) {
  const id = String(ruleId || "").trim();
  return id ? state.recurringRules.find((rule) => rule.id === id) || null : null;
}

function getNextRecurringDueDateForRule(rule, fromDate = getLocalDateKey()) {
  const normalizedRule = normalizeRecurringRule(rule);
  const fromDateKey = normalizeDateKey(fromDate);
  if (!normalizedRule) return "";
  const startMonthKey = getMonthKeyFromDate(normalizedRule.startDate);
  const fromMonthKey = getMonthKeyFromDate(fromDateKey);
  const initialMonthKey = startMonthKey && startMonthKey.localeCompare(fromMonthKey) > 0 ? startMonthKey : fromMonthKey;
  if (!initialMonthKey) return "";
  let cursor = `${initialMonthKey}-01`;
  for (let index = 0; index < 36; index += 1) {
    const monthKey = cursor.slice(0, 7);
    const scheduledDate = getScheduledDateForRecurringMonth(normalizedRule, monthKey);
    if (scheduledDate && scheduledDate >= normalizedRule.startDate && scheduledDate >= fromDateKey) return scheduledDate;
    const next = new Date(`${cursor}T00:00:00`);
    next.setMonth(next.getMonth() + 1);
    cursor = `${getLocalMonthKey(next)}-01`;
  }
  return "";
}

function sortRecurringRules(rules) {
  return [...(Array.isArray(rules) ? rules : [])].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const nextA = getNextRecurringDueDateForRule(a) || "9999-12-31";
    const nextB = getNextRecurringDueDateForRule(b) || "9999-12-31";
    return nextA.localeCompare(nextB) || String(a.category || "").localeCompare(String(b.category || ""), "vi");
  });
}

function resetRecurringRuleForm() {
  if (dom.recurringRuleIdInput) dom.recurringRuleIdInput.value = "";
  if (dom.recurringRuleAmountInput) dom.recurringRuleAmountInput.value = "";
  if (dom.recurringRuleCategoryInput) dom.recurringRuleCategoryInput.value = getAvailableCategories()[0] || "Khác";
  if (dom.recurringRuleMethodInput) dom.recurringRuleMethodInput.value = DEFAULT_METHODS[0];
  if (dom.recurringRuleDayInput) dom.recurringRuleDayInput.value = String(new Date().getDate());
  if (dom.recurringRuleStartDateInput) dom.recurringRuleStartDateInput.value = getLocalDateKey();
  if (dom.recurringRuleNoteInput) dom.recurringRuleNoteInput.value = "";
  if (dom.recurringRuleActiveInput) dom.recurringRuleActiveInput.checked = true;
  if (dom.recurringRuleSubmitBtn) dom.recurringRuleSubmitBtn.textContent = "Lưu khoản định kỳ";
  if (dom.recurringRuleCancelBtn) dom.recurringRuleCancelBtn.classList.add("hidden");
}

function populateRecurringRuleForm(ruleId) {
  const rule = findRecurringRuleById(ruleId);
  if (!rule) return;
  if (dom.recurringRuleIdInput) dom.recurringRuleIdInput.value = rule.id;
  if (dom.recurringRuleAmountInput) dom.recurringRuleAmountInput.value = String(rule.amount);
  if (dom.recurringRuleCategoryInput) dom.recurringRuleCategoryInput.value = normalizeCategoryValue(rule.category);
  if (dom.recurringRuleMethodInput) dom.recurringRuleMethodInput.value = normalizeMethodValue(rule.method);
  if (dom.recurringRuleDayInput) dom.recurringRuleDayInput.value = String(rule.dayOfMonth);
  if (dom.recurringRuleStartDateInput) dom.recurringRuleStartDateInput.value = normalizeDateKey(rule.startDate, rule.createdAt);
  if (dom.recurringRuleNoteInput) dom.recurringRuleNoteInput.value = rule.note || "";
  if (dom.recurringRuleActiveInput) dom.recurringRuleActiveInput.checked = Boolean(rule.active);
  if (dom.recurringRuleSubmitBtn) dom.recurringRuleSubmitBtn.textContent = "Cập nhật khoản định kỳ";
  if (dom.recurringRuleCancelBtn) dom.recurringRuleCancelBtn.classList.remove("hidden");
}

function renderRecurringRules(force = false) {
  if (!dom.recurringRulesList || !dom.recurringRulesEmpty || typeof document === "undefined") return;
  if (!force && !isSettingsPanelOpen()) return;
  const sortedRules = sortRecurringRules(state.recurringRules);
  const renderKey = [
    shouldHideAmounts() ? 1 : 0,
    sortedRules.length,
    ...sortedRules.map((rule) =>
      [
        rule.id,
        rule.updatedAt,
        rule.active ? 1 : 0,
        rule.amount,
        rule.dayOfMonth,
        rule.category,
        rule.method,
        rule.note,
      ].join("~")
    ),
  ].join("|");
  if (!force && state.runtime.recurringRulesRenderKey === renderKey) return;
  state.runtime.recurringRulesRenderKey = renderKey;
  if (sortedRules.length === 0) {
    dom.recurringRulesList.replaceChildren();
    dom.recurringRulesEmpty.style.display = "block";
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const rule of sortedRules) {
    const nextDueDate = getNextRecurringDueDateForRule(rule);
    const article = document.createElement("article");
    article.className = `recurring-rule-item${rule.active ? "" : " is-paused"}`;
    article.dataset.ruleId = rule.id;
    article.innerHTML = `
      <div class="recurring-rule-head">
        <div>
          <p class="recurring-rule-title"></p>
          <p class="recurring-rule-meta"></p>
        </div>
        <span class="record-badge recurring-rule-badge"></span>
      </div>
      <p class="recurring-rule-note"></p>
      <div class="recurring-rule-actions">
        <button type="button" data-action="edit" class="ghost-btn tiny">Sửa</button>
        <button type="button" data-action="toggle" class="ghost-btn tiny"></button>
        <button type="button" data-action="delete" class="danger-btn tiny">Xóa</button>
      </div>
    `;
    article.querySelector(".recurring-rule-title").textContent = `${rule.category} · ${formatCurrencyForUI(rule.amount)}`;
    article.querySelector(".recurring-rule-meta").textContent = rule.active
      ? `Mỗi tháng ngày ${rule.dayOfMonth}. Bắt đầu ${formatDate(rule.startDate)}${nextDueDate ? `. Kỳ tiếp theo ${formatDate(nextDueDate)}.` : "."}`
      : `Đang tạm dừng. Bắt đầu ${formatDate(rule.startDate)}.`;
    article.querySelector(".recurring-rule-note").textContent = rule.note || "Không có ghi chú.";
    article.querySelector(".recurring-rule-badge").textContent = rule.active ? "Đang bật" : "Tạm dừng";
    article.querySelector('[data-action="toggle"]').textContent = rule.active ? "Tạm dừng" : "Bật lại";
    fragment.appendChild(article);
  }
  dom.recurringRulesList.replaceChildren(fragment);
  dom.recurringRulesEmpty.style.display = "none";
}

function setFormStatus(message, type = "info") {
  if (!dom.formStatus) return;
  dom.formStatus.textContent = String(message || "");
  dom.formStatus.style.color = type === "success" ? "var(--success)" : type === "error" ? "var(--danger)" : "var(--muted)";
}

function isRecordsContentCollapsed() {
  return Boolean(dom.recordsSection && dom.recordsSection.classList.contains("is-collapsed"));
}

function setRecordsContentCollapsed(collapsed, options = {}) {
  const section = dom.recordsSection;
  const collapse = dom.recordsCollapse;
  const button = dom.toggleRecordsContentBtn;
  if (!section || !collapse || !button) return;
  const nextCollapsed = Boolean(collapsed);
  section.classList.toggle("is-collapsed", nextCollapsed);
  collapse.setAttribute("aria-hidden", String(nextCollapsed));
  button.textContent = nextCollapsed ? "Hiện" : "Ẩn";
  button.setAttribute("aria-expanded", String(!nextCollapsed));
  button.classList.toggle("is-collapsed", nextCollapsed);
  button.classList.toggle("is-expanded", !nextCollapsed);
  if (!nextCollapsed && options.renderOnExpand !== false) renderRecords(true);
}

function onToggleRecordsContent() {
  const nextCollapsed = !isRecordsContentCollapsed();
  setRecordsContentCollapsed(nextCollapsed, { renderOnExpand: true });
  setFormStatus(nextCollapsed ? "Đã ẩn lịch sử giao dịch." : "Đã hiển thị lịch sử giao dịch.", "info");
}

function showVersionUpdateLinkDialog(href) {
  const link = String(href || "").trim();
  if (!isLikelyHttpUrl(link)) return false;
  if (dom.updateLinkValueInput) dom.updateLinkValueInput.value = link;
  if (dom.updateLinkDialog && typeof dom.updateLinkDialog.showModal === "function") {
    if (dom.updateLinkDialog.open && typeof dom.updateLinkDialog.close === "function") dom.updateLinkDialog.close();
    dom.updateLinkDialog.showModal();
    return true;
  }
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(`Link cập nhật phiên bản:\n${link}`);
    return true;
  }
  return false;
}

function openVersionUpdateLink(href) {
  const link = String(href || "").trim();
  if (!isLikelyHttpUrl(link)) return false;
  if (typeof window === "undefined") return false;
  if (window.location && typeof window.location.assign === "function") {
    window.location.assign(link);
    return true;
  }
  if (window.location) {
    window.location.href = link;
    return true;
  }
  return false;
}

function onVersionUpdateLinkClick(event) {
  const linkElement = event?.currentTarget;
  const href = String(linkElement?.getAttribute?.("href") || linkElement?.href || "").trim();
  if (!isLikelyHttpUrl(href)) return;
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (openVersionUpdateLink(href)) return;
  if (showVersionUpdateLinkDialog(href)) return;
  setFormStatus("Không mở được link cập nhật.", "error");
}

function applyTheme() {
  if (typeof document === "undefined" || !document.body) return;
  const theme = normalizeTheme(state.settings.theme);
  state.settings.theme = theme;
  document.body.dataset.theme = theme;
  if (!dom.toggleThemeBtn) return;
  dom.toggleThemeBtn.textContent = theme === THEMES.dark ? "Chế độ sáng" : "Chế độ tối";
}

function applyAmountVisibility() {
  if (typeof document === "undefined" || !document.body) return;
  const hidden = shouldHideAmounts();
  document.body.classList.toggle("amount-hidden", hidden);
  if (!dom.toggleAmountVisibilityBtn) return;
  dom.toggleAmountVisibilityBtn.textContent = hidden ? "Hiện số tiền" : "Ẩn số tiền";
  dom.toggleAmountVisibilityBtn.classList.toggle("is-hidden", hidden);
}

function applySettingsToUI() {
  if (dom.monthlyBudgetInput) dom.monthlyBudgetInput.value = formatBudgetInput(state.settings.monthlyBudget);
  if (dom.endpointInput) dom.endpointInput.value = state.settings.sheetEndpoint || "";
  if (dom.apiKeyInput) dom.apiKeyInput.value = state.settings.apiKey || "";
  if (dom.monthlySummaryMonthInput && !dom.monthlySummaryMonthInput.value) dom.monthlySummaryMonthInput.value = getLocalMonthKey();
  applyTheme();
  applyAmountVisibility();
  applyDailyReminderToggleState();
  applyAutoSyncToggleState();
  resetRecurringRuleForm();
  renderRecurringRules();
}

function getRecordsDerivedData() {
  ensureRuntimeCaches();
  if (state.runtime.recordsDerivedCache && state.runtime.recordsDerivedCacheVersion === state.runtime.recordsVersion) {
    return state.runtime.recordsDerivedCache;
  }

  const recordsById = new Map();
  const recurringRecordByKey = new Map();
  const dateTotals = new Map();
  const summaryByMonth = new Map();
  const usedCategories = new Set();
  let grandTotal = 0;

  for (const record of state.records) {
    const recordId = String(record?.id || "").trim();
    if (recordId) recordsById.set(recordId, record);

    const category = normalizeCategoryName(record?.category, "Khác");
    if (category) usedCategories.add(category);

    if (record?.source === RECORD_SOURCE.recurring) {
      const lookupKey = makeRecurringLookupKey(record.recurringRuleId, record.recurringOccurrenceKey);
      if (lookupKey) recurringRecordByKey.set(lookupKey, record);
    }

    const amount = Number(record?.amount) || 0;
    const dateKey = normalizeDateKey(record?.date, record?.createdAt);
    const monthKey = getMonthKeyFromDate(dateKey);
    if (amount <= 0 || !dateKey || !monthKey) continue;

    grandTotal += amount;
    dateTotals.set(dateKey, (dateTotals.get(dateKey) || 0) + amount);

    if (!summaryByMonth.has(monthKey)) summaryByMonth.set(monthKey, { total: 0, count: 0, categories: new Map() });
    const monthSummary = summaryByMonth.get(monthKey);
    monthSummary.total += amount;
    monthSummary.count += 1;
    if (!monthSummary.categories.has(category)) monthSummary.categories.set(category, { amount: 0, count: 0 });
    const categorySummary = monthSummary.categories.get(category);
    categorySummary.amount += amount;
    categorySummary.count += 1;
  }

  const months = Array.from(summaryByMonth.entries())
    .map(([monthKey, monthSummary]) => ({
      monthKey,
      total: monthSummary.total,
      count: monthSummary.count,
      categories: Array.from(monthSummary.categories.entries())
        .map(([category, summary]) => ({ category, amount: summary.amount, count: summary.count }))
        .sort((a, b) => (b.amount - a.amount) || (b.count - a.count) || a.category.localeCompare(b.category, "vi")),
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  const derived = {
    recordsById,
    recurringRecordByKey,
    dateTotals,
    monthSummaries: summaryByMonth,
    availableRecordCategories: Array.from(usedCategories).sort((a, b) => a.localeCompare(b, "vi")),
    summary: {
      grandTotal,
      monthCount: months.length,
      months,
    },
  };

  state.runtime.recordsDerivedCache = derived;
  state.runtime.recordsDerivedCacheVersion = state.runtime.recordsVersion;
  return derived;
}

function getBudgetStatusForCurrentMonth() {
  const budget = Number(state.settings.monthlyBudget) || 0;
  if (budget <= 0) return { isOverBudget: false, overBy: 0, remaining: 0 };
  const month = getLocalMonthKey();
  const monthTotal = getRecordsDerivedData().monthSummaries.get(month)?.total || 0;
  const diff = budget - monthTotal;
  return { isOverBudget: diff < 0, overBy: diff < 0 ? Math.abs(diff) : 0, remaining: diff > 0 ? diff : 0 };
}

function getStatsSnapshot(todayKey, monthKey) {
  const today = normalizeDateKey(todayKey);
  const month = normalizeMonthFilter(monthKey);
  const derived = getRecordsDerivedData();
  return {
    todayTotal: derived.dateTotals.get(today) || 0,
    monthTotal: month ? derived.monthSummaries.get(month)?.total || 0 : 0,
  };
}

function renderStats() {
  if (!dom.statToday || !dom.statMonth || !dom.statCount || !dom.statBudget || !dom.budgetWarning) return;
  const renderKey = [
    state.runtime.recordsVersion,
    getLocalDateKey(),
    getLocalMonthKey(),
    Number(state.settings.monthlyBudget) || 0,
    shouldHideAmounts() ? 1 : 0,
  ].join("|");
  if (state.runtime.statsRenderKey === renderKey) return;
  state.runtime.statsRenderKey = renderKey;
  const stats = getStatsSnapshot(getLocalDateKey(), getLocalMonthKey());
  dom.statToday.textContent = formatCurrencyForUI(stats.todayTotal);
  dom.statMonth.textContent = formatCurrencyForUI(stats.monthTotal);
  dom.statCount.textContent = String(state.records.length);
  const budget = Number(state.settings.monthlyBudget) || 0;
  if (budget <= 0) {
    dom.statBudget.textContent = "Chưa đặt";
    dom.budgetWarning.textContent = "";
    dom.budgetWarning.classList.add("hidden");
    dom.budgetWarning.classList.remove("over");
    return;
  }
  dom.statBudget.textContent = formatCurrencyForUI(budget);
  const status = getBudgetStatusForCurrentMonth();
  dom.budgetWarning.classList.remove("hidden");
  if (status.isOverBudget) {
    dom.budgetWarning.classList.add("over");
    dom.budgetWarning.textContent = shouldHideAmounts()
      ? "Bạn đã vượt ngân sách tháng này."
      : `Bạn đã vượt ${formatCurrency(status.overBy)} so với ngân sách tháng.`;
  } else {
    dom.budgetWarning.classList.remove("over");
    dom.budgetWarning.textContent = shouldHideAmounts()
      ? "Bạn vẫn đang trong ngân sách tháng này."
      : `Bạn còn ${formatCurrency(status.remaining)} ngân sách tháng.`;
  }
}

function getCategorySummaryData() {
  return getRecordsDerivedData().summary;
}

function renderMonthlyCategorySummary() {
  if (!dom.monthlySummaryList || !dom.monthlySummaryTotal || !dom.monthlySummaryEmpty) return;
  const summaryData = getCategorySummaryData();
  if (summaryData.monthCount === 0) {
    const emptyKey = `${state.runtime.recordsVersion}|empty|${shouldHideAmounts() ? 1 : 0}`;
    if (state.runtime.monthlySummaryRenderKey === emptyKey) return;
    state.runtime.monthlySummaryRenderKey = emptyKey;
    dom.monthlySummaryList.replaceChildren();
    dom.monthlySummaryTotal.textContent = "Chưa có dữ liệu.";
    dom.monthlySummaryEmpty.style.display = "block";
    return;
  }
  const selected = normalizeMonthFilter(dom.monthlySummaryMonthInput?.value || "");
  const target = summaryData.months.find((item) => item.monthKey === selected) || summaryData.months.find((item) => item.monthKey === getLocalMonthKey()) || summaryData.months[0];
  if (!target) return;
  const renderKey = [
    state.runtime.recordsVersion,
    target.monthKey,
    shouldHideAmounts() ? 1 : 0,
  ].join("|");
  if (state.runtime.monthlySummaryRenderKey === renderKey) {
    if (dom.monthlySummaryMonthInput && dom.monthlySummaryMonthInput.value !== target.monthKey) {
      dom.monthlySummaryMonthInput.value = target.monthKey;
    }
    return;
  }
  state.runtime.monthlySummaryRenderKey = renderKey;
  if (dom.monthlySummaryMonthInput && dom.monthlySummaryMonthInput.value !== target.monthKey) dom.monthlySummaryMonthInput.value = target.monthKey;
  dom.monthlySummaryTotal.textContent = shouldHideAmounts()
    ? `Tháng ${formatMonthKey(target.monthKey)}: ${target.count} giao dịch`
    : `Tháng ${formatMonthKey(target.monthKey)}: ${formatCurrency(target.total)} (${target.count} giao dịch)`;
  if (typeof document === "undefined") return;
  const fragment = document.createDocumentFragment();
  const items = target.categories.slice(0, 7);
  for (const item of items) {
    const ratio = target.total > 0 ? Math.max(2, (item.amount / target.total) * 100) : 0;
    const wrap = document.createElement("article");
    wrap.className = "monthly-summary-item";
    wrap.innerHTML = `<div class="monthly-summary-head"><p class="monthly-summary-category"></p><p class="monthly-summary-metrics"><span class="amount"></span><span class="percent"></span><span class="count"></span></p></div><div class="monthly-summary-bar-track"><div class="monthly-summary-bar"></div></div>`;
    wrap.querySelector(".monthly-summary-category").textContent = item.category;
    wrap.querySelector(".amount").textContent = formatCurrencyForUI(item.amount);
    wrap.querySelector(".percent").textContent = formatPercent(item.amount, target.total);
    wrap.querySelector(".count").textContent = `${item.count} GD`;
    wrap.querySelector(".monthly-summary-bar").style.width = `${Math.min(100, ratio)}%`;
    fragment.appendChild(wrap);
  }
  dom.monthlySummaryList.replaceChildren(fragment);
  dom.monthlySummaryEmpty.style.display = items.length > 0 ? "none" : "block";
}

function compareRecordsByUpdatedAt(a, b) {
  const aTime = Date.parse(a.updatedAt || a.createdAt || `${a.date}T00:00:00`) || 0;
  const bTime = Date.parse(b.updatedAt || b.createdAt || `${b.date}T00:00:00`) || 0;
  return bTime - aTime || String(b.id || "").localeCompare(String(a.id || ""));
}

function getSortedRecordsByDate(records) {
  ensureRuntimeCaches();
  const source = Array.isArray(records) ? records : [];
  if (source === state.records && state.runtime.sortedRecordsVersion === state.runtime.recordsVersion) return state.runtime.sortedRecordsCache;
  const sorted = [...source].sort(compareRecordsByUpdatedAt);
  if (source === state.records) {
    state.runtime.sortedRecordsCache = sorted;
    state.runtime.sortedRecordsVersion = state.runtime.recordsVersion;
  }
  return sorted;
}

function getRecordSearchText(record) {
  ensureRuntimeCaches();
  const recordId = String(record?.id || "");
  const fingerprint = [
    record?.updatedAt || "",
    record?.date || "",
    record?.category || "",
    record?.method || "",
    record?.note || "",
    String(Number(record?.amount) || 0),
  ].join("|");
  const cached = recordId ? state.runtime.recordSearchCache.get(recordId) : null;
  if (cached && cached.fingerprint === fingerprint) return cached.text;
  const amount = Number(record.amount) || 0;
  const text = normalizeTextLoose([
    record.date,
    formatDate(record.date),
    record.category,
    record.method,
    record.note,
    record.source === RECORD_SOURCE.recurring ? "Định kỳ recurring" : "",
    String(amount),
    formatCurrency(amount),
  ].join(" "));
  if (recordId) state.runtime.recordSearchCache.set(recordId, { fingerprint, text });
  return text;
}

function getNormalizedRecordsFilterQuery() {
  ensureRuntimeCaches();
  return normalizeTextLoose(state.runtime.recordsFilter?.query);
}

function getFilteredRecords(records) {
  ensureRuntimeCaches();
  const source = Array.isArray(records) ? records : [];
  const normalizedQuery = getNormalizedRecordsFilterQuery();
  if (!normalizedQuery) return source;
  const canUseCache =
    source === state.runtime.sortedRecordsCache &&
    state.runtime.filteredRecordsVersion === state.runtime.recordsVersion &&
    state.runtime.filteredRecordsQuery === normalizedQuery;
  if (canUseCache) return state.runtime.filteredRecordsCache;

  const filtered = source.filter((record) => getRecordSearchText(record).includes(normalizedQuery));
  if (source === state.runtime.sortedRecordsCache) {
    state.runtime.filteredRecordsCache = filtered;
    state.runtime.filteredRecordsVersion = state.runtime.recordsVersion;
    state.runtime.filteredRecordsQuery = normalizedQuery;
  }
  return filtered;
}

function hasActiveRecordsFilter() {
  return Boolean(getNormalizedRecordsFilterQuery());
}

function createRecordRow(record) {
  if (typeof document === "undefined") return null;
  let row = null;
  if (dom.recordTemplate && "content" in dom.recordTemplate) {
    const first = dom.recordTemplate.content.firstElementChild;
    if (first) row = first.cloneNode(true);
  }
  if (!row) {
    row = document.createElement("tr");
    row.innerHTML = '<td data-col="date" data-label="Ngày"></td><td data-col="category" data-label="Danh mục"></td><td data-col="amount" data-label="Số tiền" class="amount"></td><td data-col="method" data-label="Thanh toán"></td><td data-col="note" data-label="Ghi chú"></td><td class="row-actions" data-label="Thao tác"><button type="button" data-action="edit" class="ghost-btn tiny">Sửa</button><button type="button" data-action="delete" class="danger-btn tiny">Xóa</button></td>';
  }
  row.dataset.recordId = record.id;
  row.querySelector('[data-col="date"]').textContent = formatDate(record.date);
  const categoryCell = row.querySelector('[data-col="category"]');
  if (categoryCell) {
    categoryCell.classList.add("record-category-cell");
    categoryCell.textContent = "";
    const categoryText = document.createElement("span");
    categoryText.textContent = record.category;
    categoryCell.appendChild(categoryText);
    if (record.source === RECORD_SOURCE.recurring) {
      const badge = document.createElement("span");
      badge.className = "record-badge";
      badge.textContent = "Định kỳ";
      categoryCell.appendChild(badge);
    }
  }
  row.querySelector('[data-col="amount"]').textContent = formatCurrencyForUI(record.amount);
  row.querySelector('[data-col="method"]').textContent = record.method;
  row.querySelector('[data-col="note"]').textContent = record.note || "-";
  return row;
}

function renderRecords(force = false) {
  if (!dom.recordsBody || !dom.emptyState) return;
  if (!force && isRecordsContentCollapsed()) return;
  const recordsPerPage = getRecordsPerPage();
  const filtered = getFilteredRecords(getSortedRecordsByDate(state.records));
  const totalPages = Math.max(1, Math.ceil(filtered.length / recordsPerPage));
  if (state.runtime.currentPage > totalPages) state.runtime.currentPage = 1;
  const renderKey = [
    state.runtime.recordsVersion,
    getNormalizedRecordsFilterQuery(),
    state.runtime.currentPage,
    filtered.length,
    shouldHideAmounts() ? 1 : 0,
    recordsPerPage,
  ].join("|");
  if (!force && state.runtime.recordsRenderKey === renderKey) return;
  state.runtime.recordsRenderKey = renderKey;
  if (dom.recordsFilterSummary) {
    const showing = filtered.length > recordsPerPage
      ? `${(state.runtime.currentPage - 1) * recordsPerPage + 1}-${Math.min(state.runtime.currentPage * recordsPerPage, filtered.length)}`
      : filtered.length;
    dom.recordsFilterSummary.textContent = hasActiveRecordsFilter()
      ? `Hiển thị ${showing}/${filtered.length} giao dịch.`
      : `Tổng ${state.records.length} giao dịch.`;
  }
  if (filtered.length === 0) {
    dom.recordsBody.replaceChildren();
    dom.emptyState.style.display = "block";
    if (dom.paginationControls) dom.paginationControls.style.display = "none";
    return;
  }
  dom.emptyState.style.display = "none";
  const startIndex = (state.runtime.currentPage - 1) * recordsPerPage;
  const endIndex = Math.min(startIndex + recordsPerPage, filtered.length);
  const pageRecords = filtered.slice(startIndex, endIndex);
  const fragment = document.createDocumentFragment();
  for (const record of pageRecords) {
    const row = createRecordRow(record);
    if (row) fragment.appendChild(row);
  }
  dom.recordsBody.replaceChildren(fragment);
  if (dom.paginationControls) {
    dom.paginationControls.style.display = filtered.length > recordsPerPage ? "flex" : "none";
  }
  if (dom.paginationInfo) {
    dom.paginationInfo.textContent = `Trang ${state.runtime.currentPage}/${totalPages}`;
  }
  if (dom.paginationPrevBtn) {
    dom.paginationPrevBtn.disabled = state.runtime.currentPage <= 1;
  }
  if (dom.paginationNextBtn) {
    dom.paginationNextBtn.disabled = state.runtime.currentPage >= totalPages;
  }
}

function render() {
  cancelScheduledRecordsRender();
  clearPendingFilterInputRender();
  renderStats();
  renderMonthlyCategorySummary();
  renderRecurringRules();
  renderWalletBalanceInputs();
  renderRecords();
}
function onToggleTheme() {
  state.settings.theme = state.settings.theme === THEMES.dark ? THEMES.light : THEMES.dark;
  persistSettings();
  applyTheme();
}

function onToggleAmountVisibility() {
  state.settings.hideAmounts = !Boolean(state.settings.hideAmounts);
  persistSettings();
  applyAmountVisibility();
  render();
}

function isSettingsPanelOpen() {
  return Boolean(dom.settingsPanel && !dom.settingsPanel.classList.contains("hidden"));
}

function setSettingsPanelOpen(open, options = {}) {
  const nextOpen = Boolean(open);
  if (dom.settingsPanel) dom.settingsPanel.classList.toggle("hidden", !nextOpen);
  if (dom.settingsBackdrop) dom.settingsBackdrop.classList.toggle("hidden", !nextOpen);
  if (typeof document !== "undefined" && document.body) document.body.classList.toggle("settings-open", nextOpen);
  applySettingsToggleState({ flash: Boolean(options.flash) });
  if (!nextOpen) return;
  renderRecurringRules(true);
  setTimeout(() => {
    if (dom.monthlyBudgetInput && typeof dom.monthlyBudgetInput.focus === "function") {
      dom.monthlyBudgetInput.focus();
    }
  }, 0);
}

function applySettingsToggleState(options = {}) {
  if (!dom.toggleSettingsBtn) return;
  const isOpen = isSettingsPanelOpen();
  dom.toggleSettingsBtn.textContent = isOpen ? "Đóng cài đặt" : "Cài đặt";
  dom.toggleSettingsBtn.setAttribute("aria-expanded", String(isOpen));
  dom.toggleSettingsBtn.setAttribute("aria-pressed", String(isOpen));
  dom.toggleSettingsBtn.classList.toggle("is-open", isOpen);
  dom.toggleSettingsBtn.classList.toggle("is-closed", !isOpen);
  if (!options.flash) return;
  dom.toggleSettingsBtn.classList.remove("is-flashing");
  void dom.toggleSettingsBtn.offsetWidth;
  dom.toggleSettingsBtn.classList.add("is-flashing");
  setTimeout(() => {
    if (dom.toggleSettingsBtn) dom.toggleSettingsBtn.classList.remove("is-flashing");
  }, 260);
}

function onToggleSettingsPanel() {
  setSettingsPanelOpen(!isSettingsPanelOpen(), { flash: true });
}

function onCloseSettingsPanel() {
  if (!isSettingsPanelOpen()) return;
  setSettingsPanelOpen(false, { flash: true });
}

function onSettingsPanelKeydown(event) {
  if (!event || event.key !== "Escape") return;
  if (!isSettingsPanelOpen()) return;
  event.preventDefault();
  onCloseSettingsPanel();
}

function onSaveSettings() {
  const endpoint = String(dom.endpointInput?.value || "").trim();
  if (endpoint && !isLikelyHttpUrl(endpoint)) {
    setFormStatus("Web App URL không hợp lệ.", "error");
    return;
  }
  state.settings.sheetEndpoint = endpoint;
  state.settings.apiKey = String(dom.apiKeyInput?.value || "").trim();
  state.settings.monthlyBudget = sanitizeBudgetValue(dom.monthlyBudgetInput?.value || "");
  if (dom.monthlyBudgetInput) dom.monthlyBudgetInput.value = formatBudgetInput(state.settings.monthlyBudget);
  persistSettings();
  renderStats();
  setFormStatus("Đã lưu cài đặt.", "success");
}

function onSubmitRecurringRule(event) {
  event.preventDefault();
  const recurringRuleId = String(dom.recurringRuleIdInput?.value || "").trim();
  const existingRule = findRecurringRuleById(recurringRuleId);
  const amount = Number(dom.recurringRuleAmountInput?.value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    setFormStatus("Vui lòng nhập số tiền định kỳ hợp lệ.", "error");
    return;
  }
  const startDate = normalizeDateKey(dom.recurringRuleStartDateInput?.value || getLocalDateKey());
  const timestamp = new Date().toISOString();
  const normalizedRule = normalizeRecurringRule({
    id: existingRule?.id || makeRecurringRuleId(),
    amount,
    category: normalizeCategoryValue(String(dom.recurringRuleCategoryInput?.value || "Khác")),
    method: normalizeMethodValue(String(dom.recurringRuleMethodInput?.value || "Tiền mặt")),
    note: String(dom.recurringRuleNoteInput?.value || "").trim(),
    dayOfMonth: dom.recurringRuleDayInput?.value || new Date(startDate).getDate(),
    startDate,
    active: Boolean(dom.recurringRuleActiveInput?.checked),
    createdAt: existingRule?.createdAt || timestamp,
    updatedAt: timestamp,
  });
  if (!normalizedRule) {
    setFormStatus("Không thể lưu khoản định kỳ.", "error");
    return;
  }

  if (existingRule) {
    state.recurringRules = state.recurringRules.map((rule) => rule.id === normalizedRule.id ? normalizedRule : rule);
  } else {
    state.recurringRules = [normalizedRule, ...state.recurringRules];
  }
  persistRecurringState();
  const generatedCount = normalizedRule.active ? generateRecurringRecords() : 0;
  refreshCategoryOptionsFromSettings();
  resetRecurringRuleForm();
  render();
  setFormStatus(
    existingRule
      ? generatedCount > 0
        ? `Đã cập nhật khoản định kỳ và tạo ${generatedCount} giao dịch còn thiếu.`
        : "Đã cập nhật khoản định kỳ."
      : generatedCount > 0
        ? `Đã lưu khoản định kỳ và tạo ${generatedCount} giao dịch còn thiếu.`
        : "Đã lưu khoản định kỳ.",
    "success"
  );
}

function onCancelRecurringRuleEdit() {
  resetRecurringRuleForm();
}

function onRecurringRulesListClick(event) {
  const target = event.target;
  if (!target || typeof target.closest !== "function") return;
  const button = target.closest("button");
  const item = target.closest(".recurring-rule-item");
  const ruleId = item?.dataset?.ruleId;
  if (!button || !ruleId) return;
  const rule = findRecurringRuleById(ruleId);
  if (!rule) return;

  if (button.dataset.action === "edit") {
    populateRecurringRuleForm(ruleId);
    if (dom.recurringRuleAmountInput && typeof dom.recurringRuleAmountInput.focus === "function") {
      dom.recurringRuleAmountInput.focus();
    }
    return;
  }

  if (button.dataset.action === "toggle") {
    const updatedRule = normalizeRecurringRule({
      ...rule,
      active: !rule.active,
      updatedAt: new Date().toISOString(),
    });
    state.recurringRules = state.recurringRules.map((entry) => entry.id === updatedRule.id ? updatedRule : entry);
    persistRecurringState();
    const generatedCount = updatedRule.active ? generateRecurringRecords() : 0;
    refreshCategoryOptionsFromSettings();
    render();
    setFormStatus(
      updatedRule.active
        ? generatedCount > 0
          ? `Đã bật lại khoản định kỳ và tạo ${generatedCount} giao dịch còn thiếu.`
          : "Đã bật lại khoản định kỳ."
        : "Đã tạm dừng khoản định kỳ.",
      "success"
    );
    return;
  }

  if (button.dataset.action === "delete") {
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm("Xóa khoản chi định kỳ này?")) return;
    state.recurringRules = state.recurringRules.filter((entry) => entry.id !== ruleId);
    removeRecurringSuppressionsForRule(ruleId);
    if (String(dom.recurringRuleIdInput?.value || "").trim() === ruleId) resetRecurringRuleForm();
    persistRecurringState();
    render();
    setFormStatus("Đã xóa khoản định kỳ.", "success");
  }
}

async function onToggleDailyReminder() {
  const bridge = getAndroidReminderBridge();
  if (!bridge || typeof bridge.scheduleDailyReminder !== "function" || typeof bridge.cancelDailyReminder !== "function") {
    setFormStatus("Tính năng nhắc 21:00 chỉ hoạt động trong ứng dụng Android.", "error");
    return;
  }
  if (state.settings.dailyReminderEnabled) {
    state.settings.dailyReminderEnabled = false;
    persistSettings();
    applyDailyReminderToggleState();
    syncDailyReminderScheduleForAndroid();
    setFormStatus("Đã tắt nhắc nhập chi tiêu lúc 21:00.", "success");
    return;
  }

  let permissionState = getNotificationPermissionStateForDevice();
  if (permissionState !== "granted") {
    setFormStatus("Ứng dụng cần quyền thông báo của thiết bị để bật nhắc 21:00.", "info");
    permissionState = await requestNotificationPermissionForDevice();
  }
  if (permissionState !== "granted") {
    state.settings.dailyReminderEnabled = false;
    persistSettings();
    applyDailyReminderToggleState();
    setFormStatus("Chưa có quyền thông báo. Hãy cấp quyền trong cài đặt thiết bị để bật nhắc 21:00.", "error");
    return;
  }

  state.settings.dailyReminderEnabled = true;
  persistSettings();
  applyDailyReminderToggleState();
  syncDailyReminderScheduleForAndroid();
  syncReminderTodayRecordState({ sendNow: true });
  setFormStatus("Đã bật nhắc nhập chi tiêu lúc 21:00 hằng ngày.", "success");
}

function onRecordsFilterQueryInput(event) {
  ensureRuntimeCaches();
  state.runtime.recordsFilter.query = String(event?.target?.value || "");
  state.runtime.currentPage = 1;
  clearPendingFilterInputRender();
  const delay = state.runtime.recordsFilter.query.trim() ? RECORDS_FILTER_INPUT_DEBOUNCE_MS : 0;
  state.runtime.recordsFilterInputHandle = setTimeout(() => {
    state.runtime.recordsFilterInputHandle = null;
    scheduleRecordsRender();
  }, delay);
}

function onResetRecordsFilter() {
  ensureRuntimeCaches();
  state.runtime.recordsFilter = { query: "" };
  state.runtime.currentPage = 1;
  if (dom.recordsFilterQueryInput) dom.recordsFilterQueryInput.value = "";
  clearPendingFilterInputRender();
  renderRecords();
}

function onMonthlySummaryMonthChange() {
  renderMonthlyCategorySummary();
}

function onClearAllRecords() {
  if (state.records.length === 0) {
    setFormStatus("Không có giao dịch nào để xóa.", "info");
    return;
  }
  if (dom.clearAllConfirmDialog && typeof dom.clearAllConfirmDialog.showModal === "function") {
    dom.clearAllConfirmDialog.showModal();
    return;
  }
  if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm("Xóa toàn bộ giao dịch đã lưu trên máy?")) return;
  doClearAllRecords();
}

function doClearAllRecords() {
  for (const rule of state.recurringRules) {
    const scheduledMonths = getRecurringDueMonthKeys({ ...rule, active: true }, getLocalDateKey());
    for (const monthKey of scheduledMonths) {
      addRecurringSuppression(rule.id, makeRecurringOccurrenceKey(rule.id, monthKey));
    }
  }
  state.records = [];
  markRecordsDirty();
  persistRecords();
  render();
  setFormStatus("Đã xóa toàn bộ giao dịch.", "success");
}

function closeClearAllConfirmDialog() {
  if (dom.clearAllConfirmDialog && typeof dom.clearAllConfirmDialog.close === "function") {
    dom.clearAllConfirmDialog.close();
  }
}

function onSubmitExpense(event) {
  event.preventDefault();
  const formData = new FormData(dom.form);
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    setFormStatus("Vui lòng nhập số tiền hợp lệ.", "error");
    return;
  }
  const methodValue = normalizeMethodValue(String(formData.get("method") || "Tiền mặt"));
  const walletId = findWalletIdByName(methodValue) || "wallet_tienmat";
  const record = normalizeRecord({
    id: makeId(),
    date: normalizeDateKey(formData.get("date"), new Date().toISOString()),
    category: normalizeCategoryValue(String(formData.get("category") || "Khác")),
    amount,
    method: methodValue,
    note: String(formData.get("note") || "").trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: SYNC_STATUS.local,
    walletId,
  });
  if (!record) {
    setFormStatus("Không thể lưu giao dịch.", "error");
    return;
  }
  state.records.unshift(record);
  if (state.records.length > MAX_RECORDS) state.records = state.records.slice(0, MAX_RECORDS);

  // Cập nhật số dư ví khi thêm chi tiêu
  updateWalletBalance(record.walletId, -record.amount);

  markRecordsDirty();
  persistRecords();
  refreshCategoryOptionsFromSettings();
  refreshWalletMethodOptions();
  if (dom.form && typeof dom.form.reset === "function") dom.form.reset();
  if (dom.dateInput) dom.dateInput.value = getLocalDateKey();
  renderWallets();
  render();
  const status = getBudgetStatusForCurrentMonth();
  setFormStatus(status.isOverBudget ? `Đã lưu giao dịch. Cảnh báo: vượt ngân sách ${formatCurrency(status.overBy)}.` : "Đã lưu giao dịch.", status.isOverBudget ? "error" : "success");
}

function findRecordById(recordId) {
  const id = String(recordId || "").trim();
  return id ? getRecordsDerivedData().recordsById.get(id) || null : null;
}

function confirmDeleteRecord(recordId) {
  const id = String(recordId || "").trim();
  if (!id) return;
  if (dom.deleteConfirmRecordIdInput) dom.deleteConfirmRecordIdInput.value = id;
  if (dom.deleteConfirmDialog && typeof dom.deleteConfirmDialog.showModal === "function") {
    dom.deleteConfirmDialog.showModal();
  } else {
    doDeleteRecord(id);
  }
}

function doDeleteRecord(id) {
  if (!id) return;
  const record = findRecordById(id);
  if (record) {
    // Hoàn lại số dư ví khi xóa bản ghi (không tính transfer)
    if (record.source !== RECORD_SOURCE.transfer) {
      updateWalletBalance(record.walletId, record.amount);
    }
    if (record.source === RECORD_SOURCE.recurring && record.recurringRuleId && record.recurringOccurrenceKey) {
      addRecurringSuppression(record.recurringRuleId, record.recurringOccurrenceKey);
    }
  }
  state.records = state.records.filter((record) => String(record.id) !== id);
  markRecordsDirty();
  persistRecords();
  renderWallets();
  render();
  setFormStatus("Đã xóa giao dịch.", "success");
}

function closeDeleteConfirmDialog() {
  if (dom.deleteConfirmDialog && typeof dom.deleteConfirmDialog.close === "function") {
    dom.deleteConfirmDialog.close();
  }
}

function deleteRecord(recordId) {
  confirmDeleteRecord(recordId);
}

function openEditRecordDialog(recordId) {
  const record = findRecordById(recordId);
  if (!record) return;
  if (!dom.editRecordDialog || typeof dom.editRecordDialog.showModal !== "function") {
    setFormStatus("Thiết bị không hỗ trợ hộp thoại chỉnh sửa.", "error");
    return;
  }
  if (dom.editRecordIdInput) dom.editRecordIdInput.value = record.id;
  if (dom.editRecordDateInput) dom.editRecordDateInput.value = normalizeDateKey(record.date, record.createdAt);
  if (dom.editRecordCategoryInput) dom.editRecordCategoryInput.value = normalizeCategoryValue(record.category);
  if (dom.editRecordAmountInput) dom.editRecordAmountInput.value = String(record.amount);
  if (dom.editRecordMethodInput) dom.editRecordMethodInput.value = normalizeMethodValue(record.method);
  if (dom.editRecordNoteInput) dom.editRecordNoteInput.value = record.note || "";
  dom.editRecordDialog.showModal();
}

function closeEditRecordDialog() {
  if (dom.editRecordDialog && typeof dom.editRecordDialog.close === "function") dom.editRecordDialog.close();
}

function onSubmitEditRecord(event) {
  event.preventDefault();
  const record = findRecordById(String(dom.editRecordIdInput?.value || "").trim());
  if (!record) return closeEditRecordDialog();
  const amount = Number(dom.editRecordAmountInput?.value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    setFormStatus("Số tiền chỉnh sửa không hợp lệ.", "error");
    return;
  }

  // Tính chênh lệch số dư ví nếu amount thay đổi
  if (record.source !== RECORD_SOURCE.transfer) {
    const oldAmount = record.amount;
    const newAmount = Math.round(amount);
    if (oldAmount !== newAmount) {
      // Hoàn lại số dư cũ
      updateWalletBalance(record.walletId, oldAmount);
      // Trừ số dư mới
      updateWalletBalance(record.walletId, -newAmount);
    }
  }

  record.date = normalizeDateKey(dom.editRecordDateInput?.value || record.date, record.createdAt);
  record.category = normalizeCategoryValue(dom.editRecordCategoryInput?.value || record.category);
  record.amount = Math.round(amount);
  record.method = normalizeMethodValue(dom.editRecordMethodInput?.value || record.method);
  record.note = normalizeHumanText(dom.editRecordNoteInput?.value || "", 120);
  record.updatedAt = new Date().toISOString();
  record.syncStatus = SYNC_STATUS.local;
  markRecordsDirty();
  persistRecords();
  refreshCategoryOptionsFromSettings();
  renderWallets();
  render();
  closeEditRecordDialog();
  setFormStatus("Đã cập nhật giao dịch.", "success");
}

function onRecordsTableAction(event) {
  const target = event.target;
  if (!target || typeof target.closest !== "function") return;
  const button = target.closest("button");
  if (!button) return;
  const row = button.closest("tr");
  const recordId = row?.dataset?.recordId;
  if (!recordId) return;
  if (button.dataset.action === "delete") deleteRecord(recordId);
  if (button.dataset.action === "edit") openEditRecordDialog(recordId);
}

async function postRecordToSheet(record, retryCount = 0) {
  if (!state.settings.sheetEndpoint) throw new Error("Bạn chưa cấu hình Web App URL.");
  if (typeof fetch !== "function") throw new Error("Thiết bị không hỗ trợ fetch.");
  try {
    await fetch(state.settings.sheetEndpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        apiKey: state.settings.apiKey || undefined,
        action: "appendRecord",
        record: {
          id: record.id,
          date: record.date,
          category: record.category,
          amount: record.amount,
          method: record.method,
          walletId: record.walletId || "",
          note: record.note,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          syncStatus: record.syncStatus,
        },
      }),
    });
  } catch (error) {
    if (retryCount < SYNC_MAX_RETRIES) {
      const delay = SYNC_RETRY_DELAY_MS * Math.pow(2, retryCount);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return postRecordToSheet(record, retryCount + 1);
    }
    throw error;
  }
}

async function onSyncPendingRecords() {
  const endpoint = String(state.settings.sheetEndpoint || "").trim();
  if (!endpoint) return setFormStatus("Chưa có Web App URL để đồng bộ.", "error");
  if (!isLikelyHttpUrl(endpoint)) return setFormStatus("Web App URL không hợp lệ.", "error");
  const pending = state.records.filter((record) => record.syncStatus !== SYNC_STATUS.synced);
  if (pending.length === 0) return setFormStatus("Không có bản ghi nào cần gửi.", "info");
  setFormStatus(`Đang gửi ${pending.length} bản ghi...`, "info");
  let successCount = 0;
  for (const record of pending) {
    try {
      await postRecordToSheet(record);
      record.syncStatus = SYNC_STATUS.synced;
      record.updatedAt = new Date().toISOString();
      successCount += 1;
    } catch (_error) {
      record.syncStatus = SYNC_STATUS.failed;
      record.updatedAt = new Date().toISOString();
    }
  }
  markRecordsDirty();
  persistRecords();
  scheduleRecordsRender();
  const failed = pending.length - successCount;
  setFormStatus(failed > 0 ? `Đã gửi ${successCount} bản ghi, còn ${failed} bản ghi lỗi.` : `Đã đồng bộ ${successCount} bản ghi.`, failed > 0 ? "error" : "success");
}

function startAutoSync() {
  stopAutoSync();
  if (!state.settings.autoSyncEnabled) return;
  if (!state.settings.sheetEndpoint) return;
  const intervalMs = state.settings.autoSyncInterval * 60 * 1000;
  state.runtime.autoSyncIntervalId = setInterval(() => {
    if (state.runtime.isOnline) {
      onSyncPendingRecords();
    }
  }, intervalMs);
}

function stopAutoSync() {
  if (state.runtime.autoSyncIntervalId) {
    clearInterval(state.runtime.autoSyncIntervalId);
    state.runtime.autoSyncIntervalId = null;
  }
}

function updateAutoSyncState() {
  if (state.settings.autoSyncEnabled && state.settings.sheetEndpoint) {
    startAutoSync();
  } else {
    stopAutoSync();
  }
}

function onMonthlyBudgetInputBlur() {
  if (dom.monthlyBudgetInput) dom.monthlyBudgetInput.value = formatBudgetInput(sanitizeBudgetValue(dom.monthlyBudgetInput.value));
}

function updateOnlineStatus() {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const wasOffline = !state.runtime.isOnline;
  state.runtime.isOnline = isOnline;
  if (dom.offlineIndicator) {
    dom.offlineIndicator.style.display = isOnline ? "none" : "inline-block";
  }
  // Auto sync when coming back online
  if (wasOffline && isOnline && state.settings.sheetEndpoint && state.settings.autoSyncEnabled) {
    onSyncPendingRecords();
  }
}

function onPaginationPrev() {
  if (state.runtime.currentPage > 1) {
    state.runtime.currentPage -= 1;
    renderRecords(true);
  }
}

function onPaginationNext(filteredLength) {
  const totalPages = Math.ceil(filteredLength / getRecordsPerPage());
  if (state.runtime.currentPage < totalPages) {
    state.runtime.currentPage += 1;
    renderRecords(true);
  }
}

function attachEvents() {
  if (dom.form) dom.form.addEventListener("submit", onSubmitExpense);
  if (dom.recordsBody) dom.recordsBody.addEventListener("click", onRecordsTableAction);
  if (dom.toggleThemeBtn) dom.toggleThemeBtn.addEventListener("click", onToggleTheme);
  if (dom.toggleAmountVisibilityBtn) dom.toggleAmountVisibilityBtn.addEventListener("click", onToggleAmountVisibility);
  if (dom.toggleRecordsContentBtn) dom.toggleRecordsContentBtn.addEventListener("click", onToggleRecordsContent);
  for (const link of Array.from(dom.versionUpdateLinks || [])) {
    if (!link || typeof link.addEventListener !== "function") continue;
    link.addEventListener("click", onVersionUpdateLinkClick);
  }
  if (dom.toggleSettingsBtn) dom.toggleSettingsBtn.addEventListener("click", onToggleSettingsPanel);
  if (dom.settingsBackdrop) dom.settingsBackdrop.addEventListener("click", onCloseSettingsPanel);
  if (dom.closeSettingsBtn) dom.closeSettingsBtn.addEventListener("click", onCloseSettingsPanel);
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("keydown", onSettingsPanelKeydown);
  }
  if (dom.saveSettingsBtn) dom.saveSettingsBtn.addEventListener("click", onSaveSettings);
  if (dom.recurringRuleForm) dom.recurringRuleForm.addEventListener("submit", onSubmitRecurringRule);
  if (dom.recurringRuleCancelBtn) dom.recurringRuleCancelBtn.addEventListener("click", onCancelRecurringRuleEdit);
  if (dom.recurringRulesList) dom.recurringRulesList.addEventListener("click", onRecurringRulesListClick);
  if (dom.toggleDailyReminderBtn) dom.toggleDailyReminderBtn.addEventListener("click", () => void onToggleDailyReminder());
  if (dom.toggleAutoSyncBtn) dom.toggleAutoSyncBtn.addEventListener("click", () => void onToggleAutoSync());
  if (dom.autoSyncIntervalSelect) dom.autoSyncIntervalSelect.addEventListener("change", onAutoSyncIntervalChange);
  if (dom.syncPendingBtn) dom.syncPendingBtn.addEventListener("click", () => void onSyncPendingRecords());
  if (dom.recordsFilterQueryInput) dom.recordsFilterQueryInput.addEventListener("input", onRecordsFilterQueryInput);
  if (dom.recordsFilterResetBtn) dom.recordsFilterResetBtn.addEventListener("click", onResetRecordsFilter);
  if (dom.monthlySummaryMonthInput) dom.monthlySummaryMonthInput.addEventListener("change", onMonthlySummaryMonthChange);
  if (dom.clearAllBtn) dom.clearAllBtn.addEventListener("click", onClearAllRecords);
  if (dom.editRecordForm) dom.editRecordForm.addEventListener("submit", onSubmitEditRecord);
  if (dom.editRecordCancelBtn) dom.editRecordCancelBtn.addEventListener("click", closeEditRecordDialog);
  if (dom.monthlyBudgetInput) dom.monthlyBudgetInput.addEventListener("blur", onMonthlyBudgetInputBlur);
  if (dom.deleteConfirmCancelBtn) dom.deleteConfirmCancelBtn.addEventListener("click", closeDeleteConfirmDialog);
  if (dom.deleteConfirmDialog) {
    dom.deleteConfirmDialog.addEventListener("close", () => {
      if (dom.deleteConfirmRecordIdInput) dom.deleteConfirmRecordIdInput.value = "";
    });
    dom.deleteConfirmDialog.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = dom.deleteConfirmRecordIdInput?.value;
      closeDeleteConfirmDialog();
      doDeleteRecord(id);
    });
  }
  if (dom.clearAllConfirmCancelBtn) dom.clearAllConfirmCancelBtn.addEventListener("click", closeClearAllConfirmDialog);
  if (dom.clearAllConfirmDialog) {
    dom.clearAllConfirmDialog.addEventListener("submit", (event) => {
      event.preventDefault();
      closeClearAllConfirmDialog();
      doClearAllRecords();
    });
  }
  if (dom.paginationPrevBtn) dom.paginationPrevBtn.addEventListener("click", onPaginationPrev);
  if (dom.paginationNextBtn) dom.paginationNextBtn.addEventListener("click", () => {
    const filtered = getFilteredRecords(getSortedRecordsByDate(state.records));
    onPaginationNext(filtered.length);
  });
  if (typeof window !== "undefined") {
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
  }
  // Wallet transfer button
  if (dom.walletTransferBtn) dom.walletTransferBtn.addEventListener("click", openTransferDialog);
  if (dom.walletAddBtn) dom.walletAddBtn.addEventListener("click", openAddWalletDialog);
  // Transfer dialog
  const transferForm = dom.transferDialog?.querySelector("#transfer-form");
  const transferCancelBtn = dom.transferDialog?.querySelector("#transfer-cancel");
  if (transferForm) transferForm.addEventListener("submit", onSubmitTransfer);
  if (transferCancelBtn) transferCancelBtn.addEventListener("click", closeTransferDialog);
  // Add wallet dialog
  const addWalletForm = dom.addWalletDialog?.querySelector("#add-wallet-form");
  const addWalletCancelBtn = dom.addWalletDialog?.querySelector("#add-wallet-cancel");
  if (addWalletForm) addWalletForm.addEventListener("submit", onSubmitAddWallet);
  if (addWalletCancelBtn) addWalletCancelBtn.addEventListener("click", closeAddWalletDialog);
  // Wallet balance management
  if (dom.saveWalletBalancesBtn) dom.saveWalletBalancesBtn.addEventListener("click", onSaveWalletBalances);
  if (dom.walletBalanceList) dom.walletBalanceList.addEventListener("blur", onWalletBalanceInputBlur, true);
}

function init() {
  if (!HAS_DOCUMENT) return;
  ensureRuntimeCaches();
  loadStateFromStorage();
  initializeWalletBalances();
  generateRecurringRecords();
  refreshCategoryOptionsFromSettings();
  refreshWalletMethodOptions();
  applySettingsToUI();
  setSettingsPanelOpen(false);
  setRecordsContentCollapsed(true, { renderOnExpand: false });
  if (dom.dateInput && !dom.dateInput.value) dom.dateInput.value = getLocalDateKey();
  attachEvents();
  updateOnlineStatus();
  syncDailyReminderScheduleForAndroid();
  syncReminderTodayRecordState({ sendNow: true });
  renderWallets();
  // Auto sync on app open if online and has endpoint
  if (state.runtime.isOnline && state.settings.sheetEndpoint) {
    onSyncPendingRecords();
  }
  render();
}

void init();
