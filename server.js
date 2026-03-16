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
const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

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
  labors: [],
  fields: [],
  deletedWorkers: [],
  deletedLabors: [],
  deletedFields: [],
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
  merged.deletedWorkers = normalizeDeletedKeys(input?.deletedWorkers);
  merged.deletedLabors = normalizeDeletedKeys(input?.deletedLabors);
  merged.deletedFields = normalizeDeletedKeys(input?.deletedFields);
  merged.workers = Array.isArray(input?.workers) ? input.workers.map(worker => ({
    id: worker.id || uid(),
    code: worker.code || '',
    dni: worker.dni || '',
    name: worker.name || '',
    active: worker.active !== false,
    updatedAt: worker.updatedAt || new Date().toISOString(),
    deletedAt: worker.deletedAt || null
  })) : [];
  merged.labors = Array.isArray(input?.labors) ? input.labors.map(labor => ({
    id: labor.id || uid(),
    name: labor.name || '',
    active: labor.active !== false,
    updatedAt: labor.updatedAt || SEED_TIMESTAMP,
    deletedAt: labor.deletedAt || null
  })) : merged.labors;
  merged.fields = Array.isArray(input?.fields) && input.fields.length ? input.fields.map(field => ({
    id: field.id || uid(),
    name: field.name || '',
    active: field.active !== false,
    updatedAt: field.updatedAt || SEED_TIMESTAMP,
    deletedAt: field.deletedAt || null
  })) : merged.fields;
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
  return reconcileCatalogState(merged);
}

function normalizeDeletedKeys(items) {
  if (!Array.isArray(items)) return [];
  const merged = new Map();
  items.forEach(item => {
    const key = normalizeText(item?.key || item);
    if (!key) return;
    const deletedAt = item?.deletedAt || new Date().toISOString();
    const current = merged.get(key);
    if (!current || deletedAt >= current.deletedAt) {
      merged.set(key, { key, deletedAt });
    }
  });
  return [...merged.values()];
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getWorkerSemanticKey(worker) {
  return normalizeText(worker?.code) || normalizeText(worker?.dni) || normalizeText(worker?.name);
}

function getLaborSemanticKey(labor) {
  return normalizeText(labor?.name);
}

function getFieldSemanticKey(field) {
  return normalizeText(field?.name);
}

function getEntityRecency(item) {
  return item?.deletedAt || item?.updatedAt || '';
}

function dedupeCatalog(items, getSemanticKey) {
  const groups = new Map();
  items.forEach(item => {
    const semanticKey = getSemanticKey(item);
    if (!semanticKey) return;
    if (!groups.has(semanticKey)) groups.set(semanticKey, []);
    groups.get(semanticKey).push(item);
  });

  const aliasMap = new Map();
  const deduped = [];

  groups.forEach(group => {
    const winner = [...group].sort((a, b) => getEntityRecency(b).localeCompare(getEntityRecency(a)))[0];
    group.forEach(item => aliasMap.set(item.id, winner.id));
    deduped.push(winner);
  });

  return { deduped, aliasMap };
}

function findDeletedAt(deletedItems, key) {
  return deletedItems.find(item => item.key === key)?.deletedAt || '';
}

function reconcileCatalogState(inputState) {
  const stateToFix = structuredClone(inputState);
  const workersResult = dedupeCatalog(stateToFix.workers, getWorkerSemanticKey);
  const laborsResult = dedupeCatalog(stateToFix.labors, getLaborSemanticKey);
  const fieldsResult = dedupeCatalog(stateToFix.fields, getFieldSemanticKey);

  stateToFix.workers = workersResult.deduped.filter(item => {
    const semanticKey = getWorkerSemanticKey(item);
    const deletedAt = findDeletedAt(stateToFix.deletedWorkers, semanticKey);
    return semanticKey && deletedAt < (item.updatedAt || '') && !item.deletedAt;
  });

  stateToFix.labors = laborsResult.deduped.filter(item => {
    const semanticKey = getLaborSemanticKey(item);
    const deletedAt = findDeletedAt(stateToFix.deletedLabors, semanticKey);
    return semanticKey && deletedAt < (item.updatedAt || '') && !item.deletedAt;
  });

  stateToFix.fields = fieldsResult.deduped.filter(item => {
    const semanticKey = getFieldSemanticKey(item);
    const deletedAt = findDeletedAt(stateToFix.deletedFields, semanticKey);
    return semanticKey && deletedAt < (item.updatedAt || '') && !item.deletedAt;
  });

  stateToFix.parts = stateToFix.parts.map(part => ({
    ...part,
    rows: part.rows.map(row => ({
      ...row,
      workerId: workersResult.aliasMap.get(row.workerId) || row.workerId,
      morningLaborId: laborsResult.aliasMap.get(row.morningLaborId) || row.morningLaborId,
      morningFieldId: fieldsResult.aliasMap.get(row.morningFieldId) || row.morningFieldId,
      afternoonLaborId: laborsResult.aliasMap.get(row.afternoonLaborId) || row.afternoonLaborId,
      afternoonFieldId: fieldsResult.aliasMap.get(row.afternoonFieldId) || row.afternoonFieldId
    }))
  }));

  stateToFix.performances = stateToFix.performances.map(item => ({
    ...item,
    workerId: workersResult.aliasMap.get(item.workerId) || item.workerId,
    laborId: laborsResult.aliasMap.get(item.laborId) || item.laborId,
    fieldId: fieldsResult.aliasMap.get(item.fieldId) || item.fieldId
  }));

  return stateToFix;
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
    deletedWorkers: mergeByKey(remote.deletedWorkers, incoming.deletedWorkers, item => item.key),
    deletedLabors: mergeByKey(remote.deletedLabors, incoming.deletedLabors, item => item.key),
    deletedFields: mergeByKey(remote.deletedFields, incoming.deletedFields, item => item.key),
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
