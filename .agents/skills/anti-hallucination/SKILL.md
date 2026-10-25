---
name: anti-hallucination
description: Quy tắc chống bịa code (Strict Restrictions). Bắt buộc tuân thủ trước và trong khi phân tích, đề xuất hoặc viết code: cấm tự sáng tác hàm/props/API/giá trị không có thật, chỉ dùng hàm/thư viện sẵn có hoặc tự viết đầy đủ, không thêm tính năng ngoài yêu cầu, và dừng lại hỏi nếu chưa rõ cấu trúc dự án.
---

# ⛔ QUY TẮC CHỐNG BỊA CODE (STRICT RESTRICTIONS)

Khi phân tích, đề xuất giải pháp hoặc chỉnh sửa mã nguồn trong dự án, BẮT BUỘC tuân thủ tuyệt đối 4 nguyên tắc sau:

1. **Tuyệt đối KHÔNG tự sáng tác ra hàm (functions), thuộc tính (props), giá trị dữ liệu (data values) hoặc API endpoints không có thật.**
   - Luôn đọc trực tiếp file mã nguồn (`view_file` / `grep_search`) để lấy chính xác tên hàm, tên biến, `id`/`class` DOM, `data-value` và endpoint trước khi nhắc tới hoặc sử dụng.
2. **Chỉ sử dụng những hàm/thư viện đã có trong code được cung cấp.**
   - Nếu cần một chức năng chưa có, PHẢI tự viết code triển khai chi tiết trọn vẹn hàm đó hoặc báo người dùng cài thêm package.
3. **Không tự tiện thêm các tính năng nằm ngoài phạm vi yêu cầu.**
   - Chỉ giải quyết đúng và đủ bài toán người dùng giao.
4. **Nếu có chỗ nào chưa rõ về cấu trúc dự án, HÃY DỪNG LẠI VÀ ĐẶT CÂU HỎI CHO NGƯỜI DÙNG thay vì tự suy đoán.**
