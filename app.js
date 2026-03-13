const STORAGE_KEY = 'parte-diario-santa-teresa-v1';
const SERVER_SYNC_DEBOUNCE_MS = 700;
const HEADER_COMPANY = 'AGRICOLA JAPURIMA S.A.';
const HEADER_LOCATION = 'Fundo Santa Teresa Bajo - Huaura';

const initialState = {
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
  parts: []
};

let state = structuredClone(initialState);
let currentView = 'dashboard';
let currentPartId = null;
let lastReportResults = [];
let toastTimer = null;
let serverSyncSupported = false;
let serverSyncInFlight = false;
let serverSyncPending = false;
let serverSyncTimer = null;
let networkListenersBound = false;
let appInitialized = false;

const els = {
  menuToggleBtn: document.getElementById('menuToggleBtn'),
  connectionStatus: document.getElementById('connectionStatus'),
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
  exportReportBtn: document.getElementById('exportReportBtn'),
  reportsTableBody: document.getElementById('reportsTableBody'),
  reportCountBadge: document.getElementById('reportCountBadge'),

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
  await checkAuthAndStart();
  registerServiceWorker();
}

function bindAuthEvents() {
  els.loginForm.addEventListener('submit', onLoginSubmit);
  els.logoutBtn.addEventListener('click', onLogoutClick);
}

function bindEvents() {
  els.menuToggleBtn.addEventListener('click', toggleMobileMenu);
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
  els.exportReportBtn.addEventListener('click', exportReportCSV);

  els.settingsForm.addEventListener('submit', saveSettings);
  els.exportBackupBtn.addEventListener('click', exportBackup);
  els.importBackupInput.addEventListener('change', importBackup);
  els.resetDataBtn.addEventListener('click', resetAllData);
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
  els.settingsOwner.value = state.settings.owner || '';
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
  currentView = viewName;
  els.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  els.views.forEach(view => view.classList.toggle('active', view.id === `view-${viewName}`));
  if (viewName === 'reportes') runReports();
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
  saveState();
  renderDashboard();
  renderWorkers();
  renderLabors();
  renderFields();
  renderReportsFilters();
  renderCurrentPart();
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
  merged.workers = Array.isArray(input?.workers) ? input.workers : [];
  merged.labors = Array.isArray(input?.labors) && input.labors.length ? input.labors : merged.labors;
  merged.fields = Array.isArray(input?.fields) && input.fields.length ? input.fields : merged.fields;
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
  return merged;
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
    const response = await fetch('./api/state', { cache: 'no-store' });
    if (response.status === 401) {
      lockApp('Sesion expirada. Vuelve a iniciar sesion.');
      throw new Error('UNAUTHORIZED');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const remoteState = normalizeState(payload?.state || payload);
    serverSyncSupported = true;
    if (stateDataScore(localSnapshot) > stateDataScore(remoteState)) {
      state = localSnapshot;
      queueServerSync();
    } else {
      state = remoteState;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (_error) {
    serverSyncSupported = false;
  } finally {
    updateConnectionStatus();
  }
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (response.status === 401) {
      lockApp('Sesion expirada. Vuelve a iniciar sesion.');
      throw new Error('UNAUTHORIZED');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    serverSyncPending = false;
  } catch (_error) {
    serverSyncPending = true;
  } finally {
    serverSyncInFlight = false;
    updateConnectionStatus();
  }
}

async function ensureServerSyncAvailable() {
  if (serverSyncSupported || !navigator.onLine) return;
  try {
    const health = await fetch('./api/health', { cache: 'no-store' });
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
    return;
  }
  if (!serverSyncSupported) {
    els.connectionStatus.textContent = 'Modo local';
    return;
  }
  if (serverSyncInFlight) {
    els.connectionStatus.textContent = 'Sincronizando...';
    return;
  }
  if (serverSyncPending) {
    els.connectionStatus.textContent = 'Pendiente de sincronizar';
    return;
  }
  els.connectionStatus.textContent = 'Sincronizado con servidor';
}

function stateDataScore(snapshot) {
  const safe = normalizeState(snapshot);
  const rowsCount = safe.parts.reduce((acc, part) => acc + part.rows.length, 0);
  return (safe.workers.length * 5) + (safe.parts.length * 10) + rowsCount;
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

  const recentParts = [...state.parts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
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

  els.partDate.value = part.date;
  els.partStatus.value = part.status;
  els.partRowsCount.value = String(part.rows.length);
  els.currentPartDateLabel.textContent = formatDate(part.date);
  togglePartControls(part.status === 'CERRADO');

  if (!part.rows.length) {
    els.partRows.innerHTML = `
      <div class="empty-state">
        No hay filas registradas todavia. Usa <strong>Agregar fila</strong> para cargar personal.
      </div>
    `;
    return;
  }

  els.partRows.innerHTML = part.rows.map((row, index) => `
    <article class="part-row-card" data-row-id="${row.id}">
      <div class="part-row-top">
        <div>
          <h4>Registro ${index + 1}</h4>
          <p class="muted">Asigna trabajador, labores, campos y observaciones.</p>
        </div>
        <div class="mini-actions">
          <span class="status-pill ${part.status === 'CERRADO' ? 'closed' : 'draft'}">${part.status}</span>
          <button class="secondary-btn mini-btn" data-action="remove-row">Eliminar</button>
        </div>
      </div>
      <div class="row-fields-grid">
        <label>
          <span>Trabajador</span>
          <select data-field="workerId" ${part.status === 'CERRADO' ? 'disabled' : ''}>
            ${buildSelectOptions(state.workers, row.workerId, 'Seleccionar trabajador', 'name')}
          </select>
        </label>
        <label>
          <span>Labor manana</span>
          <select data-field="morningLaborId" ${part.status === 'CERRADO' ? 'disabled' : ''}>
            ${buildSelectOptions(state.labors, row.morningLaborId, 'Seleccionar labor', 'name')}
          </select>
        </label>
        <label>
          <span>Campo manana</span>
          <select data-field="morningFieldId" ${part.status === 'CERRADO' ? 'disabled' : ''}>
            ${buildSelectOptions(state.fields, row.morningFieldId, 'Seleccionar campo', 'name')}
          </select>
        </label>
        <label>
          <span>Labor tarde</span>
          <select data-field="afternoonLaborId" ${part.status === 'CERRADO' ? 'disabled' : ''}>
            ${buildSelectOptions(state.labors, row.afternoonLaborId, 'Seleccionar labor', 'name')}
          </select>
        </label>
        <label>
          <span>Campo tarde</span>
          <select data-field="afternoonFieldId" ${part.status === 'CERRADO' ? 'disabled' : ''}>
            ${buildSelectOptions(state.fields, row.afternoonFieldId, 'Seleccionar campo', 'name')}
          </select>
        </label>
        <label class="full">
          <span>Observaciones</span>
          <textarea data-field="notes" ${part.status === 'CERRADO' ? 'disabled' : ''} placeholder="Opcional">${escapeHtml(row.notes)}</textarea>
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
  part.rows.push({
    id: uid(),
    workerId: '',
    morningLaborId: '',
    morningFieldId: '',
    afternoonLaborId: '',
    afternoonFieldId: '',
    notes: ''
  });
  part.updatedAt = new Date().toISOString();
  refreshAll();
  showToast('Se agrego una fila al parte.');
}

function onPartRowsChange(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  const rowCard = event.target.closest('[data-row-id]');
  const rowId = rowCard?.dataset.rowId;
  const part = getCurrentPart();
  if (!part || !rowId || part.status === 'CERRADO') return;
  const row = part.rows.find(item => item.id === rowId);
  if (!row) return;

  const nextValue = event.target.value;
  if (field === 'workerId' && nextValue) {
    const duplicated = part.rows.some(item => item.id !== rowId && item.workerId === nextValue);
    if (duplicated) {
      event.target.value = row.workerId || '';
      showToast('Ese trabajador ya fue registrado en este parte.');
      return;
    }
  }

  row[field] = nextValue;
  part.updatedAt = new Date().toISOString();
  saveState();
  if (field === 'workerId') renderCurrentPart();
}

function onPartRowsClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const rowCard = button.closest('[data-row-id]');
  const rowId = rowCard?.dataset.rowId;
  const part = getCurrentPart();
  if (!part || !rowId || part.status === 'CERRADO') return;

  if (action === 'remove-row') {
    part.rows = part.rows.filter(item => item.id !== rowId);
    part.updatedAt = new Date().toISOString();
    refreshAll();
    showToast('Se elimino la fila.');
  }
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
  part.updatedAt = new Date().toISOString();
  refreshAll();
  showToast('Parte cerrado. Solo queda disponible para consulta, impresion y exportacion.');
}

function reopenCurrentPart() {
  const part = getCurrentPart();
  if (!part) return showToast('No hay un parte abierto.');
  part.status = 'BORRADOR';
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
  part.updatedAt = new Date().toISOString();
  refreshAll();
  showToast(`Se copio el contenido del ${formatDate(previous.date)}.`);
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

  printable.style.width = '285mm';
  printable.style.maxWidth = '285mm';
  printable.style.margin = '0 auto';
  document.body.appendChild(printable);

  const options = {
    margin: [3, 5, 3, 5],
    filename: `parte-${part.date}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
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
    <section style="font-family: Arial, sans-serif; color: #222; padding: 0; background: white; width: 285mm;">
      <style>
        .part-doc { border: 1.5px solid #2c4737; padding: 8px; width: 100%; }
        .part-doc * { box-sizing: border-box; }
        .part-doc h1, .part-doc h2, .part-doc h3, .part-doc p { margin: 0; }
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
          font-size: 10px;
          vertical-align: top;
          word-break: break-word;
        }
        .part-doc th {
          background: #e7efe9;
          color: #22372b;
          font-size: 9px;
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
    els.workersTableBody.innerHTML = '<tr><td colspan="5">No hay trabajadores registrados.</td></tr>';
    return;
  }
  els.workersTableBody.innerHTML = items.map(item => `
    <tr>
      <td>${escapeHtml(item.code || '-')}</td>
      <td>${escapeHtml(item.dni || '-')}</td>
      <td>${escapeHtml(item.name)}</td>
      <td><span class="status-pill ${item.active ? 'active' : 'inactive'}">${item.active ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <div class="mini-actions">
          <button class="secondary-btn mini-btn" data-action="edit" data-id="${item.id}">Editar</button>
          <button class="secondary-btn mini-btn" data-action="toggle" data-id="${item.id}">${item.active ? 'Inactivar' : 'Activar'}</button>
          <button class="secondary-btn mini-btn danger-outline" data-action="delete" data-id="${item.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function saveWorker(event) {
  event.preventDefault();
  const payload = {
    id: els.workerId.value || uid(),
    code: els.workerCode.value.trim(),
    dni: els.workerDni.value.trim(),
    name: els.workerName.value.trim(),
    active: els.workerActive.checked
  };
  if (!payload.name) return showToast('Ingresa el nombre del trabajador.');

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
    refreshAll();
    showToast(`Trabajador ${item.active ? 'activado' : 'inactivado'}.`);
  }

  if (action === 'delete') {
    if (isEntityUsed('workers', item.id)) return showToast('Ese trabajador ya se uso en un parte. Inactivalo en lugar de eliminarlo.');
    if (!window.confirm(`Eliminar a ${item.name}?`)) return;
    state.workers = state.workers.filter(entry => entry.id !== item.id);
    refreshAll();
    showToast('Trabajador eliminado.');
  }
}

function renderLabors() {
  const items = [...state.labors].sort((a, b) => a.name.localeCompare(b.name));
  els.laborCountBadge.textContent = `${items.length}`;
  if (!items.length) {
    els.laborsTableBody.innerHTML = '<tr><td colspan="3">No hay labores registradas.</td></tr>';
    return;
  }
  els.laborsTableBody.innerHTML = items.map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td><span class="status-pill ${item.active ? 'active' : 'inactive'}">${item.active ? 'Activa' : 'Inactiva'}</span></td>
      <td>
        <div class="mini-actions">
          <button class="secondary-btn mini-btn" data-action="edit" data-id="${item.id}">Editar</button>
          <button class="secondary-btn mini-btn" data-action="toggle" data-id="${item.id}">${item.active ? 'Inactivar' : 'Activar'}</button>
          <button class="secondary-btn mini-btn danger-outline" data-action="delete" data-id="${item.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function saveLabor(event) {
  event.preventDefault();
  const payload = {
    id: els.laborId.value || uid(),
    name: els.laborName.value.trim(),
    active: els.laborActive.checked
  };
  if (!payload.name) return showToast('Ingresa el nombre de la labor.');
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
    refreshAll();
    showToast(`Labor ${item.active ? 'activada' : 'inactivada'}.`);
  }

  if (action === 'delete') {
    if (isEntityUsed('labors', item.id)) return showToast('Esa labor ya se uso en un parte. Inactivala en lugar de eliminarla.');
    if (!window.confirm(`Eliminar la labor ${item.name}?`)) return;
    state.labors = state.labors.filter(entry => entry.id !== item.id);
    refreshAll();
    showToast('Labor eliminada.');
  }
}

function renderFields() {
  const items = [...state.fields].sort((a, b) => a.name.localeCompare(b.name));
  els.fieldCountBadge.textContent = `${items.length}`;
  if (!items.length) {
    els.fieldsTableBody.innerHTML = '<tr><td colspan="3">No hay campos registrados.</td></tr>';
    return;
  }
  els.fieldsTableBody.innerHTML = items.map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td><span class="status-pill ${item.active ? 'active' : 'inactive'}">${item.active ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <div class="mini-actions">
          <button class="secondary-btn mini-btn" data-action="edit" data-id="${item.id}">Editar</button>
          <button class="secondary-btn mini-btn" data-action="toggle" data-id="${item.id}">${item.active ? 'Inactivar' : 'Activar'}</button>
          <button class="secondary-btn mini-btn danger-outline" data-action="delete" data-id="${item.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function saveField(event) {
  event.preventDefault();
  const payload = {
    id: els.fieldId.value || uid(),
    name: els.fieldName.value.trim(),
    active: els.fieldActive.checked
  };
  if (!payload.name) return showToast('Ingresa el nombre del campo.');
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
    refreshAll();
    showToast(`Campo ${item.active ? 'activado' : 'inactivado'}.`);
  }

  if (action === 'delete') {
    if (isEntityUsed('fields', item.id)) return showToast('Ese campo ya se uso en un parte. Inactivalo en lugar de eliminarlo.');
    if (!window.confirm(`Eliminar el campo ${item.name}?`)) return;
    state.fields = state.fields.filter(entry => entry.id !== item.id);
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
  els.reportWorker.innerHTML = `<option value="">Todos</option>${state.workers
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;

  els.reportLabor.innerHTML = `<option value="">Todas</option>${state.labors
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;

  els.reportField.innerHTML = `<option value="">Todos</option>${state.fields
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
    .sort((a, b) => b.date.localeCompare(a.date))
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

function exportReportCSV() {
  if (!lastReportResults.length) {
    runReports();
  }
  if (!lastReportResults.length) return showToast('No hay resultados para exportar.');
  downloadCSV(lastReportResults, `reporte-partes-${todayISO()}.csv`);
  showToast('Reporte exportado en CSV.');
}

function saveSettings(event) {
  event.preventDefault();
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
      els.settingsOwner.value = state.settings.owner || '';
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
  els.settingsOwner.value = state.settings.owner || '';
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
