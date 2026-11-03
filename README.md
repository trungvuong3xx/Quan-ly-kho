# 📦 HỆ THỐNG QUẢN LÝ KHO (QUANLYKHO)
> **Tài liệu đặc tả kiến trúc, quy trình vận hành và hướng dẫn kỹ thuật toàn diện cho lập trình viên & AI.**
> *Dùng làm tài liệu tham chiếu duy nhất khi chuyển đổi môi trường máy tính, IDE hoặc nâng cấp hệ thống.*

---

## 📑 MỤC LỤC
1. [Tổng Quan Dự Án & Mục Tiêu](#1-tổng-quan-dự-án--mục-tiêu)
2. [Kiến Trúc Kỹ Thuật (Architecture & Tech Stack)](#2-kiến-trúc-kỹ-thuật-architecture--tech-stack)
3. [Bản Đồ Thư Mục & Vai Trò Tệp Tin (Codebase Map)](#3-bản-đồ-thư-mục--vai-trò-tệp-tin-codebase-map)
4. [Cơ Chế Hoạt Động Từng Phân Hệ Nghiệp Vụ](#4-cơ-chế-hoạt-động-từng-phân-hệ-nghiệp-vụ)
5. [Bộ Quy Tắc Cốt Lõi Bất Di Bất Dịch (Quy Tắc Bảo Vệ Dự Án)](#5-bộ-quy-tắc-cốt-lõi-bất-di-bất-dịch-quy-tắc-bảo-vệ-dự-án)
6. [Cơ Chế Lưu Trữ Offline & Bảo Vệ Dữ Liệu](#6-cơ-chế-lưu-trữ-offline--bảo-vệ-dữ-liệu)
7. [Hạ Tầng Backend Google Apps Script (GAS) & Google Sheets](#7-hạ-tầng-backend-google-apps-script-gas--google-sheets)
8. [Cầu Nối Native Android Bridge (`AndroidNative`)](#8-cầu-nối-native-android-bridge-androidnative)
9. [Quy Trình Phát Triển & Triển Khai (DevOps & Deploy)](#9-quy-trình-phát-triển--triển-khai-devops--deploy)
10. [Hướng Dẫn Thiết Lập Môi Trường Mới Từ Đầu (Setup From Scratch)](#10-hướng-dẫn-thiết-lập-môi-trường-mới-từ-đầu-setup-from-scratch)
11. [Kinh Nghiệm Debug & Xử Lý Sự Cố](#11-kinh-nghiệm-debug--xử-lý-sự-cố)

---

## 1. TỔNG QUAN DỰ ÁN & MỤC TIÊU
- **Tên dự án**: Quản Lý Kho (QuanLyKho / com.ntv.quanlykho).
- **Mục tiêu**: Hệ thống quét mã vạch / mã QR công nghiệp phục vụ việc theo dõi xuất kho, nhập kho, kiểm kê, nhập sản xuất chỉ may, chỉ For (CX1), chỉ X5 (CX5), và bán thành phẩm (BTP).
- **Môi trường hoạt động thực tế**:
  - Kho hàng thực địa với điều kiện ánh sáng thay đổi, bụi vải, mạng Wi-Fi chập chờn hoặc mất mạng hoàn toàn.
  - Thiết bị phần cứng mục tiêu: **Xiaomi Redmi K20 Pro** (Chip Qualcomm Snapdragon 855, Camera 48MP Sony IMX586 tự động lấy nét, Android 14 / HyperOS).
- **Triết lý thiết kế**:
  - **Tối đa hóa tốc độ**: Quét liên tục 0ms trễ, phản hồi rung haptic và viền flash ngay khi trúng mã.
  - **Không bao giờ mất dữ liệu**: Chạy offline 100%, hàng đợi tự động đồng bộ khi có mạng, sao lưu tự động vào bộ nhớ máy sau mỗi ca.
  - **Tiết kiệm pin & tài nguyên máy**: Tự động giảm độ phân giải camera, hẹn giờ ngủ 18 giây khi không có thao tác, tắt các hiệu ứng GPU nặng khi camera đang bật.

---

## 2. KIẾN TRÚC KỸ THUẬT (ARCHITECTURE & TECH STACK)

### Mô hình Triển Khai Kép (Dual-Target)
```
                                 [ MÃ NGUỒN CHÍNH ]
                    (index.html, style.css, *.js, scanner-core.js)
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
           [ 1. Web PWA ]                            [ 2. Native Android APK ]
       • GitHub Pages (gh-pages)                 • Capacitor 8.5.x Bridge
       • Service Worker Offline Cache            • Native Java Bridge (MainActivity.java)
       • Dùng trên mọi trình duyệt mobile        • Cài đặt trực tiếp lên K20 Pro
```

### Chi Tiết Công Nghệ (Tech Stack)
| Thành phần | Công nghệ sử dụng | Ghi chú |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5 SPA, Vanilla JavaScript (ES6+), CSS3 Design Tokens | Giao diện phẳng Flat UI, không dùng React/Vue để tối ưu 0ms load |
| **Font chữ** | `Space Grotesk` (Tiêu đề), `IBM Plex Sans` (Body), `IBM Plex Mono` (Mã, Số cân) | Font tải từ Google Fonts có bộ nhớ đệm cache |
| **Icon** | Tabler Icons (`tabler-icons.min.css`, webfonts offline) | Offline 100%, không phụ thuộc CDN |
| **Native Wrapper** | Capacitor 8.5.1 (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`) | Đóng gói Web sang Android APK |
| **Giải mã QR/Barcode** | `BarcodeDetector` (Hardware NPU/GPU API) + `ZXing-JS` (Fallback) | Ưu tiên phần cứng thiết bị, chỉ dùng ZXing khi WebView thiếu API |
| **Cơ sở dữ liệu cục bộ** | `IndexedDB` (`QuanLyKho_HistoryDB`) + `RAM Cache` (0ms) + `localStorage` | Lưu trữ lịch sử 30 ngày, phiên dở dang, hàng đợi offline |
| **Xuất báo cáo** | `SheetJS` (`xlsx.full.min.js`) | Tạo và xuất file `.xlsx` trực tiếp trên client |
| **Backend & Cloud Database**| **Google Sheets** thông qua **Google Apps Script (GAS) Web App** | API REST HTTP không cần thuê máy chủ riêng |
| **CI / CD Pipeline** | GitHub Actions (`build-apk.yml`) | Tự động build APK bằng Java 17 và phát hành qua GitHub Release |

---

## 3. BẢN ĐỒ THƯ MỤC & VAI TRÒ TỆP TIN (CODEBASE MAP)

```
├── .agents/                    # Quy tắc dự án & Skill cho AI Pair Programmer (AGENTS.md)
├── .github/workflows/          # CI/CD Workflow: build-apk.yml (Tự động build APK bằng Java 17)
├── android/                    # Thư mục mã nguồn Native Android (Capacitor project)
│   ├── app/
│   │   ├── build.gradle        # Cấu hình versionCode, versionName, Java 17, debug.keystore
│   │   └── src/main/
│   │       ├── AndroidManifest.xml # Quyền Camera, Rung, Mạng, MediaStore
│   │       ├── assets/public/  # Thư mục chứa web assets đã build sang APK
│   │       └── java/com/ntv/quanlykho/MainActivity.java # Native Bridge AndroidNative
│   └── build.gradle            # Cấu hình subprojects ép Java 17 / JVM 17
├── lib/                        # Thư viện JavaScript & Fonts offline
│   ├── zxing.min.js            # Thư viện giải mã QR fallback khi thiếu BarcodeDetector
│   ├── qrcode.min.js           # Sinh mã QR
│   ├── xlsx.full.min.js        # Thư viện tạo và đọc file Excel
│   └── tabler-icons.min.css    # Bộ icon giao diện kèm font trong lib/fonts/
├── www/                        # Thư mục đích cho Web PWA (được tạo tự động bởi build-web.js)
├── index.html                  # Giao diện chính Single Page Application (SPA)
├── style.css                   # Toàn bộ CSS hệ thống, tokens, theme, camera UI, modal
├── app.js                      # Lõi điều phối: Camera, Autofocus, Đèn pin, Điều hướng, Auto-backup
├── scanner-core.js             # Lõi thư viện chung: HistoryDB, Chống mất lịch sử, Swipe-to-delete
├── quetqr.js                   # Nghiệp vụ Quét QR (Nhập/Xuất kho gom theo phiên)
├── cx1.js                      # Nghiệp vụ Chỉ For (Quét theo đợt, tính bao/kg, nạp quy cách LIST)
├── cx5.js                      # Nghiệp vụ Chỉ X5 (Nhập sản xuất nhanh qua bàn phím số ảo, đối chiếu)
├── btp.js                      # Nghiệp vụ Bán Thành Phẩm (Quản lý 5 phiên quét độc lập)
├── kiemke.js                   # Nghiệp vụ Kiểm kê kho & xuất báo cáo
├── tonkho.js                   # Tra cứu tồn kho tức thời từ Google Sheets
├── sw.js                       # Service Worker cache offline cho Web PWA
├── build-web.js                # Script build tự động copy file sang www/ và android assets
├── capacitor.config.json       # Cấu hình appId, appName, webDir cho Capacitor
├── package.json                # Dependencies npm và script lệnh
└── *.txt (appscript_*.txt)     # Mã nguồn Google Apps Script chạy trên Google Sheets
```

---

## 4. CƠ CHẾ HOẠT ĐỘNG TỪNG PHÂN HỆ NGHIỆP VỤ

### 4.1. Phân Hệ Quét QR (Nhập / Xuất Kho) — [`quetqr.js`](file:///c:/Users/Admin/OneDrive/Tài%20liệu/Code%20gốc/quetqr.js)
- **Quy ước**: `1 mã QR = 1 Bao hàng`.
- **Luồng hoạt động**:
  1. Người dùng chọn **Ngày** và **Loại giao dịch** (Nhập SX, Nhập Trả, Xuất SX, Xuất Bán, Bình Thuận...).
  2. Bấm "Bắt đầu" $\rightarrow$ Khởi tạo camera sau (Camera 0) qua `khoiTaoCameraFast`.
  3. Khi phát hiện mã QR:
     - Chống nháy mã: Khóa mã 1.5 giây nếu cho phép trùng, 500ms nếu không trùng (`kiemTraKhoaMa`).
     - Tách chuỗi dữ liệu qua hàm `parseQRText`: Hỗ trợ định dạng thẻ `{|T...` hoặc `ID|MSP|QC|KG`.
     - Kêu tiếng bíp (`Fast.mp3`), rung haptic 70ms, chớp viền xanh/đỏ (`hienVienFeedbackQR`).
     - Lưu phiên dở dang vào `localStorage` (`quetqr_phien_dodang`).
  4. Bấm "Gửi dữ liệu" $\rightarrow$ Đẩy mảng dữ liệu lên Google Sheets. Nếu mất mạng, tự động đưa vào hàng chờ `quetqr_pending_saves`.
  5. Toàn bộ phiên hoàn tất được lưu vào Lịch sử 30 ngày (`quetqr_lichsu` trong `IndexedDB`).

### 4.2. Phân Hệ Chỉ For — [`cx1.js`](file:///c:/Users/Admin/OneDrive/Tài%20liệu/Code%20gốc/cx1.js)
- **Đặc thù**: Quét mã theo từng **Đợt** (Đợt 1, Đợt 2...), tổng hợp số Bao và số KG.
- **Tính năng nổi bật**:
  - Tự động nạp và lưu cache danh mục quy cách từ Google Sheets (Sheet `LIST`).
  - Gợi ý quy cách thông minh dựa trên tần suất sử dụng gần đây (`tk_search_freq`).
  - Hỗ trợ cả 2 chế độ: Quét camera hoặc Nhập tay.
  - Hỗ trợ tiếp tục phiên quét cũ từ lịch sử.

### 4.3. Phân Hệ Chỉ X5 — [`cx5.js`](file:///c:/Users/Admin/OneDrive/Tài%20liệu/Code%20gốc/cx5.js)
- **Đặc thù**: Màn hình nhập số liệu sản xuất tốc độ cao cho công nhân kho.
- **Bàn phím số ảo tích hợp (Virtual Numeric Numpad)**:
  - Công nhân không cần dùng bàn phím hệ thống (tránh che khuất màn hình).
  - Bàn phím số ảo tích hợp sẵn các phím tắt nhanh: `Enter`, `Xóa`, `Số lượng lượt`.
- **Cơ chế đối chiếu**: So sánh số lượng bao/kg giữa các lượt quét để tránh thất thoát.

### 4.4. Phân Hệ Bán Thành Phẩm (BTP) — [`btp.js`](file:///c:/Users/Admin/OneDrive/Tài%20liệu/Code%20gốc/btp.js)
- **Đặc thù**: Chia làm **5 Phiên quét độc lập** trong ngày (Phiên 1 $\rightarrow$ Phiên 5).
- Quản lý trạng thái đã đồng bộ / chưa đồng bộ theo từng dòng.
- Nút "Đồng bộ hàng chờ" hiển thị số lượng mã đang chờ khi có mạng trở lại.

### 4.5. Kiểm Kê & Tồn Kho — [`kiemke.js`](file:///c:/Users/Admin/OneDrive/Tài%20liệu/Code%20gốc/kiemke.js), [`tonkho.js`](file:///c:/Users/Admin/OneDrive/Tài%20liệu/Code%20gốc/tonkho.js)
- **Kiểm kê**: Quét mã đối soát thực tế tại kho, tự động đếm số lượng, phát hiện trùng lặp, xuất trực tiếp ra file Excel `.xlsx` qua nút "Xuất File Excel".
- **Tồn kho**: Tra cứu tồn kho tức thời của từng sản phẩm theo ngày trực tiếp từ Google Sheets.

---

## 5. BỘ QUY TẮC CỐ ĐỊNH BẤT DI BẤT DỊCH (QUY TẮC BẢO VỆ DỰ ÁN)

> ⚠️ **CẢNH BÁO NGUY HIỂM**: Mọi lập trình viên hoặc AI khi chỉnh sửa dự án BẮT BUỘC tuân thủ tuyệt đối 5 quy tắc dưới đây. Vi phạm sẽ dẫn đến việc ứng dụng bị crash hoặc mất toàn bộ dữ liệu kho của khách hàng.

### 5.1. Cấu Hình Android & Build APK (TUYỆT ĐỐI CẤM JAVA 21)
- **Lý do kỹ thuật**: Trình biên dịch AOT (`dex2oat`) trên hệ điều hành Android 14 (thiết bị Redmi K20 Pro) không tương thích với bytecode sinh ra từ Java 21, gây lỗi **treo vô tận ở màn hình "Đang cài đặt..."**.
- **Quy tắc bắt buộc**:
  1. `build-apk.yml`: Setup Java BẮT BUỘC là **Java 17** (`distribution: 'temurin'`, `java-version: 17`).
  2. `android/app/build.gradle`: `sourceCompatibility` và `targetCompatibility` PHẢI LUÔN LÀ `JavaVersion.VERSION_17`.
  3. `android/build.gradle`: BẮT BUỘC phải có khối ép `subprojects` khóa toàn bộ thư viện phụ thuộc (`:capacitor-android`) về Java 17 và `jvmTarget = "17"`.
  4. File `build-web.js` đã tích hợp hàm kiểm tra tự động `kiemTraQuyTacBuild()`, sẽ tự hủy lệnh build nếu phát hiện Java 21.

### 5.2. Chữ Ký Cố Định & Cơ Chế Cài Đè (Update In-Place)
- **TUYỆT ĐỐI KHÔNG KHUYÊN NGƯỜI DÙNG GỠ CÀI ĐẶT APP**:
  - Gỡ app sẽ kích hoạt Android xóa sạch toàn bộ thư mục dữ liệu cục bộ gồm `localStorage` và `IndexedDB`, làm mất toàn bộ lịch sử quét và hàng chờ offline chưa kịp gửi.
- **Cơ chế cài đè bắt buộc**:
  - Sử dụng file khóa chữ ký cố định `android/app/debug.keystore` cho cả Debug và Release với `v1SigningEnabled true` và `v2SigningEnabled true`.
  - Mỗi khi đẩy code mới để build APK, **BẮT BUỘC TĂNG `versionCode` (+1)** (ví dụ: `130` $\rightarrow$ `131`) trong `android/app/build.gradle`. Android chỉ cho phép cài đè nâng cấp khi `versionCode` của APK mới lớn hơn APK đang cài trong máy.

### 5.3. Quy Tắc Phần Cứng Camera (Redmi K20 Pro)
- **Camera sau Sony 48MP AF (Camera 0)**:
  - Redmi K20 Pro có camera trước dạng motor thò thụt (Pop-up). TUYỆT ĐỐI KHÔNG fallback về `{ video: true }` chung chung khiến motor thò thụt nhảy lên gây lỗi cơ học và treo quyền camera.
  - Luôn sử dụng hàm lọc `timCamera0(devList)` để cố định Camera 0 góc rộng chính.
- **Ràng buộc `track.applyConstraints()`**:
  - CHỈ sử dụng cho đèn pin (`torch`) và lấy nét liên tục (`batContinuousAutofocus`). Tuyệt đối không dùng để thay đổi độ phân giải khi video stream đang chạy vì sẽ gây giật đơ luồng giải mã.

---

## 6. CƠ CHẾ LƯU TRỮ OFFLINE & BẢO VỆ DỮ LIỆU

### 6.1. Kiến Trúc Lưu Trữ Đa Tầng Tại [`scanner-core.js`](file:///c:/Users/Admin/OneDrive/Tài%20liệu/Code%20gốc/scanner-core.js)
```
[ THAO TÁC QUÉT ] ──> [ RAM Cache 0ms ] ──> Cập nhật giao diện tức thì
                             │
                             ├─(Bất đồng bộ)─> [ IndexedDB: QuanLyKho_HistoryDB ] (Lưu trữ lớn)
                             │
                             └─(Đệm dự phòng)─> [ localStorage ] (Khởi động 0ms)
```

### 6.2. Cơ Chế Chống Mất Lịch Sử Khi Khởi Động Nguội (Cold-Boot Protection)
- **Vấn đề**: Khi cài đè APK hoặc tắt hẳn app mở lại, `IndexedDB` cần 50–200ms để nạp dữ liệu lên RAM. Trước đây, sự kiện `window.onload` chạy dọn dẹp phiên hết hạn lúc RAM đang rỗng `[]`, dẫn đến việc ghi đè mảng rỗng làm mất sạch lịch sử.
- **Giải pháp bảo vệ**:
  1. **Cờ trạng thái `_loaded` & `_idbWritable`**: Chỉ cho phép ghi xuống `IndexedDB` sau khi đã nạp xong toàn bộ dữ liệu cũ từ đĩa lên RAM.
  2. **Promise `ScannerCore.whenReady()`**: Các hàm dọn dẹp (`donDepLichSuCX1`, `donDepLichSuCX5`) bắt buộc phải chờ `whenReady()` mới được phép chạy.
  3. **Chốt chặn Transaction ghi đè**: Nếu có lệnh yêu cầu ghi mảng rỗng `[]` đè lên danh sách đang có dữ liệu trong DB mà không có cờ `allowEmpty: true` (người dùng chủ động bấm Xóa tất cả), hệ thống sẽ **hủy bỏ lệnh ghi rỗng và tự động khôi phục lại dữ liệu RAM**.

### 6.3. Hệ Thống Tự Động Sao Lưu Toàn Diện (Auto-Backup)
- Định kỳ sau mỗi ca quét (hoặc khi app bị ẩn `app_hidden`, thoát app `app_exit`), hệ thống tự động gom toàn bộ dữ liệu dở dang, hàng chờ và lịch sử.
- Tính mã băm `tinhMaBam` (SHA/Hash) để kiểm tra thay đổi: nếu không có dữ liệu mới thì bỏ qua.
- **Ghi file an toàn qua bridge `AndroidNative.saveFileToDownload`**:
  - File chính: `Download/QuanLyKho_AutoBackup.json`.
  - File luân phiên theo ngày: `Download/QuanLyKho_AutoBackup_Ngay1.json` và `Ngay2.json`.
  - Cơ chế tự vệ: Nếu số lượng lịch sử bị tụt bất thường > 50%, hệ thống tự động từ chối ghi đè để bảo vệ file sao lưu cũ.

---

## 7. HẠ TẦNG BACKEND GOOGLE APPS SCRIPT (GAS) & GOOGLE SHEETS

Hệ thống sử dụng các Web App Google Apps Script đóng vai trò REST API nhận dữ liệu qua phương thức `POST` (hoặc `GET` tra cứu).

### Danh Sách Endpoint Đang Vận Hành:
1. **API Quét QR & Tổng Hợp**:
   `https://script.google.com/macros/s/AKfycbzXjzccld3X04iJgIpEvKm01in0QT0i7tkjar_oJ6K5-sBGdm9xibe7Mu4UB3mWtha5-w/exec`
2. **API Chỉ For (CX1) & Nạp Quy Cách (Sheet LIST)**:
   `https://script.google.com/macros/s/AKfycbzk7afcuHDOTnL6QSIQ0ZgT-CSiIDNZ8h5S8_IkGXahc7PQRvqZKpLpjkBphioXAyzDKQ/exec`
3. **API Bán Thành Phẩm (BTP)**:
   `https://script.google.com/macros/s/AKfycbxjnWLrJXZk1MJN4bSXdf72Wly7Of1Rc7iRtUNpcKk3iZDkxk-N1W7mE965tNMyhA9z1Q/exec`
4. **API Chỉ X5 (CX5) & Tra Cứu Tồn Kho**:
   `https://script.google.com/macros/s/AKfycbyOhUM1KCg0eUsj-tBPDFnyJXS_PDlxcsRWRqzR7ZdoX9ZCMRlvPApouk9Jn6yghVS1xg/exec`

### Nguyên Tắc Hoạt Động Của Google Apps Script:
- Sử dụng `LockService.getScriptLock()` để khóa giao dịch chống xung đột dữ liệu khi nhiều điện thoại gửi dữ liệu đồng thời.
- Nhận dữ liệu dưới dạng JSON (`e.postData.contents`), phân tích và ghi vào dòng cuối cùng của Sheet tương ứng (`appendRow` hoặc gộp mảng `setValues`).

---

## 8. CẦU NỐI NATIVE ANDROID BRIDGE (`AndroidNative`)

Tại [`MainActivity.java`](file:///c:/Users/Admin/OneDrive/Tài%20liệu/Code%20gốc/android/app/src/main/java/com/ntv/quanlykho/MainActivity.java), một đối tượng Java có tên `AndroidNative` được gắn trực tiếp vào `window` của WebView:

```javascript
// 1. Lưu file vào thư mục Download của điện thoại
window.AndroidNative.saveFileToDownload(fileName, base64Data, mimeType);

// 2. Chia sẻ file qua hộp thoại hệ thống Android
window.AndroidNative.shareFile(fileName, base64Data, mimeType);

// 3. Giữ màn hình luôn sáng trong ca quét (tránh tắt màn hình khi đang làm việc)
window.AndroidNative.setKeepScreenOn(true / false);

// 4. Rung phản hồi haptic
window.AndroidNative.vibrate(70); // 70 mili-giây

// 5. Thoát ứng dụng có sao lưu an toàn
window.AndroidNative.exitApp();
```

---

## 9. QUY TRÌNH PHÁT TRIỂN & TRIỂN KHAI (DEVOPS & DEPLOY)

Mỗi lần có bất kỳ chỉnh sửa code nào, **BẮT BUỘC** thực hiện tuần tự theo quy trình 5 bước sau:

```
[ Chỉnh sửa Code ] ──> [ 1. Kiểm tra Cú pháp ] ──> [ 2. Nâng Phiên Bản ]
                                                          │
[ 5. Tải APK mới ] <── [ 4. Push main & gh-pages ] <── [ 3. node build-web.js ]
```

### Bước 1: Kiểm Tra Cú Pháp Bắt Buộc (Syntax Check)
Tuyệt đối không push code nếu chưa chạy lệnh kiểm tra cú pháp:
```bash
node -c app.js; node -c quetqr.js; node -c cx1.js; node -c cx5.js; node -c btp.js; node -c kiemke.js; node -c tonkho.js; node -c scanner-core.js; node -c sw.js
```

### Bước 2: Nâng Phiên Bản (Version Bumping)
Phải tăng phiên bản ở cả 3 vị trí để tránh kẹt cache trình duyệt và cho phép cài đè APK:
1. `sw.js`: Tăng `CACHE_NAME` (ví dụ: `'kho-cache-v153'` $\rightarrow$ `'kho-cache-v154'`).
2. `android/app/build.gradle`: Tăng `versionCode` thêm +1 (ví dụ: `131` $\rightarrow$ `132`) và cập nhật `versionName` (ví dụ: `"2.30"` $\rightarrow$ `"2.31"`).
3. `index.html`: Cập nhật chuỗi tham số phiên bản ở link CSS và Script (ví dụ: `?v=20261103-v154`).

### Bước 3: Đồng Bộ Tài Nguyên Web Sang Android
Chạy script tự động:
```bash
node build-web.js
```
*Lệnh này sẽ copy toàn bộ code tĩnh sang `www/` (Web) và `android/app/src/main/assets/public/` (APK), đồng thời tự động kiểm tra chốt chặn Java 17.*

### Bước 4: Commit & Push Đồng Thời Cả 2 Nhánh
- Bản APK được GitHub Actions build từ nhánh `main`.
- Web PWA được GitHub Pages deploy từ nhánh `gh-pages`.
```bash
git add .
git commit -m "feat/fix: mô tả nội dung thay đổi v..."
git push origin main
git checkout gh-pages
git merge main
git push origin gh-pages
git checkout main
```

### Bước 5: Nhận File APK Tự Động
- Sau khi push lên `main`, GitHub Actions sẽ tự động biên dịch APK trong khoảng 1.5 – 2 phút.
- File APK thành phẩm được tự động phát hành tại GitHub Release tag `app-latest`:
  `https://github.com/trungvuong3xx/Quan-ly-kho/releases/download/app-latest/QuanLyKho.apk`

---

## 10. HƯỚNG DẪN THIẾT LẬP MÔI TRƯỜNG MỚI TỪ ĐẦU (SETUP FROM SCRATCH)

Khi chuyển sang máy tính mới:

### 1. Yêu Cầu Cài Đặt Phần Mềm:
- **Node.js**: Phiên bản LTS (Khuyến nghị Node 20.x hoặc mới hơn).
- **Git**: Cài đặt Git for Windows.
- **Java JDK**: **BẮT BUỘC Java 17** (Ví dụ: Eclipse Temurin JDK 17). *Không cài đặt hoặc cấu hình Java 21 làm biến môi trường mặc định!*
- **Android Studio** (Tùy chọn, chỉ cần nếu muốn build APK offline tại máy thay vì dùng GitHub Actions).

### 2. Kéo Mã Nguồn & Cài Đặt Gói:
```bash
git clone https://github.com/trungvuong3xx/Quan-ly-kho.git
cd Quan-ly-kho
npm install
```

### 3. Chạy Môi Trường Thử Nghiệm:
- **Chạy Web cục bộ**: Có thể dùng bất kỳ máy chủ tĩnh nào (VS Code Live Server, `npx serve .`, hoặc `python -m http.server 8080`).
- **Build APK thủ công trên máy (nếu có Android SDK)**:
  ```bash
  node build-web.js
  cd android
  ./gradlew assembleDebug
  ```
  File APK đầu ra sẽ nằm tại: `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 11. KINH NGHIỆM DEBUG & XỬ LÝ SỰ CỐ

1. **Cách Debug trực tiếp WebView trên điện thoại**:
   - Cắm điện thoại vào máy tính bằng cáp USB, bật chế độ "Gỡ lỗi USB" (USB Debugging) trong Cài đặt nhà phát triển.
   - Mở trình duyệt Google Chrome trên máy tính, truy cập: `chrome://inspect/#devices`.
   - Bấm **Inspect** ứng dụng "Quản Lý Kho" để xem toàn bộ `console.log`, kiểm tra `Network`, `IndexedDB`, và `localStorage` theo thời gian thực.
2. **Khôi phục dữ liệu khi có sự cố**:
   - Mở App $\rightarrow$ Vào tab **Cài đặt** $\rightarrow$ Bấm **Khôi phục dữ liệu**.
   - Chọn file `QuanLyKho_AutoBackup.json` trong thư mục `Download` của máy. App sẽ nạp lại toàn bộ lịch sử và hàng chờ.
3. **Mã QR tem in bị mờ hoặc chết kim in nhiệt**:
   - Nếu tem bị sọc trắng đứt nét ngang: Bật đèn Flash trong app, giữ khoảng cách 15–20cm.
   - Vệ sinh hoặc thay thanh nhiệt máy in tem tại xưởng; thiết lập phần mềm in tem sang mức sửa lỗi **Level M hoặc Q (15% - 25%)**.

---
*Tài liệu được cập nhật và kiểm chuẩn tự động cho hệ thống Quản Lý Kho v2.30+.*
