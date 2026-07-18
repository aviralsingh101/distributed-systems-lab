import {
  checkHealth, listNotes, getNote, createNote, updateNote, deleteNote, NotesApiError,
} from "./api.js";
import { createEditor } from "./editor.js";

let notesCache = [];
let available = null;

export function getNotesCache() {
  return notesCache;
}

export async function refreshNotesAvailability() {
  try {
    await checkHealth();
    available = true;
    notesCache = await listNotes();
    return { available: true, notes: notesCache };
  } catch {
    available = false;
    notesCache = [];
    return { available: false, notes: [] };
  }
}

export function isNotesAvailable() {
  return available;
}

function unavailableBanner() {
  return `<div class="notes-banner err" role="status">
    <strong>Notes unavailable</strong> — start the local Docker stack
    (<code>docker compose up -d</code>) and open <code>http://127.0.0.1:8080</code>.
    GitHub Pages cannot reach your private Postgres.
  </div>`;
}

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isBlankHtml(html) {
  const text = String(html || "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
  return !text;
}

export function renderNotesHub(appEl, crumbsEl) {
  crumbsEl.innerHTML = `<a href="#/">Home</a> / <b>Notes</b>`;
  if (available === false) {
    appEl.innerHTML = `
      <div class="topic notes-page">
        <div class="topic-header">
          <div class="kicker">Private</div>
          <h1>Notes</h1>
          <div class="oneliner">Personal learning notes — stored only in your local Docker Postgres.</div>
        </div>
        ${unavailableBanner()}
        <p class="notes-hint">After Compose is up, refresh this page or click Notes again.</p>
      </div>`;
    return;
  }

  const items = notesCache
    .map(
      (n) => `<li>
        <a class="notes-list-link" href="#/notes/${n.id}">
          <span class="notes-list-title">${escapeHtml(n.title || "Untitled")}</span>
          <span class="notes-list-meta">${formatWhen(n.updated_at)}</span>
        </a>
      </li>`
    )
    .join("");

  appEl.innerHTML = `
    <div class="topic notes-page">
      <div class="topic-header notes-hub-header">
        <div>
          <div class="kicker">Private</div>
          <h1>Notes</h1>
          <div class="oneliner">Your learning notes — open one to read, edit when you need to.</div>
        </div>
        <a class="notes-btn primary" href="#/notes/new">New note</a>
      </div>
      ${notesCache.length ? `<ul class="notes-list">${items}</ul>` : `<p class="notes-hint">No notes yet. Create one to get started.</p>`}
    </div>`;
}

/**
 * Saved notes open in reading mode (prose only).
 * New notes, or Edit, open the rich editor with Save / Cancel / Delete.
 */
export async function renderNoteEditor(appEl, crumbsEl, noteId) {
  const isNew = !noteId || noteId === "new";
  crumbsEl.innerHTML = `<a href="#/">Home</a> / <a href="#/track/notes">Notes</a> / <b>${isNew ? "New" : "…"}</b>`;

  if (available === false) {
    appEl.innerHTML = `<div class="topic notes-page">${unavailableBanner()}<p><a class="notes-back" href="#/track/notes">← Back to Notes</a></p></div>`;
    return;
  }

  appEl.innerHTML = `<div class="topic notes-page"><div class="loading">Loading note…</div></div>`;

  let note = { id: null, title: "", body_html: "", updated_at: null };
  if (!isNew) {
    try {
      note = await getNote(noteId);
    } catch (e) {
      appEl.innerHTML = `<div class="topic notes-page">
        <div class="notes-banner err">${escapeHtml(e.message || "Cannot load note")}</div>
        <p><a class="notes-back" href="#/track/notes">← Back to Notes</a></p>
      </div>`;
      return;
    }
  }

  const wrap = document.createElement("div");
  wrap.className = "topic notes-page";
  appEl.innerHTML = "";
  appEl.appendChild(wrap);

  let mode = isNew ? "edit" : "view";
  let editor = null;
  let snapshot = {
    title: note.title || "",
    body_html: note.body_html || "",
  };

  const setCrumbs = (title) => {
    const label = isNew && mode === "edit" ? "New" : (title || "Untitled");
    crumbsEl.innerHTML = `<a href="#/">Home</a> / <a href="#/track/notes">Notes</a> / <b>${escapeHtml(label)}</b>`;
  };

  const render = () => {
    if (mode === "view") {
      renderView();
    } else {
      renderEdit();
    }
  };

  function renderView() {
    editor = null;
    const title = snapshot.title || "Untitled";
    const body = isBlankHtml(snapshot.body_html)
      ? `<p class="notes-empty">This note is empty. Click Edit to add content.</p>`
      : snapshot.body_html;
    const updated = note.updated_at
      ? `<time class="notes-meta" datetime="${escapeHtml(note.updated_at)}">Updated ${formatWhen(note.updated_at)}</time>`
      : "";

    setCrumbs(title);
    wrap.innerHTML = `
      <header class="notes-view-header">
        <a class="notes-back" href="#/track/notes">← Notes</a>
        <button type="button" class="notes-btn notes-edit-trigger" id="notes-edit">Edit</button>
      </header>
      <article class="notes-reading">
        <h1 class="notes-reading-title">${escapeHtml(title)}</h1>
        ${updated}
        <div class="notes-reading-body prose">${body}</div>
      </article>
    `;

    wrap.querySelector("#notes-edit").addEventListener("click", () => {
      mode = "edit";
      render();
    });
  }

  function renderEdit() {
    setCrumbs(snapshot.title || (isNew ? "New" : "Untitled"));
    wrap.innerHTML = `
      <header class="notes-edit-header">
        <div class="notes-edit-heading">
          <div class="kicker">Private note</div>
          <h1>${isNew ? "New note" : "Edit note"}</h1>
        </div>
        <div class="notes-actions notes-actions-edit">
          <button type="button" class="notes-btn primary" id="notes-save">Save</button>
          <button type="button" class="notes-btn" id="notes-cancel">${isNew ? "Discard" : "Cancel"}</button>
          ${!isNew ? `<button type="button" class="notes-btn danger notes-btn-quiet" id="notes-delete">Delete</button>` : ""}
        </div>
      </header>
      <div id="notes-status" class="notes-status" hidden></div>
      <div id="notes-editor-mount"></div>
    `;

    editor = createEditor({
      initialTitle: snapshot.title,
      initialHtml: snapshot.body_html,
    });
    wrap.querySelector("#notes-editor-mount").appendChild(editor.root);
    editor.focus();

    const statusEl = wrap.querySelector("#notes-status");
    const showStatus = (msg, cls) => {
      statusEl.hidden = false;
      statusEl.className = `notes-status ${cls || ""}`;
      statusEl.textContent = msg;
    };

    const normalizeBody = (html) => {
      const h = String(html || "").trim();
      if (!h || h === "<p><br></p>" || h === "<p></p>") return "";
      return h;
    };

    const isDirty = () =>
      editor.getTitle() !== (snapshot.title || "") ||
      normalizeBody(editor.getHtml()) !== normalizeBody(snapshot.body_html);

    wrap.querySelector("#notes-save").addEventListener("click", async () => {
      const payload = { title: editor.getTitle(), body_html: editor.getHtml() };
      if (!payload.title) {
        showStatus("Add a title before saving.", "err");
        editor.focusTitle();
        return;
      }
      const saveBtn = wrap.querySelector("#notes-save");
      saveBtn.disabled = true;
      try {
        const saved = isNew
          ? await createNote(payload)
          : await updateNote(note.id, payload);
        await refreshNotesAvailability();
        note = saved;
        snapshot = { title: saved.title || "", body_html: saved.body_html || "" };
        // Navigate to the note URL; reading mode is the default for saved notes
        if (isNew || location.hash !== `#/notes/${saved.id}`) {
          location.hash = `#/notes/${saved.id}`;
        } else {
          mode = "view";
          render();
        }
      } catch (e) {
        saveBtn.disabled = false;
        const msg = e instanceof NotesApiError ? e.message : "Cannot add notes";
        showStatus(msg, "err");
      }
    });

    wrap.querySelector("#notes-cancel").addEventListener("click", () => {
      if (isNew) {
        location.hash = "#/track/notes";
        return;
      }
      if (isDirty() && !confirm("Discard unsaved changes?")) return;
      mode = "view";
      render();
    });

    wrap.querySelector("#notes-delete")?.addEventListener("click", async () => {
      if (!confirm("Delete this note? This cannot be undone.")) return;
      try {
        await deleteNote(note.id);
        await refreshNotesAvailability();
        location.hash = "#/track/notes";
      } catch (e) {
        showStatus(e.message || "Cannot delete note", "err");
      }
    });
  }

  render();
}
