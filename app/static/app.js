// State management
let fileQueue = [];
let currentPreviewIndex = null;

// DOM Elements
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const queueSection = document.getElementById("queue-section");
const fileCountBadge = document.getElementById("file-count-badge");
const fileListTbody = document.getElementById("file-list-tbody");
const btnConvertAll = document.getElementById("btn-convert-all");
const btnDownloadZip = document.getElementById("btn-download-zip");
const btnClearAll = document.getElementById("btn-clear-all");

const optFrontmatter = document.getElementById("opt-frontmatter");
const optPageMarkers = document.getElementById("opt-pagemarkers");
const optOcr = document.getElementById("opt-ocr");

// Modal Elements
const previewModal = document.getElementById("preview-modal");
const modalFilename = document.getElementById("modal-filename");
const modalTokenBadge = document.getElementById("modal-token-badge");
const btnTabPreview = document.getElementById("btn-tab-preview");
const btnTabRaw = document.getElementById("btn-tab-raw");
const btnModalCopy = document.getElementById("btn-modal-copy");
const btnModalDownload = document.getElementById("btn-modal-download");
const btnModalClose = document.getElementById("btn-modal-close");
const modalContentRendered = document.getElementById("modal-content-rendered");
const modalContentRaw = document.getElementById("modal-content-raw");

// Utility to format file sizes
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Drag & drop event listeners
dropZone.addEventListener("click", () => fileInput.click());

["dragenter", "dragover"].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("border-indigo-500", "bg-slate-900/80");
  });
});

["dragleave", "drop"].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("border-indigo-500", "bg-slate-900/80");
  });
});

dropZone.addEventListener("drop", (e) => {
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length > 0) {
    handleFiles(Array.from(dt.files));
  }
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFiles(Array.from(e.target.files));
    fileInput.value = ""; // Reset
  }
});

function handleFiles(files) {
  const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith(".pdf"));
  if (pdfFiles.length === 0) {
    alert("Vui lòng chọn tệp có định dạng .pdf!");
    return;
  }

  for (const file of pdfFiles) {
    // Avoid exact duplicate in queue
    if (!fileQueue.some(item => item.file.name === file.name && item.file.size === file.size)) {
      fileQueue.push({
        id: Math.random().toString(36).substr(2, 9),
        file: file,
        status: "waiting", // waiting | converting | done | error
        error: null,
        markdown: null,
        metadata: null,
      });
    }
  }

  renderQueue();
}

function renderQueue() {
  if (fileQueue.length === 0) {
    queueSection.classList.add("hidden");
    return;
  }

  queueSection.classList.remove("hidden");
  fileCountBadge.textContent = `${fileQueue.length} files`;

  const doneCount = fileQueue.filter(f => f.status === "done").length;
  if (doneCount === fileQueue.length && doneCount > 0) {
    btnDownloadZip.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
      Tải về ZIP (${doneCount} files)
    `;
  } else if (doneCount > 0) {
    btnDownloadZip.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
      Tải về ZIP (${doneCount} đã xong)
    `;
  } else {
    btnDownloadZip.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
      Chuyển đổi & Tải về ZIP
    `;
  }

  fileListTbody.innerHTML = fileQueue.map((item, idx) => {
    let statusBadge = "";
    if (item.status === "waiting") {
      statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300">Chờ xử lý</span>';
    } else if (item.status === "converting") {
      statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-900/60 text-indigo-300 animate-pulse">Đang chuyển đổi...</span>';
    } else if (item.status === "done") {
      statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/60 text-emerald-300">Thành công</span>';
    } else if (item.status === "error") {
      statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-900/60 text-rose-300" title="${item.error || 'Lỗi'}">Lỗi</span>`;
    }

    const pages = item.metadata ? item.metadata.total_pages : "-";
    const tokens = item.metadata ? item.metadata.estimated_tokens.toLocaleString() : "-";

    const actions = item.status === "done" ? `
      <div class="flex items-center justify-end space-x-2">
        <button onclick="openPreview(${idx})" class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition" title="Xem trước">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
        <button onclick="copyMarkdownItem(${idx})" class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition" title="Sao chép Markdown">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
        </button>
        <button onclick="downloadMarkdownItem(${idx})" class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition" title="Tải về .md">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
        </button>
        <button onclick="removeItem(${idx})" class="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition" title="Xóa">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    ` : `
      <div class="flex items-center justify-end space-x-2">
        <button onclick="convertItem(${idx})" class="text-xs font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition">Convert</button>
        <button onclick="removeItem(${idx})" class="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition" title="Xóa">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    `;

    return `
      <tr class="hover:bg-slate-900/40 transition-colors">
        <td class="py-3 px-4 font-medium text-slate-200 flex items-center gap-2">
          <svg class="w-4 h-4 text-rose-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
          </svg>
          <span class="truncate max-w-xs" title="${item.file.name}">${item.file.name}</span>
        </td>
        <td class="py-3 px-4 text-xs text-slate-400">${formatFileSize(item.file.size)}</td>
        <td class="py-3 px-4 text-xs text-slate-300">${pages}</td>
        <td class="py-3 px-4 text-xs text-indigo-300">${tokens}</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4 text-right">${actions}</td>
      </tr>
    `;
  }).join("");
}

function removeItem(index) {
  fileQueue.splice(index, 1);
  renderQueue();
}

btnClearAll.addEventListener("click", () => {
  fileQueue = [];
  renderQueue();
});

// Single item conversion
async function convertItem(index) {
  const item = fileQueue[index];
  if (!item) return;

  item.status = "converting";
  renderQueue();

  const formData = new FormData();
  formData.append("file", item.file);
  formData.append("include_frontmatter", optFrontmatter.checked);
  formData.append("include_page_markers", optPageMarkers.checked);
  formData.append("use_ocr", optOcr ? optOcr.checked : false);

  try {
    const res = await fetch("/api/convert", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Chuyển đổi thất bại" }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    item.status = "done";
    item.markdown = data.markdown;
    item.metadata = data.metadata;
  } catch (err) {
    item.status = "error";
    item.error = err.message;
  }

  renderQueue();
}

// Convert all items
btnConvertAll.addEventListener("click", async () => {
  btnConvertAll.disabled = true;
  btnConvertAll.classList.add("opacity-50");

  for (let i = 0; i < fileQueue.length; i++) {
    if (fileQueue[i].status !== "done") {
      await convertItem(i);
    }
  }

  btnConvertAll.disabled = false;
  btnConvertAll.classList.remove("opacity-50");
});

// Download all as ZIP (Instant client-side zipping with auto-convert fallback)
btnDownloadZip.addEventListener("click", async () => {
  if (fileQueue.length === 0) return;

  btnDownloadZip.disabled = true;
  const originalHtml = btnDownloadZip.innerHTML;

  try {
    // 1. If any file is not yet converted, convert them first
    const pendingIndices = [];
    fileQueue.forEach((f, idx) => {
      if (f.status !== "done") pendingIndices.push(idx);
    });

    if (pendingIndices.length > 0) {
      for (let i = 0; i < pendingIndices.length; i++) {
        const targetIdx = pendingIndices[i];
        btnDownloadZip.textContent = `Đang chuyển đổi (${i + 1}/${pendingIndices.length})...`;
        await convertItem(targetIdx);
      }
    }

    // 2. Collect all successfully converted items
    const doneFiles = fileQueue.filter(f => f.status === "done" && f.markdown);
    if (doneFiles.length === 0) {
      alert("Không có file nào được chuyển đổi thành công để tải về.");
      return;
    }

    btnDownloadZip.textContent = "Đang nén ZIP...";

    // 3. Fast Instant ZIP via JSZip
    if (window.JSZip) {
      const zip = new JSZip();
      const usedNames = new Set();

      doneFiles.forEach(item => {
        const base = item.file.name.replace(/\.[^/.]+$/, "");
        let targetName = `${base}.md`;
        let count = 1;
        while (usedNames.has(targetName)) {
          targetName = `${base}_${count}.md`;
          count++;
        }
        usedNames.add(targetName);
        zip.file(targetName, item.markdown);
      });

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "converted_markdowns.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } else {
      // 4. Server-side zip endpoint fallback using the already-converted markdown texts
      const payload = {
        files: doneFiles.map(item => ({
          filename: item.file.name.replace(/\.[^/.]+$/, "") + ".md",
          content: item.markdown,
        }))
      };

      const res = await fetch("/api/zip-markdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Tải file ZIP thất bại từ server");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "converted_markdowns.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  } catch (err) {
    alert("Lỗi khi tải file zip: " + err.message);
  } finally {
    btnDownloadZip.disabled = false;
    renderQueue();
  }
});

// Download single item markdown
function downloadMarkdownItem(index) {
  const item = fileQueue[index];
  if (!item || !item.markdown) return;

  const blob = new Blob([item.markdown], { type: "text/markdown;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  const baseName = item.file.name.replace(/\.[^/.]+$/, "");
  a.href = url;
  a.download = `${baseName}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// Copy single item markdown
function copyMarkdownItem(index) {
  const item = fileQueue[index];
  if (!item || !item.markdown) return;

  navigator.clipboard.writeText(item.markdown).then(() => {
    alert("Đã sao chép Markdown vào bộ nhớ tạm!");
  });
}

// Open Preview Modal
function openPreview(index) {
  const item = fileQueue[index];
  if (!item || !item.markdown) return;

  currentPreviewIndex = index;
  modalFilename.textContent = item.file.name;
  modalTokenBadge.textContent = `${item.metadata.estimated_tokens.toLocaleString()} tokens (~${item.metadata.total_pages} trang)`;

  // Render markdown with marked
  modalContentRendered.innerHTML = marked.parse(item.markdown);
  modalContentRaw.value = item.markdown;

  // Show rendered by default
  showPreviewTab("rendered");

  previewModal.classList.remove("hidden");
}

function showPreviewTab(tab) {
  if (tab === "rendered") {
    btnTabPreview.classList.add("bg-indigo-600", "text-white");
    btnTabPreview.classList.remove("text-slate-400");
    btnTabRaw.classList.remove("bg-indigo-600", "text-white");
    btnTabRaw.classList.add("text-slate-400");
    modalContentRendered.classList.remove("hidden");
    modalContentRaw.classList.add("hidden");
  } else {
    btnTabRaw.classList.add("bg-indigo-600", "text-white");
    btnTabRaw.classList.remove("text-slate-400");
    btnTabPreview.classList.remove("bg-indigo-600", "text-white");
    btnTabPreview.classList.add("text-slate-400");
    modalContentRaw.classList.remove("hidden");
    modalContentRendered.classList.add("hidden");
  }
}

btnTabPreview.addEventListener("click", () => showPreviewTab("rendered"));
btnTabRaw.addEventListener("click", () => showPreviewTab("raw"));

btnModalCopy.addEventListener("click", () => {
  if (currentPreviewIndex !== null) {
    copyMarkdownItem(currentPreviewIndex);
  }
});

btnModalDownload.addEventListener("click", () => {
  if (currentPreviewIndex !== null) {
    downloadMarkdownItem(currentPreviewIndex);
  }
});

btnModalClose.addEventListener("click", () => {
  previewModal.classList.add("hidden");
  currentPreviewIndex = null;
});

// Close modal on escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !previewModal.classList.contains("hidden")) {
    previewModal.classList.add("hidden");
    currentPreviewIndex = null;
  }
});

// Copy snippet helper
function copySnippet(elementId) {
  const code = document.getElementById(elementId).innerText;
  navigator.clipboard.writeText(code).then(() => {
    alert("Đã sao chép đoạn mã tích hợp!");
  });
}
