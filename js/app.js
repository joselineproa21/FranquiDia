// v2.5 — Corrección de nombres y optimización de rutas
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
  
  const filterTurno = document.getElementById('filterTurno');
  if(filterTurno) filterTurno.addEventListener('change', renderCuadrante);
}

// ── Carga de datos (JSONP) ──
function fetchJSONP(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'cb_' + Date.now() + Math.floor(Math.random() * 1000);
    const script = document.createElement('script');

    window[cbName] = function(data) {
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(data);
    };

    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cbName;
    script.onerror = () => { 
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
      reject(new Error('Error de red al cargar datos')); 
    };
    document.head.appendChild(script);
  });
}

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
    } catch(e) { console.error("Error en caché", e); }
  }

  try {
    const data = await fetchJSONP(CONFIG.SCRIPT_URL + '?action=getData');
    DATA = data;
    localStorage.setItem('franquidia_data', JSON.stringify(data));
    onDataLoaded();
  } catch (e) {
    console.error("Error fetch:", e);
    if (!cached) {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'flex';
      document.getElementById('errorMsg').textContent = 'Error de conexión: ' + e.message;
    }
  }
}

function onDataLoaded() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('syncStatus').textContent = 'Actualizado ' + formatTime(new Date());

  populateStoreFilters();
  renderResumen();
  renderCuadrante();
  renderEmpleados();
  renderTiendas(); // Esta es la función que daba el error en consola
  renderIncidencias();

  const total = DATA.empleados.length;
  const tiendasCount = [...new Set(DATA.empleados.map(e => e.tienda))].filter(Boolean).length;
  const badge = document.getElementById('headerBadge');
  if(badge) badge.textContent = `${tiendasCount} tiendas · ${total} empleados`;
}

// ── RESUMEN ──
function renderResumen() {
  const hoy = toDateStr(new Date());
  const turnosHoy = DATA.turnos.filter(t => t.fecha === hoy);
  const incAbiertas = (DATA.incidencias || []).filter(i => i.estado !== 'resuelta');
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
      <div class="sub">Carga total</div>
    </div>
    <div class="metric-card">
      <div class="label">Incidencias</div>
      <div class="value">${incAbiertas.length}</div>
      <div class="sub">Pendientes de revisar</div>
    </div>
  `;

  const tiendasList = [...new Set(DATA.empleados.map(e => e.tienda))].filter(Boolean);
  document.getElementById('storesGrid').innerHTML = tiendasList.map(tienda => {
    const color = CONFIG.STORE_COLORS[tienda] || '#888';
    const empsTienda = DATA.empleados.filter(e => e.tienda === tienda);
    const turnosT = turnosHoy.filter(t => t.tienda === tienda);
    const mañana = turnosT.filter(t => t.turno === 'M').length;
    const tarde = turnosT.filter(t => t.turno === 'T').length;
    
    return `
      <div class="store-card">
        <div class="store-header">
          <div class="store-dot" style="background:${color}"></div>
          <div class="store-name">${tienda}</div>
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
  const storeFilter = document.getElementById('filterStore').value;
  const nombresDias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  document.getElementById('weekLabel').textContent = formatWeekRange(days[0], days[6]);

  const tiendasConTurnos = [...new Set(DATA.turnos
    .filter(t => days.includes(t.fecha))
    .map(t => t.tienda))]
    .filter(Boolean).sort();

  const gridCols = `180px repeat(7, 1fr)`;
  let htmlFinal = ""; 

  tiendasConTurnos.forEach(tienda => {
    if (storeFilter && tienda !== storeFilter) return;
    const color = CONFIG.STORE_COLORS[tienda] || '#888';
    
    const nombresUnicos = [...new Set(DATA.turnos
      .filter(t => t.tienda === tienda && days.includes(t.fecha))
      .map(t => t.nombre))];

    if (nombresUnicos.length === 0) return;

    htmlFinal += `
      <div style="grid-column:1/-1; background:${color}11; border-left:4px solid ${color}; padding:10px; font-weight:bold; margin-top:15px; display:grid; grid-template-columns:${gridCols}">
        <div style="color:${color}">📍 ${tienda}</div>
        ${nombresDias.map(dia => `<div style="text-align:center; font-size:11px; color:#666">${dia}</div>`).join('')}
      </div>`;

    nombresUnicos.forEach(nombre => {
      const pNombre = nombre.split(' ')[0];
      const rowTurnos = days.map(d => {
        const t = DATA.turnos.find(turno => turno.nombre === nombre && turno.tienda === tienda && turno.fecha === d);
        const val = t ? t.turno : 'L';
        return `
          <div class="cuad-cell ${d === hoy ? 'today-col' : ''}">
            <span class="pill pill-${val.toLowerCase()}">${['L', 'VAC', 'F', 'B'].includes(val) ? '-' : pNombre}</span>
          </div>`;
      }).join('');

      htmlFinal += `
        <div class="cuad-row" style="grid-template-columns:${gridCols}">
          <div class="cuad-emp" style="padding-left:15px">${nombre}</div>
          ${rowTurnos}
        </div>`;
    });
  });

  document.getElementById('cuadranteTable').innerHTML = htmlFinal || '<div style="padding:20px;">No hay turnos.</div>';
}

// ── EMPLEADOS ──
function renderEmpleados() {
  const search = document.getElementById('searchEmp').value.toLowerCase();
  const store = document.getElementById('filterEmpStore').value;

  let emps = DATA.empleados;
  if (search) emps = emps.filter(e => e.nombre.toLowerCase().includes(search));
  if (store) emps = emps.filter(e => e.tienda === store);

  const rows = emps.map(emp => {
    const storeColor = CONFIG.STORE_COLORS[emp.tienda] || '#888';
    return `
      <tr>
        <td>${emp.nombre}</td>
        <td><span class="store-tag" style="border-color:${storeColor};color:${storeColor}">${emp.tienda}</span></td>
        <td>${emp.horasContrato || 40}h</td>
        <td><span class="badge ${emp.estado === 'activo' ? 'badge-ok' : 'badge-warn'}">${emp.estado}</span></td>
        <td><button class="btn-sm" onclick="copyLink('${slugify(emp.nombre)}')">Copiar Link</button></td>
      </tr>`;
  }).join('');

  document.getElementById('empTable').innerHTML = `<table>
    <thead><tr><th>Empleado</th><th>Tienda</th><th>Contrato</th><th>Estado</th><th>Link</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5">Sin resultados</td></tr>'}</tbody>
  </table>`;
}

// ── TIENDAS (Daba el error de consola) ──
function renderTiendas() {
  const tiendas = [...new Set(DATA.empleados.map(e => e.tienda))].filter(Boolean).sort();
  if (!activeStore && tiendas.length > 0) activeStore = tiendas[0];
  
  const tabs = document.getElementById('storeTabs');
  if(tabs) {
    tabs.innerHTML = tiendas.map(t => `
      <button class="store-tab ${t === activeStore ? 'active' : ''}" onclick="selectStoreDet('${t}')">${t}</button>
    `).join('');
  }
  renderStoreDetail(activeStore);
}

function selectStoreDet(t) { 
  activeStore = t; 
  renderTiendas(); 
}

function renderStoreDetail(tienda) {
  if(!tienda) return;
  const emps = DATA.empleados.filter(e => e.tienda === tienda);
  const html = emps.map(e => `
    <div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
      <span>${e.nombre}</span>
      <span style="color:#666; font-size:12px;">${e.horasContrato}h</span>
    </div>`).join('');
  const detail = document.getElementById('storeDetail');
  if(detail) detail.innerHTML = `<div class="panel"><div class="panel-title">Equipo ${tienda}</div>${html}</div>`;
}

function renderIncidencias() {
  const incs = DATA.incidencias || [];
  const container = document.getElementById('incidenciasList');
  if(!container) return;
  
  container.innerHTML = incs.map(i => `
    <div class="incidencia-item">
      <div><strong>${i.tipo.toUpperCase()}</strong>: ${i.nombre}</div>
      <span class="badge badge-info">${i.estado}</span>
    </div>`).join('') || 'Sin incidencias';
}

// ── HELPERS ──
function populateStoreFilters() {
  const tiendas = [...new Set(DATA.empleados.map(e => e.tienda))].filter(Boolean).sort();
  ['filterStore', 'filterEmpStore'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) {
      sel.innerHTML = '<option value="">Todas las tiendas</option>' + 
        tiendas.map(t => `<option value="${t}">${t}</option>`).join('');
    }
  });
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0,0,0,0);
  return date;
}

function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function weekDays(monday) { return Array.from({length: 7}, (_, i) => toDateStr(addDays(monday, i))); }
function toDateStr(d) { return d.toISOString().slice(0, 10); }
function formatTime(d) { return d.toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'}); }
function formatWeekRange(d1, d2) { return `Semana del ${d1.split('-')[2]} al ${d2.split('-')[2]}`; }
function slugify(s) { return s ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-') : ''; }

function showPublishLinks() {
  const days = weekDays(currentWeekStart);
  const range = formatWeekRange(days[0], days[6]);
  const tiendas = [...new Set(DATA.turnos.filter(t => days.includes(t.fecha)).map(t => t.tienda))].filter(Boolean).sort();
  const baseAddr = window.location.origin + window.location.pathname.replace('index.html', '');

  let html = `
    <div id="publishModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;">
      <div style="background:white; width:100%; max-width:400px; border-radius:15px; padding:20px; position:relative;">
        <button onclick="document.getElementById('publishModal').remove()" style="position:absolute; top:10px; right:10px;">✕</button>
        <h3>Publicar Semana</h3>
        <div style="max-height:60vh; overflow-y:auto;">`;

  tiendas.forEach(tienda => {
    const link = `${baseAddr}tienda.html?tienda=${encodeURIComponent(tienda)}&start=${days[0]}`;
    html += `
      <div style="margin-bottom:15px; padding:10px; border:1px solid #eee; border-radius:8px;">
        <strong>${tienda}</strong>
        <button onclick="copyToClipboard('${tienda}', '${link}', '${range}')" style="display:block; width:100%; margin-top:5px;">Copiar WhatsApp</button>
      </div>`;
  });

  html += `</div></div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function copyToClipboard(tienda, link, range) {
  const txt = `📍 CUADRANTE ${tienda}\n🗓️ ${range}\n🔗 Ver aquí: ${link}`;
  navigator.clipboard.writeText(txt).then(() => alert("Copiado para " + tienda));
}

function calcHorasSemana() {
  const days = weekDays(currentWeekStart);
  return DATA.turnos
    .filter(t => days.includes(t.fecha))
    .reduce((acc, t) => acc + (CONFIG.HORAS_TURNO[t.turno] || 0), 0).toFixed(1);
}
