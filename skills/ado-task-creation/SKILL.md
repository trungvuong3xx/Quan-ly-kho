---
name: ado-task-creation
description: >-
  Use this skill when the user asks to create one or more tasks or work items in Azure DevOps (ADO) for the current project.
---

# Azure DevOps Task Creation

This skill provides strict rules and procedures for creating Tasks in Azure DevOps to ensure they are correctly placed within the project's hierarchy and follow standard naming conventions.

## Core Rules

1. **Hierarchy Strictness**: All new tasks MUST follow this hierarchy:
   `Epic (Tên dự án)` -> `Feature (Workflow lớn của dự án)` -> `Product Backlog Item (PBI)` -> `Task`.
   Tuyệt đối KHÔNG gắn trực tiếp Task vào Epic hoặc Feature. Bạn phải tìm PBI (Product Backlog Item) hoặc User Story phù hợp nhất để làm parent.
2. **Naming Convention**: Tên của Task LUÔN LUÔN phải bắt đầu bằng tiền tố `[Dev] `. (Ví dụ: `[Dev] Update captcha logic`).
3. **Isolation**: BẮT BUỘC chỉ được phép truy vấn (query) và tạo work item trong dự án **`AFusion-Rpa`**. Tuyệt đối không truy cập hoặc tạo task ở các project khác. Luôn luôn sử dụng cờ `--project AFusion-Rpa` trong mọi câu lệnh.

## Execution Steps (Quy trình thực hiện)

### Bước 1: Xác định cấu trúc (Hierarchy)
Tuyệt đối không đoán mò Parent ID. Bạn phải truy vấn để tìm ra ID chính xác.

*   **Tìm Epic**: Truy vấn tìm Epic mang tên dự án con (ví dụ: "Cholimex", "VistraTL") bên trong project `AFusion-Rpa`.
    ```bash
    az boards query --project AFusion-Rpa --wiql "SELECT [System.Id], [System.Title] FROM workitems WHERE [System.TeamProject] = 'AFusion-Rpa' AND [System.WorkItemType] = 'Epic' AND [System.Title] CONTAINS '<TênDựÁn>'"
    ```
*   **Tìm PBI (Backlog) phù hợp**: Truy vấn các PBI đang mở thuộc project `AFusion-Rpa` để tìm ra backlog phù hợp nhất với workflow đang làm.
    ```bash
    az boards query --project AFusion-Rpa --wiql "SELECT [System.Id], [System.Title] FROM workitems WHERE [System.TeamProject] = 'AFusion-Rpa' AND [System.WorkItemType] = 'Product Backlog Item' AND [System.State] <> 'Closed'"
    ```
*   Nếu có nhiều Backlog Item, hãy dùng tool `ask_question` để hỏi người dùng xem nên gán Task vào PBI nào. Hoặc nếu ngữ cảnh đã cực kỳ rõ ràng, hãy tự chọn PBI phù hợp nhất.

### Bước 2: Tạo Task
Khi đã có `Parent ID` (ID của PBI), hãy tiến hành tạo task thông qua PowerShell script.

*   Phải đảm bảo gắn `[Dev] ` trước title.
*   Assign task cho người dùng hiện tại (thường là `Khanh Dinh Quoc` hoặc tùy theo output ADO).
*   Chạy lệnh PowerShell tạo task và link vào Parent:
    ```powershell
    $parentId = <PBI_ID>
    $task1 = az boards work-item create --project AFusion-Rpa --title "[Dev] <Nội dung task>" --type "Task" --assigned-to "Khanh Dinh Quoc" --query "id" -o tsv
    az boards work-item relation add --id $task1 --relation-type "parent" --target-id $parentId
    ```

### Bước 3: Xác nhận
Cung cấp ID và URL của các Task vừa tạo cho người dùng kiểm tra. Nhắc lại cấu trúc cây đã liên kết để người dùng an tâm.
