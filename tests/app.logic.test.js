const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createMockStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
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
    localStorage: createMockStorage(),
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
    `${code}\nmodule.exports = { getBudgetStatusForCurrentMonth, getCategorySummaryData, getFilteredRecords, normalizeRecord, normalizeSettings, state };`,
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
