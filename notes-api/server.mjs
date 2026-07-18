import express from "express";
import pg from "pg";

const { Pool } = pg;
const PORT = Number(process.env.PORT || 8787);
const DATABASE_URL = process.env.DATABASE_URL || "postgres://notes:notes@127.0.0.1:5432/notes";

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json({ limit: "15mb" }));

function sanitizeHtml(html) {
  let out = String(html || "");
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "");
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  out = out.replace(/javascript:/gi, "");
  return out;
}

function titleFromBody(title, bodyHtml) {
  const t = String(title || "").trim();
  if (t) return t.slice(0, 200);
  const text = String(bodyHtml || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (text.slice(0, 80) || "Untitled note").slice(0, 200);
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

app.get("/api/notes", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, created_at, updated_at
       FROM notes
       ORDER BY updated_at DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Cannot list notes" });
  }
});

app.get("/api/notes/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, body_html, created_at, updated_at FROM notes WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Cannot load note" });
  }
});

app.post("/api/notes", async (req, res) => {
  try {
    const bodyHtml = sanitizeHtml(req.body?.body_html);
    const title = titleFromBody(req.body?.title, bodyHtml);
    const { rows } = await pool.query(
      `INSERT INTO notes (title, body_html)
       VALUES ($1, $2)
       RETURNING id, title, body_html, created_at, updated_at`,
      [title, bodyHtml]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Cannot add notes" });
  }
});

app.put("/api/notes/:id", async (req, res) => {
  try {
    const bodyHtml = sanitizeHtml(req.body?.body_html);
    const title = titleFromBody(req.body?.title, bodyHtml);
    const { rows } = await pool.query(
      `UPDATE notes
       SET title = $2, body_html = $3, updated_at = now()
       WHERE id = $1
       RETURNING id, title, body_html, created_at, updated_at`,
      [req.params.id, title, bodyHtml]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Cannot add notes" });
  }
});

app.delete("/api/notes/:id", async (req, res) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM notes WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Cannot delete note" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`notes-api listening on ${PORT}`);
});
