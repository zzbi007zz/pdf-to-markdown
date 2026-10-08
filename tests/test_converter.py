import pymupdf
import pytest

from app.converter import ConversionResult, convert_pdf, estimate_tokens


def create_sample_pdf(pages_text: list[str]) -> bytes:
    """Helper to generate a clean PDF in memory."""
    doc = pymupdf.open()
    for text in pages_text:
        page = doc.new_page()
        page.insert_text((50, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_estimate_tokens():
    assert estimate_tokens("") == 0
    short_text = "Hello world this is a test"
    tokens = estimate_tokens(short_text)
    assert tokens > 0


def test_convert_pdf_success():
    pdf_bytes = create_sample_pdf([
        "Chapter 1: Introduction to AI Agents.\nAgents require structured context.",
        "Chapter 2: Working with Markdown.\nMarkdown keeps tokens low and structure clean.",
    ])

    res = convert_pdf(
        pdf_bytes=pdf_bytes,
        filename="ai_guide.pdf",
        include_frontmatter=True,
        include_page_markers=True,
    )

    assert isinstance(res, ConversionResult)
    assert res.filename == "ai_guide.pdf"
    assert res.total_pages == 2
    assert res.estimated_tokens > 0

    # Verify YAML frontmatter presence
    assert res.markdown.startswith("---\n")
    assert 'source_file: "ai_guide.pdf"' in res.markdown
    assert "total_pages: 2" in res.markdown

    # Verify page markers
    assert "<!-- Page 1 -->" in res.markdown
    assert "<!-- Page 2 -->" in res.markdown


def test_convert_pdf_without_frontmatter_and_markers():
    pdf_bytes = create_sample_pdf(["Only content here."])

    res = convert_pdf(
        pdf_bytes=pdf_bytes,
        filename="minimal.pdf",
        include_frontmatter=False,
        include_page_markers=False,
    )

    assert not res.markdown.startswith("---\n")
    assert "<!-- Page 1 -->" not in res.markdown
    assert res.total_pages == 1


def test_convert_pdf_empty_bytes():
    with pytest.raises(ValueError, match="empty"):
        convert_pdf(b"", filename="empty.pdf")


def test_convert_pdf_corrupted_bytes():
    with pytest.raises(ValueError, match="Unable to parse"):
        convert_pdf(b"This is completely invalid PDF content", filename="corrupt.pdf")
