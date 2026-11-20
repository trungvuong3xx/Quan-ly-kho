# Kiểm thử Thành Phẩm v5 — 20/11/2026

## Phạm vi đã triển khai

- Module TP độc lập: tem 5 dòng, số kg tối đa 4 số lẻ, chống trùng trong phiên, log 30 mã, chi tiết phân trang và tổng hợp QC.
- Phiên dở dang, revision, lịch sử, nạp lại/xóa phiên, dọn phiên đã xuất quá 30 ngày; bảo vệ phiên đang hoạt động/chưa xuất.
- Xuất Excel từng phiên/toàn bộ; trạng thái xuất gắn với revision, vẫn xuất được RAM khi lưu trữ lỗi.
- Tích hợp backup/restore, chờ kết quả ghi TP trước reload, phục hồi theo revision và lưu ngay ở các mốc vòng đời.
- Camera cấu hình chung, giữ đồng bộ reader cũ, Kiểm kê tắt đèn khi dừng, chặn yêu cầu mở camera đã bị hủy.
- PWA cache v164: cài đủ app shell trước khi kích hoạt; bản cập nhật đợi người dùng lưu phiên và reload.
- APK versionCode 142 / versionName 2.41, giữ app ID, Java 17 và keystore hiện có.

## Kết quả trên máy phát triển

- `npm test`: 9 bài kiểm tra đạt, gồm parser, tính tổng, thẩm định backup, retention, revision/clock drift, lỗi ghi cả hai tầng, mirror xóa và backup rỗng.
- `npm run test:browser`: 13 ca Chromium đạt. Quét dùng đầu vào giả lập; các ca vòng đời camera chạy core thực với stream được kiểm soát, không kiểm tra cảm biến thật.
- Các ca trình duyệt gồm: chống trùng/xóa/quét lại; khôi phục draft; giới hạn DOM; xuất revision; SheetJS tạo file XLSX thật đúng hai cột; quota; restore khi còn hàng đợi; lỗi native save; camera đến muộn; offline PWA; coldboot; dừng lúc đang phục hồi; khởi động CX1; layout ngang.
- Kiểm tra cú pháp tất cả JS ở thư mục gốc đạt; `git diff --check` không có lỗi whitespace.
- `node build-web.js` đạt; assets root được đồng bộ sang `www/` và Android assets.
- Build APK local đạt bằng Java 17. Vì đường dẫn có dấu làm batch wrapper lỗi, dùng lệnh dưới trong thư mục `android` với `ANDROID_HOME` trỏ SDK:

```powershell
java -classpath gradle/wrapper/gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain assembleDebug --console=plain
```

- `apksigner verify --verbose` xác nhận APK hợp lệ, chữ ký v2; cấu hình v1/v2 và keystore không thay đổi.
- Đã xem ảnh giao diện quét/kết quả ở kích thước 412×915; kiểm tra kích thước vùng log/nút ở 844×390 bằng trình duyệt.
- Các file nghiệp vụ `btp.js`, `kiemke.js`, `cx1.js`, `cx5.js`, `quetqr.js`, `tonkho.js` không bị sửa.

## Chưa xác minh bằng thiết bị thật

- ADB không có thiết bị kết nối tại thời điểm kiểm tra. Chưa thử camera/đèn pin vật lý K20 Pro, ẩn/mở app trên Android, cài đè giữ dữ liệu hoặc chia sẻ Zalo thật.
- Chưa xác minh nghiệp vụ ghi Google Sheets với dữ liệu kho thật; test trình duyệt chặn các request bên ngoài để không ghi dữ liệu thử lên hệ thống.
- Không cam kết không mất dữ liệu khi OS kill tiến trình trước lần ghi. Khi lỗi bộ nhớ, giữ ứng dụng mở để thử lưu hoặc xuất Excel.

## Chạy lại

```powershell
npm install
npx playwright install chromium
npm test
npm run test:browser
node build-web.js
```

CI đã được bổ sung hai nhóm kiểm thử trước khi build APK. Kết quả CI và việc triển khai phải được xác nhận riêng từ lần chạy gắn với commit phát hành.
