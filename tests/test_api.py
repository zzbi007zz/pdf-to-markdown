import io
import zipfile
import pymupdf
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def create_sample_pdf(text: str = "Test PDF Document for AI Agent") -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((50, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["engine"] == "pymupdf4llm"


def test_serve_index():
    response = client.get("/")
    assert response.status_code == 200
    assert "PDF &rarr; Markdown" in response.text
    assert "for AI Agents" in response.text


def test_convert_single_pdf_api():
    pdf_bytes = create_sample_pdf("FastAPI conversion test")
    files = {"file": ("sample.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    data = {"include_frontmatter": "true", "include_page_markers": "true"}

    response = client.post("/api/convert", files=files, data=data)
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["filename"] == "sample.pdf"
    assert "FastAPI conversion test" in payload["markdown"]
    assert "<!-- Page 1 -->" in payload["markdown"]


def test_convert_single_pdf_download():
    pdf_bytes = create_sample_pdf("Download mode test")
    files = {"file": ("report.pdf", io.BytesIO(pdf_bytes), "application/pdf")}

    response = client.post("/api/convert?download=true", files=files)
    assert response.status_code == 200
    assert "text/markdown" in response.headers["content-type"]
    assert 'filename="report.md"' in response.headers.get("content-disposition", "")
    assert "Download mode test" in response.text


def test_convert_invalid_file_extension():
    files = {"file": ("test.txt", io.BytesIO(b"Hello text"), "text/plain")}
    response = client.post("/api/convert", files=files)
    assert response.status_code == 400
    assert "Only PDF files are supported" in response.json()["detail"]


def test_batch_convert_json():
    pdf1 = create_sample_pdf("Document 1 content")
    pdf2 = create_sample_pdf("Document 2 content")

    files = [
        ("files", ("doc1.pdf", io.BytesIO(pdf1), "application/pdf")),
        ("files", ("doc2.pdf", io.BytesIO(pdf2), "application/pdf")),
    ]

    response = client.post("/api/batch-convert", files=files)
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["total_submitted"] == 2
    assert payload["converted_count"] == 2
    assert len(payload["results"]) == 2


def test_batch_convert_zip():
    pdf1 = create_sample_pdf("Document 1 content")
    pdf2 = create_sample_pdf("Document 2 content")

    files = [
        ("files", ("doc1.pdf", io.BytesIO(pdf1), "application/pdf")),
        ("files", ("doc2.pdf", io.BytesIO(pdf2), "application/pdf")),
    ]

    response = client.post("/api/batch-convert?format=zip", files=files)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="converted_markdowns.zip"' in response.headers.get("content-disposition", "")

    # Verify zip content
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        names = z.namelist()
        assert "doc1.md" in names
        assert "doc2.md" in names
        assert len(names) == 2


def test_zip_markdowns_endpoint():
    payload = {
        "files": [
            {"filename": "guide.md", "content": "# Guide content"},
            {"filename": "notes.md", "content": "## Notes content"},
        ]
    }
    response = client.post("/api/zip-markdowns", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="converted_markdowns.zip"' in response.headers.get("content-disposition", "")

    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        names = z.namelist()
        assert "guide.md" in names
        assert "notes.md" in names
        assert z.read("guide.md").decode("utf-8") == "# Guide content"

