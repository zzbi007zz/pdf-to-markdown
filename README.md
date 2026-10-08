# PDF to Markdown Converter for AI Agents

Ứng dụng web và REST API chuyển đổi tệp PDF sang Markdown (.md) chuẩn hóa, được thiết kế tối ưu riêng cho **AI Agents** (LLMs, RAG pipelines, CrewAI, n8n, LangChain).

---

## 🌟 Tính năng nổi bật

1. **Tối ưu hóa riêng cho AI Agent**:
   - **Tự động thêm YAML Frontmatter**: Chứa tên file gốc, tổng số trang, ước lượng token (`estimated_tokens`), thời gian chuyển đổi.
   - **Đánh dấu phân trang**: Thêm `<!-- Page X -->` phân định rõ ràng giữa các trang giúp Agent trích dẫn nguồn (source citations) và chunking chuẩn xác.
   - **Bảo toàn bảng biểu và định dạng**: Sử dụng `PyMuPDF4LLM` giúp trích xuất bảng (markdown tables), code block và tiêu đề với độ chính xác cao.
2. **100% Cục bộ & Bảo mật (Offline)**:
   - Xử lý hoàn toàn trên máy local, không gửi tài liệu ra internet, không phụ thuộc API key.
3. **Giao diện Web hiện đại (Tailwind CSS)**:
   - Kéo thả hàng loạt (Batch drag-and-drop).
   - Xem trước Markdown song song: Giao diện trực quan (Rendered Preview) & mã thô (Raw Markdown).
   - Tải về từng file `.md`, sao chép 1-click hoặc tải trọn bộ bằng file `.zip`.
4. **REST API cho Agent**:
   - Tích hợp 1 dòng lệnh qua `curl` hoặc Python script cho các agent tự động hóa.

---

## 🚀 Cài đặt & Khởi chạy

### Yêu cầu
- Python 3.10+ (Khuyến nghị 3.11)

### Khởi chạy nhanh

1. Kích hoạt môi trường ảo:
```bash
source .venv/bin/activate
```

2. Cài đặt thư viện (nếu chưa cài):
```bash
pip install -r requirements.txt
```

3. Khởi động Web App:
```bash
python run.py
```
- Truy cập giao diện Web: [http://localhost:8000](http://localhost:8000)
- Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🤖 Tích hợp REST API cho AI Agent

### 1. Chuyển đổi PDF đơn lẻ (Single File)

```bash
curl -X POST "http://localhost:8000/api/convert" \
  -F "file=@document.pdf" \
  -F "include_frontmatter=true" \
  -F "include_page_markers=true"
```

**JSON Trả về:**
```json
{
  "success": true,
  "filename": "document.pdf",
  "metadata": {
    "source_file": "document.pdf",
    "total_pages": 5,
    "estimated_tokens": 1420,
    "converted_at": "2026-10-07T14:50:00+00:00"
  },
  "markdown": "---\nsource_file: \"document.pdf\"\ntotal_pages: 5\nestimated_tokens: 1420\nconverted_at: \"2026-10-07T14:50:00+00:00\"\n---\n\n<!-- Page 1 -->\n\n# Nội dung tài liệu..."
}
```

Nếu muốn tải trực tiếp file `.md` về đĩa:
```bash
curl -X POST "http://localhost:8000/api/convert?download=true" \
  -F "file=@document.pdf" \
  -o "document.md"
```

### 2. Chuyển đổi hàng loạt & Tải file ZIP (Batch Convert)

```bash
curl -X POST "http://localhost:8000/api/batch-convert?format=zip" \
  -F "files=@file1.pdf" \
  -F "files=@file2.pdf" \
  -o "converted_markdowns.zip"
```

### 3. Tích hợp Python

```python
import requests

with open("sample.pdf", "rb") as f:
    response = requests.post(
        "http://localhost:8000/api/convert",
        files={"file": f},
        data={"include_frontmatter": True, "include_page_markers": True}
    )

result = response.json()
print("Estimated Tokens:", result["metadata"]["estimated_tokens"])
print("Markdown Preview:\n", result["markdown"][:200])
```

---

## 🧪 Chạy Test

Hệ thống đi kèm bộ kiểm thử tự động toàn diện:
```bash
./.venv/bin/pytest tests/ -v
```
