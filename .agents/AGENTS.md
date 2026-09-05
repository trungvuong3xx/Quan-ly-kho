# AGENTS.md

Project-level behavioral and tooling guidelines.

## Skills Index

| Skill | Topic |
| --- | --- |
| `brainstorming` | Design & planning: explore intent, constraints, propose approaches, get approval |
| `core-asset-usage` | Runtime config: Asset access patterns, PO/NonPO placement, UtilsHelper static usage |
| `core-browser-automation` | Playwright: BrowserSession, BrowserPage, navigation, interaction, waits, iframe |
| `core-extensions` | Helpers: StringExtensions, NumberExtensions, EnumExtensions, XmlExtensions |
| `logging` | Logging: LogEnter/LogLeave, Log/Warning/Error, [] formatting, | separator |
| `codebase-memory` | MCP graph: search_graph, trace_path, detect_changes, index_repository |
| `erp-igp-automation` | Quy trình tự động hóa nhập liệu chứng từ WorkFlow ERP iGP từ Google Sheets (Chỉ & Nhựa) |
| `karpathy-guidelines` | Behavioral guidelines derived from Andrej Karpathy to reduce common LLM coding mistakes |

## Quick Reference

**Before any task:**

1. Invoke `brainstorming` skill — no exceptions

**Before editing code:**

1. Invoke `codebase-memory` skill → `search_graph` + `trace_path(direction="inbound")`
2. Read `logging` skill for any function you write or modify
3. **[CODE PROTECTION]** Always invoke `karpathy-guidelines` (Rule 3: Surgical Changes) and `full-output-enforcement` to ensure you NEVER delete or format unrelated code.
4. **[SURGICAL TOOL]** ALWAYS use the `multi_replace_file_content` tool to edit only the specific lines needed, avoiding full file replacements.

**After code changes:**

1. `detect_changes()` → verify affected scope
2. `index_repository(mode="full")` → sync knowledge graph
3. Luôn rà soát lại toàn bộ logic ở các phần khác có liên quan đến đoạn code vừa được thêm/sửa/xóa để kịp thời đồng bộ, tránh phát sinh lỗi hiển thị hoặc sai lệch dữ liệu.

## BỘ QUY TẮC CỐ ĐỊNH BẤT DI BẤT DỊCH (BẢO VỆ DỰ ÁN)

### 1. Cấu hình Android & Build APK (`build.gradle`):
- **TUYỆT ĐỐI KHÔNG DÙNG Java 21 Bytecode**: `sourceCompatibility` và `targetCompatibility` PHẢI LUÔN LÀ `JavaVersion.VERSION_17`. Java 21 khiến hệ điều hành Android 14 (API 34) trên máy K20 Pro bị treo vô tận ở màn hình "Đang cài đặt" do trình biên dịch AOT (`dex2oat`) không phân tích được opcode.
- **TỰ ĐỘNG TĂNG `versionCode`**: Mỗi khi có thay đổi code đẩy lên Git để build APK, `versionCode` PHẢI TĂNG LÊN (2, 3, 4...) để Android nhận diện là bản nâng cấp và cho phép **CÀI ĐÈ (Update in-place)**.
- **CHỮ KÝ BẮT BUỘC**: Luôn dùng file `debug.keystore` cố định trong repo kèm `v1SigningEnabled true` và `v2SigningEnabled true`.
- **TUYỆT ĐỐI KHÔNG KHUYÊN NGƯỜI DÙNG GỠ CÀI ĐẶT**: Gỡ app sẽ làm xóa sạch toàn bộ dữ liệu quét kho trong `localStorage`. Luôn đảm bảo APK mới cài đè được lên bản cũ.

### 2. Camera & Cảm biến (K20 Pro & Snapdragon 855):
- **KHÔNG mở camera trước**: Luôn lọc và mở Camera 0 (Sony 48MP AF). Cấm dùng fallback `{ video: true }` để motor thò thụt không bao giờ nhảy lên gây lỗi Calibrate.
- **KHÔNG gọi `track.applyConstraints()`**: Gây crash / deadlock Camera HAL của Snapdragon 855.
- **KHÔNG addEventListener lặp lại trong `khoiTaoCameraFast`**: Lắng nghe tương tác chạm ở cấp `document` 1 lần duy nhất, tránh rò rỉ listener khi camera ngủ/thức.
- **KHÔNG chạy kép decoder**: Khi có phần cứng `BarcodeDetector`, cấm khởi tạo hoặc chạy song song `ZXing`.
- **KHÔNG render lại toàn bộ DOM live log**: Live log tối đa 30 mã mới nhất để chống giật lag khi quét hàng trăm bao.