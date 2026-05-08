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

  // 1. Leyenda en la parte superior
  const leyendaHTML = `
    <div class="leyenda-cuadrante" style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; background:#f9f9f9; padding:10px; border-radius:8px; border:1px solid #eee; font-size:11px">
      <div style="display:flex; align-items:center; gap:5px"><span class="pill pill-m" style="padding:2px 6px">M</span> Mañana</div>
      <div style="display:flex; align-items:center; gap:5px"><span class="pill pill-t" style="padding:2px 6px">T</span> Tarde</div>
      <div style="display:flex; align-items:center; gap:5px"><span class="pill pill-mt" style="padding:2px 6px">MT</span> Partido</div>
      <div style="display:flex; align-items:center; gap:5px"><span class="pill pill-vac" style="padding:2px 6px">VAC</span> Vacaciones</div>
      <div style="display:flex; align-items:center; gap:5px"><span class="pill pill-l" style="padding:2px 6px">L</span> Libranza</div>
    </div>`;

  const tiendasConTurnos = [...new Set(DATA.turnos
    .filter(t => days.includes(t.fecha))
    .map(t => t.tienda))]
    .filter(Boolean).sort();

  const gridCols = `180px repeat(7, 1fr)`;
  let htmlFinal = leyendaHTML; 

  tiendasConTurnos.forEach(tienda => {
    if (storeFilter && tienda !== storeFilter) return;
    const color = CONFIG.STORE_COLORS[tienda] || '#888';
    
    let personasData = [];
    const nombresUnicos = [...new Set(DATA.turnos
      .filter(t => t.tienda === tienda && days.includes(t.fecha) && !['L', 'VAC', 'F', 'B'].includes(t.turno))
      .map(t => t.nombre))];

    nombresUnicos.forEach(nombre => {
      // Analizamos todos los turnos de la semana para este empleado
      const turnosSemana = DATA.turnos.filter(t => 
        t.nombre === nombre && t.tienda === tienda && days.includes(t.fecha)
      );

      // Calculamos la prioridad: si tiene alguna 'M', va al grupo 1. Si no, si tiene 'T', al grupo 2.
      let prioridad = 3; // Por defecto partido/otros
      let etiquetaPrincipal = 'Partido';

      if (turnosSemana.some(t => t.turno === 'M')) {
        prioridad = 1;
        etiquetaPrincipal = 'Mañana';
      } else if (turnosSemana.some(t => t.turno === 'T')) {
        prioridad = 2;
        etiquetaPrincipal = 'Tarde';
      }

      personasData.push({
        nombre: nombre,
        tipoTurno: etiquetaPrincipal,
        prioridad: prioridad
      });
    });

    // ORDENACIÓN: Esto hace que los bloques de "Mañana" salgan arriba de los de "Tarde"
    personasData.sort((a, b) => a.prioridad - b.prioridad);

    if (personasData.length === 0) return;

    htmlFinal += `
      <div style="grid-column:1/-1; background:${color}22; border-left:4px solid ${color}; padding:10px; font-weight:bold; margin-top:15px; display:grid; grid-template-columns:${gridCols}">
        <div style="color:${color}">📍 ${tienda}</div>
        ${nombresDias.map(dia => `<div style="text-align:center; font-size:11px; text-transform:uppercase; color:#666">${dia}</div>`).join('')}
      </div>`;

    personasData.forEach(p => {
      const primerNombre = p.nombre.split(' ')[0];

      const rowTurnos = days.map(d => {
        const t = DATA.turnos.find(turno => 
          turno.nombre === p.nombre && turno.tienda === tienda && turno.fecha === d
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
          <div class="cuad-emp" style="font-weight:600; font-size:13px; color:#333; padding-left:15px">
            ${p.tipoTurno}
          </div>
          ${rowTurnos}
        </div>`;
    });
  });

  const container = document.getElementById('cuadranteTable');
  if (container) container.innerHTML = htmlFinal || '<div style="padding:20px; text-align:center">No hay turnos asignados.</div>';
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

// --- NUEVA FUNCIÓN DE PUBLICACIÓN POR TIENDAS ---
function showPublishLinks() {
  const days = weekDays(currentWeekStart);
  const range = formatWeekRange(days[0], days[6]);
  
  // Obtenemos las tiendas que tienen turnos esta semana
  const tiendas = [...new Set(DATA.turnos
    .filter(t => days.includes(t.fecha))
    .map(t => t.tienda))]
    .filter(Boolean).sort();

  let html = `
    <div id="publishModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="background:white; width:100%; max-width:450px; max-height:85vh; overflow-y:auto; border-radius:20px; padding:25px; position:relative; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
        <button onclick="document.getElementById('publishModal').remove()" style="position:absolute; top:15px; right:15px; border:none; background:#eee; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:bold;">✕</button>
        
        <h2 style="margin-top:0; color:#1a1a1a; font-size:20px; letter-spacing:-0.5px;">🚀 Publicar Semana</h2>
        <p style="color:#666; font-size:14px; margin-bottom:25px; border-bottom:1px solid #eee; padding-bottom:10px;">${range}</p>
        
        <div id="publishList">`;

  tiendas.forEach(tienda => {
    const color = CONFIG.STORE_COLORS[tienda] || '#888';
    // Link simulado (ajusta CONFIG.BASE_URL si es necesario)
    // Esto les llevará a la página principal pero con la tienda ya seleccionada
    const currentUrl = window.location.href.split('?')[0];
    const linkTienda = `${currentUrl}?store=${encodeURIComponent(tienda)}&start=${days[0]}`;    
    
    html += `
      <div class="publish-card" style="border:1px solid #e0e0e0; border-radius:12px; padding:15px; margin-bottom:20px; background:#fff; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
          <div style="width:14px; height:14px; background:${color}; border-radius:4px;"></div>
          <strong style="font-size:16px; color:#333;">${tienda}</strong>
        </div>
        
        <div id="text-${tienda.replace(/\s+/g, '')}" style="background:#f1f3f5; border-radius:8px; padding:12px; font-size:13px; color:#444; line-height:1.5; margin-bottom:12px; border:1px solid #e9ecef;">
          📍 *CUADRANTE ${tienda.toUpperCase()}*<br>
          🗓️ ${range}<br><br>
          Checkea tus turnos aquí:<br>
          👉 <span style="color:#007bff; text-decoration:underline;">${linkTienda}</span>
        </div>
        
        <button onclick="copyToClipboard(this, '${tienda}', '${linkTienda}', '${range}')" 
          style="width:100%; background:${color}; color:white; border:none; padding:12px; border-radius:8px; cursor:pointer; font-weight:600; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:8px;">
          <span>Copiar para WhatsApp</span>
        </button>
      </div>`;
  });

  html += `</div>
      <p style="text-align:center; font-size:11px; color:#999; margin-top:10px;">Haz una captura de pantalla si prefieres enviarlo como imagen.</p>
    </div></div>`;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

// la "magia" de copiar
function copyToClipboard(btn, tienda, link, range) {
  const texto = `📍 *CUADRANTE ${tienda.toUpperCase()}*\n🗓️ ${range}\n\nCheckea tus turnos aquí:\n👉 ${link}`;
  
  navigator.clipboard.writeText(texto).then(() => {
    const originalContent = btn.innerHTML;
    btn.style.background = "#25D366";
    btn.innerHTML = "✅ ¡Copiado!";
    
    setTimeout(() => {
      btn.style.background = CONFIG.STORE_COLORS[tienda] || '#888';
      btn.innerHTML = originalContent;
    }, 2000);
  });
}
function copyLink(s) { navigator.clipboard.writeText(`${CONFIG.BASE_URL}/empleado.html?emp=${s}`); alert("Copiado"); }
