# App quản lý chi tiêu hàng ngày + Google Sheet

## 1) Chức năng hiện có

- **Lưu trữ dữ liệu** bằng `localStorage`.
- **Quản lý giao dịch**: tạo / sửa / xóa / xóa tất cả.
- **Thống kê nhanh**: chi tiêu hôm nay, tháng này, số giao dịch, ngân sách tháng.
- **Ngân sách tháng**: đặt ngân sách tổng, cảnh báo khi vượt mức.
- **Tổng kết danh mục theo tháng**: hiển thị progress bar, chọn tháng.
- **Bộ lọc lịch sử**: tìm nhanh theo từ khóa (ghi chú, danh mục, ngày, số tiền, phương thức).
- **Đồng bộ Google Sheet**: gửi giao dịch lên Google Sheet qua Apps Script.
- **Chế độ tối / sáng**: toggle dark mode.
- **Ẩn / hiện số tiền**: bảo mật nhanh trên màn hình.
- **Nhắc nhở 21:00** (Android): nhắc nhập chi tiêu nếu chưa có giao dịch trong ngày.
- **Chuẩn hóa tiếng Việt**: tự sửa lỗi mojibake (mã hóa sai) cho danh mục, ghi chú.
- **Danh mục mặc định**: Ăn uống, Di chuyển, Nhà ở, Hóa đơn, Giải trí, Sức khỏe, Mua sắm, Khác.
- **Responsive**: giao diện tự co giãn cho mobile.
- **Animations**: hiệu ứng enter, hover, transition mượt.
- **Test**: bộ test logic bằng Node test runner (`npm test`) cho normalize/search/summary/budget logic hiện còn dùng.

## 2) Chạy local web app
```powershell
cd D:\Download\test1\test1
python -m http.server 5500
```

Mở:

`http://localhost:5500`

## 3) Cấu hình Google Apps Script (bắt buộc cho sync)
1. Tạo 1 Google Sheet mới.
2. Mở `Extensions -> Apps Script`.
3. Dán nội dung file `apps-script/Code.gs`.
4. Đổi `API_KEY` trong script theo key riêng của bạn.
5. `Deploy -> New deployment -> Web app`.
6. `Execute as`: Me.
7. `Who has access`: Anyone.
8. Deploy và copy `Web App URL`.

Script sẽ tự tạo các sheet cần thiết:
- `ChiTieuHangNgay` (append log)

## 4) Kết nối app
1. Mở app, bấm `Cài đặt`.
2. Nhập:
   - `Web App URL`
   - `API Key`
3. Bấm `Lưu cài đặt`.
4. Bấm `Đồng bộ bản ghi chưa gửi` để sync thủ công.

## 5) Chạy test
```powershell
npm.cmd test
```

Nếu môi trường chặn `node --test` thì hãy chạy lại trong PowerShell/Command Prompt bình thường ngoài sandbox.

## 6) Build Android APK (Windows)
```powershell
npm run android:sync
npm run android:build
npm run android:install
```

APK output:

`android/build/out/expense-tracker-debug.apk`
