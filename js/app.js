// v2.3 — Eliminado Timeout y Limpieza de Sintaxis
// ============================================================
// FranquiDía — App principal (dashboard admin)
// ============================================================

// ── Estado global ──
let DATA = { empleados: [], turnos: [], incidencias: [] };
let currentWeekStart = getMonday(new Date());
let activeStore = null;

// ── Inicialización ──
document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  loadData();
});

function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('s-' + btn.dataset.section).classList.add('active');
    });
  });
  document.getElementById('prevWeek').addEventListener('click', () => {
    currentWeekStart = addDays(currentWeekStart, -7);
    renderCuadrante();
  });
  document.getElementById('nextWeek').addEventListener('click', () => {
    currentWeekStart = addDays(currentWeekStart, 7);
    renderCuadrante();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    currentWeekStart = getMonday(new Date());
    renderCuadrante();
  });
  document.getElementById('publishWeek').addEventListener('click', showPublishLinks);
  document.getElementById('searchEmp').addEventListener('input', renderEmpleados);
  document.getElementById('filterEmpStore').addEventListener('change', renderEmpleados);
  document.getElementById('filterStore').addEventListener('change', renderCuadrante);
  document.getElementById('filterTurno').addEventListener('change', renderCuadrante);
}

// ── Carga de datos ──
async function loadData() {
  const loadingEl = document.getElementById('loadingState');
  const errorEl = document.getElementById('errorState');
  const mainEl = document.getElementById('mainContent');
  
  loadingEl.style.display = 'flex';
  errorEl.style.display = 'none';
  mainEl.style.display = 'none';

  const cached = localStorage.getItem('franquidia_data');
  if (cached) {
    try {
      DATA = JSON.parse(cached);
      onDataLoaded();
      document.getElementById('syncStatus').textContent = 'Actualizando...';
    } catch(e) { console.error("Error en caché", e); }
  }

  try {
    const data = await fetchJSONP(CONFIG.SCRIPT_URL + '?action=getData');
    if (data.error) throw new Error(data.error);
    
    DATA = data;
    localStorage.setItem('franquidia_data', JSON.stringify(data));
    onDataLoaded();
  } catch (e) {
    console.error("Error fetch:", e);
    loadingEl.style.display = 'none';
    if (!cached) {
      errorEl.style.display = 'flex';
      document.getElementById('errorMsg').textContent = 'Error de conexión: ' + e.message;
    } else {
      mainEl.style.display = 'block';
      document.getElementById('syncStatus').textContent = 'Modo Offline · ' + formatTime(new Date());
    }
  }
}

function fetchJSONP(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'cb_' + Date.now();
    const script = document.createElement('script');

    function cleanup() {
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = function(data) {
      cleanup();
      resolve(data);
    };

    script.src = url + '&callback=' + cbName;
    script.onerror = () => { 
      cleanup(); 
      reject(new Error('Error de red al conectar con Google Sheets')); 
    };
    document.head.appendChild(script);
  });
}

function onDataLoaded() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('syncStatus').textContent = 'Actualizado ' + formatTime(new Date());

  populateStoreFilters();
  renderResumen();
  renderCuadrante();
  renderEmpleados();
  renderTiendas();
  renderIncidencias();

  const total = DATA.empleados.length;
  const tiendasCount = [...new Set(DATA.empleados.map(e => e.tienda))].filter(Boolean).length;
  document.getElementById('headerBadge').textContent = `${tiendasCount} tiendas · ${total} empleados`;
}

// ── RESUMEN ──
function renderResumen() {
  const hoy = toDateStr(new Date());
  const turnosHoy = DATA.turnos.filter(t => t.fecha === hoy);
  const extrasAbiertos = DATA.incidencias.filter(i => i.tipo === 'extra' && i.estado !== 'resuelta');
  const vacActivos = DATA.incidencias.filter(i => (i.tipo === 'vacaciones' || i.tipo === 'baja') && i.estado === 'activa');
  const incAbiertas = DATA.incidencias.filter(i => i.estado === 'abierta' || i.estado === 'pendiente');
  const horasSemana = calcHorasSemana();

  document.getElementById('resumenMetrics').innerHTML = `
    <div class="metric-card orange">
      <div class="label">Empleados activos</div>
      <div class="value">${DATA.empleados.filter(e => e.estado === 'activo').length}</div>
      <div class="sub">${[...new Set(DATA.empleados.map(e => e.tienda))].filter(Boolean).length} tiendas</div>
    </div>
    <div class="metric-card">
      <div class="label">Horas esta semana</div>
      <div class="value">${horasSemana}</div>
      <div class="sub">${extrasAbiertos.length} extras pendientes</div>
    </div>
    <div class="metric-card">
      <div class="label">Vacaciones/Baja</div>
      <div class="value">${vacActivos.length}</div>
      <div class="sub">Personal fuera hoy</div>
    </div>
    <div class="metric-card">
      <div class="label">Incidencias</div>
      <div class="value">${incAbiertas.length}</div>
      <div class="sub">${incAbiertas.filter(i => i.urgencia === 'urgente').length} urgentes</div>
    </div>
  `;

  const tiendasList = [...new Set(DATA.empleados.map(e => e.tienda))].filter(Boolean);
  document.getElementById('storesGrid').innerHTML = tiendasList.map(tienda => {
    const emps = DATA.empleados.filter(e => e.tienda === tienda);
    const turnosT = turnosHoy.filter(t => emps.some(e => e.nombre === t.nombre));
    const mañana = turnosT.filter(t => t.turno === 'M').length;
    const tarde = turnosT.filter(t => t.turno === 'T').length;
    const bajas = DATA.incidencias.filter(i => i.tienda === tienda && i.tipo === 'baja' && i.estado === 'activa').length;
    const color = CONFIG.STORE_COLORS[tienda] || '#888';
    
    return `
      <div class="store-card">
        <div class="store-header">
          <div class="store-dot" style="background:${color}"></div>
          <div style="flex:1">
            <div class="store-name">${tienda}</div>
          </div>
          ${bajas > 0 ? `<span class="badge badge-warn">${bajas} Baja</span>` : `<span class="badge badge-ok">OK</span>`}
        </div>
        <div class="store-shifts">
          <div class="shift-pill shift-m">☀ M: ${mañana}</div>
          <div class="shift-pill shift-t">🌙 T: ${tarde}</div>
        </div>
      </div>`;
  }).join('');
}

// ── CUADRANTE ──
function renderCuadrante() {
  const days = weekDays(currentWeekStart);
  const hoy = toDateStr(new Date());
  const storeFilter = document.
