#!/usr/bin/env python3
"""Entrypoint script to launch the PDF to Markdown web application and API."""

import uvicorn

if __name__ == "__main__":
    print("=" * 60)
    print("  PDF to Markdown for AI Agents")
    print("  Running at: http://localhost:8000")
    print("  API Docs:   http://localhost:8000/docs")
    print("=" * 60)
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
