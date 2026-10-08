"""FastAPI server for PDF to Markdown converter.
Serves web interface and provides REST APIs for human users and AI agents.
"""

from __future__ import annotations

import asyncio
import io
from pathlib import Path
from typing import List, Optional
import zipfile

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.converter import convert_pdf

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="PDF to Markdown Converter for AI Agents",
    description="High-performance, offline PDF to Markdown conversion API and Web UI.",
    version="1.0.0",
)

# Enable CORS for external Agent workflows (curl, automation scripts, browser extensions)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MarkdownFileItem(BaseModel):
    filename: str
    content: str


class ZipRequest(BaseModel):
    files: List[MarkdownFileItem]


@app.get("/api/health")
async def health_check():
    """Health check endpoint for agent monitoring."""
    return {"status": "ok", "engine": "pymupdf4llm", "service": "pdf-to-md"}


@app.post("/api/convert")
async def convert_single_pdf(
    file: UploadFile = File(...),
    include_frontmatter: bool = Form(True),
    include_page_markers: bool = Form(True),
    use_ocr: bool = Form(False),
    download: bool = Query(False, description="Return raw markdown file as attachment if true"),
):
    """Converts a single PDF file into agent-ready Markdown."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        res = await asyncio.to_thread(
            convert_pdf,
            pdf_bytes=content,
            filename=file.filename,
            include_frontmatter=include_frontmatter,
            include_page_markers=include_page_markers,
            use_ocr=use_ocr,
        )

        if download:
            out_name = f"{Path(file.filename).stem}.md"
            return Response(
                content=res.markdown,
                media_type="text/markdown; charset=utf-8",
                headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
            )

        return JSONResponse(
            content={
                "success": True,
                "filename": res.filename,
                "metadata": res.metadata,
                "markdown": res.markdown,
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion error: {str(e)}") from e


@app.post("/api/batch-convert")
async def convert_batch_pdfs(
    files: List[UploadFile] = File(...),
    include_frontmatter: bool = Form(True),
    include_page_markers: bool = Form(True),
    use_ocr: bool = Form(False),
    format: Optional[str] = Query(None, description="Set to 'zip' to download all converted markdown files as a zip archive"),
):
    """Converts multiple PDF files into agent-ready Markdown in batch."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    results = []
    errors = []

    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            errors.append({"filename": file.filename, "error": "Not a PDF file"})
            continue

        try:
            content = await file.read()
            if not content:
                errors.append({"filename": file.filename, "error": "Empty file"})
                continue

            res = await asyncio.to_thread(
                convert_pdf,
                pdf_bytes=content,
                filename=file.filename,
                include_frontmatter=include_frontmatter,
                include_page_markers=include_page_markers,
                use_ocr=use_ocr,
            )
            results.append(res)
        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})

    # If client requested a zip archive download
    if format == "zip":
        if not results:
            detail_msg = errors[0]["error"] if errors else "No files could be converted."
            raise HTTPException(status_code=400, detail=detail_msg)

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            used_names = set()
            for res in results:
                base_stem = Path(res.filename).stem
                target_name = f"{base_stem}.md"
                count = 1
                while target_name in used_names:
                    target_name = f"{base_stem}_{count}.md"
                    count += 1
                used_names.add(target_name)
                zip_file.writestr(target_name, res.markdown.encode("utf-8"))

        zip_buffer.seek(0)
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="converted_markdowns.zip"'},
        )

    return JSONResponse(
        content={
            "success": len(results) > 0,
            "total_submitted": len(files),
            "converted_count": len(results),
            "results": [r.to_dict() for r in results],
            "errors": errors,
        }
    )


@app.post("/api/zip-markdowns")
async def zip_markdown_files(req: ZipRequest):
    """Zips an array of already-converted markdown texts into a single ZIP file immediately."""
    if not req.files:
        raise HTTPException(status_code=400, detail="No files provided to zip.")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        used_names = set()
        for item in req.files:
            target_name = item.filename
            if not target_name.endswith(".md"):
                target_name = f"{target_name}.md"
            base_stem = Path(target_name).stem
            count = 1
            while target_name in used_names:
                target_name = f"{base_stem}_{count}.md"
                count += 1
            used_names.add(target_name)
            zip_file.writestr(target_name, item.content.encode("utf-8"))

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="converted_markdowns.zip"'},
    )


# Mount static assets directory and serve index.html at root
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "PDF to Markdown API is running. Web UI not found."}
