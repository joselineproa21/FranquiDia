// v2.6 — Optimización de estilos y robustez en nombres
// ============================================================
// FranquiDía — App principal (dashboard admin)
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
    // Usamos timestamp para evitar caché del navegador
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

// ── Render de Empleados (Mejorado con tus nuevos estilos) ──
function renderEmpleados() {
  const search = document.getElementById('searchEmp').value.trim().toLowerCase();
  const store = document.getElementById('filterEmpStore').value;

  let emps = DATA.empleados;
  if (search) emps = emps.filter(e => e.nombre.toLowerCase().includes(search));
  if (store) emps = emps.filter(e => e.tienda === store);

  const rows = emps.map(emp => {
    const storeColor = CONFIG.STORE_COLORS[emp.tienda] || '#888';
    // Link robusto usando encodeURIComponent
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
          <a href="${urlFicha}" class="btn-sm btn-orange" style="text-decoration:none;">
            Ver Ficha
          </a>
        </td>
      </tr>`;
  }).join('');

  document.getElementById('empTable').innerHTML = `
    <table>
      <thead><tr><th>Empleado</th><th>Tienda</th><th>Contrato</th><th>Estado</th><th>Acción</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">Sin resultados</td></tr>'}</tbody>
    </table>`;
}

// ── Render de Cuadrante (Corregido para evitar errores de nombres) ──
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

// ── TIENDAS ──
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
  const html = emps.map(e => `
    <div class="monthly-row">
      <span class="monthly-name">${e.nombre}</span>
      <span class="badge-total">${e.horasContrato}h/sem</span>
    </div>`).join('');
  detail.innerHTML = `<div class="panel"><div class="panel-title">Equipo en ${tienda}</div>${html}</div>`;
}

// ── JSONP FETCH ──
function fetchJSONP(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'cb_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    window[cbName] = (data) => {
      delete window[cbName];
      script.remove();
      resolve(data);
    };
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${cbName}`;
    script.onerror = () => reject(new Error('Error de red al conectar con Google Sheets'));
    document.head.appendChild(script);
  });
}

// ── Helpers de Fecha ──
function getMonday(d) { d = new Date(d); const day = d.getDay() || 7; if(day!==1) d.setHours(-24*(day-1)); d.setHours(0,0,0,0); return d; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function weekDays(monday) { return Array.from({length: 7}, (_, i) => toDateStr(addDays(monday, i))); }
function toDateStr(d) { return d.toISOString().split('T')[0]; }
function formatTime(d) { return d.toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'}); }
function formatWeekRange(d1, d2) { return `Semana del ${d1.split('-')[2]} al ${d2.split('-')[2]}`; }
