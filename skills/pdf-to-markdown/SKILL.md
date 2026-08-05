---
name: pdf-to-markdown
description: |
  [TRIGGER] Use this skill when the user wants to convert PDF files to Markdown using the doc2md OCR API.
  Triggers for: "convert PDF to markdown", "pdf sang markdown", "ocr pdf", "doc2md",
  "chuyển pdf", "scan pdf to text", or any request to extract text/tables from PDFs via the afusion.ai API.
  [WHAT] This skill converts PDF files to Markdown by uploading them to the doc2md OCR API endpoint,
  extracting the `markdown` field from each page of the JSON response, and saving clean .md files.
  [BOUNDARY] Do not use this skill for general PDF operations (merge, split, encrypt). Use the `pdf` skill instead.
  This skill only handles PDF-to-Markdown conversion via the doc2md API.
license: Internal
---

# PDF to Markdown via doc2md API

Converts PDF files to Markdown using the OCR API at `https://idp-invoice-kie.afusion.ai/doc2md/ocr`.

## API Configuration

- **Endpoint:** `https://idp-invoice-kie.afusion.ai/doc2md/ocr`
- **Method:** `POST`
- **Auth:** `Authorization: Bearer iie_ecc7aa1b3b0d8afb04b6cf94c24459e87c9ae3982ae02651bdc4e388a699f5f5`
- **Content-Type:** `multipart/form-data`
- **Form field:** `file=@<pdf-path>;type=application/pdf`
- **Accept:** `application/json`

## Response Format

The API returns JSON with the following structure:

```json
{
  "project": "doc2md",
  "status": "success",
  "pages": [
    {
      "page_index": 0,
      "markdown": "..."
    }
  ],
  "audit": { ... },
  "error": null
}
```

**The output Markdown is in `pages[].markdown`, NOT the raw JSON response.**

## Workflow

### Step 1: Locate PDF Files

Find all PDF files to convert:

```powershell
# Find PDFs in a directory
Get-ChildItem -Path "<directory>" -Filter "*.pdf" -Recurse
```

If the user specifies particular files, use only those. Otherwise, convert all `.pdf` files found.

### Step 2: Create Output Directory

Create a `markdown` subdirectory inside the PDF source directory (or wherever the user specifies):

```powershell
$pdfDir = "<pdf-source-directory>"
$mdDir = Join-Path $pdfDir "markdown"
New-Item -ItemType Directory -Path $mdDir -Force
```

### Step 3: Convert Each PDF (Parallel)

Upload each PDF to the API in parallel. For each file:

```powershell
curl -s -X POST 'https://idp-invoice-kie.afusion.ai/doc2md/ocr' `
  -H 'accept: application/json' `
  -H 'Authorization: Bearer iie_ecc7aa1b3b0d8afb04b6cf94c24459e87c9ae3982ae02651bdc4e388a699f5f5' `
  -H 'Content-Type: multipart/form-data' `
  -F 'file=@<full-pdf-path>;type=application/pdf' `
  -o "<md-output-path>.json"
```

**Batch files in parallel.** Make one `curl` call per PDF in the same message for maximum speed.

### Step 4: Extract Markdown from JSON

The raw response is JSON. Extract the `markdown` field from each page and combine:

```powershell
$jsonFile = "<path-to-json-response>"
$mdFile = "$jsonFile.Replace('.json', '.md')"

$json = Get-Content -Path $jsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
$md = ($json.pages | ForEach-Object { $_.markdown }) -join "---`n`n"
[System.IO.File]::WriteAllText($mdFile, $md, [System.Text.UTF8Encoding]::new($false))
Remove-Item $jsonFile  # Clean up temp JSON
```

**Completion criterion:** Every .json file is converted to .md and the .json file is deleted.

### Step 5: Verify Results

List all generated Markdown files and report:

```powershell
Get-ChildItem $mdDir | Format-Table Name, Length -AutoSize
```

**Completion criterion:** All PDF files have corresponding .md files with non-zero size.

## Error Handling

| Scenario | Action |
|----------|--------|
| `json.error` is not null | Log error, skip file, report to user |
| `json.status` is not "success" | Log status, retry once with 600s timeout |
| File size > 500KB | Use `--max-time 600` flag (large files take longer to upload) |
| Empty `pages` array | File was not processed — retry or report |
| Empty `markdown` string | Server failed to OCR — retry once |

### Retry Logic for Large Files

Large PDFs (> 200KB) may timeout with default settings:

```powershell
curl -s -X POST 'https://idp-invoice-kie.afusion.ai/doc2md/ocr' `
  -H 'accept: application/json' `
  -H 'Authorization: Bearer iie_ecc7aa1b3b0d8afb04b6cf94c24459e87c9ae3982ae02651bdc4e388a699f5f5' `
  -H 'Content-Type: multipart/form-data' `
  -F 'file=@<full-pdf-path>;type=application/pdf' `
  -o "<md-output-path>.json" `
  --max-time 600
```

Use Bash timeout of `650000`ms for large files.

## Important Notes

- **Always extract `markdown` from JSON** — never save the raw JSON response as .md
- **Join multi-page documents** with `---` separator between pages
- **UTF-8 without BOM** — use `[System.Text.UTF8Encoding]::new($false)`
- **Parallel uploads** — convert multiple PDFs simultaneously for speed
- **Clean up** — always delete temporary .json files after extraction