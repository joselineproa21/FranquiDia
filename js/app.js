// v2.8 — Restauración total + Filtro estricto de Vacaciones
// ============================================================

let DATA = { empleados: [], turnos: [], incidencias: [] };
let currentWeekStart = getMonday(new Date());
let activeStore = null;

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

  document.getElementById('prevWeek').onclick = () => { currentWeekStart = addDays(currentWeekStart, -7); renderCuadrante(); };
  document.getElementById('nextWeek').onclick = () => { currentWeekStart = addDays(currentWeekStart, 7); renderCuadrante(); };
  document.getElementById('todayBtn').onclick = () => { currentWeekStart = getMonday(new Date()); renderCuadrante(); };

  // Recuperadas funciones que daban error en consola
  document.getElementById('publishWeek').addEventListener('click', showPublishLinks);
  document.getElementById('searchEmp').addEventListener('input', renderEmpleados);
  document.getElementById('filterEmpStore').addEventListener('change', renderEmpleados);
  document.getElementById('filterStore').addEventListener('change', renderCuadrante);
}

// ── Carga de Datos ──
async function loadData() {
  const loadingEl = document.getElementById('loadingState');
  const mainEl = document.getElementById('mainContent');
  
  loadingEl.style.display = 'flex';
  mainEl.style.display = 'none';

  try {
    const data = await fetchJSONP(CONFIG.SCRIPT_URL + '?action=getData&t=' + Date.now());
    DATA = data;
    onDataLoaded();
  } catch (e) {
    console.error("Error crítico:", e);
    document.getElementById('errorState').style.display = 'flex';
    document.getElementById('errorMsg').textContent = e.message;
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
  renderTiendas();
  renderIncidencias();

  const total = DATA.empleados.length;
  const tiendasCount = [...new Set(DATA.empleados.map(e => e.tienda))].filter(Boolean).length;
  const badge = document.getElementById('headerBadge');
  if(badge) badge.textContent = `${tiendasCount} tiendas · ${total} empleados`;
}

// ── Render de Cuadrante (CON TU REGLA DE VACACIONES) ──
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
    
    // REGLA: Filtrar nombres que tengan turnos que NO sean VAC en esta semana
    const nombresUnicos = [...new Set(DATA.turnos
      .filter(t => {
          const coincide = t.tienda === tienda && days.includes(t.fecha);
          const noEsVac = t.turno !== 'VAC';
          return coincide && noEsVac;
      })
      .map(t => t.nombre.trim()))];

    if (nombresUnicos.length === 0) return;

    htmlFinal += `
      <div class="cuad-head" style="grid-column:1/-1; border-left:4px solid ${color}; grid-template-columns:${gridCols}">
        <div style="padding:10px; color:${color}; font-weight:600">📍 ${tienda}</div>
        ${nombresDias.map(dia => `<div class="cuad-head-cell">${dia}</div>`).join('')}
      </div>`;

    nombresUnicos.forEach(nombre => {
      const rowTurnos = days.map(d => {
        const t = DATA.turnos.find(turno => 
          turno.nombre.trim().toLowerCase() === nombre.toLowerCase() && 
          turno.tienda === tienda && 
          turno.fecha === d
        );
        const val = t ? t.turno : 'L';
        return `
          <div class="cuad-cell ${d === hoy ? 'today-col' : ''}">
            <span class="pill pill-${val.toLowerCase()}">${val}</span>
          </div>`;
      }).join('');

      htmlFinal += `
        <div class="cuad-row" style="grid-template-columns:${gridCols}">
          <div class="cuad-emp">${nombre}</div>
          ${rowTurnos}
        </div>`;
    });
  });

  document.getElementById('cuadranteTable').innerHTML = htmlFinal || '<div style="padding:20px;">No hay turnos registrados esta semana.</div>';
}

// ── Render de Empleados ──
function renderEmpleados() {
  const search = document.getElementById('searchEmp').value.trim().toLowerCase();
  const store = document.getElementById('filterEmpStore').value;

  let emps = DATA.empleados;
  if (search) emps = emps.filter(e => e.nombre.toLowerCase().includes(search));
  if (store) emps = emps.filter(e => e.tienda === store);

  const rows = emps.map(emp => {
    const storeColor = CONFIG.STORE_COLORS[emp.tienda] || '#888';
    const urlFicha = `empleado.html?nombre=${encodeURIComponent(emp.nombre.trim())}&tienda=${encodeURIComponent(emp.tienda)}`;

    return `
      <tr>
        <td>
          <div class="emp-name-cell">
            <div class="avatar-xs" style="background:${storeColor}; color:white">${emp.nombre[0]}</div>
            ${emp.nombre}
          </div>
        </td>
        <td><span class="store-tag" style="border-color:${storeColor}; color:${storeColor}">${emp.tienda}</span></td>
        <td>${emp.horasContrato || 40}h</td>
        <td><span class="badge ${emp.estado === 'activo' ? 'badge-ok' : 'badge-danger'}">${emp.estado}</span></td>
        <td>
          <a href="${urlFicha}" class="btn-sm btn-orange" style="text-decoration:none;">Ver Ficha</a>
        </td>
      </tr>`;
  }).join('');

  document.getElementById('empTable').innerHTML = `
    <table>
      <thead><tr><th>Empleado</th><th>Tienda</th><th>Contrato</th><th>Estado</th><th>Acción</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">Sin resultados</td></tr>'}</tbody>
    </table>`;
}

// ── Render de Resumen ──
function renderResumen() {
  const hoy = toDateStr(new Date());
  const turnosHoy = DATA.turnos.filter(t => t.fecha === hoy);
  const incAbiertas = (DATA.incidencias || []).filter(i => i.estado !== 'resuelta');
  const horasSemana = calcHorasSemana();

  const container = document.getElementById('resumenMetrics');
  if(!container) return;

  container.innerHTML = `
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
      <div class="sub">Pendientes</div>
    </div>`;
}

// ── Tiendas ──
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

function selectStoreDet(t) { activeStore = t; renderTiendas(); }

function renderStoreDetail(tienda) {
  const detail = document.getElementById('storeDetail');
  if(!tienda || !detail) return;
  const emps = DATA.empleados.filter(e => e.tienda === tienda);
  detail.innerHTML = `<div class="panel"><div class="panel-title">Equipo en ${tienda}</div>` + 
    emps.map(e => `<div class="monthly-row"><span>${e.nombre}</span><span class="badge-total">${e.horasContrato}h</span></div>`).join('') + `</div>`;
}

// ── Incidencias ──
function renderIncidencias() {
  const container = document.getElementById('incidenciasList');
  if(!container) return;
  container.innerHTML = (DATA.incidencias || []).map(i => `
    <div class="incidencia-item"><div><strong>${i.tipo}</strong>: ${i.nombre}</div><span class="badge badge-info">${i.estado}</span></div>
  `).join('') || 'No hay incidencias';
}

// ── Funciones de Publicación ──
function showPublishLinks() {
  const days = weekDays(currentWeekStart);
  const range = formatWeekRange(days[0], days[6]);
  const tiendas = [...new Set(DATA.turnos.filter(t => days.includes(t.fecha)).map(t => t.tienda))].filter(Boolean).sort();
  const baseAddr = window.location.origin + window.location.pathname.replace('index.html', '');

  let html = `
    <div id="publishModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;">
      <div style="background:white; width:100%; max-width:400px; border-radius:15px; padding:20px; position:relative;">
        <button onclick="document.getElementById('publishModal').remove()" style="position:absolute; top:10px; right:10px; border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        <h3 style="margin-top:0">Publicar Semana</h3>
        <div style="max-height:60vh; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">`;

  tiendas.forEach(tienda => {
    const link = `${baseAddr}tienda.html?tienda=${encodeURIComponent(tienda)}&start=${days[0]}`;
    html += `
      <div style="padding:10px; border:1px solid #eee; border-radius:8px;">
        <div style="font-weight:600; margin-bottom:5px;">${tienda}</div>
        <button class="btn-sm btn-orange" style="width:100%" onclick="copyToClipboard('${tienda}', '${link}', '${range}')">Copiar WhatsApp</button>
      </div>`;
  });

  html += `</div></div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function copyToClipboard(tienda, link, range) {
  const txt = `📍 *CUADRANTE ${tienda}*\n🗓️ ${range}\n🔗 Ver aquí: ${link}`;
  navigator.clipboard.writeText(txt).then(() => alert("Copiado para " + tienda));
}

// ── Helpers ──
function fetchJSONP(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'cb_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    window[cbName] = (data) => { delete window[cbName]; script.remove(); resolve(data); };
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${cbName}`;
    script.onerror = () => reject(new Error('Error al conectar con Google Sheets'));
    document.head.appendChild(script);
  });
}

function populateStoreFilters() {
  const tiendas = [...new Set(DATA.empleados.map(e => e.tienda))].filter(Boolean).sort();
  ['filterStore', 'filterEmpStore'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.innerHTML = '<option value="">Todas las tiendas</option>' + tiendas.map(t => `<option value="${t}">${t}</option>`).join('');
  });
}

function getMonday(d) { d = new Date(d); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0,0,0,0); return d; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function weekDays(monday) { return Array.from({length: 7}, (_, i) => toDateStr(addDays(monday, i))); }
function toDateStr(d) { return d.toISOString().split('T')[0]; }
function formatTime(d) { return d.toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'}); }
function formatWeekRange(d1, d2) { return `Semana del ${d1.split('-')[2]} al ${d2.split('-')[2]}`; }
function calcHorasSemana() {
  const days = weekDays(currentWeekStart);
  const total = DATA.turnos.filter(t => days.includes(t.fecha)).reduce((acc, t) => acc + (CONFIG.HORAS_TURNO[t.turno] || 0), 0);
  return total.toFixed(1);
}
