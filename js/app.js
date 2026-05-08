// v2.4 — Eliminado Timeout y optimización de fetchJSONP
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
      reject(new Error('Error de red al cargar datos')); 
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

// ── CUADRANTE ACTUALIZADO ──
function renderCuadrante() {
  const days = weekDays(currentWeekStart);
  const hoy = toDateStr(new Date());
  const storeFilter = document.getElementById('filterStore').value;
  const nombresDias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  document.getElementById('weekLabel').textContent = formatWeekRange(days[0], days[6]);

  // Obtenemos todas las tiendas únicas que aparecen en los TURNOS de esta semana
  // para asegurar que si alguien cambia de tienda, aparezca en la nueva.
  const tiendasConTurnos = [...new Set(DATA.turnos
    .filter(t => days.includes(t.fecha))
    .map(t => t.tienda))]
    .filter(Boolean).sort();

  const gridCols = `180px repeat(7, 1fr)`;
  let htmlFinal = '';

  tiendasConTurnos.forEach(tienda => {
    if (storeFilter && tienda !== storeFilter) return;
    const color = CONFIG.STORE_COLORS[tienda] || '#888';
    
    // BUSQUEDA DINÁMICA: Obtenemos los nombres de personas que tienen turnos en ESTA tienda ESTA semana
    const nombresEnTienda = [...new Set(DATA.turnos
      .filter(t => t.tienda === tienda && days.includes(t.fecha) && !['L', 'VAC', 'F', 'B'].includes(t.turno))
      .map(t => t.nombre))];

    if (nombresEnTienda.length === 0) return;

    // Encabezado de tienda
    htmlFinal += `
      <div style="grid-column:1/-1; background:${color}22; border-left:4px solid ${color}; padding:10px; font-weight:bold; margin-top:15px; display:grid; grid-template-columns:${gridCols}">
        <div style="color:${color}">📍 ${tienda}</div>
        ${nombresDias.map(dia => `<div style="text-align:center; font-size:11px; text-transform:uppercase; color:#666">${dia}</div>`).join('')}
      </div>`;

    nombresEnTienda.forEach(nombrePersona => {
      const primerNombre = nombrePersona.split(' ')[0];
      
      // Buscamos el tipo de turno para la etiqueta de la izquierda
      const turnoEjemplo = DATA.turnos.find(t => 
        t.nombre === nombrePersona && 
        t.tienda === tienda && 
        days.includes(t.fecha) && 
        !['L', 'VAC'].includes(t.turno)
      )?.turno || 'M';
      
      const etiquetasTurno = { 'M': 'Mañana', 'T': 'Tarde', 'MT': 'Partido', 'M2': 'Partido' };
      const tipoTurnoTexto = etiquetasTurno[turnoEjemplo] || 'Mañana';

      const rowTurnos = days.map(d => {
        // IMPORTANTE: Buscamos el turno específico de esa persona en esa TIENDA y ese DÍA
        const t = DATA.turnos.find(turno => 
          turno.nombre === nombrePersona && 
          turno.tienda === tienda && 
          turno.fecha === d
        );

        const val = t ? t.turno : 'L';
        const isHoy = d === hoy;
        const esInactivo = ['L', 'VAC', 'F', 'B'].includes(val);
        const textoCelda = esInactivo ? '-' : primerNombre;

        return `
          <div class="cuad-cell ${isHoy ? 'today-col' : ''}" style="${esInactivo ? 'opacity:0.4' : ''}">
            <span class="pill pill-${val.toLowerCase()}" style="font-size: 10px; padding: 2px 6px;">
              ${textoCelda}
            </span>
          </div>`;
      }).join('');

      htmlFinal += `
        <div class="cuad-row" style="grid-template-columns:${gridCols}">
          <div class="cuad-emp" style="font-weight:500; font-size:11px; color:#444; padding-left:15px; line-height:1.2">
            ${tipoTurnoTexto}<br><small style="color:#999; font-size:9px">${primerNombre}</small>
          </div>
          ${rowTurnos}
        </div>`;
    });
  });

  const container = document.getElementById('cuadranteTable');
  if (container) container.innerHTML = htmlFinal || '<div style="padding:20px; text-align:center">No hay turnos asignados para esta semana.</div>';
}
// ── EMPLEADOS ──
function renderEmpleados() {
  const search = document.getElementById('searchEmp').value.toLowerCase();
  const store = document.getElementById('filterEmpStore').value;

  let emps = DATA.empleados;
  if (search) emps = emps.filter(e => e.nombre.toLowerCase().includes(search));
  if (store) emps = emps.filter(e => e.tienda === store);

  const rows = emps.map(emp => {
    const horas = calcHorasMes(emp.id);
    const contrato = parseInt(emp.horasContrato) || 160;
    const pct = Math.min(100, Math.round((horas / contrato) * 100));
    const storeColor = CONFIG.STORE_COLORS[emp.tienda] || '#888';
    
    return `
      <tr>
        <td>
          <div class="emp-name-cell">
            <div class="avatar-sm" style="${avatarStyle(emp.nombre)}">${initials(emp.nombre)}</div>
            ${emp.nombre}
          </div>
        </td>
        <td><span class="store-tag" style="border-color:${storeColor};color:${storeColor}">${emp.tienda}</span></td>
        <td>${emp.horasContrato || 40}h/sem</td>
        <td>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </td>
        <td><span class="badge ${emp.estado === 'activo' ? 'badge-ok' : 'badge-warn'}">${emp.estado}</span></td>
        <td><button class="btn-sm" onclick="copyLink('${slugify(emp.nombre)}')">Link</button></td>
      </tr>`;
  }).join('');

  document.getElementById('empTable').innerHTML = `<table>
    <thead><tr><th>Empleado</th><th>Tienda</th><th>Contrato</th><th>Carga Mes</th><th>Estado</th><th>Acción</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">No hay resultados</td></tr>'}</tbody>
  </table>`;
}

// ── OTRAS FUNCIONES ──
function renderTiendas() {
  const tiendas = [...new Set(DATA.empleados.map(e => e.tienda))].filter(Boolean);
  if (!activeStore) activeStore = tiendas[0];
  document.getElementById('storeTabs').innerHTML = tiendas.map(t => `
    <button class="store-tab ${t === activeStore ? 'active' : ''}" onclick="selectStoreDet('${t}')">${t}</button>
  `).join('');
  renderStoreDetail(activeStore);
}

function selectStoreDet(t) { activeStore = t; renderTiendas(); }

function renderStoreDetail(tienda) {
  const emps = DATA.empleados.filter(e => e.tienda === tienda);
  const html = emps.map(e => `<div class="monthly-row">
    <div class="avatar-xs" style="${avatarStyle(e.nombre)}">${initials(e.nombre)}</div>
    <span>${e.nombre}</span>
  </div>`).join('');
  document.getElementById('storeDetail').innerHTML = `<div class="panel"><div class="panel-title">Equipo ${tienda}</div>${html}</div>`;
}

function renderIncidencias() {
  const incs = DATA.incidencias || [];
  const html = incs.map(i => `
    <div class="incidencia-item">
      <div class="inc-body">
        <strong>${i.tipo.toUpperCase()}: ${i.titulo || 'Nota'}</strong>
        <div class="inc-detail">${i.detalle || ''}</div>
      </div>
      <span class="badge ${i.urgencia === 'urgente' ? 'badge-danger' : 'badge-info'}">${i.estado}</span>
    </div>`).join('');
  document.getElementById('incidenciasList').innerHTML = html || 'Sin incidencias';
}

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

// ── HELPERS ──
function calcHorasMes(empId) {
  const emp = DATA.empleados.find(e => e.id === empId);
  if (!emp) return 0;
  const mesActual = new Date().getMonth();
  return DATA.turnos
    .filter(t => t.nombre === emp.nombre && new Date(t.fecha).getMonth() === mesActual)
    .reduce((acc, t) => acc + (CONFIG.HORAS_TURNO[t.turno] || 0), 0);
}

function calcHorasSemana() {
  const days = weekDays(currentWeekStart);
  return DATA.turnos
    .filter(t => days.includes(t.fecha))
    .reduce((acc, t) => acc + (CONFIG.HORAS_TURNO[t.turno] || 0), 0);
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
function formatWeekRange(d1, d2) { return `Del ${d1.split('-')[2]} al ${d2.split('-')[2]} de ${new Date(d2).toLocaleString('es-ES', {month: 'long'})}`; }
function initials(n) { return n ? n.split(' ').map(p => p[0]).join('').toUpperCase() : '??'; }
function avatarStyle(n) { 
  const colors = [['#FFF3E8','#C0620E'], ['#E6F1FB','#185FA5'], ['#EAF3DE','#3B6D11']];
  const c = colors[n ? n.length % colors.length : 0];
  return `background:${c[0]};color:${c[1]}`;
}
function slugify(s) { return s ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-') : ''; }

function showPublishLinks() { alert("Links generados en consola."); }
function copyLink(s) { navigator.clipboard.writeText(`${CONFIG.BASE_URL}/empleado.html?emp=${s}`); alert("Copiado"); }
