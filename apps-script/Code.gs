const SHEET_NAME = "ChiTieuHangNgay";
const API_KEY = "5639aa5af8ac7018b7aad8a89c95c98cfc098eefa9d198b452d789a877e7da86";
const LEGACY_HEADERS = [
  "created_at_server",
  "client_id",
  "date",
  "category",
  "amount_vnd",
  "method",
  "note",
  "tags",
  "template_id",
  "recurring_rule_id",
  "source",
  "created_at_client",
  "updated_at_client",
  "sync_status",
];

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || "").trim();

  return outputPayload_(
    {
      ok: true,
      message: "Expense endpoint is running",
      at: new Date().toISOString(),
    },
    callback
  );
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOutput_({ ok: false, error: "Missing request body" });
    }

    const payload = JSON.parse(e.postData.contents);
    if (!payload || typeof payload !== "object") {
      return jsonOutput_({ ok: false, error: "Invalid payload" });
    }

    if (API_KEY && String(payload.apiKey || "").trim() !== API_KEY) {
      return jsonOutput_({ ok: false, error: "Unauthorized apiKey" });
    }

    const action = String(payload.action || "appendRecord").trim();
    if (action !== "appendRecord") {
      return jsonOutput_({ ok: false, error: "Unsupported action" });
    }

    return jsonOutput_(handleAppendRecord_(payload));
  } catch (error) {
    return jsonOutput_({
      ok: false,
      error: error && error.message ? error.message : "Unexpected error",
    });
  }
}

function handleAppendRecord_(payload) {
  const record = payload.record || {};
  const sheet = getOrCreateSheet_(SHEET_NAME);
  ensureHeaders_(sheet, LEGACY_HEADERS);

  const recordId = String(record.id || "").trim();
  if (recordId && isDuplicatedId_(sheet, recordId)) {
    return { ok: true, message: "Duplicate ignored" };
  }

  sheet.appendRow([
    new Date(),
    recordId,
    record.date || "",
    record.category || "",
    Number(record.amount || 0),
    record.method || "",
    record.note || "",
    "",
    "",
    "",
    "",
    record.createdAt || "",
    record.updatedAt || record.createdAt || "",
    record.syncStatus || "",
  ]);

  return { ok: true, message: "Saved" };
}

function getOrCreateSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  let same = true;
  for (let i = 0; i < headers.length; i += 1) {
    if (String(firstRow[i] || "").trim() !== headers[i]) {
      same = false;
      break;
    }
  }
  if (!same) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function isDuplicatedId_(sheet, recordId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return false;
  }

  const range = sheet.getRange(2, 2, lastRow - 1, 1);
  const found = range.createTextFinder(recordId).matchEntireCell(true).findNext();
  return Boolean(found);
}

function outputPayload_(payload, callbackName) {
  if (callbackName) {
    const safeCallback = String(callbackName || "").replace(/[^\w.$]/g, "");
    const body = `${safeCallback}(${JSON.stringify(payload)});`;
    return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOutput_(payload);
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
