# Dự án NTV Code gốc - Từ vựng & Ngữ cảnh (Shared Language)

Tài liệu này chứa các thuật ngữ và ngữ cảnh chung của dự án để đảm bảo sự thống nhất trong quá trình phát triển giữa lập trình viên và AI.

## Ngữ cảnh dự án
- Đây là dự án quản lý kho (Quan-ly-kho) của trungvuong3xx.
- Quản lý việc kiểm kê hàng hóa, sử dụng camera trên thiết bị Android (K20 Pro) để quét mã vạch.
- Có sự tương tác với Google Sheets (appscript) và hệ thống ERP iGP.

## Từ vựng (Vocabulary)
- **Google Apps Script (GAS)**: Các script (chứa trong file `.txt`) đóng vai trò backend trung gian, nhận request HTTP từ app và ghi/đọc dữ liệu trên Google Sheets.
- **Clasp**: Công cụ CLI của Google dùng để quản lý mã nguồn, đẩy (push) và tải (pull) code GAS trực tiếp từ terminal, thay thế cho quy trình copy/paste file `.txt`.
- **Sync Queue (Hàng đợi đồng bộ)**: Nơi lưu trữ tạm thời các mã vạch (payload) chưa thể gửi lên GAS do mất mạng. Khi có mạng trở lại, hàng đợi này sẽ được xử lý.
