const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createMockStorage(seed = {}) {
  const store = new Map();
  for (const [key, value] of Object.entries(seed || {})) {
    store.set(key, String(value));
  }
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function loadAppExports(options = {}) {
  const appPath = path.resolve(__dirname, "..", "app.js");
  let code = fs.readFileSync(appPath, "utf8");
  code = code.replace(/void init\(\);\s*/g, "");

  const documentMock = {
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    body: {
      classList: {
        add() {},
        remove() {},
        contains() {
          return false;
        },
        toggle() {},
      },
      dataset: {},
    },
  };

  const context = {
    module: { exports: {} },
    exports: {},
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date: options.Date || Date,
    Math,
    URL,
    Blob,
    navigator: { onLine: true },
    localStorage: createMockStorage(options.localStorageSeed),
    window: {
      addEventListener() {},
      removeEventListener() {},
      matchMedia() {
        return {
          matches: false,
          addEventListener() {},
          removeEventListener() {},
        };
      },
    },
    document: documentMock,
  };

  vm.createContext(context);
  vm.runInContext(
    `${code}\nmodule.exports = {
      STORAGE_KEYS,
      RECORD_SOURCE,
      addRecurringSuppression,
      doDeleteRecord,
      generateRecurringRecords,
      getBudgetStatusForCurrentMonth,
      getCategorySummaryData,
      getFilteredRecords,
      getRecurringDueMonthKeys,
      getScheduledDateForRecurringMonth,
      loadStateFromStorage,
      makeRecurringOccurrenceKey,
      normalizeRecord,
      normalizeRecurringRule,
      normalizeRecurringSuppression,
      normalizeSettings,
      state
    };`,
    context
  );
  return context.module.exports;
}

function toMojibake(value) {
  return Buffer.from(String(value || ""), "utf8").toString("latin1");
}

test("normalizeRecord repairs mojibake text and drops dormant fields", () => {
  const { normalizeRecord } = loadAppExports();

  const normalized = normalizeRecord({
    id: "m1",
    date: "2026-03-04",
    category: toMojibake("Ăn uống"),
    amount: 120000,
    method: toMojibake("Tiền mặt"),
    note: toMojibake("Cà phê sáng"),
    tags: ["an ngoai"],
    createdAt: "2026-03-04T00:00:00.000Z",
    updatedAt: "2026-03-04T00:00:00.000Z",
    syncStatus: "local",
  });

  assert.equal(normalized.category, "Ăn uống");
  assert.equal(normalized.method, "Tiền mặt");
  assert.equal(normalized.note, "Cà phê sáng");
  assert.equal("tags" in normalized, false);
  assert.equal("tagsText" in normalized, false);
});

test("normalizeSettings keeps supported settings and ignores dormant legacy config", () => {
  const { normalizeSettings } = loadAppExports();

  const settings = normalizeSettings({
    sheetEndpoint: " https://example.com/exec ",
    apiKey: " secret ",
    monthlyBudget: "5000000",
    categories: ["Ăn uống", "Khác", "Cafe"],
    categoryAliases: { cafe: "Ăn uống" },
    monthlyCategoryBudgets: { "2026-03": { "Ăn uống": 200000 } },
    hideAmounts: true,
    theme: "dark",
    dailyReminderEnabled: true,
    autoSyncEnabled: true,
    autoSyncInterval: 30,
  });

  assert.equal(settings.sheetEndpoint, "https://example.com/exec");
  assert.equal(settings.apiKey, "secret");
  assert.equal(settings.monthlyBudget, 5000000);
  assert.equal(settings.hideAmounts, true);
  assert.equal(settings.theme, "dark");
  assert.equal(settings.dailyReminderEnabled, true);
  assert.equal(settings.autoSyncEnabled, true);
  assert.equal(settings.autoSyncInterval, 30);
  assert(settings.categories.includes("Ăn uống"));
  assert(settings.categories.includes("Cafe"));
  assert.equal("categoryAliases" in settings, false);
  assert.equal("monthlyCategoryBudgets" in settings, false);
});

test("quick search filters by visible record fields only", () => {
  const { getFilteredRecords, normalizeRecord, state } = loadAppExports();
  state.runtime.recordsFilter = { query: "cafe" };

  const records = [
    normalizeRecord({
      id: "x1",
      date: "2026-03-02",
      category: "Ăn uống",
      amount: 120000,
      method: "Tiền mặt",
      note: "Cafe sáng",
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      syncStatus: "local",
    }),
    normalizeRecord({
      id: "x2",
      date: "2026-03-03",
      category: "Mua sắm",
      amount: 250000,
      method: "Chuyển khoản",
      note: "Mua đồ dùng",
      createdAt: "2026-03-03T00:00:00.000Z",
      updatedAt: "2026-03-03T00:00:00.000Z",
      syncStatus: "local",
    }),
  ].filter(Boolean);

  const filtered = getFilteredRecords(records);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "x1");
});

test("category summary groups records by month and category", () => {
  const { getCategorySummaryData, normalizeRecord, state } = loadAppExports();
  state.records = [
    normalizeRecord({
      id: "a1",
      date: "2026-03-01",
      category: "Ăn uống",
      amount: 100000,
      method: "Tiền mặt",
      note: "",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
      syncStatus: "local",
    }),
    normalizeRecord({
      id: "a2",
      date: "2026-03-02",
      category: "Ăn uống",
      amount: 50000,
      method: "Tiền mặt",
      note: "",
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      syncStatus: "local",
    }),
    normalizeRecord({
      id: "a3",
      date: "2026-02-28",
      category: "Di chuyển",
      amount: 70000,
      method: "Tiền mặt",
      note: "",
      createdAt: "2026-02-28T00:00:00.000Z",
      updatedAt: "2026-02-28T00:00:00.000Z",
      syncStatus: "local",
    }),
  ].filter(Boolean);
  state.runtime.recordsVersion = 1;
  state.runtime.categorySummaryCacheVersion = -1;
  state.runtime.categorySummaryCache = null;

  const summary = getCategorySummaryData();
  assert.equal(summary.grandTotal, 220000);
  assert.equal(summary.monthCount, 2);
  assert.equal(summary.months[0].monthKey, "2026-03");
  assert.equal(summary.months[0].total, 150000);
  assert.equal(summary.months[0].categories[0].category, "Ăn uống");
  assert.equal(summary.months[0].categories[0].count, 2);
});

test("current month budget status reports remaining budget", () => {
  const RealDate = Date;
  function MockDate(...args) {
    if (args.length === 0) {
      return new RealDate("2026-03-21T08:00:00.000Z");
    }
    return new RealDate(...args);
  }
  MockDate.UTC = RealDate.UTC;
  MockDate.parse = RealDate.parse;
  MockDate.now = () => new RealDate("2026-03-21T08:00:00.000Z").getTime();
  MockDate.prototype = RealDate.prototype;

  const { getBudgetStatusForCurrentMonth, normalizeRecord, state } = loadAppExports({ Date: MockDate });
  state.settings.monthlyBudget = 500000;
  state.records = [
    normalizeRecord({
      id: "b1",
      date: "2026-03-10",
      category: "Ăn uống",
      amount: 120000,
      method: "Tiền mặt",
      note: "",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      syncStatus: "local",
    }),
    normalizeRecord({
      id: "b2",
      date: "2026-03-11",
      category: "Di chuyển",
      amount: 80000,
      method: "Tiền mặt",
      note: "",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      syncStatus: "local",
    }),
  ].filter(Boolean);

  const status = getBudgetStatusForCurrentMonth();
  assert.equal(status.isOverBudget, false);
  assert.equal(status.remaining, 300000);
  assert.equal(status.overBy, 0);
});

test("normalizeRecord defaults unknown sync status to local", () => {
  const { normalizeRecord } = loadAppExports();

  const normalized = normalizeRecord({
    id: "s1",
    date: "2026-03-04",
    category: "Ăn uống",
    amount: 120000,
    method: "Tiền mặt",
    note: "",
    createdAt: "2026-03-04T00:00:00.000Z",
    updatedAt: "2026-03-04T00:00:00.000Z",
    syncStatus: "unknown",
  });

  assert.equal(normalized.syncStatus, "local");
});

test("normalizeRecurringRule keeps supported recurring fields only", () => {
  const { normalizeRecurringRule } = loadAppExports();

  const rule = normalizeRecurringRule({
    id: "rule-1",
    amount: "450000",
    category: toMojibake("Hóa đơn"),
    method: toMojibake("Chuyển khoản"),
    note: toMojibake("Tiền nhà"),
    dayOfMonth: 31,
    startDate: "2026-03-01",
    active: false,
    legacyField: "ignore-me",
  });

  assert.equal(rule.id, "rule-1");
  assert.equal(rule.amount, 450000);
  assert.equal(rule.category, "Hóa đơn");
  assert.equal(rule.method, "Chuyển khoản");
  assert.equal(rule.note, "Tiền nhà");
  assert.equal(rule.dayOfMonth, 31);
  assert.equal(rule.startDate, "2026-03-01");
  assert.equal(rule.active, false);
  assert.equal("legacyField" in rule, false);
});

test("loadStateFromStorage defaults recurring collections for existing installs", () => {
  const { STORAGE_KEYS } = loadAppExports();
  const seeded = loadAppExports({
    localStorageSeed: {
      [STORAGE_KEYS.records]: JSON.stringify([
        {
          id: "seed-1",
          date: "2026-03-02",
          category: "Ăn uống",
          amount: 120000,
          method: "Tiền mặt",
          note: "Bún bò",
          createdAt: "2026-03-02T00:00:00.000Z",
          updatedAt: "2026-03-02T00:00:00.000Z",
          syncStatus: "local",
        },
      ]),
      [STORAGE_KEYS.settings]: JSON.stringify({ monthlyBudget: 2500000 }),
    },
  });

  seeded.loadStateFromStorage();

  assert.equal(seeded.state.records.length, 1);
  assert.equal(seeded.state.settings.monthlyBudget, 2500000);
  assert.deepEqual(Array.from(seeded.state.recurringRules), []);
  assert.deepEqual(Array.from(seeded.state.recurringSuppressions), []);
});

test("generateRecurringRecords backfills missed months and waits for the current due date", () => {
  const { generateRecurringRecords, normalizeRecurringRule, state } = loadAppExports();

  state.recurringRules = [
    normalizeRecurringRule({
      id: "rule_due",
      amount: 180000,
      category: "Hóa đơn",
      method: "Chuyển khoản",
      note: "Internet",
      dayOfMonth: 20,
      startDate: "2026-01-10",
      active: true,
    }),
  ];

  const beforeDue = generateRecurringRecords({ asOfDate: "2026-03-19", persist: false });
  assert.equal(beforeDue, 2);
  assert.deepEqual(Array.from(state.records, (record) => record.date), ["2026-02-20", "2026-01-20"]);

  const afterDue = generateRecurringRecords({ asOfDate: "2026-03-21", persist: false });
  assert.equal(afterDue, 1);
  assert.deepEqual(Array.from(state.records, (record) => record.date), ["2026-03-20", "2026-02-20", "2026-01-20"]);
});

test("scheduled recurring dates clamp to the last day of shorter months", () => {
  const { getRecurringDueMonthKeys, getScheduledDateForRecurringMonth, normalizeRecurringRule } = loadAppExports();

  const rule = normalizeRecurringRule({
    id: "rule_month_end",
    amount: 99000,
    category: "Hóa đơn",
    method: "Chuyển khoản",
    note: "Hosting",
    dayOfMonth: 31,
    startDate: "2026-01-31",
    active: true,
  });

  assert.equal(getScheduledDateForRecurringMonth(rule, "2026-02"), "2026-02-28");
  assert.equal(getScheduledDateForRecurringMonth(rule, "2026-04"), "2026-04-30");
  assert.deepEqual(Array.from(getRecurringDueMonthKeys(rule, "2026-03-31")), ["2026-01", "2026-02", "2026-03"]);
});

test("generateRecurringRecords is idempotent across repeated runs", () => {
  const { generateRecurringRecords, normalizeRecurringRule, state } = loadAppExports();

  state.recurringRules = [
    normalizeRecurringRule({
      id: "rule_repeat",
      amount: 50000,
      category: "Giải trí",
      method: "Ví điện tử",
      note: "Nhạc",
      dayOfMonth: 5,
      startDate: "2026-02-01",
      active: true,
    }),
  ];

  const firstRun = generateRecurringRecords({ asOfDate: "2026-04-10", persist: false });
  const secondRun = generateRecurringRecords({ asOfDate: "2026-04-10", persist: false });

  assert.equal(firstRun, 3);
  assert.equal(secondRun, 0);
  assert.equal(state.records.length, 3);
  assert.equal(new Set(Array.from(state.records, (record) => record.recurringOccurrenceKey)).size, 3);
});

test("deleting a recurring record suppresses regeneration for that month", () => {
  const { doDeleteRecord, generateRecurringRecords, normalizeRecurringRule, state } = loadAppExports();

  state.recurringRules = [
    normalizeRecurringRule({
      id: "rule_delete",
      amount: 275000,
      category: "Nhà ở",
      method: "Chuyển khoản",
      note: "Tiền nhà",
      dayOfMonth: 8,
      startDate: "2026-03-01",
      active: true,
    }),
  ];

  generateRecurringRecords({ asOfDate: "2026-03-10", persist: false });
  const target = state.records[0];

  doDeleteRecord(target.id);
  const afterDelete = generateRecurringRecords({ asOfDate: "2026-03-10", persist: false });

  assert.equal(afterDelete, 0);
  assert.equal(state.records.length, 0);
  assert.equal(state.recurringSuppressions.length, 1);
});

test("edited recurring records keep occurrence identity and do not regenerate", () => {
  const { generateRecurringRecords, normalizeRecurringRule, state } = loadAppExports();

  state.recurringRules = [
    normalizeRecurringRule({
      id: "rule_edit",
      amount: 120000,
      category: "Hóa đơn",
      method: "Chuyển khoản",
      note: "Điện",
      dayOfMonth: 6,
      startDate: "2026-03-01",
      active: true,
    }),
  ];

  generateRecurringRecords({ asOfDate: "2026-03-10", persist: false });
  state.records[0].amount = 150000;
  state.records[0].note = "Điện đã chỉnh";
  state.records[0].date = "2026-03-09";
  state.records[0].updatedAt = "2026-03-09T00:00:00.000Z";

  const secondRun = generateRecurringRecords({ asOfDate: "2026-03-10", persist: false });

  assert.equal(secondRun, 0);
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].amount, 150000);
  assert.equal(state.records[0].recurringOccurrenceKey, "rule_edit:2026-03");
});

test("rule edits and pauses affect only future recurring generation", () => {
  const { generateRecurringRecords, normalizeRecurringRule, state } = loadAppExports();

  state.recurringRules = [
    normalizeRecurringRule({
      id: "rule_future",
      amount: 200000,
      category: "Hóa đơn",
      method: "Chuyển khoản",
      note: "Bảo hiểm",
      dayOfMonth: 5,
      startDate: "2026-01-01",
      active: true,
    }),
  ];

  generateRecurringRecords({ asOfDate: "2026-02-10", persist: false });
  state.recurringRules = [
    normalizeRecurringRule({
      ...state.recurringRules[0],
      amount: 320000,
      dayOfMonth: 15,
      updatedAt: "2026-03-01T00:00:00.000Z",
    }),
  ];

  const marchRun = generateRecurringRecords({ asOfDate: "2026-03-20", persist: false });
  assert.equal(marchRun, 1);
  assert.equal(state.records.find((record) => record.date === "2026-03-15").amount, 320000);
  assert.equal(state.records.find((record) => record.date === "2026-01-05").amount, 200000);
  assert.equal(state.records.find((record) => record.date === "2026-02-05").amount, 200000);

  state.recurringRules[0].active = false;
  const aprilRun = generateRecurringRecords({ asOfDate: "2026-04-20", persist: false });
  assert.equal(aprilRun, 0);
  assert.equal(state.records.some((record) => record.date === "2026-04-15"), false);

  state.recurringRules = [];
  const mayRun = generateRecurringRecords({ asOfDate: "2026-05-20", persist: false });
  assert.equal(mayRun, 0);
  assert.equal(state.records.length, 3);
});

test("generated recurring records participate in budget, summary, and filtering", () => {
  const RealDate = Date;
  function MockDate(...args) {
    if (args.length === 0) {
      return new RealDate("2026-03-23T08:00:00.000Z");
    }
    return new RealDate(...args);
  }
  MockDate.UTC = RealDate.UTC;
  MockDate.parse = RealDate.parse;
  MockDate.now = () => new RealDate("2026-03-23T08:00:00.000Z").getTime();
  MockDate.prototype = RealDate.prototype;

  const { generateRecurringRecords, getBudgetStatusForCurrentMonth, getCategorySummaryData, getFilteredRecords, normalizeRecurringRule, state } = loadAppExports({ Date: MockDate });
  state.settings.monthlyBudget = 500000;
  state.recurringRules = [
    normalizeRecurringRule({
      id: "rule_stats",
      amount: 300000,
      category: "Hóa đơn",
      method: "Chuyển khoản",
      note: "Tiền nhà",
      dayOfMonth: 5,
      startDate: "2026-03-01",
      active: true,
    }),
  ];

  generateRecurringRecords({ asOfDate: "2026-03-23", persist: false });
  state.runtime.recordsFilter = { query: "dinh ky" };

  const filtered = getFilteredRecords(state.records);
  const summary = getCategorySummaryData();
  const budgetStatus = getBudgetStatusForCurrentMonth();

  assert.equal(filtered.length, 1);
  assert.equal(summary.grandTotal, 300000);
  assert.equal(summary.months[0].categories[0].category, "Hóa đơn");
  assert.equal(budgetStatus.remaining, 200000);
});
