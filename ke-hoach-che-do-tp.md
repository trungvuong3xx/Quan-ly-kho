# 📋 Kế Hoạch Kỹ Thuật Toàn Diện: Module Thành Phẩm (TP) & Tái Cấu Trúc Camera (Bản rà soát v5 — 20/11/2026)

> Kế hoạch triển khai đã đối chiếu mã nguồn ngày 20/11/2026. Giữ lộ trình 4 giai đoạn; bổ sung an toàn lưu trữ, phục hồi backup, xác nhận kết quả xuất Excel, vòng đời camera và kiểm thử lỗi. Đây là đặc tả cần triển khai, không phải xác nhận các tính năng đã tồn tại hoặc đã chạy trên điện thoại.
>
> Các hàm TP, thuộc tính cấu hình bổ sung và thay đổi hợp đồng xuất Excel dưới đây là phần phải xây dựng. API dùng chung hiện có phải được đối chiếu lại khi triển khai. Số dòng chỉ là mốc tham khảo; tìm theo tên hàm. Không tự thêm đồng bộ TP lên Google Sheets trong phạm vi này.

---

## 1. Danh Sách File Tác Động Thực Tế

| Phân loại | Tên File | Vai trò & Nội dung can thiệp |
| :--- | :--- | :--- |
| **TẠO MỚI** | **tp.js** | Module Thành Phẩm độc lập:<br>• *Giai đoạn 2*: Quét camera, thẩm định tem 5 dòng chặt chẽ, `parseKgTP` (xử lý dấu phẩy), chống trùng Dòng 1, Live Log & Bảng tổng hợp (bỏ chữ "kg" và bỏ chữ "bao" ở các dòng tổng), xuất Excel 2 cột, phiên dở dang (`localStorage`), ghi ngầm lịch sử `tp_lich_su` qua `ScannerCore.docLichSu` / `ScannerCore.luuLichSu` (debounce 1000ms có lưu ngay ở mốc chuyển trạng thái; chỉ dọn phiên đã xuất, quá 30 ngày và không đang hoạt động).<br>• *Giai đoạn 3*: Toàn bộ giao diện & nghiệp vụ Lịch Sử TP (`renderLichSuTP`, `xuatExcelPhienLichSuTP`, `xoaMotPhienLichSuTP`, `tiepTucTuLichSuTP`). |
| **SỬA** | **app.js** | • *Giai đoạn 1*: Tái cấu trúc toàn bộ các vị trí hardcode camera sang bảng `CAMERA_CONFIG_MAP` duy nhất (bao gồm `pausedFlag`, `resumeFallback`). Hoàn thiện cơ chế `giuDen: false`: reset `denPinMap[vid] = false`, `denPinGiuMap[vid] = false` và gọi `capNhatNutDenPin(vid, false)` khi tắt track thật.<br>• *Giai đoạn 2*: Thêm `tp-reader` vào `CAMERA_CONFIG_MAP`.<br>• *Giai đoạn 3*: Bổ sung nhánh `loai === 'tp'` trong `moLichSuChon(loai)` và kích hoạt `renderLichSuTP()` khi vào trang `lichSuTP` trong `chuyenTrangKhongNav`. **Bổ sung** hai khóa `tp_lich_su`, `tp_phien_dodang` vào whitelist phục hồi `isAllowedKey`; bộ thu thập backup nhận được TP nhưng whitelist hiện tại loại TP. Mở rộng `exportToExcel` trả kết quả bất đồng bộ; tích hợp lưu TP trước backup/thoát/cập nhật PWA và hoàn thiện `khoiPhucCamera`. |
| **SỬA** | **scanner-core.js** | • *Giai đoạn 2*: Thêm `'tp_lich_su'` vào hằng số `HISTORY_KEYS` (dòng 15) để lưu lịch sử TP vào IndexedDB + RAM cache. Tích hợp trạng thái sẵn sàng, thông báo lịch sử đã nạp; sử dụng `whenReady()`, `isLoaded()`, sự kiện `scannercore:history-ready`, `whenIdle()` đúng giới hạn ở Mục 7. Xóa toàn bộ qua `xoaLichSu`. Không chỉ thêm khóa rồi coi tích hợp đã hoàn tất. |
| **SỬA** | **index.html** | • *Giai đoạn 2*: Thêm Card "Thành Phẩm (TP)" ở Trang Chủ (`#trangChu`), khung giao diện `#tpPage` (`#tp-cam` & `#tp-ketqua`), nhúng thẻ script `<script src="tp.js" defer></script>`.<br>• *Giai đoạn 3*: Thêm tùy chọn "Lịch sử Thành Phẩm (TP)" vào Modal Lịch Sử chung (`#modal-overlay`), thêm trang Lịch Sử TP riêng biệt `#lichSuTP` (tìm kiếm, danh sách phiên, nút xuất Excel từng phiên, xóa). |
| **SỬA** | **style.css** | • *Giai đoạn 2*: Bổ sung các class dành riêng cho TP (`.tp-badge-bao`, `.tp-group-row`, `.tp-sub-item`, `.tp-chevron`), sử dụng biến màu CSS chung; bổ sung selector TP vào layout camera/log, vùng cuộn và theme đang liệt kê ID các module cũ. Giữ hành vi CSS của các module cũ. |
| **SỬA** | **sw.js** | • *Giai đoạn 2*: Thêm `'./tp.js'` vào `urlsToCache`, tăng `CACHE_NAME` từ phiên bản thực tế lúc phát hành (mốc rà soát: `kho-cache-v163`, dự kiến `kho-cache-v164`). |
| **SỬA** | **build-web.js** | • *Giai đoạn 2*: Thêm `'tp.js'` vào mảng `filesToCopy` để tự động sao chép sang `www/` và Android APK assets (`android/app/src/main/assets/public/`). |
| **SỬA** | **android/app/build.gradle** | • *Giai đoạn 2*: Tăng phiên bản từ giá trị thực tế khi phát hành (mốc rà soát: `versionCode 141`, `versionName "2.40"`; dự kiến `142` / `"2.41"`). Giữ Java 17, app ID và chữ ký cố định để cài đè giữ dữ liệu. |
| **SỬA** | **.github/workflows/build-apk.yml** | Thêm `'tp.js'` vào `on.push.paths`; giữ cấu hình Java 17 và quy trình build hiện có. |
| **SỬA / TẠO KHI TRIỂN KHAI** | **package.json và các file kiểm thử TP** | Bổ sung lệnh kiểm thử có ý nghĩa cho parser, thống kê, phiên/revision và tích hợp lưu/khôi phục; chọn tên file theo cấu trúc kiểm thử khi triển khai. |
| **GIỮ NGUYÊN** | **btp.js**, **kiemke.js**, **cx1.js**, **cx5.js**, **quetqr.js**, **tonkho.js** | Giữ nguyên 100% logic nghiệp vụ nội bộ của các module cũ. (Nhờ cờ `giuDen: false` và reset trạng thái đèn trong `app.js`, không cần can thiệp `kiemke.js`). |

---

## 2. Lộ Trình 4 Giai Đoạn Triển Khai Chuẩn Xác (Staged Roadmap)

* **Giai đoạn 1: Tái cấu trúc toàn diện hệ thống Camera trong `app.js` & Xử lý đèn pin Kiểm Kê**:
  1. Xây dựng bảng `CAMERA_CONFIG_MAP` gom toàn bộ 4 camera hiện có (`reader`, `cx1-reader`, `btp-reader`, `kk-reader`).
  2. Bổ sung các thuộc tính: `pageId`, `boxId`, `giuDen`, `pausedFlag`, `dungFn`, `resumeFallback`; bổ sung hook nhận reader sau phục hồi và ID nút đèn khi cần (chi tiết Mục 3.D).
  3. Quét sạch tất cả các vị trí hardcode camera trong `app.js` (danh sách chi tiết ở Mục 3).
  4. Hoàn thiện nhánh tắt track thật trong `dungCameraFast`: reset `denPinMap` và đồng bộ nút đèn pin về tắt khi `giuDen === false`.
  5. Chạy kiểm tra cú pháp `node -c app.js` và kiểm thử hồi quy các ca đã liệt kê trên cả 4 chế độ camera cũ (`quetqr`, `cx1`, `btp`, `kiemke`).

* **Giai đoạn 2: Triển khai Module Thành Phẩm Lõi (Core TP Module)**:
  1. Thêm cấu hình `tp-reader` vào `CAMERA_CONFIG_MAP` trong `app.js`.
  2. Thêm `'tp_lich_su'` vào `scanner-core.js` (`HISTORY_KEYS`).
  3. Bổ sung styling cho TP trong `style.css`.
  4. Tạo `tp.js` với các tính năng lõi:
     - Thẩm định tem 5 dòng chặt chẽ, `parseKgTP` (xử lý dấu phẩy), chống trùng Dòng 1.
     - Live Log (accordion nhóm QC) & Bảng tổng hợp (bỏ chữ "kg" và bỏ chữ "bao" ở các dòng tổng).
     - Quản lý phiên dở dang qua `localStorage` (`tp_phien_dodang`) với debounce 300ms.
     - Xuất Excel chuẩn 2 cột (`Thời gian`, `Mã QR Gốc`) tương thích cả Android APK và Web PWA.
     - **Lưu lịch sử ngầm tối thiểu (`luuVaoLichSuTP`)**: Dùng `ScannerCore.docLichSu` / `ScannerCore.luuLichSu` với debounce 1000ms khi quét và lưu ngay khi dừng/rời trang, chỉ tự dọn phiên đã xuất, quá 30 ngày theo `capNhatLuc` và không đang hoạt động. Có xử lý lỗi/quota và lưu ngay theo Mục 7.F; không cam kết chống mất dữ liệu tuyệt đối khi tiến trình bị tắt trước lúc ghi.
  5. Bổ sung Card Trang Chủ và màn hình `#tpPage` trong `index.html`.
  6. Tích hợp whitelist phục hồi, lưu trước backup/reload/thoát, kết quả xuất Excel và CSS camera/log TP.
  7. Thêm TP vào `sw.js`, `build-web.js`, bộ lọc CI. Tăng cache/APK version từ phiên bản thực tế trước phát hành, không tăng lặp ở từng giai đoạn nếu chưa phát hành.

* **Giai đoạn 3: Triển khai Giao Diện Lịch Sử TP & Nạp Lại Phiên**:
  1. Bổ sung mục "Lịch sử Thành Phẩm (TP)" vào Modal Lịch Sử chung trên Trang Chủ.
  2. Thêm giao diện trang `#lichSuTP` trong `index.html` (ô tìm kiếm `#lichsu-tp-tim`, danh sách card `#lichsu-tp-list`, nút xuất Excel tất cả, nút xóa tất cả).
  3. Cập nhật `app.js`: thêm nhánh `loai === 'tp'` trong `moLichSuChon(loai)` và gọi `renderLichSuTP()` khi vào trang `lichSuTP`.
  4. Hoàn thiện toàn bộ tương tác Lịch Sử TP trong `tp.js`:
     - Render danh sách thẻ phiên (tính toán `tongBao`, `tongKg`, `gomNhom` động lúc hiển thị, không lưu thừa trong database).
     - Xuất lại Excel 2 cột cho riêng 1 phiên từ lịch sử (`xuatExcelPhienLichSuTP`).
     - Xóa 1 phiên / xóa tất cả lịch sử (có xác nhận `moXacNhanApp`).
     - **Cơ chế nạp lại phiên để quét tiếp (`tiepTucTuLichSuTP`)**: giữ nguyên `idPhien`, hỏi xác nhận nếu đang có phiên dở dang khác, dựng lại Set chống trùng, tự động đặt `daXuatExcel: false` khi có biến động dữ liệu.

* **Giai đoạn 4: Kiểm thử toàn diện, Build APK & Deploy**:
  1. Thực hiện đầy đủ 9 nhóm kịch bản trong Test Plan (Mục 9).
  2. Chạy kiểm tra cú pháp `node -c` toàn bộ file JS.
  3. Chạy `node build-web.js` sao chép sang `www/` và Android APK assets.
  4. Khi thực hiện đợt triển khai: commit/push `main`, đồng bộ `gh-pages`; theo dõi CI build APK thành công và kiểm tra artifact. Kiểm tra cài đè giữ dữ liệu trên thiết bị thật. Việc chỉnh tài liệu kế hoạch không thực hiện các thao tác này.

---

## 3. Tái Cấu Trúc Toàn Diện Hệ Thống Camera (CAMERA_CONFIG_MAP) trong app.js

### A. Bảng cấu hình hợp nhất duy nhất
Thay vì rải rác danh sách camera cứng ở nhiều nơi, toàn bộ đọc từ `CAMERA_CONFIG_MAP`:

> Bảng dưới là cấu hình nền; khi triển khai phải bổ sung hook đồng bộ reader/trạng thái nêu ở Mục 3.D, không sao chép bảng này rồi bỏ qua các nhánh phục hồi.

```javascript
const CAMERA_CONFIG_MAP = {
  'reader': { 
    pageId: 'quetQR', 
    boxId: 'qr-cam', 
    giuDen: true, 
    pausedFlag: 'dangQuetQR',
    dungFn: () => (typeof dungQuet === 'function' && dungQuet()),
    resumeFallback: (txt) => { if (txt && window.dangQuetQR && typeof window.khiQuetDuocMaQR === 'function') window.khiQuetDuocMaQR({ getText: () => txt }); }
  },
  'cx1-reader': { 
    pageId: 'chiFor', 
    boxId: 'cx1-cam', 
    giuDen: true, 
    pausedFlag: 'dangQuetCX1',
    dungFn: () => (typeof dungCX1 === 'function' && dungCX1()),
    resumeFallback: (txt) => { if (txt && window.dangQuetCX1 && typeof window.khiQuetDuocMa === 'function') window.khiQuetDuocMa({ getText: () => txt }); }
  },
  'btp-reader': { 
    pageId: 'btpPage', 
    boxId: 'btp-cam', 
    giuDen: true, 
    pausedFlag: 'dangQuetBTP',
    dungFn: () => (typeof dungBTP === 'function' && dungBTP()),
    resumeFallback: (txt) => { if (txt && window.dangQuetBTP && typeof window.khiQuetDuocMaBTP === 'function') window.khiQuetDuocMaBTP({ getText: () => txt }); }
  },
  'kk-reader': { 
    pageId: 'kiemKe', 
    boxId: 'kk-cam', 
    giuDen: false, // Kiểm kê kết thúc phiên là tắt hẳn, không giữ stream làm đèn pin
    pausedFlag: null, // Kiểm kê không có cờ tạm dừng dạng này
    dungFn: () => (typeof dungKiemKe === 'function' && dungKiemKe()),
    // Kiểm kê hiện nhận mã trong callback nội bộ; phục hồi dùng lastCameraCallbackMap.
    resumeFallback: null
  },
  'tp-reader': { 
    pageId: 'tpPage', 
    boxId: 'tp-cam', 
    giuDen: true, 
    pausedFlag: 'dangQuetTP',
    dungFn: () => (typeof dungTP === 'function' && dungTP()),
    resumeFallback: (txt) => { if (txt && window.dangQuetTP && typeof window.khiQuetDuocMaTP === 'function') window.khiQuetDuocMaTP({ getText: () => txt }); }
  }
};
```

### B. Danh sách toàn bộ các vị trí được chuẩn hóa sang đọc bảng
1. **`onGlobalCameraInteraction` (dòng ~643)**: Duyệt qua `Object.entries(CAMERA_CONFIG_MAP)` thay vì 2 mảng/map cứng.
2. **`danhThucCamera` (dòng ~773-782)**: Ưu tiên callback đã lưu; chỉ lấy `CAMERA_CONFIG_MAP[videoId]?.resumeFallback` khi thiếu callback, theo Mục 3.D.
3. **`tatDenPinKhiRoiTab(idTrangMoi)` (dòng ~631)**: So khớp với `CAMERA_CONFIG_MAP[vid].pageId`.
4. **`triggerResumeCamera` (dòng ~2115)**:
   - Mảng `camBoxes` đọc trực tiếp từ `CAMERA_CONFIG_MAP`.
   - `isPausedByUser` kiểm tra tổng quát qua `pausedFlag`:
     ```javascript
     const cfg = CAMERA_CONFIG_MAP[item.vid];
     const isPausedByUser = cfg?.pausedFlag ? (window[cfg.pausedFlag] === false) : false;
     ```
   - Vòng lặp đồng bộ nút đèn pin ở cuối hàm duyệt theo `Object.keys(CAMERA_CONFIG_MAP)` thay vì mảng cứng.
5. **`ngatTatCaCamera` (dòng ~2154)**: Duyệt `Object.keys(CAMERA_CONFIG_MAP)` để giải phóng toàn bộ phần cứng.
6. **`chuyenTrang(id)` / `chuyenTrangKhongNav(id)` (dòng ~395, ~437)**: Duyệt `CAMERA_CONFIG_MAP`: nếu `config.pageId !== id` thì gọi `config.dungFn()`.

7. **`khoiPhucCamera` (hiện dòng ~2076)**: Chuẩn hóa nhánh gán reader và trạng thái quét sau phục hồi. Giữ đồng bộ biến `let` của module và thuộc tính `window` mà các đường gọi hiện dùng.
8. **`capNhatNutDenPin`**: Đưa ID nút mặc định vào cấu hình nếu cần, vẫn giữ tra cứu nút đã đăng ký qua HUD. Rà soát `doiCameraNhanh` để không bỏ sót nhánh thông báo riêng theo video ID.

### C. Cơ chế `giuDen: false` và Reset Trạng Thái Đèn Pin Hoàn Chỉnh
Trong hàm `dungCameraFast(videoId, zxingReaderObj)`:
1. **Điều kiện giữ stream**:
   ```javascript
   const config = CAMERA_CONFIG_MAP[videoId];
   const coTheGiuDen = config ? config.giuDen !== false : true;
   const trackDen = videoEl && videoEl.srcObject && videoEl.srcObject.getVideoTracks ? videoEl.srcObject.getVideoTracks()[0] : null;

   if (denPinMap[videoId] && coTheGiuDen && trackDen && trackDen.readyState === 'live') {
     denPinGiuMap[videoId] = true;
     return; // Chỉ giữ stream nếu camera được phép giữ đèn (không phải Kiểm Kê)
   }
   ```
2. **Nhánh dừng thật (tắt track camera)**:
   ```javascript
   if (videoEl && videoEl.srcObject) {
     videoEl.srcObject.getTracks().forEach(t => t.stop());
     videoEl.srcObject = null;
   }
   // BẢO VỆ: Nếu track camera đã tắt hẳn (như Kiểm Kê), BẮT BUỘC reset trạng thái đèn pin và đồng bộ nút về tắt
   denPinMap[videoId] = false;
   denPinGiuMap[videoId] = false;
   capNhatNutDenPin(videoId, false);
   ```

### D. Hợp đồng phục hồi và chống mở camera sau khi rời trang
- Bổ sung hook cấu hình nhận reader mới (thuộc tính mới cần triển khai), đồng bộ đúng biến reader mà hàm dừng của từng module dùng. Không chỉ gán `window.zxingReader...` khi module còn đọc biến `let` riêng.
- Phục hồi ưu tiên `lastCameraCallbackMap[videoId]`; fallback chỉ dùng hàm thực sự tồn tại. Kiểm kê hiện không có hàm toàn cục `xuLyMaKiemKe`; không đưa tên này vào cấu hình như API có sẵn. Nếu mất callback thì báo lỗi/cho khởi động lại, không âm thầm mở camera không có xử lý mã.
- Khóa các yêu cầu khởi động trùng. Sau mỗi thao tác mở camera bất đồng bộ, kiểm tra lại trang đang hiển thị, trạng thái quét và thế hệ yêu cầu; yêu cầu đã bị hủy phải dừng decoder/track vừa nhận, không gán lại vào phiên mới.
- TP dùng một nguồn trạng thái quét nhất quán; nếu xuất ra `window` để core đọc thì phải đồng bộ ở mọi đường bắt đầu, dừng, lỗi, phục hồi.
- Phân biệt tạm dừng giữ đèn, dừng hoàn toàn và tạm ngắt do app chạy nền. Dừng hoàn toàn reset cả hai map và nút đèn kể cả khi một map đã sai lệch; chạy nền có thể giữ ý định bật đèn để phục hồi phiên đang quét, nhưng không tự tiếp tục phiên người dùng đã dừng.
- `tatDenPinHoanToan` hiện không tự dừng track đang quét trong mọi trường hợp: khi xem kết quả/kết thúc phải gọi cùng luồng dừng decoder và camera. Giữ các tác dụng phụ điều hướng hiện có như tải QC BTP, quản lý `cam-active` và ghi batch Kiểm kê.

---

## 4. Khuôn Mẫu Đèn Pin Chuẩn cho tp.js

Tái sử dụng khuôn mẫu đèn pin hiện có và nghiệm thu trên thiết bị thật:
* Nút đèn trên HUD gọi: `onclick="toggleFlashlightHUD('tp-reader', this)"`.
* Hàm khởi động/tiếp tục camera trong `tp.js`:
  ```javascript
  const isCamRunningTP = track && track.readyState === 'live' && !(window.denPinGiuMap && window.denPinGiuMap['tp-reader']);
  ```
* Gọi `tatDenPinHoanToan('tp-reader')` khi kết thúc phiên, xem kết quả hoặc chuyển sang trang khác.

---

## 5. Bóc Tách Dữ Liệu, Thẩm Định Tem & Khóa Chống Trùng

### A. Định dạng tem chuẩn (5 dòng)
```text
5BFN1388                                        --> Dòng 1: Mã vạch ID định danh (tính trùng)
21B3021A017                                     --> Dòng 2: Mã kiện (lưu trữ)
1                                               --> Dòng 3: Số PCS (phải là số nguyên)
Luoi cao                                        --> Dòng 4: Tên hàng (lưu trữ)
021/78 x 35mm x 300MD x 14M (Bac ) 56.4000     --> Dòng 5: QC đủ & Khối lượng
```

### B. Thẩm định tem chặt chẽ & Tách Quy Cách / Khối Lượng
Một mã quét vào chỉ được chấp nhận là tem TP khi thỏa mãn đồng thời:
1. Có đúng 5 dòng sau khi chuẩn hóa bỏ `\r` và dòng trống: `const lines = rawText.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);`.
2. Dòng 1 không rỗng (chứa mã vạch ID).
3. Dòng 3 là chuỗi số nguyên: `/^\d+$/.test(lines[2])`.
4. **Dòng 5 thẩm định chặt chẽ**:
   - Sử dụng regex bóc tách 2 phần: phần Quy cách (phải chứa `x`) và phần Khối lượng (ở cuối dòng):
     ```javascript
     const matchD5 = lines[4].match(/^(.+?)\s+([\d]+(?:[.,]\d{1,4})?)\s*$/);
     ```
   - Điều kiện: `matchD5` tồn tại, phần QC `matchD5[1]` có chứa ký tự `x` (hoặc `X`), và phần khối lượng `matchD5[2]` vượt qua toàn bộ kiểm tra hữu hạn, độ chính xác và miền an toàn ở Mục 5.C, có giá trị `> 0`.
* Nếu vi phạm bất kỳ điều kiện nào: Từ chối nhận, phát âm thanh lỗi + rung lỗi + thông báo: `"Mã không đúng định dạng tem Thành Phẩm (5 dòng)!"`.

### C. Hàm `parseKgTP` & Xử Lý Khối Lượng Chống Sai Lệch Dấu Phẩy & Số Thực
* **Độ chính xác**: nhận số dương, tối đa 4 chữ số thập phân; dấu `,` và `.` đều là dấu thập phân. Không nhận dấu phân cách hàng nghìn, ký hiệu khoa học, số âm, `NaN`, `Infinity` hay chuỗi có hậu tố. Không tự làm tròn tem có hơn 4 số lẻ: báo lỗi định dạng khối lượng.
* `parseKgTP` là hàm mới cần triển khai: kiểm tra toàn chuỗi trước khi đổi sang số, kiểm tra `Number.isFinite`, và bảo đảm khối lượng quy đổi theo đơn vị 1/10000 nằm trong miền số nguyên an toàn. Dữ liệu lỗi trả kết quả không hợp lệ để từ chối, không đổi thành `0` rồi nhận vào phiên.
* Tách phần nguyên/thập phân để tạo số nguyên theo đơn vị 1/10000 từ chuỗi đã hợp lệ. Cộng bằng số nguyên; kiểm tra tổng cũng không vượt `Number.MAX_SAFE_INTEGER`. Cùng một quy tắc áp dụng khi quét, phục hồi và tính thống kê.
* `kg` lưu số đã chuẩn hóa; tổng và hiển thị lấy cùng giá trị chuẩn hóa. `formatKgTP` hiển thị tối thiểu 1, tối đa 4 chữ số lẻ, bỏ số 0 thừa, không có chữ `kg`: `56.4`, `432.0`, `56.45`.
* Trường hợp `0.00001` phải bị từ chối; không được nhận thành công rồi cộng tổng thành `0`.

### D. Đồng Bộ Hàm Tiếp Nhận Mã `khiQuetDuocMaTP`
Để tương thích hoàn hảo với cả ZXing trả về đối tượng `{ getText: () => txt }` và chuỗi văn bản thuần:
```javascript
function khiQuetDuocMaTP(res) {
  const rawText = (typeof res === 'object' && res && typeof res.getText === 'function') 
    ? res.getText() 
    : String(res || '');
  if (!rawText.trim()) return;
  // Chặn nếu TP đã dừng/rời trang hoặc callback thuộc yêu cầu camera cũ.
  // Tiến hành thẩm định và xử lý mã...
}
window.khiQuetDuocMaTP = khiQuetDuocMaTP;
```

### E. Khóa chống trùng trong phiên
* Lấy chuỗi ở Dòng 1 (`id = lines[0]`).
* Chỉ kiểm tra trùng trong phiên hiện tại (duy trì qua một `Set` các mã Dòng 1: `tapMaDaQuetTP`).
* Không kiểm tra trùng với các phiên cũ trong lịch sử.
* ID là chuỗi đã trim, giữ số 0 đầu; so sánh phân biệt hoa/thường theo nội dung tem. Không tự chuyển chữ hoa/thường cho khóa nghiệp vụ.
* Ngoài Set chống trùng, dùng `ScannerCore.kiemTraKhoaMa` / `khoaCanhBaoTrung` để tránh rung/toast lặp theo từng frame, kể cả mã sai định dạng. Khóa này chỉ giảm tần suất phản hồi, không thay thế Set.
* `raw` lưu nguyên văn đầu vào; chuẩn hóa dòng chỉ trên bản dùng để parse. Nội dung QR và dữ liệu backup phải được escape khi hiển thị bằng HTML; ưu tiên `textContent`, không ghép ID/QC vào chuỗi `onclick`.

---

## 6. Giao Diện & Styling (style.css, Live Log, Bảng Chi Tiết, Bảng Tổng Hợp)

### A. Tác động CSS (`style.css`)
- Bổ sung các class dành riêng cho TP: `.tp-badge-bao`, `.tp-group-row`, `.tp-sub-item`, `.tp-chevron`.
- Bổ sung selector TP cho `body.cam-active`, khung camera, con trực tiếp của khung, log container/list và nền trang quét (các vùng hiện liệt kê ID BTP/CX1/QR). Kiểm tra cuộn log độc lập, không che nút điều khiển khi xoay màn hình.
- Sử dụng bảng màu và cấu trúc responsive có sẵn trong `style.css` (biến CSS `--bg-body`, `--border`, `--text-main`, `--primary`).

### B. Live Log & Bảng Chi Tiết (Khớp Mockup)
```text
┌─────────────────────────────────────────────────────────────┐
│ STT   QC                                   BAO     KG       │
├─────────────────────────────────────────────────────────────┤
│  1    021/78 x 35mm x 300MD x 14M (Bac )     ×2     112.8   │ ▼
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 1. 5BFN1388  56.4  10:15  [X]                          │ │
│  │ 2. 5BFN1389  56.4  10:16  [X]                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```
* Dòng nhóm: `STT | QC đủ | Badge Số bao (×...) | Khối lượng (không có chữ kg) | Chevron ▼`.
* Dòng con xổ xuống: `<STT_con>. <Mã vạch Dòng 1>  <Khối lượng>  <Giờ:phút>  [X]`.
* Xóa mã: Bấm [X] ở dòng con -> cập nhật lại tổng bao và kg của nhóm; nếu nhóm hết mã -> xóa nhóm. Mã bị xóa được phép quét lại trong phiên.

### C. Giới hạn Live Log và cập nhật DOM
- Live Log chỉ render tối đa 30 mã mới nhất, nhóm theo QC; số bao/kg của nhóm vẫn tính trên toàn bộ dữ liệu phiên. Ghi rõ đang hiển thị một phần; bảng chi tiết ở màn hình kết quả cho phép xem/xóa các mã cũ.
- Cập nhật nhóm/dòng bị thay đổi khi quét; không dựng lại toàn bộ DOM mỗi frame/mã. Giữ trạng thái mở nhóm và vị trí cuộn; nút [X] phải chặn sự kiện lan lên thao tác mở/đóng nhóm.
- Dữ liệu tính tổng trong RAM không bị cắt theo giới hạn hiển thị. Khi mở chi tiết lớn, phân trang/tải thêm thay vì render không giới hạn.

### D. Bảng Tổng Hợp (Màn hình Kết quả)
```text
┌──────────────────────────────────────────────┬────────┬──────────┐
│ QC                                           │  BAO   │    KG    │
├──────────────────────────────────────────────┼────────┼──────────┤
│ 021/78 x 35mm x 300MD x 14M (Bac )           │   12   │  676.8   │
│ 021/78 x 40mm x 400MD x 20M (Xanh )          │    8   │  432.0   │
├──────────────────────────────────────────────┼────────┼──────────┤
│ TỔNG                                         │   20   │  1108.8  │
└──────────────────────────────────────────────┴────────┴──────────┘
```
* Toàn bộ bảng, đặc biệt là dòng **TỔNG**, tuyệt đối **không có chữ "bao"** và **không có chữ "kg"** (chỉ hiển thị con số thuần túy: cột BAO là `20`, cột KG là `1108.8`).

---

## 7. Quản Lý Phiên, Lưu Trữ & Hệ Thống Lịch Sử TP Toàn Diện

### A. Quản lý phiên dở dang
* Lưu vào `localStorage` với khóa `tp_phien_dodang` qua debounce 300ms.
* Cấu trúc lưu phiên dở dang: `{ idPhien, ngay, capNhatLuc, daXuatExcel, revision, items }`.
* `ngay` là ISO thời điểm tạo, giữ nguyên suốt vòng đời phiên. `revision` là số nguyên tăng mỗi lần thêm/xóa mã; không tăng khi chỉ render/lưu lại. `capNhatLuc` chỉ đổi khi dữ liệu/trạng thái phiên thực sự thay đổi, không gán thời gian mới mỗi lần đọc hoặc ghi lại cùng dữ liệu.
* Khi tải lại trang: khôi phục danh sách mã đã quét, khôi phục trạng thái `daXuatExcelTP`, và dựng lại `Set` các mã Dòng 1 (`tapMaDaQuetTP`) để chống trùng tức thì.
* Cảnh báo khi Bắt đầu phiên mới: Nếu phiên đang có dữ liệu mà chưa bấm xuất Excel -> hiện hộp thoại xác nhận:
  *"Phiên quét hiện tại có [X] mã chưa xuất Excel! Bạn có chắc muốn tạo phiên mới?"*.

### B. Khóa lưu trữ Lịch Sử & Tối Ưu Tần Suất Ghi (IndexedDB)
* **Khóa lưu trữ**: `TP_LICHSU_KEY = "tp_lich_su"`.
* **API ScannerCore chuẩn xác**:
  - Đọc danh sách: `ScannerCore.docLichSu('tp_lich_su')` *(scanner-core.js không có hàm layLichSu)*.
  - Ghi danh sách: `ScannerCore.luuLichSu('tp_lich_su', list)` (tham số thứ 2 là mảng; có thể truyền callback lỗi quota ở tham số 3).
  - Hàm ghi hiện trả về ngay, không phải Promise xác nhận commit. `whenIdle()` chờ các tác vụ mà core theo dõi, không phải tín hiệu đảm bảo ghi thành công; `whenReady()` có timeout nên không thay thế kiểm tra `isLoaded()`.
  - Khi IndexedDB chưa nạp xong, core có cơ chế gộp dữ liệu và mirror localStorage. Không cho dọn/xóa dựa trên danh sách chưa đầy đủ. UI có trạng thái đang nạp và cập nhật lại khi `scannercore:history-ready` phát ra; tránh listener lặp.
  - Thêm thông báo/render TP vào cơ chế lịch sử sẵn sàng (hoặc listener TP tương đương). Nếu lưu thất bại phải báo rõ và giữ RAM/phiên dở dang để người dùng thử lại hoặc xuất file.
* **Tần suất ghi lịch sử thông minh (Tránh ghi IndexedDB sau từng mã lẻ)**:
  - Khi quét liên tục: Cập nhật RAM `phienTP` tức thì (0ms), ghi debounce 300ms vào `localStorage` (`tp_phien_dodang`), và ghi debounce 1000ms vào `tp_lich_su`.
  - Ghi IndexedDB ngay lập tức tại các mốc then chốt:
    1. Khi bấm tạm dừng quét hoặc bấm Xem kết quả.
    2. Khi chuyển tab hoặc rời khỏi trang (`chuyenTrangKhongNav`).
    3. Khi bấm Xuất Excel.
    4. Khi xóa một mã hoặc nạp lại phiên.

### C. Cấu trúc bản ghi phiên Tinh Gọn (Không lưu thừa dữ liệu tính toán)
Để tối ưu dung lượng và tránh sai lệch dữ liệu, cơ sở dữ liệu **chỉ lưu danh sách mã gốc**, các trường thống kê (`tongBao`, `tongKg`, `gomNhom`) được hàm `tinhThongKePhienTP(danhSach)` tính toán động lúc hiển thị:

```javascript
{
  idPhien: "TP_<timestamp>_<random>",  // Minh họa ID có timestamp và phần ngẫu nhiên
  ngay: "2026-11-20T09:30:00.000Z",     // ISO Date lúc tạo phiên
  capNhatLuc: "2026-11-20T11:28:00.000Z",// ISO Date lần sửa đổi gần nhất (dùng để lọc 30 ngày)
  thoiGian: "20/11/2026 09:30:00",      // Thời gian hiển thị lúc tạo
  daXuatExcel: false,                   // Trạng thái của đúng revision đã xuất
  revision: 1,                          // Tăng khi thêm/xóa mã
  danhSach: [                           // Danh sách chi tiết các mã quét trong phiên
    {
      id: "5BFN1388",
      maKien: "21B3021A017",
      pcs: 1,
      tenHang: "Luoi cao",
      qcDu: "021/78 x 35mm x 300MD x 14M (Bac )",
      kg: 56.4,
      thoiGian: "2026-11-20 09:30:15",
      raw: "5BFN1388\n21B3021A017\n1\nLuoi cao\n021/78 x 35mm x 300MD x 14M (Bac ) 56.4000"
    }
  ]
}
```

* **Hợp đồng `tinhThongKePhienTP(danhSach)` cần triển khai**:
  - Đầu vào là danh sách đã được kiểm tra, bao gồm dữ liệu quét và dữ liệu phục hồi. Không âm thầm bỏ dòng lỗi hoặc biến khối lượng lỗi thành 0.
  - Trả `{ tongBao, tongKg, gomNhom }`; mỗi nhóm có `{ qcDu, soBao, tongKg, items }`. `tongBao` là số mã, không phải tổng PCS; mỗi mã TP được tính một bao.
  - Khóa nhóm lấy QC đầy đủ, gộp khoảng trắng, trim và chuyển chữ thường; giữ QC gốc của dòng đầu để hiển thị. Không gộp mất thông tin màu/kích thước trong QC.
  - Quy đổi từng khối lượng về số nguyên đơn vị 1/10000 theo Mục 5.C, kiểm tra miền an toàn trước mỗi lần cộng. Tổng nhóm và toàn phiên dùng cùng phép tính; chỉ đổi về số kg ở kết quả.
  - Thống kê không sửa `capNhatLuc`, `revision` hoặc ghi database. Không lưu lại các tổng/nhóm dẫn xuất vào bản ghi lịch sử.

### D. Dọn lịch sử 30 ngày, bảo vệ phiên chưa xuất
* Chỉ tự xóa khi đồng thời: `daXuatExcel === true`, không phải phiên đang hoạt động/dở dang, và `capNhatLuc || ngay` hợp lệ, đã quá 30 × 24 giờ.
* Giữ phiên chưa xuất, phiên đang hoạt động, phiên có ngày thiếu/sai; báo dữ liệu ngày lỗi nếu cần. Không gia hạn chỉ vì mở danh sách lịch sử.
* Chạy dọn sau khi dữ liệu lịch sử nạp đầy đủ; tách khỏi hàm đọc/render để đọc không gây tác dụng phụ. Nếu DB chưa sẵn sàng hoặc lỗi đọc thì hoãn dọn.
* Chỉ ghi lại khi danh sách thực sự thay đổi. Nếu dọn hết các phiên đủ điều kiện, dùng đường xóa rõ ràng của core; xóa toàn bộ theo yêu cầu người dùng dùng `ScannerCore.xoaLichSu('tp_lich_su')` sau xác nhận.
* Chính sách này thay cho v4 tự xóa mọi phiên quá hạn. Xóa thủ công vẫn được phép sau xác nhận, kể cả phiên chưa xuất, theo Mục 7.G.

### E. Đặc Tả Chi Tiết Cơ Chế "Nạp Lại Phiên Để Quét Tiếp" (`tiepTucTuLichSuTP`)
Khi người dùng bấm nút "Nạp lại / Quét tiếp" một phiên từ trang Lịch sử:
1. **Xử lý phiên đang dở dang (Hỏi xác nhận tránh mất dữ liệu)**:
   - Nếu phiên đang quét trên màn hình TP chính là phiên này (`idPhienHienTaiTP === idPhien`): Không hỏi lại; giữ dữ liệu RAM hiện tại, không nạp bản lịch sử cũ đè lên; chuyển sang trang `#tpPage` và tiếp tục qua luồng khởi động camera có khóa.
   - Nếu màn hình TP đang có một phiên KHÁC và **đang có mã** (`phienTP.length > 0`):
     - BẬT HỘP THOẠI XÁC NHẬN (`moXacNhanApp`):
       *"Phiên hiện tại đang có ${phienTP.length} mã! Bạn có muốn lưu phiên hiện tại và chuyển sang quét tiếp phiên lịch sử này không?"*
     - Nếu người dùng chọn **Đồng ý**:
       * Ngừng nhận mã, hủy cả timer lưu phiên và lịch sử; lưu ngay snapshot phiên hiện tại vào cả hai nơi. Nếu phát hiện lỗi lưu thì giữ phiên cũ và báo lỗi, không chuyển âm thầm.
       * Đọc lại phiên đích sau khi lịch sử sẵn sàng, kiểm tra còn tồn tại và hợp lệ; nạp bản sao dữ liệu, không dùng chung tham chiếu với bản ghi lịch sử.
     - Nếu người dùng chọn **Hủy**: Giữ nguyên trạng thái cũ, ở lại màn hình Lịch sử.
   - Nếu màn hình TP chưa có mã nào (`phienTP.length === 0`): Tự động nạp luôn phiên được chọn.
2. **Định danh phiên (`idPhien`)**:
   - **GIỮ NGUYÊN CÙNG `idPhien`**: `idPhienHienTaiTP = session.idPhien;` (KHÔNG sinh ID mới).
   - Khi quét thêm mã mới hoặc xuất Excel, hệ thống cập nhật trực tiếp vào đúng phiên này trong `tp_lich_su`, đảm bảo dữ liệu của một ca/lô hàng được gom trọn vẹn, không phân mảnh.
3. **Dựng lại Set chống trùng (`tapMaDaQuetTP`)**:
   - Làm sạch và nạp lại toàn bộ mã Dòng 1 (`id`) từ danh sách mã của phiên vào Set:
     ```javascript
     tapMaDaQuetTP.clear();
     phienTP.forEach(it => {
       if (it.id) tapMaDaQuetTP.add(it.id);
     });
     ```
   - Nhờ đó, bất kỳ mã nào đã quét trong phiên cũ khi đưa vào camera quét lại đều lập tức bị phát hiện và báo trùng!
4. **Cơ chế đặt cờ `daXuatExcel: false` & Cập nhật `capNhatLuc`**:
   - Mặc dù phiên nạp lại có thể trước đó đã xuất Excel (`session.daXuatExcel === true`).
   - Nhưng **ngay khi có bất kỳ thay đổi nào trong phiên** (quét thêm mã mới thành công HOẶC bấm xóa một mã):
     * BẮT BUỘC đặt lại `daXuatExcelTP = false;`.
     * Cập nhật `capNhatLuc = new Date().toISOString()`.
     * Tự động cập nhật `daXuatExcel: false` vào bản ghi của phiên trong `tp_lich_su` và `tp_phien_dodang`.
     * Giao diện Kết quả và Lịch sử đổi badge sang trạng thái "Chưa xuất Excel", nhắc nhở thợ kho phải xuất lại file Excel mới chứa dữ liệu cập nhật.
5. **Điều hướng & Khởi động Camera**:
   - Gọi `chuyenTrangKhongNav('tpPage')`.
   - Gọi `capNhatLogTP()` render lại giao diện Live Log của phiên vừa nạp.
   - Hiển thị Toast: `"Đã nạp phiên: ${session.thoiGian} (${phienTP.length} mã)"`.
   - Tự khởi động camera qua luồng khởi động TP có khóa và kiểm tra yêu cầu còn hiệu lực; nếu lỗi quyền/phần cứng thì giữ phiên đã nạp, chuyển trạng thái dừng và hiển thị nguyên nhân cùng nút thử lại. Không chỉ điều hướng rồi coi camera đã chạy.

### F. Lưu ngay, backup và giới hạn độ bền dữ liệu
- Có một luồng lưu ngay TP: ngừng/hủy timer cũ, chụp snapshot đúng `idPhien` và `revision`, ghi phiên dở dang đồng bộ, gửi snapshot lịch sử cho core. Không để callback timer đọc nhầm phiên mới.
- Gọi ở các mốc: tạm dừng, xem kết quả, rời trang qua cả hai hàm điều hướng, tạo/nạp phiên, xóa mã, xuất Excel, trước backup thủ công/tự động, thoát có kiểm soát và cập nhật PWA. Xử lý thêm `visibilitychange` khi hidden và `pagehide`.
- Tích hợp lưu trước khi bộ thu thập backup chạy, kể cả đường Native gọi `thucHienAutoBackup`; không phụ thuộc thứ tự listener giữa `app.js` và `tp.js`.
- Trước reload/thoát có kiểm soát: lưu ngay rồi chờ tác vụ core qua `whenIdle()` trước bước tiếp theo. Khi trình duyệt/OS đóng đột ngột, không trông cậy vào Promise của sự kiện unload.
- Debounce chỉ chạy sau lần quét hợp lệ, không reset vì frame trùng. Nếu quét liên tục nhanh hơn debounce, phải có giới hạn thời gian chờ tối đa để không trì hoãn ghi vô hạn: đề xuất tối đa 1 giây cho phiên dở dang, 3 giây cho lịch sử.
- Lưu dữ liệu lỗi/quota: hiện nguyên nhân dễ hiểu, giữ phiên trên RAM, cho thử lại/xuất Excel; không báo “đã lưu an toàn” khi mới cập nhật RAM. Tiến trình bị kill trước lần ghi vẫn có thể làm mất phần chưa ghi.
- Whitelist phục hồi cho phép chính xác `tp_lich_su`, `tp_phien_dodang`; kiểm tra cấu trúc/giá trị trước nhập. Khi cùng `idPhien` có nhiều bản, đối chiếu `capNhatLuc` và `revision`, không để phiên dở dang cũ đè lịch sử mới hơn; không nối mảng mù làm sống lại mã đã xóa.

### G. Xóa phiên và vòng đời phiên rỗng
- Xóa phiên đang hoạt động phải thông báo rõ sẽ xóa cả phiên dở dang; khi đồng ý: ngừng nhận mã, hủy timer, xóa bản lịch sử và localStorage, xóa RAM/Set/trạng thái xuất. Sau đó ở màn hình chưa có phiên; không tự ghi lại phiên vừa xóa.
- Xóa tất cả áp dụng cùng quy trình cho phiên hoạt động và gọi `ScannerCore.xoaLichSu`; hủy xác nhận không làm thay đổi dữ liệu.
- Xóa mã cuối: xóa bản ghi lịch sử của phiên đó, giữ phiên dở dang rỗng với cùng ID/ngày tạo và `daXuatExcel: false` để có thể quét tiếp. Không để bản lịch sử cũ còn nguyên các mã đã xóa.
- Tạo phiên mới luôn chốt phiên cũ trước khi reset, kể cả đã xuất Excel. ID mới có timestamp và phần ngẫu nhiên để giảm va chạm khi phục hồi dữ liệu từ nhiều máy.

---

## 8. Xuất File Excel (Chuẩn hóa cho Android APK & Web PWA)

* Tái sử dụng hàm dùng chung `exportToExcel(filename, sheetName, dataArray)` trong `app.js`:
  * Trên Android APK (Redmi K20 Pro): Lưu qua `window.AndroidNative.saveFileToDownload` vào thư mục Download và mở hộp thoại chia sẻ Zalo/Excel.
  * Trên Web PWA: Tải file về qua `XLSX.writeFile`.
* Cấu trúc dữ liệu đúng 2 cột:
  1. Cột 1: **Thời gian** — Chuỗi ngày giờ chuẩn `YYYY-MM-DD HH:mm:ss` (ví dụ `2026-11-20 09:30:15`) để Excel hỗ trợ sắp xếp.
  2. Cột 2: **Mã QR Gốc** — Toàn bộ chuỗi 5 dòng nguyên bản (các ký tự `\n` được bảo toàn nguyên vẹn trong ô).
* Tên file xuất: `Quet_TP_<YYYYMMDD>_<HHmmss>.xlsx` (kèm giờ phút giây để xuất nhiều lần không bị trùng tên).

### A. Xác nhận kết quả xuất và tính nhất quán
- Mở rộng `exportToExcel` hiện có thành hợp đồng bất đồng bộ trả kết quả thành công/thất bại; các caller cũ không chờ kết quả vẫn dùng được. Xử lý đầy đủ tải thư viện lỗi, lỗi tạo workbook và lỗi native save. Không tạo Promise rejection không được xử lý ở caller cũ.
- Chụp snapshot `idPhien`, `revision` và các dòng trước khi chờ thư viện. Chỉ đặt `daXuatExcel = true` cho phiên có cùng revision khi xuất thành công; phiên đã thêm/xóa mã trong lúc chờ vẫn chưa xuất. Không tái tạo phiên đã bị xóa trong thời gian chờ.
- Android: thành công khi bridge xác nhận lưu `OK`; lỗi native phải báo lỗi, không âm thầm dùng tải Web rồi coi đã lưu Download thành công. Đóng hộp thoại chia sẻ không làm mất trạng thái đã lưu file.
- Web PWA: chỉ xác nhận đã tạo file và yêu cầu tải xuống thành công; không tuyên bố biết người dùng đã lưu file vào ổ đĩa. Nhãn/hướng dẫn phải phản ánh giới hạn này.
- Sau khi cập nhật trạng thái xuất, lưu ngay cả lịch sử và phiên dở dang tương ứng; lưu trạng thái lỗi không được che lỗi xuất file.

### B. Xuất tất cả lịch sử
- Nút “Xuất tất cả” xuất toàn bộ phiên lịch sử, không chỉ kết quả đang lọc; nhãn hoặc xác nhận nêu số phiên.
- Một workbook, mỗi phiên một sheet; mỗi sheet đúng hai cột như trên. Tên sheet hợp lệ, tối đa 31 ký tự và không trùng; tên file có thời điểm xuất.
- Hàm dùng chung hiện chỉ hỗ trợ một sheet: mở rộng bằng tùy chọn tương thích ngược để nhận danh sách sheet, giữ nguyên lời gọi 3 tham số cũ. Không giả định API nhiều sheet đã tồn tại.
- Chụp snapshot các phiên/revision trước xuất; chỉ đánh dấu từng phiên không thay đổi sau khi toàn bộ workbook xuất thành công.
- Thời gian Excel và tên file dùng giờ địa phương của nghiệp vụ (GMT+7); thời gian lưu để so sánh dùng ISO có múi giờ. Chuỗi `YYYY-MM-DD HH:mm:ss` hỗ trợ sắp xếp dạng chuỗi, không mặc nhiên là ô Date của Excel.

---

## 9. Kế Hoạch Kiểm Thử Toàn Diện & Kiểm Tra Hồi Quy (Test Plan Đầy Đủ)

1. **Kiểm thử độc lập bộ bóc tách & Thẩm định tem `xuLyDuLieuQRTP`**:
   - Tem chuẩn 5 dòng -> bóc tách đúng Dòng 1, QC đủ, số kg.
   - Tem chứa ký tự `\r\n` (CRLF) hoặc dấu phẩy ở số kg (`56,4`) -> `parseKgTP` parse đúng `56.4`.
   - Tem chứa khoảng trắng bất thường ở dòng QC.
   - Tem sai định dạng (thiếu dòng, dòng 3 không phải số, dòng 5 thiếu `x` hoặc thiếu kg) -> chặn nhận và báo lỗi rõ ràng.
2. **Kiểm thử vòng đời camera & Đèn pin (Bảo vệ phần cứng K20 Pro)**:
   - Bật đèn pin -> camera không tự ngủ sau 18 giây.
   - Bấm dừng quét khi đèn đang bật -> đèn giữ sáng liên tục (stream được giữ lại).
   - Bấm quét tiếp -> tiếp tục quét tức thì, đèn không nháy tắt.
   - Bấm tắt đèn khi đang dừng quét -> camera được giải phóng hoàn toàn.
   - Chuyển sang tab khác -> đèn tắt, camera được giải phóng sạch sẽ.
   - **Ca Kiểm Kê (`giuDen: false`)**: Bật đèn pin ở Kiểm kê rồi bấm Lưu -> camera tắt, đèn tắt thật, `denPinMap` về `false`, và nút đèn pin chuyển về trạng thái tắt. Mở lại Kiểm kê không bị tự bật đèn.
   - **Ca Ẩn/Mở lại App**: Ẩn app rồi mở lại khi đèn đang bật -> nếu camera đang hoạt động thì camera và đèn được khôi phục; nếu camera đang tạm dừng thì không tự ý bật lại.
3. **Kiểm thử Quản lý Phiên & Chống Trùng**:
   - Quét mã trùng Dòng 1 trong phiên -> báo trùng tức thì.
   - Xóa một mã con trong bảng chi tiết -> cập nhật lại tổng bao/kg của nhóm -> quét lại mã vừa xóa -> được nhận lại thành công.
   - **Tải lại trang giữa chừng**: Phiên dở dang được khôi phục nguyên vẹn từ `localStorage`, quét lại các mã cũ tiếp tục báo trùng chính xác.
   - **Cảnh báo phiên mới**: Bấm "Bắt đầu phiên mới" khi phiên đang có mã mà chưa xuất Excel -> hiện hộp thoại cảnh báo xác nhận.
4. **Kiểm thử Xuất File Excel (Android APK & Web PWA)**:
   - Xuất Excel từ màn hình kết quả TP: kiểm tra file mở lên có đúng 2 cột (`Thời gian`, `Mã QR Gốc`).
   - Kiểm tra ô `Mã QR Gốc` chứa đầy đủ 5 dòng nguyên bản.
   - Kiểm tra trên thiết bị Android thật (lưu vào Download và mở share Zalo).
5. **Kiểm thử Lịch Sử TP & Cơ Chế Nạp Lại Phiên Quét Tiếp**:
   - Quét phiên mới -> lưu thành công vào `tp_lich_su` qua `ScannerCore.luuLichSu`.
   - Mở modal lịch sử từ Trang Chủ -> vào đúng trang `#lichSuTP`.
   - Tìm kiếm lịch sử theo ngày / theo quy cách.
   - Bấm nút "Xuất Excel" từ một phiên lịch sử -> file Excel đúng 2 cột được tạo thành công.
   - **Nạp lại phiên để quét tiếp**:
     * Kiểm tra giữ nguyên cùng `idPhien`.
     * Kiểm tra `tapMaDaQuetTP` được dựng lại đầy đủ (quét lại mã cũ báo trùng ngay).
     * Quét thêm mã mới hoặc xóa mã -> kiểm tra `daXuatExcel` tự động chuyển về `false` và `capNhatLuc` được cập nhật.
     * Nạp phiên khác khi đang có phiên dở dang -> kiểm tra hiện popup xác nhận lưu phiên cũ trước khi nạp.
   - Xóa 1 phiên / Xóa tất cả -> xác nhận an toàn, dọn dẹp sạch IndexedDB.
   - **Dọn 30 ngày**: Chỉ phiên đã xuất, không hoạt động và quá 30 ngày bị dọn. Phiên chưa xuất/đang hoạt động/ngày lỗi được giữ. Đọc/render không ghi DB; dọn chỉ ghi khi danh sách thay đổi và DB đã nạp đầy đủ.
6. **Kiểm tra hồi quy các module cũ & Cơ chế Cache**:
   - Xác nhận các ca nghiệp vụ Quét QR, Chỉ X1, Chỉ X5, BTP, Kiểm kê và tra cứu Tồn Kho vẫn hoạt động sau khi refactor `app.js`.
   - Kiểm tra nâng từ cache cũ sang bản mới, TP có đủ assets để chạy offline sau cài/nâng cấp, không trộn HTML/JS khác phiên bản. Không mặc định lần tải thứ hai chắc chắn có đủ code mới. Nút cập nhật phải lưu phiên trước reload; nếu thử nghiệm phát hiện thiếu asset hoặc trộn phiên bản, sửa luồng cập nhật/cache trong phạm vi phát hành trước khi nghiệm thu.

7. **Khởi động, lưu trữ và phục hồi**:
   - DB nạp chậm hơn timeout `whenReady`, mở lịch sử ngay khi khởi động: hiện trạng thái nạp, cập nhật sau ready, không dọn/xóa dữ liệu chưa nạp.
   - Quét rồi ẩn app/reload/thoát trước 300ms và trước 1000ms; kiểm tra các đường lưu ngay. Quét liên tục nhanh hơn debounce vẫn ghi theo thời gian chờ tối đa.
   - IndexedDB lỗi đọc/ghi, localStorage đầy: hiện lỗi rõ, giữ phiên, thử lại/xuất file; không báo thành công giả.
   - Backup có cả hai khóa TP; phục hồi vào dữ liệu trống và dữ liệu đã có cùng ID nhưng phiên bản mới hơn. Mở lại app, kiểm tra ID, ngày tạo, revision, Set, mã đã xóa và cờ xuất.
8. **Đổi/xóa phiên, lỗi xuất Excel và dữ liệu biên**:
   - Timer phiên A còn chờ rồi nạp B: không ghi nhầm dữ liệu/ID. Hủy popup giữ nguyên A; nạp cùng ID không ghi đè RAM mới bằng lịch sử cũ.
   - Xóa phiên đang hoạt động/xóa tất cả/xóa mã cuối rồi đợi timer và mở lại app: không phục sinh dữ liệu cũ. Xóa tất cả khi DB chưa sẵn sàng phải chờ hoặc dùng đường xóa rõ ràng, không ghi mảng rỗng mù.
   - Tải XLSX thất bại, native save trả lỗi, tạo workbook lỗi: không đặt đã xuất. Trong lúc chờ xuất, thêm/xóa mã, đổi phiên hoặc xóa phiên: chỉ cập nhật đúng snapshot còn tồn tại.
   - Xuất tất cả khi đang lọc: đủ toàn bộ phiên, sheet không trùng tên, đúng hai cột, giữ CRLF/nội dung QR gốc.
   - Từ chối `0.00001`, số quá lớn, Infinity/NaN từ dữ liệu phục hồi; tổng không vượt miền an toàn. Kiểm tra ID có số 0 đầu, hoa/thường, QR chứa dấu nháy/ký tự HTML và tem lỗi bị đưa liên tục trước camera.
9. **Hiệu năng, vòng đời camera và phát hành**:
   - Phiên lớn, nhóm lớn: DOM Live Log không vượt giới hạn 30 mã, tổng vẫn đầy đủ, mở nhóm/xóa/cuộn không mất trạng thái; kiểm tra sáng/tối và xoay màn hình.
   - Camera mở chậm rồi rời trang/nhấn dừng/ẩn app: track đến muộn bị đóng; không có decoder kép. Ngủ/thức và phục hồi cập nhật đúng reader mà hàm dừng sử dụng.
   - Kiểm kê phục hồi bằng callback đã lưu, không gọi hàm fallback không tồn tại; lỗi phục hồi có thông báo và thử lại.
   - Kiểm tra file TP trong root, `www/`, Android assets và danh sách cache; CI có `tp.js` trong paths. Cài đè APK giữ lịch sử/phiên, xác nhận chữ ký và phiên bản mới.

## 10. Điều kiện nghiệm thu và phạm vi bàn giao
- Kiểm tra cú pháp chỉ là một lớp kiểm tra. Cần bài kiểm tra tự động có ý nghĩa cho parser, thống kê, trạng thái phiên/revision và các tình huống lưu/khôi phục; `npm test` hiện chưa có bộ test thực tế, phải thiết lập lệnh chạy khi triển khai.
- Phân biệt kết quả kiểm tra tĩnh, mô phỏng trình duyệt, kiểm thử thiết bị thật và triển khai. Ghi rõ ca chưa chạy hoặc bị chặn; không ghi “100% hoàn hảo/an toàn” khi thiếu bằng chứng.
- Phạm vi gồm TP cục bộ, Excel, lịch sử/backup và phần tích hợp dùng chung đã nêu; không thay đổi nghiệp vụ hoặc backend các module cũ.
- Giữ bản kế hoạch cùng ghi nhận kiểm thử; chỉ phát hành khi các lỗi P1 về dữ liệu, xuất Excel và vòng đời camera đã được xử lý.
