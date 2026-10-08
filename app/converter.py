"""PDF to Markdown converter module tailored for AI Agent consumption.
Extracts structured Markdown from PDF files with page markers, token estimation,
and YAML frontmatter metadata.
"""

from __future__ import annotations

import datetime
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional
import pymupdf
import pymupdf4llm


def estimate_tokens(text: str) -> int:
    """Estimates LLM token count for given text using standard heuristic (~4 chars/token)."""
    if not text:
        return 0
    # Heuristic: roughly 1 token per 4 characters or ~1.3 tokens per word
    char_based = len(text) / 4.0
    word_based = len(text.split()) * 1.3
    return max(1, int(round((char_based + word_based) / 2.0)))


@dataclass
class ConversionResult:
    filename: str
    total_pages: int
    estimated_tokens: int
    markdown: str
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def convert_pdf(
    pdf_bytes: bytes,
    filename: str = "document.pdf",
    include_frontmatter: bool = True,
    include_page_markers: bool = True,
    use_ocr: bool = False,
) -> ConversionResult:
    """Converts PDF bytes into clean Markdown optimized for AI agents.

    Args:
        pdf_bytes: Binary content of the PDF file.
        filename: Name of the original file.
        include_frontmatter: Whether to prepend YAML frontmatter metadata.
        include_page_markers: Whether to include '<!-- Page X -->' markers between pages.
        use_ocr: Whether to run OCR on scanned pages/images (slower).

    Returns:
        ConversionResult containing markdown string and metadata.

    Raises:
        ValueError: If PDF is empty, encrypted, or corrupted.
    """
    if not pdf_bytes:
        raise ValueError("PDF content is empty.")

    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Unable to parse PDF file '{filename}': {str(e)}") from e

    try:
        if doc.is_encrypted:
            raise ValueError(f"PDF file '{filename}' is password protected / encrypted.")

        total_pages = len(doc)
        if total_pages == 0:
            raise ValueError(f"PDF file '{filename}' contains no pages.")

        # Extract markdown chunks page by page for granular page boundaries
        page_chunks: List[Dict[str, Any]] = pymupdf4llm.to_markdown(
            doc,
            page_chunks=True,
            use_ocr=use_ocr,
        )

        page_texts: List[str] = []
        for idx, chunk in enumerate(page_chunks, start=1):
            text = chunk.get("text", "").strip()
            if include_page_markers:
                page_header = f"<!-- Page {idx} -->\n\n"
                page_texts.append(page_header + text)
            else:
                page_texts.append(text)

        body_markdown = "\n\n---\n\n".join(page_texts)

        # Estimate tokens on the markdown body
        token_count = estimate_tokens(body_markdown)
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        metadata = {
            "source_file": filename,
            "total_pages": total_pages,
            "estimated_tokens": token_count,
            "converted_at": now_iso,
        }

        if include_frontmatter:
            frontmatter = (
                f"---\n"
                f'source_file: "{filename}"\n'
                f"total_pages: {total_pages}\n"
                f"estimated_tokens: {token_count}\n"
                f'converted_at: "{now_iso}"\n'
                f"---\n\n"
            )
            full_markdown = frontmatter + body_markdown
        else:
            full_markdown = body_markdown

        return ConversionResult(
            filename=filename,
            total_pages=total_pages,
            estimated_tokens=token_count,
            markdown=full_markdown,
            metadata=metadata,
        )
    finally:
        doc.close()
