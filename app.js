const STORAGE_KEY = 'parte-diario-santa-teresa-v3';
const SERVER_SYNC_DEBOUNCE_MS = 700;
const HEADER_COMPANY = 'AGRICOLA JAPURIMA S.A.';
const HEADER_LOCATION = 'Fundo Santa Teresa Bajo - Huaura';
const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

const initialState = {
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

let state = structuredClone(initialState);
let currentView = 'dashboard';
let currentPartId = null;
let lastReportResults = [];
let lastJornalesResults = [];
let lastPerformanceResults = [];
let lastPerformanceSummary = [];
let toastTimer = null;
let serverSyncSupported = false;
let serverSyncInFlight = false;
let serverSyncPending = false;
let serverSyncTimer = null;
let networkListenersBound = false;
let appInitialized = false;
let currentDraftRow = null;
let showSavedPartRows = false;

const els = {
  menuToggleBtn: document.getElementById('menuToggleBtn'),
  connectionStatus: document.getElementById('connectionStatus'),
  syncNowBtn: document.getElementById('syncNowBtn'),
  navButtons: [...document.querySelectorAll('.nav-btn')],
  views: [...document.querySelectorAll('.view')],
  statWorkers: document.getElementById('statWorkers'),
  statLabors: document.getElementById('statLabors'),
  statFields: document.getElementById('statFields'),
  statParts: document.getElementById('statParts'),
  recentParts: document.getElementById('recentParts'),
  goToPartes: document.getElementById('goToPartes'),
  toast: document.getElementById('toast'),

  partDate: document.getElementById('partDate'),
  partStatus: document.getElementById('partStatus'),
  partRowsCount: document.getElementById('partRowsCount'),
  currentPartDateLabel: document.getElementById('currentPartDateLabel'),
  partRows: document.getElementById('partRows'),
  openPartBtn: document.getElementById('openPartBtn'),
  savePartBtn: document.getElementById('savePartBtn'),
  copyPreviousBtn: document.getElementById('copyPreviousBtn'),
  addRowBtn: document.getElementById('addRowBtn'),
  closePartBtn: document.getElementById('closePartBtn'),
  reopenPartBtn: document.getElementById('reopenPartBtn'),
  deletePartBtn: document.getElementById('deletePartBtn'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  exportPartBtn: document.getElementById('exportPartBtn'),

  workerForm: document.getElementById('workerForm'),
  workerFormTitle: document.getElementById('workerFormTitle'),
  workerId: document.getElementById('workerId'),
  workerCode: document.getElementById('workerCode'),
  workerDni: document.getElementById('workerDni'),
  workerName: document.getElementById('workerName'),
  workerActive: document.getElementById('workerActive'),
  cancelWorkerEdit: document.getElementById('cancelWorkerEdit'),
  workersTableBody: document.getElementById('workersTableBody'),
  workerCountBadge: document.getElementById('workerCountBadge'),

  laborForm: document.getElementById('laborForm'),
  laborFormTitle: document.getElementById('laborFormTitle'),
  laborId: document.getElementById('laborId'),
  laborName: document.getElementById('laborName'),
  laborActive: document.getElementById('laborActive'),
  cancelLaborEdit: document.getElementById('cancelLaborEdit'),
  laborsTableBody: document.getElementById('laborsTableBody'),
  laborCountBadge: document.getElementById('laborCountBadge'),

  fieldForm: document.getElementById('fieldForm'),
  fieldFormTitle: document.getElementById('fieldFormTitle'),
  fieldId: document.getElementById('fieldId'),
  fieldName: document.getElementById('fieldName'),
  fieldActive: document.getElementById('fieldActive'),
  cancelFieldEdit: document.getElementById('cancelFieldEdit'),
  fieldsTableBody: document.getElementById('fieldsTableBody'),
  fieldCountBadge: document.getElementById('fieldCountBadge'),

  reportFilters: document.getElementById('reportFilters'),
  reportFrom: document.getElementById('reportFrom'),
  reportTo: document.getElementById('reportTo'),
  reportWorker: document.getElementById('reportWorker'),
  reportLabor: document.getElementById('reportLabor'),
  reportField: document.getElementById('reportField'),
  downloadReportPdfBtn: document.getElementById('downloadReportPdfBtn'),
  exportReportBtn: document.getElementById('exportReportBtn'),
  reportsTableBody: document.getElementById('reportsTableBody'),
  reportCountBadge: document.getElementById('reportCountBadge'),

  jornalesFilters: document.getElementById('jornalesFilters'),
  jornalesFrom: document.getElementById('jornalesFrom'),
  jornalesTo: document.getElementById('jornalesTo'),
  jornalesWorker: document.getElementById('jornalesWorker'),
  jornalesLabor: document.getElementById('jornalesLabor'),
  jornalesField: document.getElementById('jornalesField'),
  downloadJornalesPdfBtn: document.getElementById('downloadJornalesPdfBtn'),
  exportJornalesBtn: document.getElementById('exportJornalesBtn'),
  jornalesTableBody: document.getElementById('jornalesTableBody'),
  jornalesCountBadge: document.getElementById('jornalesCountBadge'),
  jornalesTotalSummary: document.getElementById('jornalesTotalSummary'),

  performanceForm: document.getElementById('performanceForm'),
  performanceFormTitle: document.getElementById('performanceFormTitle'),
  performanceId: document.getElementById('performanceId'),
  performanceDate: document.getElementById('performanceDate'),
  performanceWorker: document.getElementById('performanceWorker'),
  performanceLabor: document.getElementById('performanceLabor'),
  performanceField: document.getElementById('performanceField'),
  performanceQuantity: document.getElementById('performanceQuantity'),
  performanceUnit: document.getElementById('performanceUnit'),
  performanceJornales: document.getElementById('performanceJornales'),
  performanceNotes: document.getElementById('performanceNotes'),
  cancelPerformanceEdit: document.getElementById('cancelPerformanceEdit'),
  performanceFilters: document.getElementById('performanceFilters'),
  performanceFrom: document.getElementById('performanceFrom'),
  performanceTo: document.getElementById('performanceTo'),
  performanceFilterWorker: document.getElementById('performanceFilterWorker'),
  performanceFilterLabor: document.getElementById('performanceFilterLabor'),
  performanceFilterField: document.getElementById('performanceFilterField'),
  downloadPerformancePdfBtn: document.getElementById('downloadPerformancePdfBtn'),
  exportPerformanceBtn: document.getElementById('exportPerformanceBtn'),
  performanceTotalJornales: document.getElementById('performanceTotalJornales'),
  performanceTotalQuantity: document.getElementById('performanceTotalQuantity'),
  performanceAverage: document.getElementById('performanceAverage'),
  performanceCount: document.getElementById('performanceCount'),
  performanceCountBadge: document.getElementById('performanceCountBadge'),
  performanceTableBody: document.getElementById('performanceTableBody'),
  performanceSummaryCountBadge: document.getElementById('performanceSummaryCountBadge'),
  performanceSummaryTableBody: document.getElementById('performanceSummaryTableBody'),

  settingsForm: document.getElementById('settingsForm'),
  settingsOwner: document.getElementById('settingsOwner'),
  exportBackupBtn: document.getElementById('exportBackupBtn'),
  importBackupInput: document.getElementById('importBackupInput'),
  resetDataBtn: document.getElementById('resetDataBtn'),

  authOverlay: document.getElementById('authOverlay'),
  loginForm: document.getElementById('loginForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  loginSubmitBtn: document.getElementById('loginSubmitBtn'),
  loginMessage: document.getElementById('loginMessage'),
  logoutBtn: document.getElementById('logoutBtn')
};

void boot();

async function boot() {
  setupNetworkState();
  bindEvents();
  bindAuthEvents();
  closeMobileMenu();
  await checkAuthAndStart();
  registerServiceWorker();
}

function bindAuthEvents() {
  els.loginForm.addEventListener('submit', onLoginSubmit);
  els.logoutBtn.addEventListener('click', onLogoutClick);
}

function bindEvents() {
  els.menuToggleBtn.addEventListener('click', toggleMobileMenu);
  if (els.syncNowBtn) els.syncNowBtn.addEventListener('click', syncNow);
  els.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
      closeMobileMenu();
    });
  });

  els.goToPartes.addEventListener('click', () => switchView('partes'));
  els.openPartBtn.addEventListener('click', () => openOrCreatePartForDate(els.partDate.value));
  els.savePartBtn.addEventListener('click', saveCurrentPart);
  els.copyPreviousBtn.addEventListener('click', copyPreviousPart);
  els.addRowBtn.addEventListener('click', addPartRow);
  els.closePartBtn.addEventListener('click', closeCurrentPart);
  els.reopenPartBtn.addEventListener('click', reopenCurrentPart);
  els.deletePartBtn.addEventListener('click', deleteCurrentPart);
  els.downloadPdfBtn.addEventListener('click', downloadCurrentPartPDF);
  els.exportPartBtn.addEventListener('click', exportCurrentPartCSV);
  els.partRows.addEventListener('change', onPartRowsChange);
  els.partRows.addEventListener('input', onPartRowsChange);
  els.partRows.addEventListener('click', onPartRowsClick);

  els.workerForm.addEventListener('submit', saveWorker);
  els.cancelWorkerEdit.addEventListener('click', resetWorkerForm);
  els.workersTableBody.addEventListener('click', onWorkersTableClick);

  els.laborForm.addEventListener('submit', saveLabor);
  els.cancelLaborEdit.addEventListener('click', resetLaborForm);
  els.laborsTableBody.addEventListener('click', onLaborsTableClick);

  els.fieldForm.addEventListener('submit', saveField);
  els.cancelFieldEdit.addEventListener('click', resetFieldForm);
  els.fieldsTableBody.addEventListener('click', onFieldsTableClick);

  els.reportFilters.addEventListener('submit', event => {
    event.preventDefault();
    runReports();
  });
  els.downloadReportPdfBtn.addEventListener('click', downloadReportPDF);
  els.exportReportBtn.addEventListener('click', exportReportCSV);

  if (els.jornalesFilters) {
    els.jornalesFilters.addEventListener('submit', event => {
      event.preventDefault();
      runJornalesReport();
    });
  }
  if (els.downloadJornalesPdfBtn) {
    els.downloadJornalesPdfBtn.addEventListener('click', downloadJornalesPDF);
  }
  if (els.exportJornalesBtn) {
    els.exportJornalesBtn.addEventListener('click', exportJornalesCSV);
  }

  if (els.performanceForm) els.performanceForm.addEventListener('submit', savePerformance);
  if (els.cancelPerformanceEdit) els.cancelPerformanceEdit.addEventListener('click', resetPerformanceForm);
  if (els.performanceFilters) {
    els.performanceFilters.addEventListener('submit', event => {
      event.preventDefault();
      runPerformanceReport();
    });
  }
  if (els.downloadPerformancePdfBtn) els.downloadPerformancePdfBtn.addEventListener('click', downloadPerformancePDF);
  if (els.exportPerformanceBtn) els.exportPerformanceBtn.addEventListener('click', exportPerformanceCSV);
  if (els.performanceTableBody) {
    els.performanceTableBody.addEventListener('click', onPerformanceTableClick);
  }

  if (els.settingsForm) els.settingsForm.addEventListener('submit', saveSettings);
  if (els.exportBackupBtn) els.exportBackupBtn.addEventListener('click', exportBackup);
  if (els.importBackupInput) els.importBackupInput.addEventListener('change', importBackup);
  if (els.resetDataBtn) els.resetDataBtn.addEventListener('click', resetAllData);
}

async function checkAuthAndStart() {
  setLoginMessage('');
  try {
    const response = await fetch('./api/auth/status', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.authenticated) {
      lockApp('Ingresa usuario y contrasena para continuar.');
      return;
    }
    unlockApp();
    await initMainApp();
  } catch (_error) {
    lockApp('No se pudo validar la sesion con el servidor.');
  }
}

async function initMainApp() {
  if (appInitialized) {
    refreshAll();
    return;
  }
  els.partDate.value = todayISO();
  state = loadState();
  await hydrateStateFromServer();
  if (els.settingsOwner) els.settingsOwner.value = state.settings.owner || '';
  refreshAll();
  openOrCreatePartForDate(els.partDate.value, false);
  appInitialized = true;
}

function lockApp(message = '') {
  document.body.classList.add('auth-locked');
  setLoginMessage(message);
}

function unlockApp() {
  document.body.classList.remove('auth-locked');
  setLoginMessage('');
}

function setLoginMessage(message) {
  els.loginMessage.textContent = message;
}

async function onLoginSubmit(event) {
  event.preventDefault();
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;
  if (!username || !password) {
    setLoginMessage('Completa usuario y contrasena.');
    return;
  }

  els.loginSubmitBtn.disabled = true;
  setLoginMessage('Validando acceso...');

  try {
    const response = await fetch('./api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      setLoginMessage('Credenciales invalidas.');
      return;
    }
    unlockApp();
    await initMainApp();
    showToast('Sesion iniciada.');
    els.loginForm.reset();
  } catch (_error) {
    setLoginMessage('No se pudo iniciar sesion. Intenta nuevamente.');
  } finally {
    els.loginSubmitBtn.disabled = false;
  }
}

async function onLogoutClick() {
  closeMobileMenu();
  try {
    await fetch('./api/auth/logout', { method: 'POST' });
  } catch (_error) {
    // No-op
  }
  lockApp('Sesion cerrada.');
}

function switchView(viewName) {
  closeMobileMenu();
  currentView = viewName;
  els.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  els.views.forEach(view => view.classList.toggle('active', view.id === `view-${viewName}`));
  if (viewName === 'reportes') runReports();
  if (viewName === 'jornales') runJornalesReport();
  if (viewName === 'rendimiento') runPerformanceReport();
}

function toggleMobileMenu() {
  const isOpen = document.body.classList.toggle('sidebar-open');
  els.menuToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function closeMobileMenu() {
  document.body.classList.remove('sidebar-open');
  els.menuToggleBtn.setAttribute('aria-expanded', 'false');
}

function refreshAll() {
  state = normalizeState(state);
  saveState();
  renderDashboard();
  renderWorkers();
  renderLabors();
  renderFields();
  renderReportsFilters();
  renderCurrentPart();
  renderPerformanceModule();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialState);
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    console.error(error);
    return structuredClone(initialState);
  }
}

function normalizeState(input) {
  const merged = structuredClone(initialState);
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
    date: part.date,
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
    date: item.date || todayISO(),
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

function mergeByKey(localItems, remoteItems, getKey) {
  const merged = new Map();
  [...localItems, ...remoteItems].forEach(item => {
    merged.set(getKey(item), item);
  });
  return [...merged.values()];
}

function mergeStates(localState, remoteState) {
  const local = normalizeState(localState);
  const remote = normalizeState(remoteState);
  return normalizeState({
    settings: { ...remote.settings, ...local.settings },
    workers: mergeByKey(remote.workers, local.workers, item => item.id),
    labors: mergeByKey(remote.labors, local.labors, item => item.id),
    fields: mergeByKey(remote.fields, local.fields, item => item.id),
    deletedWorkers: mergeByKey(remote.deletedWorkers, local.deletedWorkers, item => item.key),
    deletedLabors: mergeByKey(remote.deletedLabors, local.deletedLabors, item => item.key),
    deletedFields: mergeByKey(remote.deletedFields, local.deletedFields, item => item.key),
    parts: mergeByKey(remote.parts, local.parts, item => item.id),
    performances: mergeByKey(remote.performances, local.performances, item => item.id)
  });
}

function removeDeletedKey(collectionName, semanticKey) {
  state[collectionName] = state[collectionName].filter(item => item.key !== semanticKey);
}

function markEntityDeleted(collectionName, deletedCollectionName, item, getSemanticKey) {
  const semanticKey = getSemanticKey(item);
  const deletedAt = new Date().toISOString();
  state[collectionName] = state[collectionName].filter(entry => getSemanticKey(entry) !== semanticKey);
  state[deletedCollectionName] = mergeByKey(
    state[deletedCollectionName],
    [{ key: semanticKey, deletedAt }],
    entry => entry.key
  );
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueServerSync();
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

function setupNetworkState() {
  if (!networkListenersBound) {
    window.addEventListener('online', () => {
      void ensureServerSyncAvailable();
      updateConnectionStatus();
    });
    window.addEventListener('offline', updateConnectionStatus);
    networkListenersBound = true;
  }
  updateConnectionStatus();
}

async function hydrateStateFromServer() {
  const localSnapshot = normalizeState(state);
  try {
    const remoteState = await fetchServerStateWithRetry();
    serverSyncSupported = true;
    state = mergeStates(localSnapshot, remoteState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    queueServerSync();
  } catch (_error) {
    serverSyncSupported = false;
  } finally {
    updateConnectionStatus();
  }
}

async function fetchServerStateWithRetry() {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch('./api/state', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (response.status === 401) {
        lockApp('Sesion expirada. Vuelve a iniciar sesion.');
        throw new Error('UNAUTHORIZED');
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      return normalizeState(payload?.state || payload);
    } catch (error) {
      lastError = error;
      if (String(error?.message || '') === 'UNAUTHORIZED') throw error;
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 700));
      }
    }
  }
  throw lastError || new Error('STATE_FETCH_FAILED');
}

function queueServerSync() {
  if (!serverSyncSupported) return;
  serverSyncPending = true;
  updateConnectionStatus();
  clearTimeout(serverSyncTimer);
  serverSyncTimer = setTimeout(() => {
    void syncStateToServer();
  }, SERVER_SYNC_DEBOUNCE_MS);
}

async function syncStateToServer() {
  if (!serverSyncSupported || serverSyncInFlight) return;
  serverSyncInFlight = true;
  updateConnectionStatus();
  try {
    const response = await fetch('./api/state', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (response.status === 401) {
      lockApp('Sesion expirada. Vuelve a iniciar sesion.');
      throw new Error('UNAUTHORIZED');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state = normalizeState(payload?.state || payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    serverSyncPending = false;
  } catch (_error) {
    serverSyncPending = true;
  } finally {
    serverSyncInFlight = false;
    updateConnectionStatus();
  }
}

async function syncNow() {
  if (!navigator.onLine) {
    showToast('No hay conexion para sincronizar.');
    return;
  }

  if (els.syncNowBtn) els.syncNowBtn.disabled = true;
  try {
    await ensureServerSyncAvailable();
    if (!serverSyncSupported) {
      showToast('No se pudo conectar con el servidor.');
      return;
    }
    await syncStateToServer();
    await hydrateStateFromServer();
    refreshAll();
    showToast('Sincronizacion completada.');
  } finally {
    if (els.syncNowBtn) els.syncNowBtn.disabled = false;
    updateConnectionStatus();
  }
}

async function ensureServerSyncAvailable() {
  if (serverSyncSupported || !navigator.onLine) return;
  try {
    const health = await fetch('./api/health', {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    serverSyncSupported = true;
    queueServerSync();
  } catch (_error) {
    serverSyncSupported = false;
  } finally {
    updateConnectionStatus();
  }
}

function updateConnectionStatus() {
  if (!navigator.onLine) {
    els.connectionStatus.textContent = 'Sin conexion (guardado local)';
    if (els.syncNowBtn) els.syncNowBtn.disabled = true;
    return;
  }
  if (!serverSyncSupported) {
    els.connectionStatus.textContent = 'Modo local';
    if (els.syncNowBtn) els.syncNowBtn.disabled = false;
    return;
  }
  if (serverSyncInFlight) {
    els.connectionStatus.textContent = 'Sincronizando...';
    if (els.syncNowBtn) els.syncNowBtn.disabled = true;
    return;
  }
  if (serverSyncPending) {
    els.connectionStatus.textContent = 'Pendiente de sincronizar';
    if (els.syncNowBtn) els.syncNowBtn.disabled = false;
    return;
  }
  els.connectionStatus.textContent = 'Sincronizado con servidor';
  if (els.syncNowBtn) els.syncNowBtn.disabled = false;
}

function stateDataScore(snapshot) {
  const safe = normalizeState(snapshot);
  const rowsCount = safe.parts.reduce((acc, part) => acc + part.rows.length, 0);
  return (safe.workers.length * 5) + (safe.parts.length * 10) + rowsCount + (safe.performances.length * 4);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(error => {
        console.warn('No se pudo registrar el service worker', error);
      });
    });
  }
}

function renderDashboard() {
  els.statWorkers.textContent = state.workers.filter(item => item.active).length;
  els.statLabors.textContent = state.labors.filter(item => item.active).length;
  els.statFields.textContent = state.fields.filter(item => item.active).length;
  els.statParts.textContent = state.parts.length;

  const recentParts = [...state.parts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  if (!recentParts.length) {
    els.recentParts.innerHTML = `<div class="empty-state">Todavia no hay partes registrados.</div>`;
    return;
  }

  els.recentParts.innerHTML = recentParts.map(part => {
    const rowsCount = part.rows.length;
    return `
      <div class="part-row-card">
        <div class="part-row-top">
          <div>
            <h4>${formatDate(part.date)}</h4>
            <p class="muted">${rowsCount} trabajadores registrados</p>
          </div>
          <span class="status-pill ${part.status === 'CERRADO' ? 'closed' : 'draft'}">${part.status}</span>
        </div>
        <div class="mini-actions">
          <button class="secondary-btn mini-btn" data-open-part-date="${part.date}">Abrir</button>
        </div>
      </div>
    `;
  }).join('');

  [...els.recentParts.querySelectorAll('[data-open-part-date]')].forEach(btn => {
    btn.addEventListener('click', () => {
      els.partDate.value = btn.dataset.openPartDate;
      switchView('partes');
      openOrCreatePartForDate(btn.dataset.openPartDate);
    });
  });
}

function openOrCreatePartForDate(dateValue, notify = true) {
  if (!dateValue) {
    showToast('Selecciona una fecha para continuar.');
    return;
  }
  let part = state.parts.find(item => item.date === dateValue);
  if (!part) {
    part = {
      id: uid(),
      date: dateValue,
      status: 'BORRADOR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rows: []
    };
    state.parts.push(part);
    saveState();
    if (notify) showToast(`Se creo el parte del ${formatDate(dateValue)}.`);
  } else if (notify) {
    showToast(`Se abrio el parte del ${formatDate(dateValue)}.`);
  }
  currentPartId = part.id;
  showSavedPartRows = true;
  ensureDraftRow(part);
  renderCurrentPart();
  renderDashboard();
}

function getCurrentPart() {
  return state.parts.find(item => item.id === currentPartId) || null;
}

function renderCurrentPart() {
  const part = getCurrentPart();
  if (!part) {
    els.partStatus.value = 'SIN ABRIR';
    els.partRowsCount.value = '0';
    els.currentPartDateLabel.textContent = 'Sin fecha';
    els.partRows.innerHTML = `<div class="empty-state">Abre o crea un parte para comenzar.</div>`;
    togglePartControls(true);
    return;
  }

  if (part.status !== 'CERRADO' && !showSavedPartRows) ensureDraftRow(part);
  els.partDate.value = part.date;
  els.partStatus.value = part.status;
  els.partRowsCount.value = String(part.rows.length);
  els.currentPartDateLabel.textContent = formatDate(part.date);
  togglePartControls(part.status === 'CERRADO');

  if (part.status === 'CERRADO' || showSavedPartRows) {
    renderSavedPartRows(part);
    return;
  }

  if (!currentDraftRow) {
    els.partRows.innerHTML = `
      <div class="empty-state">
        Usa <strong>Registrar</strong> para preparar un nuevo registro.
      </div>
    `;
    return;
  }

  els.partRows.innerHTML = `
    <article class="part-row-card" data-row-id="${currentDraftRow.id}">
      <div class="part-row-top">
        <div>
          <h4>Nuevo registro</h4>
          <p class="muted">Completa los datos y pulsa Guardar para continuar con el siguiente.</p>
        </div>
        <div class="mini-actions">
          <button class="mini-btn" data-action="save-draft">Guardar</button>
        </div>
      </div>
      <div class="row-fields-grid">
        <label>
          <span>Trabajador</span>
          <select data-field="workerId">
            ${buildSelectOptions(state.workers, currentDraftRow.workerId, 'Seleccionar trabajador', 'name')}
          </select>
        </label>
        <label>
          <span>Labor manana</span>
          <select data-field="morningLaborId">
            ${buildSelectOptions(state.labors, currentDraftRow.morningLaborId, 'Seleccionar labor', 'name')}
          </select>
        </label>
        <label>
          <span>Campo manana</span>
          <select data-field="morningFieldId">
            ${buildSelectOptions(state.fields, currentDraftRow.morningFieldId, 'Seleccionar campo', 'name')}
          </select>
        </label>
        <label>
          <span>Labor tarde</span>
          <select data-field="afternoonLaborId">
            ${buildSelectOptions(state.labors, currentDraftRow.afternoonLaborId, 'Seleccionar labor', 'name')}
          </select>
        </label>
        <label>
          <span>Campo tarde</span>
          <select data-field="afternoonFieldId">
            ${buildSelectOptions(state.fields, currentDraftRow.afternoonFieldId, 'Seleccionar campo', 'name')}
          </select>
        </label>
        <label class="full">
          <span>Observaciones</span>
          <textarea data-field="notes" placeholder="Opcional">${escapeHtml(currentDraftRow.notes)}</textarea>
        </label>
      </div>
    </article>
  `;
}

function renderSavedPartRows(part) {
  if (!part.rows.length) {
    els.partRows.innerHTML = `
      <div class="empty-state">
        Todavia no hay registros guardados en este parte.
      </div>
    `;
    return;
  }

  els.partRows.innerHTML = part.rows.map((row, index) => `
    <article class="part-row-card">
      <div class="part-row-top">
        <div>
          <h4>Registro ${index + 1}</h4>
          <p class="muted">${escapeHtml(getNameById(state.workers, row.workerId, 'name') || 'Sin trabajador')}</p>
        </div>
      </div>
      <div class="row-fields-grid">
        <label>
          <span>Trabajador</span>
          <input type="text" value="${escapeHtml(getNameById(state.workers, row.workerId, 'name'))}" readonly>
        </label>
        <label>
          <span>Labor manana</span>
          <input type="text" value="${escapeHtml(getNameById(state.labors, row.morningLaborId, 'name'))}" readonly>
        </label>
        <label>
          <span>Campo manana</span>
          <input type="text" value="${escapeHtml(getNameById(state.fields, row.morningFieldId, 'name'))}" readonly>
        </label>
        <label>
          <span>Labor tarde</span>
          <input type="text" value="${escapeHtml(getNameById(state.labors, row.afternoonLaborId, 'name'))}" readonly>
        </label>
        <label>
          <span>Campo tarde</span>
          <input type="text" value="${escapeHtml(getNameById(state.fields, row.afternoonFieldId, 'name'))}" readonly>
        </label>
        <label class="full">
          <span>Observaciones</span>
          <textarea readonly>${escapeHtml(row.notes)}</textarea>
        </label>
      </div>
    </article>
  `).join('');
}

function buildSelectOptions(items, selectedId, placeholder, labelKey) {
  const selectedItem = items.find(item => item.id === selectedId);
  const orderedItems = [...items].sort((a, b) => (a[labelKey] || '').localeCompare(b[labelKey] || ''));
  return [`<option value="">${placeholder}</option>`]
    .concat(orderedItems
      .filter(item => item.active || item.id === selectedId)
      .map(item => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item[labelKey])}${item.active ? '' : ' (inactivo)'}</option>`)
    )
    .concat(selectedItem && !orderedItems.some(item => item.id === selectedItem.id) ? [`<option value="${selectedItem.id}" selected>${escapeHtml(selectedItem[labelKey])}</option>`] : [])
    .join('');
}

function togglePartControls(isClosed) {
  const hasPart = Boolean(getCurrentPart());
  els.savePartBtn.disabled = !hasPart || isClosed;
  els.copyPreviousBtn.disabled = !hasPart || isClosed;
  els.addRowBtn.disabled = !hasPart || isClosed;
  els.closePartBtn.disabled = !hasPart || isClosed;
  els.reopenPartBtn.disabled = !hasPart || !isClosed;
  els.deletePartBtn.disabled = !hasPart;
  els.downloadPdfBtn.disabled = !hasPart;
  els.exportPartBtn.disabled = !hasPart;
}

function deleteCurrentPart() {
  const part = getCurrentPart();
  if (!part) {
    showToast('No hay un parte abierto para eliminar.');
    return;
  }
  const rowsInfo = part.rows.length ? ` con ${part.rows.length} fila(s)` : '';
  const confirmed = window.confirm(`Se eliminara el parte del ${formatDate(part.date)}${rowsInfo}. Esta accion no se puede deshacer.`);
  if (!confirmed) return;

  state.parts = state.parts.filter(item => item.id !== part.id);
  currentPartId = null;
  refreshAll();
  showToast(`Se elimino el parte del ${formatDate(part.date)}.`);
}

function addPartRow() {
  const part = getCurrentPart();
  if (!part) {
    showToast('Abre o crea un parte primero.');
    return;
  }
  if (part.status === 'CERRADO') {
    showToast('El parte esta cerrado y no acepta cambios.');
    return;
  }
  showSavedPartRows = false;
  ensureDraftRow(part, true);
  renderCurrentPart();
  showToast('Registro listo para completar.');
}

function onPartRowsChange(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  const part = getCurrentPart();
  if (!part || part.status === 'CERRADO' || !currentDraftRow) return;

  const nextValue = event.target.value;
  if (field === 'workerId' && nextValue) {
    const duplicated = part.rows.some(item => item.workerId === nextValue);
    if (duplicated) {
      event.target.value = currentDraftRow.workerId || '';
      showToast('Ese trabajador ya fue registrado en este parte.');
      return;
    }
  }

  currentDraftRow[field] = nextValue;
}

function onPartRowsClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const part = getCurrentPart();
  if (!part || part.status === 'CERRADO') return;
  if (action === 'save-draft') saveDraftRow();
}

function saveCurrentPart() {
  const part = getCurrentPart();
  if (!part) {
    showToast('No hay un parte abierto.');
    return;
  }
  if (part.status === 'CERRADO') {
    showToast('El parte esta cerrado.');
    return;
  }
  part.updatedAt = new Date().toISOString();
  refreshAll();
  showToast('Parte guardado correctamente.');
}

function closeCurrentPart() {
  const part = getCurrentPart();
  if (!part) return showToast('No hay un parte abierto.');
  if (!part.rows.length) return showToast('Agrega al menos una fila antes de cerrar el parte.');
  const hasRowsWithoutWorker = part.rows.some(row => !row.workerId);
  if (hasRowsWithoutWorker) return showToast('Todas las filas deben tener trabajador antes de cerrar.');
  part.status = 'CERRADO';
  currentDraftRow = null;
  showSavedPartRows = true;
  part.updatedAt = new Date().toISOString();
  refreshAll();
  showToast('Parte cerrado. Solo queda disponible para consulta, impresion y exportacion.');
}

function reopenCurrentPart() {
  const part = getCurrentPart();
  if (!part) return showToast('No hay un parte abierto.');
  part.status = 'BORRADOR';
  showSavedPartRows = true;
  part.updatedAt = new Date().toISOString();
  refreshAll();
  showToast('Parte reabierto.');
}

function copyPreviousPart() {
  const part = getCurrentPart();
  if (!part) return showToast('No hay un parte abierto.');
  const previous = [...state.parts]
    .filter(item => item.date < part.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!previous) return showToast('No existe un parte anterior para copiar.');
  if (part.rows.length && !window.confirm('Este parte ya tiene filas. Se reemplazaran por el contenido del dia anterior.')) return;
  part.rows = previous.rows.map(row => ({ ...row, id: uid() }));
  currentDraftRow = createEmptyPartRow();
  showSavedPartRows = true;
  part.updatedAt = new Date().toISOString();
  refreshAll();
  showToast(`Se copio el contenido del ${formatDate(previous.date)}.`);
}

function createEmptyPartRow() {
  return {
    id: uid(),
    workerId: '',
    morningLaborId: '',
    morningFieldId: '',
    afternoonLaborId: '',
    afternoonFieldId: '',
    notes: ''
  };
}

function ensureDraftRow(part, forceNew = false) {
  if (!part || part.status === 'CERRADO') {
    currentDraftRow = null;
    return;
  }
  if (forceNew || !currentDraftRow) {
    currentDraftRow = createEmptyPartRow();
  }
}

function saveDraftRow() {
  const part = getCurrentPart();
  if (!part || part.status === 'CERRADO' || !currentDraftRow) return;
  if (!currentDraftRow.workerId) {
    showToast('Selecciona un trabajador para guardar el registro.');
    return;
  }

  part.rows.push({ ...currentDraftRow });
  part.updatedAt = new Date().toISOString();
  currentDraftRow = createEmptyPartRow();
  showSavedPartRows = false;
  refreshAll();
  showToast('Registro guardado. Puedes continuar con el siguiente.');
}

function currentPartRowsFlat() {
  const part = getCurrentPart();
  if (!part) return [];
  return part.rows.map(row => ({
    fecha: part.date,
    trabajador: getNameById(state.workers, row.workerId, 'name'),
    laborManana: getNameById(state.labors, row.morningLaborId, 'name'),
    campoManana: getNameById(state.fields, row.morningFieldId, 'name'),
    laborTarde: getNameById(state.labors, row.afternoonLaborId, 'name'),
    campoTarde: getNameById(state.fields, row.afternoonFieldId, 'name'),
    observaciones: row.notes || '',
    estado: part.status
  }));
}

function exportCurrentPartCSV() {
  const part = getCurrentPart();
  if (!part) return showToast('No hay un parte abierto.');
  const rows = currentPartRowsFlat();
  if (!rows.length) return showToast('No hay datos para exportar.');
  downloadCSV(rows, `parte-${part.date}.csv`);
  showToast('Se exporto el parte en CSV.');
}

function downloadCurrentPartPDF() {
  const part = getCurrentPart();
  if (!part) return showToast('No hay un parte abierto.');
  if (typeof window.html2pdf !== 'function') {
    showToast('No se pudo cargar el generador de PDF.');
    return;
  }

  const container = document.createElement('div');
  container.innerHTML = buildPartPrintableBody(part);
  const printable = container.firstElementChild;
  if (!printable) {
    showToast('No se pudo preparar el PDF.');
    return;
  }

  printable.style.width = '277mm';
  printable.style.maxWidth = '277mm';
  printable.style.margin = '0 auto';
  document.body.appendChild(printable);

  const options = {
    margin: [5, 5, 5, 5],
    filename: `parte-${part.date}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 1.6, useCORS: true, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  window.html2pdf()
    .set(options)
    .from(printable)
    .save()
    .then(() => {
      showToast('PDF descargado correctamente.');
    })
    .catch(() => {
      showToast('No se pudo generar el PDF.');
    })
    .finally(() => {
      printable.remove();
    });
}

function buildPartPrintableBody(part) {
  const basePath = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : window.location.pathname.replace(/\/[^/]*$/, '/');
  const logoUrl = `${window.location.origin}${basePath}icons/logo.png?v=20260312`;
  const generatedAt = new Date().toLocaleString('es-PE');
  const totalWorkers = part.rows.length;
  const printableRows = part.rows.map((row, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${escapeHtml(getNameById(state.workers, row.workerId, 'name'))}</td>
      <td>${escapeHtml(getNameById(state.labors, row.morningLaborId, 'name'))}</td>
      <td>${escapeHtml(getNameById(state.fields, row.morningFieldId, 'name'))}</td>
      <td>${escapeHtml(getNameById(state.labors, row.afternoonLaborId, 'name'))}</td>
      <td>${escapeHtml(getNameById(state.fields, row.afternoonFieldId, 'name'))}</td>
      <td>${escapeHtml(row.notes || '-')}</td>
    </tr>
  `).join('');

  return `
    <section style="font-family: Arial, sans-serif; color: #222; padding: 0; background: white; width: 277mm;">
      <style>
        .part-doc { border: 1.5px solid #2c4737; padding: 8px; width: 100%; }
        .part-doc * { box-sizing: border-box; }
        .part-doc h1, .part-doc h2, .part-doc h3, .part-doc p { margin: 0; }
        .part-doc table,
        .part-doc tr,
        .part-doc td,
        .part-doc th {
          page-break-inside: avoid;
        }
        .part-doc .doc-header {
          display: grid;
          grid-template-columns: 155px 1fr 165px;
          align-items: center;
          gap: 12px;
          border-bottom: 2px solid #2c4737;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .part-doc .logo-wrap {
          height: 56px;
          display: flex;
          align-items: center;
        }
        .part-doc .logo-wrap img {
          max-width: 145px;
          max-height: 52px;
          object-fit: contain;
        }
        .part-doc .doc-title {
          text-align: center;
        }
        .part-doc .doc-title h1 {
          font-size: 19px;
          letter-spacing: 0.04em;
          font-weight: 800;
        }
        .part-doc .doc-title h2 {
          font-size: 11px;
          margin-top: 3px;
          font-weight: 700;
        }
        .part-doc .doc-code {
          border: 1px solid #2c4737;
          padding: 8px 10px;
          font-size: 10px;
          line-height: 1.45;
        }
        .part-doc .meta-grid {
          display: flex;
          align-items: stretch;
          gap: 6px;
          margin-bottom: 10px;
        }
        .part-doc .meta-cell {
          border: 1px solid #2c4737;
          min-height: 48px;
          padding: 7px 8px;
          flex: 0 0 auto;
        }
        .part-doc .meta-label {
          display: block;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #516459;
          margin-bottom: 4px;
          letter-spacing: 0.04em;
        }
        .part-doc .meta-value {
          font-size: 12px;
          font-weight: 700;
        }
        .part-doc table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .part-doc th, .part-doc td {
          border: 1px solid #98a99e;
          padding: 6px 6px;
          text-align: left;
          font-size: 12px;
          vertical-align: top;
          word-break: break-word;
        }
        .part-doc th {
          background: #e7efe9;
          color: #22372b;
          font-size: 11px;
          letter-spacing: 0.03em;
        }
        .part-doc .center {
          text-align: center;
        }
        .part-doc .summary-row td {
          font-weight: 700;
          background: #f6faf7;
        }
        .part-doc .footer {
          margin-top: 14px;
          font-size: 10px;
          color: #555;
          text-align: right;
        }
      </style>
      <div class="part-doc">
        <div class="doc-header">
          <div class="logo-wrap">
            <img src="${escapeHtml(logoUrl)}" alt="Logo empresa">
          </div>
          <div class="doc-title">
            <h1>${escapeHtml(state.settings.company)}</h1>
            <h2>PARTE DIARIO DE DISTRIBUCION DE PERSONAL</h2>
          </div>
          <div class="doc-code">
            <div><strong>Formato:</strong> Control diario</div>
            <div><strong>Version:</strong> 1.0</div>
            <div><strong>Area:</strong> Campo</div>
          </div>
        </div>
        <div class="meta-grid">
          <div class="meta-cell">
            <span class="meta-label">Fundo / ubicacion</span>
            <div class="meta-value">${escapeHtml(state.settings.location)}</div>
          </div>
          <div class="meta-cell" style="min-width: 110px;">
            <span class="meta-label">Fecha</span>
            <div class="meta-value">${formatDate(part.date)}</div>
          </div>
          <div class="meta-cell" style="min-width: 110px;">
            <span class="meta-label">Estado</span>
            <div class="meta-value">${escapeHtml(part.status)}</div>
          </div>
          <div class="meta-cell" style="min-width: 130px;">
            <span class="meta-label">Total personal</span>
            <div class="meta-value">${totalWorkers}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 4%;">No.</th>
              <th style="width: 28%;">APELLIDOS y NOMBRES</th>
              <th style="width: 15%;">LABOR MA&#209;ANA</th>
              <th style="width: 11%;">CAMPO</th>
              <th style="width: 15%;">LABOR TARDE</th>
              <th style="width: 11%;">CAMPO</th>
              <th style="width: 16%;">OBSERVACIONES</th>
            </tr>
          </thead>
          <tbody>
            ${printableRows || '<tr><td colspan="7">Sin datos</td></tr>'}
            <tr class="summary-row">
              <td colspan="7">Total de personal registrado: ${totalWorkers}</td>
            </tr>
          </tbody>
        </table>
        <p class="footer">Generado el ${generatedAt}</p>
      </div>
    </section>
  `;
}

function renderWorkers() {
  const items = [...state.workers].sort((a, b) => a.name.localeCompare(b.name));
  els.workerCountBadge.textContent = `${items.length}`;
  if (!items.length) {
    els.workersTableBody.innerHTML = '<div class="empty-state">No hay trabajadores registrados.</div>';
    return;
  }
  els.workersTableBody.innerHTML = items.map(item => `
    <article class="worker-item-card">
      <div class="worker-item-top">
        <div>
          <h4>${escapeHtml(item.name)}</h4>
          <p class="muted">${escapeHtml(item.code || 'Sin codigo')} · DNI: ${escapeHtml(item.dni || '-')}</p>
        </div>
        <span class="status-pill ${item.active ? 'active' : 'inactive'}">${item.active ? 'Activo' : 'Inactivo'}</span>
      </div>
      <div class="mini-actions">
        <button class="secondary-btn mini-btn" data-action="edit" data-id="${item.id}">Editar</button>
        <button class="secondary-btn mini-btn" data-action="toggle" data-id="${item.id}">${item.active ? 'Inactivar' : 'Activar'}</button>
        <button class="secondary-btn mini-btn danger-outline" data-action="delete" data-id="${item.id}">Eliminar</button>
      </div>
    </article>
  `).join('');
}

function saveWorker(event) {
  event.preventDefault();
  const updatedAt = new Date().toISOString();
  const payload = {
    id: els.workerId.value || uid(),
    code: els.workerCode.value.trim(),
    dni: els.workerDni.value.trim(),
    name: els.workerName.value.trim(),
    active: els.workerActive.checked,
    updatedAt,
    deletedAt: null
  };
  if (!payload.name) return showToast('Ingresa el nombre del trabajador.');
  removeDeletedKey('deletedWorkers', getWorkerSemanticKey(payload));

  const existingIndex = state.workers.findIndex(item => item.id === payload.id);
  if (existingIndex >= 0) state.workers[existingIndex] = payload;
  else state.workers.push(payload);

  resetWorkerForm();
  refreshAll();
  showToast('Trabajador guardado.');
}

function resetWorkerForm() {
  els.workerForm.reset();
  els.workerId.value = '';
  els.workerActive.checked = true;
  els.workerFormTitle.textContent = 'Nuevo trabajador';
}

function onWorkersTableClick(event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const item = state.workers.find(entry => entry.id === btn.dataset.id);
  if (!item) return;
  const action = btn.dataset.action;

  if (action === 'edit') {
    els.workerId.value = item.id;
    els.workerCode.value = item.code || '';
    els.workerDni.value = item.dni || '';
    els.workerName.value = item.name || '';
    els.workerActive.checked = Boolean(item.active);
    els.workerFormTitle.textContent = 'Editar trabajador';
    switchView('trabajadores');
  }

  if (action === 'toggle') {
    item.active = !item.active;
    item.updatedAt = new Date().toISOString();
    refreshAll();
    showToast(`Trabajador ${item.active ? 'activado' : 'inactivado'}.`);
  }

  if (action === 'delete') {
    if (isEntityUsed('workers', item.id)) return showToast('Ese trabajador ya se uso en un parte. Inactivalo en lugar de eliminarlo.');
    if (!window.confirm(`Eliminar a ${item.name}?`)) return;
    markEntityDeleted('workers', 'deletedWorkers', item, getWorkerSemanticKey);
    refreshAll();
    showToast('Trabajador eliminado.');
  }
}

function renderLabors() {
  const items = [...state.labors].sort((a, b) => a.name.localeCompare(b.name));
  els.laborCountBadge.textContent = `${items.length}`;
  if (!items.length) {
    els.laborsTableBody.innerHTML = '<div class="empty-state">No hay labores registradas.</div>';
    return;
  }
  els.laborsTableBody.innerHTML = items.map(item => `
    <article class="worker-item-card">
      <div class="worker-item-top">
        <div>
          <h4>${escapeHtml(item.name)}</h4>
        </div>
        <span class="status-pill ${item.active ? 'active' : 'inactive'}">${item.active ? 'Activa' : 'Inactiva'}</span>
      </div>
      <div class="mini-actions">
        <button class="secondary-btn mini-btn" data-action="edit" data-id="${item.id}">Editar</button>
        <button class="secondary-btn mini-btn" data-action="toggle" data-id="${item.id}">${item.active ? 'Inactivar' : 'Activar'}</button>
        <button class="secondary-btn mini-btn danger-outline" data-action="delete" data-id="${item.id}">Eliminar</button>
      </div>
    </article>
  `).join('');
}

function saveLabor(event) {
  event.preventDefault();
  const updatedAt = new Date().toISOString();
  const payload = {
    id: els.laborId.value || uid(),
    name: els.laborName.value.trim(),
    active: els.laborActive.checked,
    updatedAt,
    deletedAt: null
  };
  if (!payload.name) return showToast('Ingresa el nombre de la labor.');
  removeDeletedKey('deletedLabors', getLaborSemanticKey(payload));
  const existingIndex = state.labors.findIndex(item => item.id === payload.id);
  if (existingIndex >= 0) state.labors[existingIndex] = payload;
  else state.labors.push(payload);
  resetLaborForm();
  refreshAll();
  showToast('Labor guardada.');
}

function resetLaborForm() {
  els.laborForm.reset();
  els.laborId.value = '';
  els.laborActive.checked = true;
  els.laborFormTitle.textContent = 'Nueva labor';
}

function onLaborsTableClick(event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const item = state.labors.find(entry => entry.id === btn.dataset.id);
  if (!item) return;
  const action = btn.dataset.action;

  if (action === 'edit') {
    els.laborId.value = item.id;
    els.laborName.value = item.name;
    els.laborActive.checked = Boolean(item.active);
    els.laborFormTitle.textContent = 'Editar labor';
    switchView('labores');
  }

  if (action === 'toggle') {
    item.active = !item.active;
    item.updatedAt = new Date().toISOString();
    refreshAll();
    showToast(`Labor ${item.active ? 'activada' : 'inactivada'}.`);
  }

  if (action === 'delete') {
    if (isEntityUsed('labors', item.id)) return showToast('Esa labor ya se uso en un parte. Inactivala en lugar de eliminarla.');
    if (!window.confirm(`Eliminar la labor ${item.name}?`)) return;
    markEntityDeleted('labors', 'deletedLabors', item, getLaborSemanticKey);
    refreshAll();
    showToast('Labor eliminada.');
  }
}

function renderFields() {
  const items = [...state.fields].sort((a, b) => a.name.localeCompare(b.name));
  els.fieldCountBadge.textContent = `${items.length}`;
  if (!items.length) {
    els.fieldsTableBody.innerHTML = '<div class="empty-state">No hay campos registrados.</div>';
    return;
  }
  els.fieldsTableBody.innerHTML = items.map(item => `
    <article class="worker-item-card">
      <div class="worker-item-top">
        <div>
          <h4>${escapeHtml(item.name)}</h4>
        </div>
        <span class="status-pill ${item.active ? 'active' : 'inactive'}">${item.active ? 'Activo' : 'Inactivo'}</span>
      </div>
      <div class="mini-actions">
        <button class="secondary-btn mini-btn" data-action="edit" data-id="${item.id}">Editar</button>
        <button class="secondary-btn mini-btn" data-action="toggle" data-id="${item.id}">${item.active ? 'Inactivar' : 'Activar'}</button>
        <button class="secondary-btn mini-btn danger-outline" data-action="delete" data-id="${item.id}">Eliminar</button>
      </div>
    </article>
  `).join('');
}

function saveField(event) {
  event.preventDefault();
  const updatedAt = new Date().toISOString();
  const payload = {
    id: els.fieldId.value || uid(),
    name: els.fieldName.value.trim(),
    active: els.fieldActive.checked,
    updatedAt,
    deletedAt: null
  };
  if (!payload.name) return showToast('Ingresa el nombre del campo.');
  removeDeletedKey('deletedFields', getFieldSemanticKey(payload));
  const existingIndex = state.fields.findIndex(item => item.id === payload.id);
  if (existingIndex >= 0) state.fields[existingIndex] = payload;
  else state.fields.push(payload);
  resetFieldForm();
  refreshAll();
  showToast('Campo guardado.');
}

function resetFieldForm() {
  els.fieldForm.reset();
  els.fieldId.value = '';
  els.fieldActive.checked = true;
  els.fieldFormTitle.textContent = 'Nuevo campo';
}

function onFieldsTableClick(event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const item = state.fields.find(entry => entry.id === btn.dataset.id);
  if (!item) return;
  const action = btn.dataset.action;

  if (action === 'edit') {
    els.fieldId.value = item.id;
    els.fieldName.value = item.name;
    els.fieldActive.checked = Boolean(item.active);
    els.fieldFormTitle.textContent = 'Editar campo';
    switchView('campos');
  }

  if (action === 'toggle') {
    item.active = !item.active;
    item.updatedAt = new Date().toISOString();
    refreshAll();
    showToast(`Campo ${item.active ? 'activado' : 'inactivado'}.`);
  }

  if (action === 'delete') {
    if (isEntityUsed('fields', item.id)) return showToast('Ese campo ya se uso en un parte. Inactivalo en lugar de eliminarlo.');
    if (!window.confirm(`Eliminar el campo ${item.name}?`)) return;
    markEntityDeleted('fields', 'deletedFields', item, getFieldSemanticKey);
    refreshAll();
    showToast('Campo eliminado.');
  }
}

function isEntityUsed(type, id) {
  return state.parts.some(part => part.rows.some(row => {
    if (type === 'workers') return row.workerId === id;
    if (type === 'labors') return row.morningLaborId === id || row.afternoonLaborId === id;
    if (type === 'fields') return row.morningFieldId === id || row.afternoonFieldId === id;
    return false;
  }));
}

function renderReportsFilters() {
  const workerOptions = `<option value="">Todos</option>${state.workers
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;

  const laborOptions = `<option value="">Todas</option>${state.labors
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;

  const fieldOptions = `<option value="">Todos</option>${state.fields
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;

  els.reportWorker.innerHTML = workerOptions;
  els.reportLabor.innerHTML = laborOptions;
  els.reportField.innerHTML = fieldOptions;

  if (els.jornalesWorker) els.jornalesWorker.innerHTML = workerOptions;
  if (els.jornalesLabor) els.jornalesLabor.innerHTML = laborOptions;
  if (els.jornalesField) els.jornalesField.innerHTML = fieldOptions;
  if (els.performanceFilterWorker) els.performanceFilterWorker.innerHTML = workerOptions;
  if (els.performanceFilterLabor) els.performanceFilterLabor.innerHTML = laborOptions;
  if (els.performanceFilterField) els.performanceFilterField.innerHTML = fieldOptions;
  if (els.performanceWorker) els.performanceWorker.innerHTML = `<option value="">Selecciona</option>${state.workers
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;
  if (els.performanceLabor) els.performanceLabor.innerHTML = `<option value="">Selecciona</option>${state.labors
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;
  if (els.performanceField) els.performanceField.innerHTML = `<option value="">Selecciona</option>${state.fields
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;
}

function runReports() {
  const filters = {
    from: els.reportFrom.value,
    to: els.reportTo.value,
    workerId: els.reportWorker.value,
    laborId: els.reportLabor.value,
    fieldId: els.reportField.value
  };

  lastReportResults = state.parts
    .filter(part => {
      if (filters.from && part.date < filters.from) return false;
      if (filters.to && part.date > filters.to) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap(part => part.rows.map(row => ({ part, row })))
    .filter(({ row }) => {
      const matchesWorker = !filters.workerId || row.workerId === filters.workerId;
      const matchesLabor = !filters.laborId || row.morningLaborId === filters.laborId || row.afternoonLaborId === filters.laborId;
      const matchesField = !filters.fieldId || row.morningFieldId === filters.fieldId || row.afternoonFieldId === filters.fieldId;
      return matchesWorker && matchesLabor && matchesField;
    })
    .map(({ part, row }) => ({
      fecha: part.date,
      trabajador: getNameById(state.workers, row.workerId, 'name'),
      laborManana: getNameById(state.labors, row.morningLaborId, 'name'),
      campoManana: getNameById(state.fields, row.morningFieldId, 'name'),
      laborTarde: getNameById(state.labors, row.afternoonLaborId, 'name'),
      campoTarde: getNameById(state.fields, row.afternoonFieldId, 'name'),
      observaciones: row.notes || '',
      estado: part.status
    }));

  els.reportCountBadge.textContent = `${lastReportResults.length} registros`;
  if (!lastReportResults.length) {
    els.reportsTableBody.innerHTML = '<tr><td colspan="8">No se encontraron resultados.</td></tr>';
    return;
  }
  els.reportsTableBody.innerHTML = lastReportResults.map(item => `
    <tr>
      <td class="no-break">${formatDate(item.fecha)}</td>
      <td>${escapeHtml(item.trabajador)}</td>
      <td>${escapeHtml(item.laborManana)}</td>
      <td>${escapeHtml(item.campoManana)}</td>
      <td>${escapeHtml(item.laborTarde)}</td>
      <td>${escapeHtml(item.campoTarde)}</td>
      <td>${escapeHtml(item.observaciones)}</td>
      <td><span class="status-pill ${item.estado === 'CERRADO' ? 'closed' : 'draft'}">${escapeHtml(item.estado)}</span></td>
    </tr>
  `).join('');
}

function runJornalesReport() {
  if (!els.jornalesTableBody || !els.jornalesCountBadge || !els.jornalesTotalSummary) return;

  const filters = {
    from: els.jornalesFrom?.value || '',
    to: els.jornalesTo?.value || '',
    workerId: els.jornalesWorker?.value || '',
    laborId: els.jornalesLabor?.value || '',
    fieldId: els.jornalesField?.value || ''
  };

  const grouped = new Map();

  state.parts
    .filter(part => {
      if (filters.from && part.date < filters.from) return false;
      if (filters.to && part.date > filters.to) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(part => {
      part.rows.forEach(row => {
        if (filters.workerId && row.workerId !== filters.workerId) return;
        if (filters.laborId && row.morningLaborId !== filters.laborId) return;
        if (filters.fieldId && row.morningFieldId !== filters.fieldId) return;
        if (!row.morningLaborId && !row.morningFieldId) return;

        const labor = getNameById(state.labors, row.morningLaborId, 'name') || '-';
        const field = getNameById(state.fields, row.morningFieldId, 'name') || '-';
        const key = [part.date, labor, field].join('||');
        const current = grouped.get(key) || {
          fecha: part.date,
          labor,
          campo: field,
          totalJornales: 0
        };
        current.totalJornales += 1;
        grouped.set(key, current);
      });
    });

  lastJornalesResults = [...grouped.values()].sort((a, b) => {
    if (a.fecha === b.fecha) {
      if (a.campo === b.campo) return a.labor.localeCompare(b.labor);
      return a.campo.localeCompare(b.campo);
    }
    return a.fecha.localeCompare(b.fecha);
  });

  const totalJornales = lastJornalesResults.reduce((acc, item) => acc + item.totalJornales, 0);
  els.jornalesCountBadge.textContent = `${lastJornalesResults.length} registros`;
  els.jornalesTotalSummary.textContent = `Total de jornales: ${totalJornales}`;

  if (!lastJornalesResults.length) {
    els.jornalesTableBody.innerHTML = '<tr><td colspan="4">No se encontraron resultados.</td></tr>';
    return;
  }

  els.jornalesTableBody.innerHTML = lastJornalesResults.map(item => `
    <tr>
      <td class="no-break">${formatDate(item.fecha)}</td>
      <td>${escapeHtml(item.labor)}</td>
      <td>${escapeHtml(item.campo)}</td>
      <td>${item.totalJornales}</td>
    </tr>
  `).join('');
}

function renderPerformanceModule() {
  if (!els.performanceDate) return;
  if (!els.performanceDate.value) els.performanceDate.value = todayISO();
  runPerformanceReport();
}

function runPerformanceReport() {
  if (!els.performanceTableBody) return;

  const filters = {
    from: els.performanceFrom?.value || '',
    to: els.performanceTo?.value || '',
    workerId: els.performanceFilterWorker?.value || '',
    laborId: els.performanceFilterLabor?.value || '',
    fieldId: els.performanceFilterField?.value || ''
  };

  lastPerformanceResults = [...state.performances]
    .filter(item => {
      if (filters.from && item.date < filters.from) return false;
      if (filters.to && item.date > filters.to) return false;
      if (filters.workerId && item.workerId !== filters.workerId) return false;
      if (filters.laborId && item.laborId !== filters.laborId) return false;
      if (filters.fieldId && item.fieldId !== filters.fieldId) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      ...item,
      trabajador: getNameById(state.workers, item.workerId, 'name'),
      labor: getNameById(state.labors, item.laborId, 'name'),
      campo: getNameById(state.fields, item.fieldId, 'name'),
      rendimiento: item.jornales > 0 ? (item.quantity / item.jornales) : 0
    }));

  const totalJornales = lastPerformanceResults.reduce((acc, item) => acc + item.jornales, 0);
  const totalQuantity = lastPerformanceResults.reduce((acc, item) => acc + item.quantity, 0);
  const average = totalJornales > 0 ? (totalQuantity / totalJornales) : 0;
  const averageUnit = lastPerformanceResults[0]?.unit || '';
  const summaryMap = new Map();

  lastPerformanceResults.forEach(item => {
    const normalizedUnit = normalizeUnit(item.unit);
    const key = [item.campo, item.labor, normalizedUnit].join('||');
    const current = summaryMap.get(key) || {
      campo: item.campo,
      labor: item.labor,
      unidad: normalizedUnit,
      totalCantidad: 0,
      totalJornales: 0,
      rendimiento: 0
    };
    current.totalCantidad += item.quantity;
    current.totalJornales += item.jornales;
    current.rendimiento = current.totalJornales > 0 ? (current.totalCantidad / current.totalJornales) : 0;
    summaryMap.set(key, current);
  });
  lastPerformanceSummary = [...summaryMap.values()].sort((a, b) => {
    if (a.campo === b.campo) return a.labor.localeCompare(b.labor);
    return a.campo.localeCompare(b.campo);
  });

  if (els.performanceTotalJornales) els.performanceTotalJornales.textContent = formatDecimal(totalJornales);
  if (els.performanceTotalQuantity) els.performanceTotalQuantity.textContent = formatDecimal(totalQuantity);
  if (els.performanceAverage) els.performanceAverage.textContent = `${formatDecimal(average)}${averageUnit ? ` ${averageUnit}/jornal` : ''}`;
  if (els.performanceCount) els.performanceCount.textContent = String(lastPerformanceResults.length);
  if (els.performanceCountBadge) els.performanceCountBadge.textContent = `${lastPerformanceResults.length} registros`;
  if (els.performanceSummaryCountBadge) els.performanceSummaryCountBadge.textContent = `${lastPerformanceSummary.length} grupos`;

  if (!lastPerformanceResults.length) {
    els.performanceTableBody.innerHTML = '<tr><td colspan="9">No se encontraron resultados.</td></tr>';
    if (els.performanceSummaryTableBody) {
      els.performanceSummaryTableBody.innerHTML = '<tr><td colspan="6">No se encontraron resultados.</td></tr>';
    }
    return;
  }

  els.performanceTableBody.innerHTML = lastPerformanceResults.map(item => `
    <tr>
      <td class="no-break">${formatDate(item.date)}</td>
      <td>${escapeHtml(item.trabajador)}</td>
      <td>${escapeHtml(item.labor)}</td>
      <td>${escapeHtml(item.campo)}</td>
      <td>${formatDecimal(item.quantity)}</td>
      <td>${escapeHtml(item.unit)}</td>
      <td>${formatDecimal(item.jornales)}</td>
      <td>${formatDecimal(item.rendimiento)} ${escapeHtml(item.unit)}/jornal</td>
      <td>
        <div class="mini-actions">
          <button class="secondary-btn mini-btn" data-action="edit" data-id="${item.id}">Editar</button>
          <button class="secondary-btn mini-btn danger-outline" data-action="delete" data-id="${item.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join('');

  if (els.performanceSummaryTableBody) {
    els.performanceSummaryTableBody.innerHTML = lastPerformanceSummary.map(item => `
      <tr>
        <td>${escapeHtml(item.campo)}</td>
        <td>${escapeHtml(item.labor)}</td>
        <td>${formatDecimal(item.totalCantidad)}</td>
        <td>${escapeHtml(item.unidad)}</td>
        <td>${formatDecimal(item.totalJornales)}</td>
        <td>${formatDecimal(item.rendimiento)} ${escapeHtml(item.unidad)}/jornal</td>
      </tr>
    `).join('');
  }
}

function savePerformance(event) {
  event.preventDefault();
  const payload = {
    id: els.performanceId.value || uid(),
    date: els.performanceDate.value || todayISO(),
    workerId: els.performanceWorker.value,
    laborId: els.performanceLabor.value,
    fieldId: els.performanceField.value,
    quantity: Number(els.performanceQuantity.value),
    unit: els.performanceUnit.value.trim(),
    jornales: Number(els.performanceJornales.value),
    notes: els.performanceNotes.value.trim()
  };

  if (!payload.workerId || !payload.laborId || !payload.fieldId) return showToast('Completa trabajador, labor y campo.');
  if (!payload.quantity || payload.quantity <= 0) return showToast('Ingresa una cantidad valida.');
  if (!payload.unit) return showToast('Ingresa la unidad.');
  if (!payload.jornales || payload.jornales <= 0) return showToast('Ingresa jornales validos.');

  const existingIndex = state.performances.findIndex(item => item.id === payload.id);
  if (existingIndex >= 0) state.performances[existingIndex] = payload;
  else state.performances.push(payload);

  resetPerformanceForm();
  refreshAll();
  showToast('Rendimiento guardado.');
}

function resetPerformanceForm() {
  if (!els.performanceForm) return;
  els.performanceForm.reset();
  els.performanceId.value = '';
  els.performanceDate.value = todayISO();
  els.performanceFormTitle.textContent = 'Nuevo rendimiento';
}

function onPerformanceTableClick(event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const item = state.performances.find(entry => entry.id === btn.dataset.id);
  if (!item) return;

  if (btn.dataset.action === 'edit') {
    els.performanceId.value = item.id;
    els.performanceDate.value = item.date || todayISO();
    els.performanceWorker.value = item.workerId || '';
    els.performanceLabor.value = item.laborId || '';
    els.performanceField.value = item.fieldId || '';
    els.performanceQuantity.value = item.quantity ?? '';
    els.performanceUnit.value = item.unit || '';
    els.performanceJornales.value = item.jornales ?? '';
    els.performanceNotes.value = item.notes || '';
    els.performanceFormTitle.textContent = 'Editar rendimiento';
    switchView('rendimiento');
  }

  if (btn.dataset.action === 'delete') {
    if (!window.confirm('Eliminar este registro de rendimiento?')) return;
    state.performances = state.performances.filter(entry => entry.id !== item.id);
    refreshAll();
    showToast('Rendimiento eliminado.');
  }
}

function exportPerformanceCSV() {
  if (!lastPerformanceResults.length) {
    runPerformanceReport();
  }
  if (!lastPerformanceResults.length) return showToast('No hay resultados de rendimiento para exportar.');
  const exportRows = lastPerformanceResults.map(item => ({
    fecha: item.date,
    trabajador: item.trabajador,
    labor: item.labor,
    campo: item.campo,
    cantidad: item.quantity,
    unidad: item.unit,
    jornales: item.jornales,
    rendimiento: item.rendimiento
  }));
  downloadCSV(exportRows, `rendimiento-${todayISO()}.csv`);
  showToast('Rendimiento exportado en CSV.');
}

function downloadPerformancePDF() {
  if (!lastPerformanceResults.length) {
    runPerformanceReport();
  }
  if (!lastPerformanceResults.length) {
    showToast('No hay resultados de rendimiento para exportar.');
    return;
  }
  if (typeof window.html2pdf !== 'function') {
    showToast('No se pudo cargar el generador de PDF.');
    return;
  }

  const container = document.createElement('div');
  container.innerHTML = buildPerformancePrintableBody(lastPerformanceResults, lastPerformanceSummary);
  const printable = container.firstElementChild;
  if (!printable) {
    showToast('No se pudo preparar el PDF de rendimiento.');
    return;
  }

  printable.style.width = '277mm';
  printable.style.maxWidth = '277mm';
  printable.style.margin = '0 auto';
  document.body.appendChild(printable);

  const options = {
    margin: [5, 5, 5, 5],
    filename: `rendimiento-${todayISO()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 1.6, useCORS: true, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  window.html2pdf()
    .set(options)
    .from(printable)
    .save()
    .then(() => {
      showToast('Rendimiento descargado en PDF.');
    })
    .catch(() => {
      showToast('No se pudo generar el PDF de rendimiento.');
    })
    .finally(() => {
      printable.remove();
    });
}

function exportJornalesCSV() {
  if (!lastJornalesResults.length) {
    runJornalesReport();
  }
  if (!lastJornalesResults.length) return showToast('No hay resultados de jornales para exportar.');
  downloadCSV(lastJornalesResults, `jornales-por-campo-${todayISO()}.csv`);
  showToast('Jornales exportados en CSV.');
}

function downloadJornalesPDF() {
  if (!lastJornalesResults.length) {
    runJornalesReport();
  }
  if (!lastJornalesResults.length) {
    showToast('No hay resultados de jornales para exportar.');
    return;
  }
  if (typeof window.html2pdf !== 'function') {
    showToast('No se pudo cargar el generador de PDF.');
    return;
  }

  const container = document.createElement('div');
  container.innerHTML = buildJornalesPrintableBody(lastJornalesResults);
  const printable = container.firstElementChild;
  if (!printable) {
    showToast('No se pudo preparar el PDF de jornales.');
    return;
  }

  printable.style.width = '277mm';
  printable.style.maxWidth = '277mm';
  printable.style.margin = '0 auto';
  document.body.appendChild(printable);

  const options = {
    margin: [5, 5, 5, 5],
    filename: `jornales-por-campo-${todayISO()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 1.6, useCORS: true, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  window.html2pdf()
    .set(options)
    .from(printable)
    .save()
    .then(() => {
      showToast('Jornales descargados en PDF.');
    })
    .catch(() => {
      showToast('No se pudo generar el PDF de jornales.');
    })
    .finally(() => {
      printable.remove();
    });
}

function getLogoUrl() {
  const basePath = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : window.location.pathname.replace(/\/[^/]*$/, '/');
  return `${window.location.origin}${basePath}icons/logo.png?v=20260312`;
}

function exportReportCSV() {
  if (!lastReportResults.length) {
    runReports();
  }
  if (!lastReportResults.length) return showToast('No hay resultados para exportar.');
  downloadCSV(lastReportResults, `reporte-partes-${todayISO()}.csv`);
  showToast('Reporte exportado en CSV.');
}

function downloadReportPDF() {
  if (!lastReportResults.length) {
    runReports();
  }
  if (!lastReportResults.length) {
    showToast('No hay resultados para exportar.');
    return;
  }
  if (typeof window.html2pdf !== 'function') {
    showToast('No se pudo cargar el generador de PDF.');
    return;
  }

  const container = document.createElement('div');
  container.innerHTML = buildReportPrintableBody(lastReportResults);
  const printable = container.firstElementChild;
  if (!printable) {
    showToast('No se pudo preparar el PDF del reporte.');
    return;
  }

  printable.style.width = '277mm';
  printable.style.maxWidth = '277mm';
  printable.style.margin = '0 auto';
  document.body.appendChild(printable);

  const options = {
    margin: [5, 5, 5, 5],
    filename: `reporte-partes-${todayISO()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 1.6, useCORS: true, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  window.html2pdf()
    .set(options)
    .from(printable)
    .save()
    .then(() => {
      showToast('Reporte descargado en PDF.');
    })
    .catch(() => {
      showToast('No se pudo generar el PDF del reporte.');
    })
    .finally(() => {
      printable.remove();
    });
}

function buildReportPrintableBody(rows) {
  const logoUrl = getLogoUrl();
  const generatedAt = new Date().toLocaleString('es-PE');
  const printableRows = rows.map((row, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${formatDate(row.fecha)}</td>
      <td>${escapeHtml(row.trabajador)}</td>
      <td>${escapeHtml(row.laborManana)}</td>
      <td>${escapeHtml(row.campoManana)}</td>
      <td>${escapeHtml(row.laborTarde)}</td>
      <td>${escapeHtml(row.campoTarde)}</td>
      <td>${escapeHtml(row.observaciones || '-')}</td>
      <td>${escapeHtml(row.estado)}</td>
    </tr>
  `).join('');

  return `
    <section style="font-family: Arial, sans-serif; color: #222; padding: 0; background: white;">
      <style>
        .report-doc { border: 1.5px solid #2c4737; padding: 8px; width: 100%; }
        .report-doc * { box-sizing: border-box; }
        .report-doc h1, .report-doc h2, .report-doc p { margin: 0; }
        .report-doc .doc-header {
          display: grid;
          grid-template-columns: 155px 1fr 165px;
          align-items: center;
          gap: 12px;
          border-bottom: 2px solid #2c4737;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .report-doc .logo-wrap {
          height: 56px;
          display: flex;
          align-items: center;
        }
        .report-doc .logo-wrap img {
          max-width: 145px;
          max-height: 52px;
          object-fit: contain;
        }
        .report-doc .doc-title {
          text-align: center;
        }
        .report-doc .doc-title h1 {
          font-size: 19px;
          letter-spacing: 0.04em;
          font-weight: 800;
        }
        .report-doc .doc-title h2 {
          font-size: 11px;
          margin-top: 3px;
          font-weight: 700;
        }
        .report-doc .doc-code {
          border: 1px solid #2c4737;
          padding: 8px 10px;
          font-size: 10px;
          line-height: 1.45;
        }
        .report-doc .summary-strip {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
        }
        .report-doc .summary-cell {
          border: 1px solid #2c4737;
          min-height: 48px;
          padding: 7px 8px;
          flex: 0 0 auto;
        }
        .report-doc .summary-label {
          display: block;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #516459;
          margin-bottom: 4px;
          letter-spacing: 0.04em;
        }
        .report-doc .summary-value {
          font-size: 12px;
          font-weight: 700;
        }
        .report-doc table,
        .report-doc tr,
        .report-doc td,
        .report-doc th {
          page-break-inside: avoid;
        }
        .report-doc table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .report-doc th, .report-doc td {
          border: 1px solid #98a99e;
          padding: 6px 6px;
          text-align: left;
          font-size: 12px;
          vertical-align: top;
          word-break: break-word;
        }
        .report-doc th {
          background: #e7efe9;
          color: #22372b;
          font-size: 11px;
          letter-spacing: 0.03em;
        }
        .report-doc .center {
          text-align: center;
        }
        .report-doc .summary-row td {
          font-weight: 700;
          background: #f6faf7;
        }
        .report-doc .footer {
          margin-top: 12px;
          font-size: 10px;
          color: #555;
          text-align: right;
        }
      </style>
      <div class="report-doc">
        <div class="doc-header">
          <div class="logo-wrap">
            <img src="${escapeHtml(logoUrl)}" alt="Logo empresa">
          </div>
          <div class="doc-title">
            <h1>${escapeHtml(state.settings.company)}</h1>
            <h2>REPORTE DE DISTRIBUCION DE PERSONAL</h2>
          </div>
          <div class="doc-code">
            <div><strong>Formato:</strong> Reporte</div>
            <div><strong>Version:</strong> 1.0</div>
            <div><strong>Area:</strong> Campo</div>
          </div>
        </div>
        <div class="summary-strip">
          <div class="summary-cell">
            <span class="summary-label">Fundo</span>
            <div class="summary-value">${escapeHtml(state.settings.location)}</div>
          </div>
          <div class="summary-cell">
            <span class="summary-label">Desde</span>
            <div class="summary-value">${els.reportFrom.value ? formatDate(els.reportFrom.value) : 'Todos'}</div>
          </div>
          <div class="summary-cell">
            <span class="summary-label">Hasta</span>
            <div class="summary-value">${els.reportTo.value ? formatDate(els.reportTo.value) : 'Todos'}</div>
          </div>
          <div class="summary-cell">
            <span class="summary-label">Registros</span>
            <div class="summary-value">${rows.length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 4%;">No.</th>
              <th style="width: 9%;">Fecha</th>
              <th style="width: 20%;">APELLIDOS y NOMBRES</th>
              <th style="width: 13%;">LABOR MA&#209;ANA</th>
              <th style="width: 10%;">CAMPO</th>
              <th style="width: 13%;">LABOR TARDE</th>
              <th style="width: 10%;">CAMPO</th>
              <th style="width: 13%;">OBSERVACIONES</th>
              <th style="width: 8%;">ESTADO</th>
            </tr>
          </thead>
          <tbody>
            ${printableRows || '<tr><td colspan="9">Sin datos</td></tr>'}
            <tr class="summary-row">
              <td colspan="9">Total de registros: ${rows.length}</td>
            </tr>
          </tbody>
        </table>
        <p class="footer">Generado el ${generatedAt}</p>
      </div>
    </section>
  `;
}

function buildJornalesPrintableBody(rows) {
  const logoUrl = getLogoUrl();
  const generatedAt = new Date().toLocaleString('es-PE');
  const totalJornales = rows.reduce((acc, item) => acc + item.totalJornales, 0);
  const printableRows = rows.map((row, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${formatDate(row.fecha)}</td>
      <td>${escapeHtml(row.labor)}</td>
      <td>${escapeHtml(row.campo)}</td>
      <td class="center">${row.totalJornales}</td>
    </tr>
  `).join('');

  return `
    <section style="font-family: Arial, sans-serif; color: #222; padding: 0; background: white;">
      <style>
        .jornales-doc { border: 1.5px solid #2c4737; padding: 8px; width: 100%; }
        .jornales-doc * { box-sizing: border-box; }
        .jornales-doc h1, .jornales-doc h2, .jornales-doc p { margin: 0; }
        .jornales-doc .doc-header {
          display: grid;
          grid-template-columns: 155px 1fr 165px;
          align-items: center;
          gap: 12px;
          border-bottom: 2px solid #2c4737;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .jornales-doc .logo-wrap {
          height: 56px;
          display: flex;
          align-items: center;
        }
        .jornales-doc .logo-wrap img {
          max-width: 145px;
          max-height: 52px;
          object-fit: contain;
        }
        .jornales-doc .doc-title {
          text-align: center;
        }
        .jornales-doc .doc-title h1 {
          font-size: 19px;
          letter-spacing: 0.04em;
          font-weight: 800;
        }
        .jornales-doc .doc-title h2 {
          font-size: 11px;
          margin-top: 3px;
          font-weight: 700;
        }
        .jornales-doc .doc-code {
          border: 1px solid #2c4737;
          padding: 8px 10px;
          font-size: 10px;
          line-height: 1.45;
        }
        .jornales-doc .summary-strip {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
        }
        .jornales-doc .summary-cell {
          border: 1px solid #2c4737;
          min-height: 48px;
          padding: 7px 8px;
          flex: 0 0 auto;
        }
        .jornales-doc .summary-label {
          display: block;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #516459;
          margin-bottom: 4px;
          letter-spacing: 0.04em;
        }
        .jornales-doc .summary-value {
          font-size: 12px;
          font-weight: 700;
        }
        .jornales-doc table,
        .jornales-doc tr,
        .jornales-doc td,
        .jornales-doc th {
          page-break-inside: avoid;
        }
        .jornales-doc table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .jornales-doc th, .jornales-doc td {
          border: 1px solid #98a99e;
          padding: 6px 6px;
          text-align: left;
          font-size: 12px;
          vertical-align: top;
          word-break: break-word;
        }
        .jornales-doc th {
          background: #e7efe9;
          color: #22372b;
          font-size: 11px;
          letter-spacing: 0.03em;
        }
        .jornales-doc .center {
          text-align: center;
        }
        .jornales-doc .summary-row td {
          font-weight: 700;
          background: #f6faf7;
        }
        .jornales-doc .footer {
          margin-top: 12px;
          font-size: 10px;
          color: #555;
          text-align: right;
        }
      </style>
      <div class="jornales-doc">
        <div class="doc-header">
          <div class="logo-wrap">
            <img src="${escapeHtml(logoUrl)}" alt="Logo empresa">
          </div>
          <div class="doc-title">
            <h1>${escapeHtml(state.settings.company)}</h1>
            <h2>JORNALES POR CAMPO</h2>
          </div>
          <div class="doc-code">
            <div><strong>Formato:</strong> Resumen jornales</div>
            <div><strong>Version:</strong> 1.0</div>
            <div><strong>Area:</strong> Campo</div>
          </div>
        </div>
        <div class="summary-strip">
          <div class="summary-cell" style="min-width: 220px;">
            <span class="summary-label">Fundo / ubicacion</span>
            <div class="summary-value">${escapeHtml(state.settings.location)}</div>
          </div>
          <div class="summary-cell" style="min-width: 110px;">
            <span class="summary-label">Desde</span>
            <div class="summary-value">${els.jornalesFrom?.value ? formatDate(els.jornalesFrom.value) : 'Todos'}</div>
          </div>
          <div class="summary-cell" style="min-width: 110px;">
            <span class="summary-label">Hasta</span>
            <div class="summary-value">${els.jornalesTo?.value ? formatDate(els.jornalesTo.value) : 'Todos'}</div>
          </div>
          <div class="summary-cell" style="min-width: 140px;">
            <span class="summary-label">Total jornales</span>
            <div class="summary-value">${totalJornales}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 7%;">No.</th>
              <th style="width: 18%;">FECHA</th>
              <th style="width: 35%;">LABOR</th>
              <th style="width: 25%;">CAMPO</th>
              <th style="width: 15%;">TOTAL DE JORNALES</th>
            </tr>
          </thead>
          <tbody>
            ${printableRows || '<tr><td colspan="5">Sin datos</td></tr>'}
            <tr class="summary-row">
              <td colspan="5">Total de jornales: ${totalJornales}</td>
            </tr>
          </tbody>
        </table>
        <p class="footer">Generado el ${generatedAt}</p>
      </div>
    </section>
  `;
}

function buildPerformancePrintableBody(rows, summaryRows) {
  const logoUrl = getLogoUrl();
  const generatedAt = new Date().toLocaleString('es-PE');
  const totalJornales = rows.reduce((acc, item) => acc + item.jornales, 0);
  const totalQuantity = rows.reduce((acc, item) => acc + item.quantity, 0);
  const average = totalJornales > 0 ? (totalQuantity / totalJornales) : 0;
  const averageUnit = rows[0]?.unit || '';

  const printableRows = rows.map((row, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${formatDate(row.date)}</td>
      <td>${escapeHtml(row.trabajador)}</td>
      <td>${escapeHtml(row.labor)}</td>
      <td>${escapeHtml(row.campo)}</td>
      <td class="center">${formatDecimal(row.quantity)}</td>
      <td>${escapeHtml(row.unit)}</td>
      <td class="center">${formatDecimal(row.jornales)}</td>
      <td>${formatDecimal(row.rendimiento)} ${escapeHtml(row.unit)}/jornal</td>
    </tr>
  `).join('');

  const printableSummaryRows = summaryRows.map(row => `
    <tr>
      <td>${escapeHtml(row.campo)}</td>
      <td>${escapeHtml(row.labor)}</td>
      <td class="center">${formatDecimal(row.totalCantidad)}</td>
      <td>${escapeHtml(row.unidad)}</td>
      <td class="center">${formatDecimal(row.totalJornales)}</td>
      <td>${formatDecimal(row.rendimiento)} ${escapeHtml(row.unidad)}/jornal</td>
    </tr>
  `).join('');

  return `
    <section style="font-family: Arial, sans-serif; color: #222; padding: 0; background: white;">
      <style>
        .perf-doc { border: 1.5px solid #2c4737; padding: 8px; width: 100%; }
        .perf-doc * { box-sizing: border-box; }
        .perf-doc h1, .perf-doc h2, .perf-doc h3, .perf-doc p { margin: 0; }
        .perf-doc .doc-header {
          display: grid;
          grid-template-columns: 155px 1fr 165px;
          align-items: center;
          gap: 12px;
          border-bottom: 2px solid #2c4737;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .perf-doc .logo-wrap {
          height: 56px;
          display: flex;
          align-items: center;
        }
        .perf-doc .logo-wrap img {
          max-width: 145px;
          max-height: 52px;
          object-fit: contain;
        }
        .perf-doc .doc-title { text-align: center; }
        .perf-doc .doc-title h1 {
          font-size: 19px;
          letter-spacing: 0.04em;
          font-weight: 800;
        }
        .perf-doc .doc-title h2 {
          font-size: 11px;
          margin-top: 3px;
          font-weight: 700;
        }
        .perf-doc .doc-code {
          border: 1px solid #2c4737;
          padding: 8px 10px;
          font-size: 10px;
          line-height: 1.45;
        }
        .perf-doc .summary-strip {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
        }
        .perf-doc .summary-cell {
          border: 1px solid #2c4737;
          min-height: 48px;
          padding: 7px 8px;
          flex: 0 0 auto;
        }
        .perf-doc .summary-label {
          display: block;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #516459;
          margin-bottom: 4px;
          letter-spacing: 0.04em;
        }
        .perf-doc .summary-value {
          font-size: 12px;
          font-weight: 700;
        }
        .perf-doc .table-title {
          margin: 12px 0 6px;
          font-size: 12px;
          font-weight: 700;
          color: #22372b;
        }
        .perf-doc table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .perf-doc th, .perf-doc td {
          border: 1px solid #98a99e;
          padding: 6px 6px;
          text-align: left;
          font-size: 11px;
          vertical-align: top;
          word-break: break-word;
        }
        .perf-doc th {
          background: #e7efe9;
          color: #22372b;
          font-size: 10px;
          letter-spacing: 0.03em;
        }
        .perf-doc .center { text-align: center; }
        .perf-doc .summary-row td {
          font-weight: 700;
          background: #f6faf7;
        }
        .perf-doc .footer {
          margin-top: 12px;
          font-size: 10px;
          color: #555;
          text-align: right;
        }
      </style>
      <div class="perf-doc">
        <div class="doc-header">
          <div class="logo-wrap">
            <img src="${escapeHtml(logoUrl)}" alt="Logo empresa">
          </div>
          <div class="doc-title">
            <h1>${escapeHtml(state.settings.company)}</h1>
            <h2>REPORTE DE RENDIMIENTO</h2>
          </div>
          <div class="doc-code">
            <div><strong>Formato:</strong> Rendimiento</div>
            <div><strong>Version:</strong> 1.0</div>
            <div><strong>Area:</strong> Campo</div>
          </div>
        </div>
        <div class="summary-strip">
          <div class="summary-cell" style="min-width: 220px;">
            <span class="summary-label">Fundo / ubicacion</span>
            <div class="summary-value">${escapeHtml(state.settings.location)}</div>
          </div>
          <div class="summary-cell" style="min-width: 120px;">
            <span class="summary-label">Total jornales</span>
            <div class="summary-value">${formatDecimal(totalJornales)}</div>
          </div>
          <div class="summary-cell" style="min-width: 120px;">
            <span class="summary-label">Total cantidad</span>
            <div class="summary-value">${formatDecimal(totalQuantity)}</div>
          </div>
          <div class="summary-cell" style="min-width: 150px;">
            <span class="summary-label">Rendimiento promedio</span>
            <div class="summary-value">${formatDecimal(average)}${averageUnit ? ` ${escapeHtml(averageUnit)}/jornal` : ''}</div>
          </div>
        </div>
        <p class="table-title">Detalle de registros</p>
        <table>
          <thead>
            <tr>
              <th style="width: 5%;">No.</th>
              <th style="width: 10%;">FECHA</th>
              <th style="width: 18%;">TRABAJADOR</th>
              <th style="width: 14%;">LABOR</th>
              <th style="width: 13%;">CAMPO</th>
              <th style="width: 9%;">CANTIDAD</th>
              <th style="width: 8%;">UNIDAD</th>
              <th style="width: 9%;">JORNALES</th>
              <th style="width: 14%;">RENDIMIENTO</th>
            </tr>
          </thead>
          <tbody>
            ${printableRows || '<tr><td colspan="9">Sin datos</td></tr>'}
          </tbody>
        </table>
        <p class="table-title">Consolidado por campo y labor</p>
        <table>
          <thead>
            <tr>
              <th style="width: 22%;">CAMPO</th>
              <th style="width: 24%;">LABOR</th>
              <th style="width: 14%;">TOTAL CANTIDAD</th>
              <th style="width: 12%;">UNIDAD</th>
              <th style="width: 14%;">TOTAL JORNALES</th>
              <th style="width: 14%;">RENDIMIENTO</th>
            </tr>
          </thead>
          <tbody>
            ${printableSummaryRows || '<tr><td colspan="6">Sin datos</td></tr>'}
            <tr class="summary-row">
              <td colspan="6">Total de registros: ${rows.length}</td>
            </tr>
          </tbody>
        </table>
        <p class="footer">Generado el ${generatedAt}</p>
      </div>
    </section>
  `;
}

function saveSettings(event) {
  event.preventDefault();
  if (!els.settingsOwner) return;
  state.settings.owner = els.settingsOwner.value.trim() || 'Supervisor';
  refreshAll();
  showToast('Ajustes guardados.');
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `respaldo-parte-diario-${todayISO()}.json`);
  showToast('Se exporto el respaldo.');
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = normalizeState(parsed);
      currentPartId = null;
      currentDraftRow = null;
      showSavedPartRows = false;
      if (els.settingsOwner) els.settingsOwner.value = state.settings.owner || '';
      refreshAll();
      if (state.parts.length) {
        const latest = [...state.parts].sort((a, b) => b.date.localeCompare(a.date))[0];
        openOrCreatePartForDate(latest.date, false);
      }
      showToast('Respaldo importado correctamente.');
    } catch (error) {
      console.error(error);
      showToast('El archivo no es un respaldo valido.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!window.confirm('Se eliminaran todos los datos locales de este dispositivo.')) return;
  state = structuredClone(initialState);
  currentPartId = null;
  currentDraftRow = null;
  showSavedPartRows = false;
  if (els.settingsOwner) els.settingsOwner.value = state.settings.owner || '';
  resetWorkerForm();
  resetLaborForm();
  resetFieldForm();
  refreshAll();
  openOrCreatePartForDate(els.partDate.value || todayISO(), false);
  showToast('Se borraron los datos locales.');
}

function getNameById(collection, id, labelKey) {
  return collection.find(item => item.id === id)?.[labelKey] || '';
}

function formatDecimal(value) {
  const number = Number(value) || 0;
  return number.toLocaleString('es-PE', {
    minimumFractionDigits: number % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function normalizeUnit(value) {
  const unit = String(value || '').trim().toLowerCase();
  if (!unit) return '';

  const aliases = {
    planta: 'plantas',
    plantas: 'plantas',
    kilo: 'kg',
    kilos: 'kg',
    kilogramo: 'kg',
    kilogramos: 'kg',
    kg: 'kg',
    jaba: 'jabas',
    jabas: 'jabas',
    metro: 'm',
    metros: 'm',
    'm2': 'm2',
    mt2: 'm2',
    hectarea: 'ha',
    hectareas: 'ha',
    ha: 'ha'
  };

  return aliases[unit] || unit;
}

function downloadCSV(rows, fileName) {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, fileName);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = rows.map(row => headers.map(header => csvCell(row[header])).join(','));
  return [headers.join(','), ...lines].join('\n');
}

function csvCell(value) {
  const safe = String(value ?? '').replace(/"/g, '""');
  return `"${safe}"`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 2600);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
