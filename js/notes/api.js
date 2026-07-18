/** Notes API client — same-origin `/api` (nginx proxy in Docker). */

export class NotesApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "NotesApiError";
    this.status = status;
  }
}

async function request(path, opts = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
  } catch {
    throw new NotesApiError("Notes unavailable — start Docker Compose (or open via localhost).", 0);
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const msg =
      data?.error ||
      (res.status >= 500 ? "Cannot add notes" : `Notes request failed (${res.status})`);
    throw new NotesApiError(msg, res.status);
  }
  return data;
}

export function checkHealth() {
  return request("/health");
}

export function listNotes() {
  return request("/notes");
}

export function getNote(id) {
  return request(`/notes/${encodeURIComponent(id)}`);
}

export function createNote({ title, body_html }) {
  return request("/notes", {
    method: "POST",
    body: JSON.stringify({ title, body_html }),
  });
}

export function updateNote(id, { title, body_html }) {
  return request(`/notes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ title, body_html }),
  });
}

export function deleteNote(id) {
  return request(`/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
}
