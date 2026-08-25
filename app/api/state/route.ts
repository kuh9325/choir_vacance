import { env } from 'cloudflare:workers';
import { DEFAULT_STATE, normalizeState } from '@/lib/game';

async function ensureTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS event_state (
    id INTEGER PRIMARY KEY,
    payload TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`).run();
}

export async function GET() {
  await ensureTable();
  const row = await env.DB.prepare('SELECT payload, revision, updated_at FROM event_state WHERE id = ?')
    .bind(1)
    .first<{ payload: string; revision: number; updated_at: number }>();
  if (!row) return Response.json(DEFAULT_STATE, { headers: { 'Cache-Control': 'no-store' } });
  try {
    return Response.json({ ...normalizeState(JSON.parse(row.payload)), revision: row.revision, updatedAt: row.updated_at }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(DEFAULT_STATE, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function PUT(request: Request) {
  await ensureTable();
  const rawText = await request.text();
  if (rawText.length > 500_000) return Response.json({ error: 'Payload too large' }, { status: 413 });
  let state;
  try {
    state = normalizeState(JSON.parse(rawText));
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const now = Date.now();
  const current = await env.DB.prepare('SELECT revision FROM event_state WHERE id = ?').bind(1).first<{ revision: number }>();
  const revision = (current?.revision ?? 0) + 1;
  const saved = { ...state, revision, updatedAt: now };
  await env.DB.prepare(`INSERT INTO event_state (id, payload, revision, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, revision = excluded.revision, updated_at = excluded.updated_at`)
    .bind(1, JSON.stringify(saved), revision, now)
    .run();
  return Response.json({ revision, updatedAt: now });
}
