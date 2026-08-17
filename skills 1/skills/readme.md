# Danh sách Kỹ năng (Skills)

Tài liệu này cung cấp danh sách và hướng dẫn sử dụng của từng kỹ năng (skill) có trong hệ thống (`C:\Users\khanhdq\.gemini\config\skills`).

## Danh sách các kỹ năng cấu hình chung

| Tên Kỹ năng (Skill) | Nhiệm vụ / Tính năng | Khi nào nên dùng |
| --- | --- | --- |
| **ado-pr-creation** | Tự động tạo Pull Request (PR) trên Azure DevOps (ADO). | Khi đã hoàn thiện code và muốn AI tự động gom commit, viết mô tả PR và submit lên hệ thống ADO. |
| **ado-task-creation** | Tạo task hoặc work item trên Azure DevOps. | Khi cần chia nhỏ công việc, lên kế hoạch và log các đầu việc (tickets) vào bảng Agile/Scrum trên ADO. |
| **ask-matt** | Công cụ điều hướng (router) hệ thống các kỹ năng. | Khi bị lạc lối, không biết nên bắt đầu từ đâu hoặc dùng lệnh gì tiếp theo để giải quyết một quy trình phát triển. |
| **brand-guidelines** | Áp dụng chuẩn nhận diện thương hiệu (màu sắc, kiểu chữ) của Anthropic. | Khi thiết kế UI, viết tài liệu, tạo báo cáo cần sự đồng bộ về mặt thẩm mỹ theo chuẩn thương hiệu. |
| **build-release** | Khắc phục lỗi build .NET (lỗi MSB4803, COM reference). | Khi gõ lệnh `dotnet build -c Release` bị thất bại và cần AI tự động tìm nguyên nhân, sửa lỗi cấu hình. |
| **canvas-design** | Thiết kế hình ảnh, poster, nghệ thuật trực quan (.png, .pdf). | Khi cần tạo các hình ảnh tĩnh, ấn phẩm truyền thông, biểu đồ có tính thẩm mỹ cao trực tiếp. |
| **code-review** | Đánh giá mã nguồn tự động dựa trên Tiêu chuẩn (Standards) và Đặc tả (Spec). | Khi có một nhánh (branch) mới hoặc PR cần được soát lỗi, nhận xét khách quan trước khi merge. |
| **codebase-design** | Phân tích và thiết kế module sâu (deep modules). | Khi cần tái cấu trúc (refactor) một module phức tạp, muốn code dễ test hơn hoặc giúp AI hiểu cấu trúc. |
| **design-taste-frontend** | Hướng dẫn thiết kế frontend chuyên nghiệp (không template). | Khi xây dựng UI/UX cho landing page, portfolio và muốn có một giao diện độc bản, tinh tế, chỉn chu. |
| **diagnosing-bugs** | Cung cấp vòng lặp chẩn đoán lỗi chuyên sâu. | Khi gặp bug khó tái hiện, sụt giảm hiệu suất, hoặc khi ứng dụng lỗi mà không rõ nguyên nhân gốc rễ. |
| **discord-chat-scraper**| Cào (scrape) và thu thập dữ liệu lịch sử chat trên Discord. | Khi cần trích xuất khối lượng lớn tin nhắn từ Discord hoặc các app cuộn để tổng hợp tài liệu/phân tích. |
| **doc-coauthoring** | Hỗ trợ quy trình đồng tác giả viết tài liệu kỹ thuật, đề xuất. | Khi cần viết tài liệu kiến trúc, hướng dẫn sử dụng và muốn AI làm người đồng viết, rà soát ý tưởng. |
| **docx** | Thao tác (đọc, sửa, tạo mới) trên file Word (.docx, .dotx). | Khi cần xuất báo cáo ra file Word, phân tích dữ liệu từ Word có sẵn hoặc tự điền vào mẫu tài liệu. |
| **frontend-design** | Định hướng hình ảnh trực quan cho giao diện (thẩm mỹ, typography). | Khi bắt tay vào thiết kế UI và cần các quyết định về màu sắc, khoảng cách, font chữ sao cho hiện đại. |
| **full-output-enforcement**| Ép buộc AI trả về toàn bộ mã nguồn, không cắt xén, không dùng placeholder. | Khi cần sửa các file code lớn và bạn muốn copy/paste nguyên vẹn ngay lập tức mà không phải tự điền thủ công. |
| **gpt-taste** | Kỹ sư UX/UI và hoạt ảnh nâng cao (GSAP, lưới Bento). | Khi làm các trang web có hiệu ứng cuộn (scroll), hoạt ảnh phức tạp, và bố cục bất đối xứng, sáng tạo. |
| **grill-me** | Phỏng vấn phản biện gắt gao ý tưởng/kế hoạch (Không lưu trạng thái). | Khi bạn có một ý tưởng sơ khai (chưa có code) và muốn AI hỏi xoáy để tìm ra lỗ hổng trước khi làm. |
| **grill-with-docs** | Phỏng vấn gắt gao VÀ tự động ghi lại tài liệu kiến trúc (ADR, Glossary). | Tương tự như `grill-me` nhưng dùng khi dự án ĐÃ CÓ mã nguồn, cần lưu lại quyết định kỹ thuật làm docs. |
| **grilling** | Bật chế độ phản biện gắt gao (stress-test). | Bất cứ lúc nào muốn AI ngừng "đáp ứng ngoan ngoãn" và chuyển sang "hỏi xoáy" về tính khả thi của một kế hoạch. |
| **handoff** | Nén và đóng gói đoạn hội thoại thành file bàn giao. | Khi cửa sổ chat quá dài (hết bộ nhớ) hoặc muốn chuyển bối cảnh công việc cho một session/AI Agent khác. |
| **implement** | Trực tiếp code/triển khai một phần công việc dựa trên đặc tả. | Khi đã có Đặc tả (Spec) hoặc ticket rõ ràng và cần AI viết mã nguồn hoàn chỉnh cho chức năng đó. |
| **improve-codebase-architecture**| Quét tìm cơ hội cải thiện kiến trúc và tạo báo cáo trực quan. | Khi dự án có "nợ kỹ thuật" (technical debt) và bạn muốn AI tự động gợi ý những module cần cấu trúc lại. |
| **internal-comms** | Viết các tài liệu giao tiếp nội bộ (báo cáo, sự cố, bản tin). | Khi cần thông báo cho cấp trên, team về trạng thái dự án theo form chuẩn, văn phong chuyên nghiệp. |
| **last30days** | Nghiên cứu dư luận trên MXH (Reddit, X, YouTube...) trong 30 ngày qua. | Khi cần đánh giá công nghệ, thu thập phản hồi người dùng về một chủ đề để đưa ra quyết định sản phẩm. |
| **minimalist-ui** | Thiết kế giao diện web theo phong cách biên tập, tối giản. | Khi muốn web giống như ấn phẩm báo chí: màu đơn sắc ấm, phẳng, tập trung mạnh vào typography và khoảng trắng. |
| **pdf** | Mọi thao tác trên file PDF (đọc, tách, ghép, OCR, watermark...). | Bất kỳ khi nào có yêu cầu xử lý tài liệu định dạng PDF, trích xuất bảng biểu hoặc tạo file PDF. |
| **pdf-to-markdown** | Chuyển đổi PDF sang định dạng Markdown qua API doc2md. | Khi cần AI đọc hiểu nội dung sách, tài liệu PDF dài và muốn chuyển chúng thành text để dễ lưu trữ/phân tích. |
| **pine-developer** | Viết mã Pine Script v6 chất lượng cao. | Khi phát triển các chỉ báo (indicators) hoặc chiến lược giao dịch tự động trên nền tảng TradingView. |
| **pptx** | Đọc, sửa, tạo mới file trình chiếu PowerPoint (.pptx). | Khi cần tự động hóa việc xuất báo cáo ra slide, hoặc muốn phân tích nội dung từ một bài thuyết trình. |
| **prototype** | Xây dựng nhanh các nguyên mẫu thử nghiệm "dùng một lần" (throwaway). | Khi đang tranh luận về một UI hoặc logic nào đó, cần code thử nhanh một bản nháp để xem tận mắt. |
| **research** | Nghiên cứu chuyên sâu một câu hỏi từ nguồn tin cậy và lưu thành Markdown. | Khi gặp một chủ đề/công nghệ lạ, ủy quyền cho AI tự thu thập tài liệu gốc, đọc và tóm tắt lại. |
| **resolving-merge-conflicts**| Hỗ trợ xử lý và giải quyết xung đột (conflict) trong Git. | Khi thực hiện `git merge` hoặc `rebase` bị vướng conflict và cần AI đối chiếu mã để gỡ rối chính xác. |
| **setup-matt-pocock-skills** | Khởi tạo môi trường (tracker, triage, docs) cho các kỹ năng kỹ thuật. | CHỈ dùng 1 lần duy nhất khi bắt đầu áp dụng hệ thống kỹ năng này vào một repo/dự án mới. |
| **tdd** | Lập trình phần mềm hướng kiểm thử (Test-Driven Development). | Khi code tính năng đòi hỏi độ chính xác cao, yêu cầu AI viết Test trước (Red) -> Code sau (Green) -> Refactor. |
| **teach** | Đóng vai trò gia sư hướng dẫn một khái niệm. | Khi bạn chưa hiểu rõ về một công cụ, framework trong dự án và muốn AI giải thích + thực hành trực tiếp. |
| **theme-factory** | Áp dụng các bộ giao diện/bảng màu chuẩn vào tài liệu, web. | Khi muốn thay đổi nhanh "lớp áo" (màu sắc, font) của một slide hoặc trang HTML mà không cần tự phối màu. |
| **to-spec** | Chuyển hội thoại thành tài liệu Đặc tả kỹ thuật (Specification). | Sau khi "phỏng vấn" ý tưởng xong, dùng lệnh này để đúc kết mọi thứ thành tài liệu yêu cầu tính năng rõ ràng. |
| **to-tickets** | Xé nhỏ bản Đặc tả thành các tác vụ (Tickets) có ràng buộc (blockers). | Sau khi có Spec, muốn lên kế hoạch chi tiết xem việc nào làm trước (chặn), việc nào làm sau, phân chia rõ ràng. |
| **triage** | Phân loại, xác minh và làm rõ các Issue/Bug từ bên ngoài. | Khi repo nhận được nhiều báo cáo lỗi từ người dùng, cần AI phân tích, tái hiện lỗi trước khi đưa đi sửa. |
| **wayfinder** | Lập bản đồ tác vụ quyết định cho một dự án quá khổng lồ. | Khi đối mặt với một dự án lớn, chưa rõ đường đi (vượt khả năng 1 session), cần lập bản đồ để đánh giá dần. |
| **web-artifacts-builder** | Xây dựng ứng dụng web phức tạp (React, Tailwind) trên màn hình AI. | Khi muốn xem trước (preview) giao diện tĩnh (Shadcn, React) hoạt động ra sao mà không cần tự build trình duyệt. |
| **webapp-testing** | Kiểm thử ứng dụng web cục bộ bằng Playwright. | Khi cần AI tự động chạy trình duyệt ẩn, click nút, chụp màn hình, kiểm tra luồng hoạt động UI của trang web. |
| **xlsx** | Đọc, phân tích, làm sạch, tính toán, tạo mới file Excel/CSV. | Khi cần xử lý số liệu, báo cáo, làm sạch dữ liệu lộn xộn hoặc import/export dữ liệu dạng bảng tính. |

*Lưu ý: Bạn cũng có một số kỹ năng khác nằm trong thư mục cài đặt dự án* `.agents/skills/` *không được liệt kê trong thư mục toàn cục này.*