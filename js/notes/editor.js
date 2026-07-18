/**
 * Contenteditable rich editor: toolbar + clipboard paste (HTML / images).
 */

function wrapSelection(tag, style = null) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const el = document.createElement(tag);
  if (style) el.setAttribute("style", style);
  try {
    range.surroundContents(el);
  } catch {
    const frag = range.extractContents();
    el.appendChild(frag);
    range.insertNode(el);
  }
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  sel.addRange(r);
}

function insertHtmlAtCaret(html) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const frag = document.createDocumentFragment();
  let node;
  let last = null;
  while ((node = tmp.firstChild)) last = frag.appendChild(node);
  range.insertNode(frag);
  if (last) {
    range.setStartAfter(last);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function createEditor({ initialHtml = "", initialTitle = "" } = {}) {
  const root = document.createElement("div");
  root.className = "notes-editor";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "notes-title-input";
  titleInput.placeholder = "Note title";
  titleInput.value = initialTitle;

  const toolbar = document.createElement("div");
  toolbar.className = "notes-toolbar";
  toolbar.innerHTML = `
    <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
    <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
    <label class="notes-toolbar-label">Size
      <select data-cmd="fontSize">
        <option value="">Default</option>
        <option value="12px">12</option>
        <option value="14px">14</option>
        <option value="16px">16</option>
        <option value="18px">18</option>
        <option value="24px">24</option>
        <option value="32px">32</option>
      </select>
    </label>
    <label class="notes-toolbar-label">Weight
      <select data-cmd="fontWeight">
        <option value="">Default</option>
        <option value="400">Regular</option>
        <option value="600">Semibold</option>
        <option value="700">Bold</option>
      </select>
    </label>
  `;

  const surface = document.createElement("div");
  surface.className = "notes-surface";
  surface.contentEditable = "true";
  surface.setAttribute("role", "textbox");
  surface.setAttribute("aria-multiline", "true");
  surface.innerHTML = initialHtml || "<p><br></p>";

  surface.addEventListener("paste", async (e) => {
    e.preventDefault();
    const cd = e.clipboardData;
    if (!cd) return;

    const items = [...(cd.items || [])];
    const imageItem = items.find((it) => it.type.startsWith("image/"));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        const url = await fileToDataUrl(file);
        insertHtmlAtCaret(`<img src="${url}" alt="pasted image" />`);
        return;
      }
    }

    const html = cd.getData("text/html");
    if (html) {
      const cleaned = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "");
      insertHtmlAtCaret(cleaned);
      return;
    }

    const text = cd.getData("text/plain");
    if (text) {
      insertHtmlAtCaret(text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>"));
    }
  });

  toolbar.addEventListener("mousedown", (e) => {
    // Keep selection in the editor
    if (e.target.closest("button, select")) e.preventDefault();
  });

  toolbar.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cmd]");
    if (!btn) return;
    surface.focus();
    const cmd = btn.dataset.cmd;
    if (cmd === "bold" || cmd === "italic" || cmd === "underline") {
      document.execCommand(cmd, false, null);
    }
  });

  toolbar.addEventListener("change", (e) => {
    const sel = e.target.closest("select[data-cmd]");
    if (!sel || !sel.value) return;
    surface.focus();
    if (sel.dataset.cmd === "fontSize") wrapSelection("span", `font-size:${sel.value}`);
    if (sel.dataset.cmd === "fontWeight") wrapSelection("span", `font-weight:${sel.value}`);
    sel.value = "";
  });

  root.appendChild(titleInput);
  root.appendChild(toolbar);
  root.appendChild(surface);

  return {
    root,
    getTitle: () => titleInput.value.trim(),
    setTitle: (t) => {
      titleInput.value = t || "";
    },
    getHtml: () => surface.innerHTML,
    setHtml: (html) => {
      surface.innerHTML = html || "<p><br></p>";
    },
    focus: () => {
      if (!titleInput.value) titleInput.focus();
      else surface.focus();
    },
    focusTitle: () => titleInput.focus(),
  };
}
