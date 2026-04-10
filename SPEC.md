# Zent - Ứng Dụng Theo Dõi Chi Tiêu Cá Nhân

## 1. Tổng Quan

**Tên ứng dụng:** Zent
**Mô tả ngắn:** Ứng dụng theo dõi chi tiêu cá nhân đơn giản, gọn nhẹ cho người dùng phổ thông.
**Tagline:** "Gọn, rõ, đủ dùng cho người cơ bản."
**Ngôn ngữ giao diện:** Tiếng Việt
**Đơn vị tiền tệ mặc định:** VND (Việt Nam Đồng)
**Phiên bản hiện tại:** 1.0.0

---

## 2. Kiến Trúc Kỹ Thuật

### 2.1 Công Nghệ Sử Dụng

| Lớp | Công nghệ |
|-----|-----------|
| Frontend | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| Font chữ | IBM Plex Sans (body), Space Grotesk (heading) |
| Lưu trữ cục bộ | localStorage |
| Đồng bộ từ xa | Google Apps Script Web App (HTTP POST) |
| Nền tảng di động | Android WebView ( Capacitor-style hybrid app) |
| Native Bridge | AndroidReminderBridge (notification/reminder) |

### 2.2 Cấu Trúc File

```
test1/
├── index.html              # Main HTML entry point
├── app.js                  # Core application logic (2270 dòng)
├── styles.css              # All styles
├── package.json            # NPM config & scripts
├── SPEC.md                 # This file
├── assets/icons/           # App icons (favicon, avatar)
│   ├── app-avatar.png
│   ├── favicon-16.png
│   ├── favicon-32.png
│   ├── favicon-48.png
│   └── apple-touch-icon.png
├── android/
│   ├── assets/www/         # Copied web assets for APK
│   │   ├── index.html
│   │   ├── app.js
│   │   └── styles.css
│   ├── src/com/kko004/chitieumoingay/
│   │   ├── ReminderScheduler.java   # Schedule daily reminders
│   │   ├── ReminderReceiver.java    # Handle reminder broadcast
│   │   └── BootReceiver.java        # Reschedule after boot
│   ├── AndroidManifest.xml
│   ├── build-apk.ps1      # Build script
│   └── install-apk.ps1    # Install script
└── apps-script/
    └── Code.gs             # Google Apps Script backend
```

### 2.3 Storage Schema (localStorage)

| Key | Mô tả | Giới hạn |
|-----|-------|----------|
| `expense_records_v1` | Array of expense records | 8000 records max |
| `expense_settings_v1` | User settings object | 1 object |
| `expense_recurring_rules_v1` | Array of recurring rules | No hard limit |
| `expense_recurring_suppressions_v1` | Suppressed occurrences | No hard limit |

### 2.4 Performance Profiles

Ứng dụng tự động phát hiện device profile để tối ưu:

| Profile | Điều kiện | Records per page |
|---------|-----------|-----------------|
| Performance Lite | Android WebView, reduced motion, coarse pointer, RAM ≤ 4GB, CPU ≤ 4 cores | 30 |
| Standard | Các thiết bị còn lại | 50 |

---

## 3. Dữ Liệu Mô Hình

### 3.1 Expense Record (Bản ghi chi tiêu)

```typescript
interface ExpenseRecord {
  id: string;                    // UUID hoặc `rec_{timestamp}_{random}`
  date: string;                 // Format: YYYY-MM-DD
  category: string;             // Danh mục (xem mặc định bên dưới)
  amount: number;               // Số tiền VND (integer, đã làm tròn)
  method: string;               // Phương thức thanh toán
  note: string;                 // Ghi chú (max 120 ký tự)
  createdAt: string;            // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  syncStatus: 'synced' | 'pending' | 'failed' | 'local';
  source: 'manual' | 'recurring';
  recurringRuleId?: string;     // ID của rule nếu source = 'recurring'
  recurringOccurrenceKey?: string; // Key: `{ruleId}:{YYYY-MM}`
}
```

### 3.2 Recurring Rule (Khoản chi định kỳ)

```typescript
interface RecurringRule {
  id: string;                    // UUID hoặc `rule_{timestamp}_{random}`
  amount: number;               // Số tiền VND
  category: string;             // Danh mục
  method: string;               // Phương thức thanh toán
  note: string;                 // Ghi chú (max 120 ký tự)
  dayOfMonth: number;           // Ngày lặp trong tháng (1-31)
  startDate: string;            // YYYY-MM-DD
  active: boolean;              // Đang bật hay tạm dừng
  createdAt: string;            // ISO timestamp
  updatedAt: string;            // ISO timestamp
}
```

### 3.3 Recurring Suppression (Kỳ đã bị bỏ qua)

```typescript
interface RecurringSuppression {
  recurringRuleId: string;
  recurringOccurrenceKey: string; // Format: `{ruleId}:{YYYY-MM}`
  deletedAt: string;               // ISO timestamp
}
```

### 3.4 Settings (Cài đặt)

```typescript
interface Settings {
  sheetEndpoint: string;         // Google Apps Script Web App URL
  apiKey: string;                 // API key tùy chọn
  monthlyBudget: number;          // Ngân sách tháng VND (0 = chưa đặt)
  categories: string[];          // Danh sách danh mục tùy chỉnh
  hideAmounts: boolean;           // Ẩn/hiện số tiền
  theme: 'light' | 'dark';        // Giao diện sáng/tối
  dailyReminderEnabled: boolean;  // Bật nhắc 21:00
  autoSyncEnabled: boolean;       // Bật tự đồng bộ
  autoSyncInterval: number;       // Phút giữa mỗi lần sync (5/15/30/60/120)
}
```

### 3.5 Default Categories (Danh mục mặc định)

```
Ăn uống, Di chuyển, Nhà ở, Hóa đơn, Giải trí, Sức khỏe, Mua sắm, Khác
```

### 3.6 Default Payment Methods (Phương thức thanh toán)

```
Tiền mặt, Chuyển khoản, Thẻ tín dụng, Ví điện tử
```

---

## 4. Tính Năng Chi Tiết

### 4.1 Quản Lý Chi Tiêu (CRUD)

#### Thêm chi tiêu
- Form nhập: Ngày, Danh mục, Số tiền, Phương thức, Ghi chú
- Validation: Số tiền > 0, ngày hợp lệ, danh mục bắt buộc
- Auto-generate ID, createdAt, updatedAt
- syncStatus mặc định: `local`
- Auto-prepend vào danh sách (mới nhất lên đầu)
- Max 8000 records (tự động cắt cũ nhất nếu vượt)

#### Sửa chi tiêu
- Dialog chỉnh sửa với form pre-populated
- Cập nhật updatedAt + reset syncStatus → `pending`
- Không cho sửa recurring record (chỉ suppress)

#### Xóa chi tiêu
- Confirmation dialog trước khi xóa
- Nếu là recurring record → tạo suppression entry
- Batch delete all: Tạo suppression cho tất cả recurring occurrences

#### Xem lịch sử
- Bảng với phân trang (30 hoặc 50 records/page)
- Các cột: Ngày, Danh mục, Số tiền, Thanh toán, Ghi chú, Thao tác
- Badge "Định kỳ" cho records có nguồn recurring
- Collapsible section (mặc định collapsed)

### 4.2 Tìm kiếm & Lọc

- **Text search**: Tìm theo ghi chú, danh mục, ngày, số tiền
- **Debounce**: 120ms
- **Normalized search**: Không phân biệt dấu, lowercase, đặc biệt xử lý tiếng Việt
- Reset bộ lọc về trang 1

### 4.3 Tổng Kết & Thống Kê

#### Stats Grid (Luôn hiển thị)
| Thẻ | Nội dung |
|-----|----------|
| Hôm nay | Tổng chi tiêu trong ngày |
| Tháng này | Tổng chi tiêu trong tháng |
| Số giao dịch | Tổng số records |
| Ngân sách tháng | Giá trị đã đặt hoặc "Chưa đặt" |

#### Budget Warning
- Hiển thị khi đã đặt ngân sách
- Over budget: "Bạn đã vượt X VND so với ngân sách tháng."
- Under budget: "Bạn còn X VND ngân sách tháng."
- Khi ẩn số tiền: Chỉ hiển thị cảnh báo chung

#### Monthly Category Summary
- Chọn tháng xem (input type="month")
- Tổng tiền + số giao dịch của tháng
- Top 7 danh mục với:
  - Tên danh mục
  - Tổng tiền
  - % chiếm tổng
  - Số giao dịch
  - Thanh bar trực quan (min 2%, max 100%)

### 4.4 Khoản Chi Định Kỳ

#### Tạo Rule
- Số tiền, Danh mục, Phương thức, Ngày lặp (1-31), Ngày bắt đầu, Ghi chú, Bật/Tắt
- Auto-generate tất cả records còn thiếu khi lưu

#### Xử lý hàng tháng
- Tính tất cả các tháng "đến hạn" từ startDate đến hiện tại
- Mỗi rule tạo record cho tháng đó với `date = scheduledDate`
- Kiểm tra suppression & existing records để tránh trùng lặp

#### Quản lý Rule
- **Sửa**: Populate form, update existing rule
- **Toggle**: Bật/tắt active, auto-generate nếu bật lại
- **Xóa**: Xóa rule, KHÔNG xóa các records đã tạo

#### Suppression
- Khi xóa 1 recurring record: Tạo suppression entry
- Khi clear all: Tạo suppression cho tất cả future/past occurrences
- Suppression check trước khi auto-generate

### 4.5 Đồng Bộ Google Sheets

#### Manual Sync
- POST mỗi record với `syncStatus != 'synced'` lên endpoint
- Retry logic: 3 lần với exponential backoff (1s, 2s, 4s)
- Cập nhật syncStatus sau mỗi lần gửi

#### Auto Sync
- Interval options: 5, 15, 30, 60, 120 phút
- Chỉ sync khi online
- Tự động sync khi quay lại online (nếu đang bật)

#### Sheet Endpoint Format
```
POST https://script.google.com/macros/s/{deploymentId}/exec
Body: JSON.stringify({
  apiKey: string,
  action: "appendRecord",
  record: ExpenseRecord
})
```

### 4.6 Giao Diện & Theme

#### Light Mode (Default)
- Background: Trắng/#fff
- Text: Tối/#1a1a1a
- Accent: Tùy chỉnh qua CSS variables

#### Dark Mode
- Background: Tối/#121212
- Text: Sáng/#f5f5f5
- Tự động theo `prefers-color-scheme` nếu chưa đặt

#### Toggle Controls
- **Ẩn/Hiện tiền**: Toggle `.amount-hidden` class, thay đổi số tiền thành "••••••"
- **Theme**: Toggle light/dark
- **Settings panel**: Slide-in panel với backdrop

### 4.7 Nhắc Nhở Hàng Ngày (Android Only)

#### Cấu hình
- Thời gian: 21:00 hàng ngày
- Title: "Nhắc nhập chi tiêu"
- Message: "Hôm nay bạn chưa nhập chi tiêu. Hãy cập nhật trước khi kết thúc ngày."

#### Android Bridge API
```java
interface AndroidReminderBridge {
  // Yêu cầu quyền notification
  String requestNotificationPermission();
  String getNotificationPermissionState();

  // Quản lý reminder
  void scheduleDailyReminder(int hour, int minute, String title, String message);
  void cancelDailyReminder();

  // Báo cho app biết đã nhập hôm nay
  void updateTodayRecordState(String dateKey, boolean hasRecord);

  // Trigger reminder ngay lập tức (sau khi enable)
  void maybeSendReminderNow();
}
```

#### Boot Receiver
- Reschedule reminder sau khi khởi động lại thiết bị
- Chỉ reschedule nếu `dailyReminderEnabled = true`

---

## 5. UI Layout

```
┌─────────────────────────────────────────────┐
│  [Zent Avatar]  Zent                        │
│              Gọn, rõ, đủ dùng...            │
│                                             │
│  [Offline] [Cập nhật] [Ẩn tiền] [Tối] [Cài] │
├─────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │Hôm nay │ │Tháng   │ │Số GD   │ │Ngân sách││
│  │ 0 đ   │ │ 0 đ   │ │ 0     │ │Chưa đặt││
│  └────────┘ └────────┘ └────────┘ └────────┘│
│  ⚠️ Budget Warning (nếu có)                 │
├─────────────────────────────────────────────┤
│  Tổng kết danh mục theo tháng    [Tháng ▼] │
│  Tháng 04/2026: 0 đ (0 GD)                 │
│  ┌─────────────────────────────── 85%      │
│  │ Ăn uống      1.500.000₫  60%   12 GD     │
│  ├──────────────────────── 35%              │
│  │ Di chuyển      500.000₫  20%    8 GD     │
│  └───────────────────────────────            │
│  Chưa có giao dịch...                       │
├─────────────────────────────────────────────┤
│  [Settings Panel - Slide-in overlay]       │
│  - Ngân sách tháng: [_________] VND         │
│  - Web App URL: [https://...]               │
│  - API Key: [********]                      │
│  [Lưu] [Đồng bộ] [Bật nhắc 21:00]           │
│  [Tự động đồng bộ: Tắt ▼]                   │
│                                             │
│  Khoản chi định kỳ                          │
│  [+ Form thêm rule]                         │
│  [Rule 1] [Edit] [Pause] [Delete]          │
│  [Rule 2] ...                               │
├─────────────────────────────────────────────┤
│  Thêm chi tiêu                              │
│  [Ngày] [Danh mục ▼]                        │
│  [Số tiền____] [Thanh toán ▼]              │
│  [Ghi chú________________________________]   │
│  [        Lưu giao dịch        ]            │
│  ✅ Đã lưu giao dịch.                        │
├─────────────────────────────────────────────┤
│  Lịch sử giao dịch              [Hiện ▼]    │
│  ───────────────────────────────────────    │
│  │ Tìm nhanh...        │ [Xóa lọc] │        │
│  [                                ]         │
│  [      Xóa tất cả      ]                  │
│  ───────────────────────────────────────    │
│  Ngày    Danh mục    Tiền    ...  Thao tác │
│  ───────────────────────────────────────    │
│  (Records table with pagination)           │
│  [<<] Trang 1/5 [>>]                        │
└─────────────────────────────────────────────┘
```

---

## 6. Xử Lý Text & Encoding

### 6.1 Mojibake Repair
- Phát hiện các ký tự lạ: `Ã`, `Â`, `Ä`, `Å`, `Æ`, `Ð`, `Ñ`, `Ø`, `â`, `ï¿½`, `�`
- Thử decode UTF-8 from Latin-1
- Chọn version có ít markers hơn và nhiều extended letters hơn

### 6.2 Vietnamese Normalization
```javascript
// Lowercase, remove diacritics, replace đ → d
normalizeTextLoose("Trường Tiền") → "truong tien"
```

### 6.3 Fuzzy Category/Method Matching
- Canonicalize theo loose match với default values
- "ĂN UỐNG" → "Ăn uống"
- "cash" → "Tiền mặt"

---

## 7. API Google Apps Script (Server-side)

### 7.1 Endpoint
```
POST https://script.google.com/macros/s/{deploymentId}/exec
Content-Type: text/plain;charset=utf-8
```

### 7.2 Request Format
```json
{
  "apiKey": "optional-api-key",
  "action": "appendRecord",
  "record": {
    "id": "rec_xxx",
    "date": "2026-04-01",
    "category": "Ăn uống",
    "amount": 150000,
    "method": "Tiền mặt",
    "note": "Cà phê sáng",
    "createdAt": "2026-04-01T00:00:00.000Z",
    "updatedAt": "2026-04-01T00:00:00.000Z",
    "syncStatus": "pending"
  }
}
```

### 7.3 Response
- Do sử dụng `mode: 'no-cors'`, response không được đọc
- Coi như thành công nếu không throw error

---

## 8. Constants & Configuration

```javascript
const STORAGE_KEYS = {
  records: "expense_records_v1",
  settings: "expense_settings_v1",
  recurringRules: "expense_recurring_rules_v1",
  recurringSuppressions: "expense_recurring_suppressions_v1",
};

const SYNC_STATUS = { synced: "synced", pending: "pending", failed: "failed", local: "local" };
const THEMES = { light: "light", dark: "dark" };
const RECORD_SOURCE = { manual: "manual", recurring: "recurring" };
const MAX_RECORDS = 8000;
const MAX_RECORDS_PER_PAGE = 50;
const PERFORMANCE_LITE_RECORDS_PER_PAGE = 30;
const RECORDS_FILTER_INPUT_DEBOUNCE_MS = 120;
const SYNC_MAX_RETRIES = 3;
const SYNC_RETRY_DELAY_MS = 1000;
const AUTO_SYNC_INTERVALS = [5, 15, 30, 60, 120];
const DAILY_REMINDER_CONFIG = { hour: 21, minute: 0 };
```

---

## 9. Build & Deployment

### 9.1 Android APK Build
```bash
# PowerShell
npm run android:build

# Bash
npm run android:build:bash
```

### 9.2 Web Asset Sync
```bash
# Copy web assets to android/assets/www/
npm run android:sync
```

### 9.3 APK Install
```bash
npm run android:install
```

---

## 10. Known Behaviors

1. **no-cors mode**: Google Sheets sync dùng `mode: 'no-cors'` nên không đọc được response - coi như thành công nếu không error
2. **Day-of-month edge case**: Ngày 29-31 được xử lý an toàn bằng `Math.min(daysInMonth, dayOfMonth)`
3. **Budget 0**: Ngân sách = 0 coi như chưa đặt, không hiện cảnh báo
4. **Auto-generated records**: Khi bật lại recurring rule đã tạm dừng, chỉ tạo records còn thiếu (không tạo lại records đã xóa có suppression)
5. **Clear all**: Không xóa recurring rules, chỉ tạo suppression entries để các records không bị tái tạo
