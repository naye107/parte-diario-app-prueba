const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const Database = require('better-sqlite3');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'parte-diario.db');
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || '123456';
const SESSION_COOKIE = 'pd_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 horas
const HEADER_COMPANY = 'AGRICOLA JAPURIMA S.A.';
const HEADER_LOCATION = 'Fundo Santa Teresa Bajo - Huaura';

const app = express();
app.use(express.json({ limit: '5mb' }));
const sessions = new Map();

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const DEFAULT_STATE = {
  settings: {
    owner: 'Supervisor',
    company: HEADER_COMPANY,
    location: HEADER_LOCATION
  },
  workers: [],
  labors: [
    { id: uid(), name: 'Cosecha', active: true },
    { id: uid(), name: 'Riego', active: true },
    { id: uid(), name: 'Poda', active: true }
  ],
  fields: [
    { id: uid(), name: 'Campo 1', active: true },
    { id: uid(), name: 'Campo 2', active: true },
    { id: uid(), name: 'Campo 3', active: true }
  ],
  parts: [],
  performances: []
};

const readStateStmt = db.prepare('SELECT data, updated_at AS updatedAt FROM app_state WHERE id = 1');
const writeStateStmt = db.prepare(`
  INSERT INTO app_state (id, data, updated_at)
  VALUES (1, @data, @updatedAt)
  ON CONFLICT(id) DO UPDATE SET
    data = excluded.data,
    updated_at = excluded.updated_at
`);

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function normalizeState(input) {
  const merged = structuredClone(DEFAULT_STATE);
  merged.settings = { ...merged.settings, ...(input?.settings || {}) };
  merged.settings.company = HEADER_COMPANY;
  merged.settings.location = HEADER_LOCATION;
  merged.workers = Array.isArray(input?.workers) ? input.workers : [];
  merged.labors = Array.isArray(input?.labors) && input.labors.length ? input.labors : merged.labors;
  merged.fields = Array.isArray(input?.fields) && input.fields.length ? input.fields : merged.fields;
  merged.parts = Array.isArray(input?.parts) ? input.parts.map(part => ({
    id: part.id || uid(),
    date: part.date || '',
    status: part.status || 'BORRADOR',
    createdAt: part.createdAt || new Date().toISOString(),
    updatedAt: part.updatedAt || new Date().toISOString(),
    rows: Array.isArray(part.rows) ? part.rows.map(row => ({
      id: row.id || uid(),
      workerId: row.workerId || '',
      morningLaborId: row.morningLaborId || '',
      morningFieldId: row.morningFieldId || '',
      afternoonLaborId: row.afternoonLaborId || '',
      afternoonFieldId: row.afternoonFieldId || '',
      notes: row.notes || ''
    })) : []
  })) : [];
  merged.performances = Array.isArray(input?.performances) ? input.performances.map(item => ({
    id: item.id || uid(),
    date: item.date || new Date().toISOString().slice(0, 10),
    workerId: item.workerId || '',
    laborId: item.laborId || '',
    fieldId: item.fieldId || '',
    quantity: Number(item.quantity) || 0,
    unit: item.unit || '',
    jornales: Number(item.jornales) || 0,
    notes: item.notes || ''
  })) : [];
  return merged;
}

function mergeByKey(remoteItems, incomingItems, getKey) {
  const merged = new Map();
  [...remoteItems, ...incomingItems].forEach(item => {
    merged.set(getKey(item), item);
  });
  return [...merged.values()];
}

function mergeStates(baseState, incomingState) {
  const remote = normalizeState(baseState);
  const incoming = normalizeState(incomingState);
  return normalizeState({
    settings: { ...remote.settings, ...incoming.settings },
    workers: mergeByKey(remote.workers, incoming.workers, item => item.id),
    labors: mergeByKey(remote.labors, incoming.labors, item => item.id),
    fields: mergeByKey(remote.fields, incoming.fields, item => item.id),
    parts: mergeByKey(remote.parts, incoming.parts, item => item.id),
    performances: mergeByKey(remote.performances, incoming.performances, item => item.id)
  });
}

function loadState() {
  const row = readStateStmt.get();
  if (!row) {
    const defaultState = normalizeState(DEFAULT_STATE);
    saveState(defaultState);
    return { state: defaultState, updatedAt: new Date().toISOString() };
  }
  try {
    const parsed = JSON.parse(row.data);
    return { state: normalizeState(parsed), updatedAt: row.updatedAt };
  } catch {
    const repaired = normalizeState(DEFAULT_STATE);
    saveState(repaired);
    return { state: repaired, updatedAt: new Date().toISOString() };
  }
}

function saveState(nextState) {
  const currentStored = readStateStmt.get();
  const currentState = currentStored ? normalizeState(JSON.parse(currentStored.data)) : normalizeState(DEFAULT_STATE);
  const normalized = mergeStates(currentState, nextState);
  const updatedAt = new Date().toISOString();
  writeStateStmt.run({
    data: JSON.stringify(normalized),
    updatedAt
  });
  return { state: normalized, updatedAt };
}

function parseCookies(rawCookieHeader) {
  if (!rawCookieHeader) return {};
  return rawCookieHeader.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx <= 0) return acc;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function createSession(username) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function clearSession(res, token) {
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function requireAuth(req, res, next) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  req.auth = session;
  return next();
}

app.get('/api/auth/status', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) return res.json({ authenticated: false });
  return res.json({ authenticated: true, user: session.username });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (username !== AUTH_USER || password !== AUTH_PASS) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }
  const token = createSession(username);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  return res.json({ ok: true, user: username });
});

app.post('/api/auth/logout', (req, res) => {
  const session = getSessionFromRequest(req);
  clearSession(res, session?.token);
  return res.json({ ok: true });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get('/api/state', requireAuth, (_req, res) => {
  const payload = loadState();
  res.json(payload);
});

app.put('/api/state', requireAuth, (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Body invalido' });
  }
  const payload = saveState(req.body);
  return res.json(payload);
});

app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Parte Diario escuchando en http://localhost:${PORT}`);
});
