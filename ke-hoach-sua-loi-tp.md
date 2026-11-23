# 📋 Kế Hoạch Kỹ Thuật Toàn Diện: Sửa Lỗi Giao Diện & Tối Ưu Chia Sẻ Excel Module Thành Phẩm (TP) - Bản Hoàn Hảo v7

> **Tiêu chuẩn hoàn thiện kỹ thuật cao nhất**:
> 1. **Khôi phục toàn diện Web Share API Level 2**: Hỗ trợ chia sẻ file `.xlsx` thẳng sang Zalo/Messenger trên Web PWA với nhánh `cancelled` khi người dùng bấm Hủy; fallback tải về chuẩn.
> 2. **Khớp hình học 100% không lệch lề**: Khung lưới 5 cột cố định `26px | 1fr | 44px | 78px | 18px` dùng chung cho nhóm và tem con; cột KG con cách mép phải đúng 34px thẳng tắp với KG nhóm; padding ngang do `.tp-kq-grid` và `.tp-gom-grid` quản lý duy nhất; bỏ `scrollbar-gutter: stable`.
> 3. **Đồng bộ trạng thái xuất giữa RAM và Lịch sử**: Khi xuất lịch sử trùng với phiên đang mở trong RAM $\rightarrow$ cập nhật đồng thời `daXuatExcelTP = true` và lưu draft, chống việc `luuVaoLichSuTP()` ghi đè xóa mất đánh dấu.
> 4. **Bảo toàn ngày phiên đang quét**: `khoiTaoTatCaNgayMacDinh()` chỉ cập nhật DOM, tuyệt đối không gán `ngayTP` của phiên đang quét dở khi qua nửa đêm.
> 5. **Hiển thị QC trọn vẹn trên màn cảm ứng**: Bảng Chi Tiết cho phép QC xuống dòng tự nhiên không cắt cụt; Live Log giới hạn 2 dòng để giữ bố cục camera.

---

## 1. Chi Tiết Các Quyết Định Kỹ Thuật Chuẩn Xác

### 1.1. Căn Thẳng Cột Tuyệt Đối & Quy Chuẩn Padding Duy Nhất

* **Định nghĩa 2 khung lưới CSS Grid cố định mang padding ngang chuẩn**:
  - Trong `style.css`:
    ```css
    /* Khung lưới 5 cột Bảng Chi Tiết TP: STT (26px) | QC (1fr) | Số Bao/Giờ (44px) | KG (78px) | Chevron/Xóa (18px) */
    .tp-kq-grid {
      display: grid;
      grid-template-columns: 26px minmax(0, 1fr) 44px 78px 18px;
      gap: 8px;
      align-items: center;
      width: 100%;
      box-sizing: border-box;
      padding: 8px 8px;
    }

    /* Khung lưới 3 cột Bảng Tổng Hợp TP: QC (1fr) | BAO (54px) | KG (78px) */
    .tp-gom-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 54px 78px;
      gap: 8px;
      align-items: center;
      width: 100%;
      box-sizing: border-box;
      padding: 8px 8px;
    }
    ```
* **Triệt tiêu lồng padding ngang ở các container bọc ngoài**:
  - Đặt `padding-left: 0; padding-right: 0;` cho các container:
    ```css
    #tp-wrap-chitiet .kq-table-header,
    #tp-wrap-chitiet .kq-table-footer,
    #tp-wrap-chitiet .tp-swipe-content,
    #tp-cam .tp-swipe-content,
    #tp-wrap-gom .kq-table-header,
    #tp-wrap-gom .kq-table-footer {
      padding-left: 0;
      padding-right: 0;
    }
    ```
* **Cấu trúc hàng tem con (`.tp-sub-item`) & Khung chi tiết (`.tp-group-details`)**:
  - Hàng tem con dùng chung class `.tp-kq-grid` (có padding ngang `8px 8px`):
    - Cột 1 (26px): `STT con`
    - Cột 2 (1fr): `Mã ID tem`
    - Cột 3 (44px): `Giờ quét` (thẳng tắp với badge `×N` của nhóm)
    - Cột 4 (78px): `KG tem con` căn phải (thẳng tắp với cột KG của nhóm, cách mép phải đúng 34px)
    - Cột 5 (18px): `Nút xóa` (thẳng tắp với cột chevron của nhóm)
  - Khung `.tp-group-details`:
    ```css
    #tp-wrap-chitiet .tp-group-details,
    #tp-cam .tp-group-details {
      margin: 0;
      padding: 0;
      border-radius: 0;
      border-left: none;
      border-right: none;
      border-top: 1px dashed var(--border-card);
      border-bottom: 1px dashed var(--border-card);
      background: var(--surface-2);
    }
    ```
    Khung chi tiết trải dài 100% chiều rộng của hàng nhóm, có nền màu phân biệt và đường viền trên/dưới thanh lịch, không bị co thụt mép lề.
* **Cột QC hiển thị đầy đủ trên màn hình cảm ứng**:
  - Trong Bảng Chi Tiết (`#tp-wrap-chitiet .tp-col-qc`):
    `white-space: normal; line-height: 1.3; word-break: break-word;`
    Cho phép hiển thị đầy đủ toàn bộ chuỗi thông số tem, không bị line-clamp, người dùng đọc được trọn vẹn mà không cần hover.
  - Trong Live Log (`#tp-cam .tp-col-qc`):
    Giữ `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;` để đảm bảo khu vực camera luôn gọn gàng.
* **Bỏ `scrollbar-gutter: stable;`**:
  - Không thêm thuộc tính này để tránh làm lệch thân bảng so với header/footer trên máy tính Desktop.

---

### 1.2. Khôi Phục Toàn Diện Web Share API Level 2 & Hợp Đồng Xuất Excel

* **Hàm `exportToExcel` luôn trả Promise và hỗ trợ chia sẻ đa nền tảng**:
  ```javascript
  function exportToExcel(filename, sheetName, dataArray, options) {
    return new Promise((resolve) => {
      try {
        if (!dataArray || dataArray.length === 0) {
          if (typeof showCanhBao === "function") showCanhBao("Không có dữ liệu để xuất file Excel!", "warning");
          resolve({ success: false, error: "Không có dữ liệu để xuất" });
          return;
        }

        if (typeof XLSX === "undefined") {
          napThuVienXLSX(
            async () => {
              try {
                const res = await exportToExcel(filename, sheetName, dataArray, options);
                resolve(res);
              } catch (err) {
                resolve({ success: false, error: err ? err.message : "Lỗi xuất file" });
              }
            },
            {
              imLang: options && options.imLang,
              onFail: (err) => resolve({ success: false, error: "Không thể nạp thư viện XLSX: " + (err && err.message ? err.message : "Lỗi mạng") })
            }
          );
          return;
        }

        const ws = XLSX.utils.json_to_sheet(dataArray);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName || "Sheet1");

        const safeBaseName = (filename || "BaoCaoKho").replace(/\.xlsx$/i, "");
        const fullFileName = safeBaseName + ".xlsx";

        // 1. Nhánh Android Native APK
        if (window.AndroidNative && typeof window.AndroidNative.saveFileToDownload === "function") {
          const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
          const res = window.AndroidNative.saveFileToDownload(fullFileName, base64Data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          if (res && res.startsWith("OK")) {
            if (options && options.chiaSe) {
              if (typeof window.AndroidNative.shareFile === "function") {
                try {
                  window.AndroidNative.shareFile(fullFileName, base64Data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                } catch (e) {
                  console.warn("shareFile lỗi:", e);
                }
              } else if (typeof moXacNhanApp === "function") {
                moXacNhanApp(
                  `Đã lưu file Excel:\n${fullFileName}\nvào thư mục Download của điện thoại!\n\nBạn có muốn gửi file này qua Zalo hoặc mở bằng Excel không?`,
                  () => {
                    if (typeof window.AndroidNative.shareFile === "function") {
                      window.AndroidNative.shareFile(fullFileName, base64Data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                    }
                  },
                  "Chia sẻ / Mở file", null, "Đóng", "Xuất Excel thành công"
                );
              }
              resolve({ success: true, method: 'native_share' });
            } else {
              // Hành vi mặc định cho 8 caller cũ
              if (typeof moXacNhanApp === "function") {
                moXacNhanApp(
                  `Đã lưu file Excel:\n${fullFileName}\nvào thư mục Download của điện thoại!\n\nBạn có muốn gửi file này qua Zalo hoặc mở bằng Excel không?`,
                  () => {
                    if (typeof window.AndroidNative.shareFile === "function") {
                      window.AndroidNative.shareFile(fullFileName, base64Data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                    }
                  },
                  "Chia sẻ / Mở file", null, "Đóng", "Xuất Excel thành công"
                );
              } else if (typeof showCanhBao === "function") {
                showCanhBao("Đã lưu " + fullFileName + " vào Download!", "success");
              }
              resolve({ success: true, method: 'native_save' });
            }
            return;
          } else if (options && options.chiaSe) {
            resolve({ success: false, error: "Lưu file vào Download thất bại" });
            return;
          }
        }

        // 2. Nhánh Web PWA (Web Share API Level 2)
        if (options && options.chiaSe) {
          try {
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const file = new File([blob], fullFileName, { type: blob.type });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              navigator.share({ files: [file], title: fullFileName, text: fullFileName })
                .then(() => resolve({ success: true, method: 'web_share' }))
                .catch((err) => {
                  if (err && err.name === 'AbortError') {
                    resolve({ success: false, cancelled: true });
                  } else {
                    console.warn("navigator.share thất bại, fallback sang tải về:", err);
                    XLSX.writeFile(wb, fullFileName);
                    if (typeof showCanhBao === "function") showCanhBao("Đã tải xuống " + fullFileName, "success");
                    resolve({ success: true, method: 'download' });
                  }
                });
              return;
            }
          } catch (e) {
            console.warn("Lỗi chuẩn bị Web Share, fallback sang tải về:", e);
          }
        }

        // 3. Fallback Tải về Máy tính Desktop / Trình duyệt không hỗ trợ Share
        XLSX.writeFile(wb, fullFileName);
        if (typeof showCanhBao === "function") {
          showCanhBao("Đã tải xuống " + fullFileName, "success");
        }
        resolve({ success: true, method: 'download' });
      } catch (e) {
        resolve({ success: false, error: e ? e.message : "Lỗi xuất file" });
      }
    });
  }
  ```

* **Xử lý kết quả trong `xuatExcelTP`**:
  ```javascript
  if (dangXuatTP) return;
  dangXuatTP = true;
  const idPhienLucXuat = idPhienHienTaiTP;
  const revLucXuat = revisionTP;

  try {
    const res = await exportToExcel(filename, "Thành Phẩm", data, { chiaSe: true });
    if (res && res.success) {
      if (idPhienHienTaiTP === idPhienLucXuat && revisionTP === revLucXuat) {
        daXuatExcelTP = true;
        luuPhienDoDangTPNgay();
        luuVaoLichSuTP();
      }
    } else if (res && res.cancelled) {
      showCanhBaoTP("Đã hủy chia sẻ Excel", "info");
    } else if (res && res.error) {
      showCanhBaoTP(res.error, "error");
    }
  } finally {
    dangXuatTP = false;
  }
  ```

---

### 1.3. Đồng Bộ Trạng Thái "Đã Xuất" Giữa RAM Và Lịch Sử

* **Tránh ghi đè mất trạng thái xuất khi phiên lịch sử trùng phiên trong RAM**:
  - Khi gọi `xuatExcelPhienLichSuTP(idPhien)`:
    - Chụp `const revLucXuat = session.revision || 0;`.
    - Xuất thành công $\rightarrow$ đọc lại `list = docLichSuTP()`, tìm `s = list.find(x => x.idPhien === idPhien)`.
    - Nếu `s && (s.revision || 0) === revLucXuat`:
      - Đánh dấu `s.daXuatExcel = true;`.
      - Cập nhật `s.capNhatLuc = new Date().toISOString();` (gia hạn mốc 30 ngày dọn rác).
      - **Đồng bộ RAM**: Nếu `idPhienHienTaiTP === s.idPhien && revisionTP === s.revision`:
        `daXuatExcelTP = true; luuPhienDoDangTPNgay();`.
      - Ghi lại `luuLichSuTP(list); renderLichSuTP();`.
  - Khi gọi `xuatExcelTatCaLichSuTP()`:
    - Tương tự, nếu phiên đang mở trong RAM nằm trong danh sách được xuất thành công thì cập nhật `daXuatExcelTP = true; luuPhienDoDangTPNgay();`.

---

### 1.4. Quản Lý Ngày An Toàn Không Ghi Đè Phiên Đang Quét

* **Tách biệt DOM và biến `ngayTP` trong RAM**:
  - `khoiTaoTatCaNgayMacDinh()`:
    - CHỈ kiểm tra và cập nhật DOM:
      ```javascript
      function khoiTaoTatCaNgayMacDinh() {
        const today = (typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : new Date().toISOString().split("T")[0];
        ["cx5-ngay", "cx1-ngay", "btp-ngay", "kk-ngay", "tp-ngay"].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            if (!el.value || el.value === ngayTuDongTP) {
              el.value = today;
              if (id === "tp-ngay") ngayTuDongTP = today;
            }
          }
        });
      }
      ```
    - **TUYỆT ĐỐI KHÔNG gán `ngayTP = today;` trong hàm này**. Khi người dùng chuyển tab sau nửa đêm, ngày của phiên quét đang chạy dở được bảo toàn 100%!
  - **Gán `ngayTP` chỉ diễn ra khi bắt đầu phiên**:
    - Khi bắt đầu phiên mới (`batDauTP` / `batDauPhienMoiTP`):
      `const ngayEl = document.getElementById("tp-ngay");`
      `ngayTP = (ngayEl && ngayEl.value) ? ngayEl.value : today;`
    - Khi khôi phục phiên (`khoiPhucTP`):
      `ngayTP = phienCu.ngay || today;`
      `if (ngayEl) ngayEl.value = ngayTP;`
  - **Xử lý trong `quetMoiTP()`**:
    - Xác định ngày áp dụng cho phiên mới: Nếu `ngayInput.value === ngayTuDongTP && ngayTuDongTP < today`, ngày áp dụng là `today`. Nếu người dùng chủ động chọn ngày khác (`ngayInput.value !== ngayTuDongTP`), giữ nguyên ngày đó.
    - Hiện rõ ngày áp dụng trong hộp xác nhận: `"Tạo phiên mới cho ngày: " + ngayApDung + "?"`.
    - Khi người dùng xác nhận: gán `ngayInput.value = ngayApDung; batDauPhienMoiTP(ngayApDung);`.

---

### 1.5. Chuẩn Hóa Khóa Nhóm `taoKhoaNhomTP` & Debounce Tìm Kiếm

* **Chuẩn hóa chuỗi và thống nhất một chữ "KHÁC" duy nhất**:
  ```javascript
  function taoKhoaNhomTP(r) {
    if (!r || !r.qcDu) return "KHÁC";
    return r.qcDu.trim().replace(/\s+/g, ' ');
  }
  ```
  Sử dụng thống nhất cho gom nhóm, render, xóa nhóm và dọn Set khi xóa mã cuối (`xoaMaTP`).
* **Debounce tìm kiếm có rẽ nhánh tức thì**:
  ```javascript
  let timerSearchTP = null;
  function onSearchTPInput() {
    const el = document.getElementById("tp-ketqua-search");
    const val = el ? el.value.trim() : "";
    if (timerSearchTP) clearTimeout(timerSearchTP);
    if (!val) {
      locKetQuaTP(); // Xóa trắng ô tìm kiếm -> render lại tức thì không chờ timer
      return;
    }
    timerSearchTP = setTimeout(() => {
      locKetQuaTP();
    }, 200);
  }
  ```

---

## 2. Danh Sách File Can Thiệp Chính Thức

| File | Nội dung can thiệp |
| :--- | :--- |
| **`index.html`** | Cập nhật tiêu đề Bảng Chi Tiết (`STT | QC | BAO | KG`) và Bảng Tổng Hợp (`QC | BAO | KG`) sang dùng `.tp-kq-grid` và `.tp-gom-grid`. Gắn `oninput="onSearchTPInput()"` cho `#tp-ketqua-search`. |
| **`style.css`** | • `.tp-kq-grid` (26px 1fr 44px 78px 18px) và `.tp-gom-grid` (1fr 54px 78px) mang `padding: 8px 8px;`.<br>• Reset `padding-left: 0; padding-right: 0;` cho các container bọc ngoài của TP.<br>• `.tp-group-details` mở rộng 100% chiều ngang, bỏ co thụt mép lề, có viền dashed trên dưới và nền mờ.<br>• `.tp-col-qc` trong Bảng Chi Tiết hiển thị trọn vẹn không cắt cụt (Live Log giới hạn 2 dòng).<br>• Không thêm `scrollbar-gutter: stable;`. |
| **`app.js`** | • `khoiTaoTatCaNgayMacDinh()` chỉ cập nhật DOM, quản lý `ngayTuDongTP`.<br>• `napThuVienXLSX` quản lý hàng chờ `{ onSuccess, onFail, imLang }`, tương thích ngược 1 tham số.<br>• `exportToExcel` luôn trả Promise, hỗ trợ Web Share API Level 2 (`File`, `canShare`, `AbortError`), native share 3 tham số trên APK, bảo vệ 8 caller cũ. |
| **`tp.js`** | • Quản lý ngày độc lập giữa DOM và RAM; `quetMoiTP` thông báo rõ ngày mới.<br>• Render Bảng Chi Tiết và tem con dùng chung lưới 5 cột chuẩn.<br>• Render Bảng Tổng Hợp (`#tp-tbody-gom`) theo `.tp-gom-grid`.<br>• Đồng bộ `daXuatExcelTP` trong RAM khi xuất từ Lịch Sử trùng phiên đang mở.<br>• Quản lý 2 Set: `expandedTPGroupsLog` và `expandedTPGroupsKq`, dọn dẹp khi xóa tem cuối bằng `taoKhoaNhomTP`.<br>• Toggle nhóm cục bộ DOM, debounce tìm kiếm tức thì khi xóa trắng.<br>• Dùng `data-group-key` Base64.<br>• So khớp cả `idPhienLucXuat` và `revLucXuat`, giải phóng `dangXuatTP` trong `finally`. |
| **`sw.js`** | Tăng `CACHE_NAME` lên `kho-cache-v166`. |
| **`android/app/build.gradle`** | Tăng `versionCode 144`, `versionName "2.43"`. |

---

## 3. Ma Trận Kiểm Thử Toàn Diện

| STT | Tình huống kiểm thử | Môi trường | Kết quả kỳ vọng |
| :---: | :--- | :--- | :--- |
| **1** | Hồi quy BTP, CX1, QR, Kiểm kê | Web & APK | Giao diện và luồng xuất Excel của 4 module cũ giữ nguyên 100%. |
| **2** | Theme Tối (Dark theme) | Web & APK | Chữ `TỔNG`, số bao, số KG, badge tương phản rõ nét. |
| **3** | QC dài trên màn hình cảm ứng | Redmi K20 Pro | Bảng Chi Tiết hiển thị đầy đủ toàn bộ chuỗi thông số, không bị cắt cụt. |
| **4** | Cột KG tem con thẳng tắp với KG nhóm | Redmi K20 Pro | Đo trên màn hình thật: Số KG của nhóm và từng tem con bên trong thẳng hàng 78px căn phải (cách mép phải đúng 34px). |
| **5** | Hàng Bảng Tổng Hợp thẳng Tiêu đề & Footer | Web & APK | Cột QC, BAO (54px), KG (78px) thẳng tắp giữa Tiêu đề, Hàng dữ liệu và Footer. |
| **6** | Chuyển tab sau nửa đêm khi phiên đang quét | Web & APK | Biến `ngayTP` của phiên đang quét dở không bị đổi ngày. |
| **7** | Xuất từ lịch sử đúng phiên đang mở trong RAM | Web & APK | Cập nhật `daXuatExcelTP = true` trong RAM; quay lại quét tiếp và lưu thì dấu đã xuất vẫn được bảo toàn. |
| **8** | Bấm Xuất trên Web PWA rồi bấm HỦY Share Sheet | Chrome Mobile | Hiện toast "Đã hủy chia sẻ Excel", phiên giữ nguyên trạng thái chưa xuất. |
| **9** | Xuất Excel trên APK thật | Redmi K20 Pro | Lưu Download thành công, gọi `shareFile` 3 tham số mở Zalo/Messenger, ghi nhận đã xuất. |
| **10** | Mở kết quả khi offline rồi bấm Xuất ngay | Web & APK | Hiện đúng duy nhất 1 thông báo lỗi kết nối, nút xuất mở khóa lại ngay (`dangXuatTP = false`). |
| **11** | Kiểm tra hiển thị trên Desktop có thanh cuộn | Chrome Desktop | Tiêu đề, Hàng dữ liệu và Footer thẳng cột, không bị giật lề do thanh cuộn. |
| **12** | Đổi phiên trong lúc đợi chia sẻ (cùng revision=1) | Web & APK | Phiên mới không bị đánh dấu nhầm (nhờ so khớp cả `idPhienLucXuat`). |
| **13** | Xóa mã cuối của nhóm rồi quét lại cùng QC | Web & APK | Nhóm mới không bị tự động mở (nhờ `taoKhoaNhomTP` dọn sạch Set). |
| **14** | Tìm kiếm danh sách lớn với gõ liên tục | Web & APK | Debounce 200ms mượt mà; xóa trắng ô tìm kiếm hiển thị lại toàn bộ ngay lập tức. |
