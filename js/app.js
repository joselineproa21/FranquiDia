// ============================================================
//  FranquiDía — App principal (dashboard admin)
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

// ── Carga de datos desde Google Apps Script ──
async function loadData() {
  document.getElementById('loadingState').style.display = 'flex';
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('mainContent').style.display = 'none';

  try {
    const url = CONFIG.SCRIPT_URL + '?action=getData&t=' + Date.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    DATA = json;
    onDataLoaded();
  } catch (e) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'flex';
    document.getElementById('errorMsg').textContent = 'Error: ' + e.message +
      '. Asegúrate de que el script está publicado como "Cualquiera" puede acceder.';
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
  const tiendas = [...new Set(DATA.empleados.map(e => e.tienda))].length;
  document.getElementById('headerBadge').textContent = tiendas + ' tiendas · ' + total + ' empleados';
}

// ── RESUMEN ──
function renderResumen() {
  const hoy = toDateStr(new Date());
  const turnosHoy = DATA.turnos.filter(t => t.fecha === hoy);
  const extrasAbiertos = DATA.incidencias.filter(i => i.tipo === 'extra' && i.estado !== 'resuelta');
  const vacActivos = DATA.incidencias.filter(i => i.tipo === 'vacaciones' && i.estado === 'activa');
  const incAbiertas = DATA.incidencias.filter(i => i.estado === 'abierta' || i.estado === 'pendiente');
  const horasSemana = calcHorasSemana();

  document.getElementById('resumenMetrics').innerHTML = `
    <div class="metric-card orange">
      <div class="label">Empleados activos</div>
      <div class="value">${DATA.empleados.filter(e => e.estado === 'activo').length}</div>
      <div class="sub">${[...new Set(DATA.empleados.map(e => e.tienda))].length} tiendas</div>
    </div>
    <div class="metric-card">
      <div class="label">Horas esta semana</div>
      <div class="value">${horasSemana}</div>
      <div class="sub">${extrasAbiertos.length} extras pendientes</div>
    </div>
    <div class="metric-card">
      <div class="label">Vacaciones activas</div>
      <div class="value">${vacActivos.length}</div>
      <div class="sub">Empleados de baja/vac</div>
    </div>
    <div class="metric-card">
      <div class="label">Incidencias abiertas</div>
      <div class="value">${incAbiertas.length}</div>
      <div class="sub">${incAbiertas.filter(i => i.urgencia === 'urgente').length} urgentes</div>
    </div>
  `;

  const festivoProximo = getFestivosProximos(1)[0];
  if (festivoProximo) {
    const diff = Math.ceil((new Date(festivoProximo.fecha) - new Date()) / 86400000);
    const esHoy = festivoProximo.fecha === hoy;
    document.getElementById('festivoAlert').innerHTML = `
      <div class="festivo-bar ${festivoProximo.tipo === 'cierre' ? 'festivo-danger' : ''}">
        <strong>${esHoy ? 'Hoy:' : 'Próximo festivo (' + diff + ' días):'}</strong>
        ${formatDateLong(festivoProximo.fecha)} — ${festivoProximo.nombre} ·
        <span style="font-weight:500">${festivoProximo.tipo === 'cierre' ? 'Cierre' : 'Horario reducido'}</span>
      </div>`;
  }

  const tiendas = [...new Set(DATA.empleados.map(e => e.tienda))];
  document.getElementById('storesGrid').innerHTML = tiendas.map(tienda => {
    const emps = DATA.empleados.filter(e => e.tienda === tienda);
    const turnosT = turnosHoy.filter(t => emps.some(e => e.nombre === t.nombre));
    const mañana = turnosT.filter(t => t.turno === 'M').length;
    const tarde = turnosT.filter(t => t.turno === 'T').length;
    const bajas = DATA.incidencias.filter(i => i.tienda === tienda && i.tipo === 'baja' && i.estado === 'activa').length;
    const extras = DATA.turnos.filter(t => t.tienda === tienda && t.turno === 'X').length;
    const color = CONFIG.STORE_COLORS[tienda] || '#888';
    const badgeHtml = bajas > 0
      ? `<span class="badge badge-warn">${bajas} baja${bajas > 1 ? 's' : ''}</span>`
      : `<span class="badge badge-ok">Operativa</span>`;
    return `
      <div class="store-card">
        <div class="store-header">
          <div class="store-dot" style="background:${color}"></div>
          <div>
            <div class="store-name">Día — ${tienda}</div>
            <div class="store-addr">${emps[0]?.direccion || ''}</div>
          </div>
          ${badgeHtml}
        </div>
        <div class="store-stats">
          <div class="stat"><div class="sl">Empleados</div><div class="sv">${emps.length}</div></div>
          <div class="stat"><div class="sl">Turno hoy</div><div class="sv">${turnosT.length}/${emps.length}</div></div>
          <div class="stat"><div class="sl">H. extras</div><div class="sv">+${extras}</div></div>
        </div>
        <div class="store-shifts">
          <div class="shift-pill shift-m">☀ Mañana: ${mañana}</div>
          <div class="shift-pill shift-t">🌙 Tarde: ${tarde}</div>
        </div>
      </div>`;
  }).join('');

  const horasMesHtml = DATA.empleados.slice(0, 8).map(emp => {
    const horas = calcHorasMes(emp.nombre);
    const contrato = parseInt(emp.horasContrato) || 160;
    const pct = Math.min(100, Math.round((horas / contrato) * 100));
    const color = horas > contrato ? '#E24B4A' : '#F5821F';
    const badge = horas > contrato ? `<span class="badge badge-danger">+${horas - contrato}h</span>` : '';
    return `
      <div class="monthly-row">
        <div class="avatar-xs" style="${avatarStyle(emp.nombre)}">${initials(emp.nombre)}</div>
        <div class="monthly-name">${emp.nombre}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="monthly-hrs">${horas}/${contrato}h ${badge}</div>
      </div>`;
  }).join('');
  document.getElementById('horasMes').innerHTML = horasMesHtml || '<p style="font-size:12px;color:var(--text3)">Sin datos</p>';

  document.getElementById('festivosList').innerHTML = getFestivosProximos(6).map(f => `
    <div class="festivo-item">
      <div class="festivo-dot"></div>
      <div class="festivo-date">${formatDateShort(f.fecha)}</div>
      <div class="festivo-name">${f.nombre}</div>
      <span class="badge ${f.tipo === 'cierre' ? 'badge-danger' : 'badge-warn'}">${f.tipo === 'cierre' ? 'Cierre' : 'Reducido'}</span>
    </div>`).join('');
}

// ── CUADRANTE ──

function renderCuadrante() {
  const days = weekDays(currentWeekStart);
  const hoy = toDateStr(new Date());
  const storeFilter = document.getElementById('filterStore').value;
  const nombresDias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const TIPOS_TURNO_ORDEN = ['M', 'T', 'MT', 'M2']; // Definimos el orden de las filas

  document.getElementById('weekLabel').textContent = formatWeekRange(days[0], days[6]);

  // 1. Leyenda al principio
  const leyendaHTML = `
    <div class="leyenda-cuadrante" style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; background:#f9f9f9; padding:10px; border-radius:8px; border:1px solid #eee; font-size:11px">
      <div style="display:flex; align-items:center; gap:5px"><span class="pill pill-m" style="padding:2px 6px">M</span> Mañana</div>
      <div style="display:flex; align-items:center; gap:5px"><span class="pill pill-t" style="padding:2px 6px">T</span> Tarde</div>
      <div style="display:flex; align-items:center; gap:5px"><span class="pill pill-mt" style="padding:2px 6px">MT</span> Partido</div>
      <div style="display:flex; align-items:center; gap:5px"><span class="pill pill-m2" style="padding:2px 6px">M2</span> Mañana 2</div>
      <div style="display:flex; align-items:center; gap:5px"><span class="pill pill-l" style="padding:2px 6px">-</span> Libranza / Inactivo</div>
    </div>`;

  // Obtenemos las tiendas directamente de la página de TURNOS
  const tiendasConTurnos = [...new Set(DATA.turnos
    .filter(t => days.includes(t.fecha))
    .map(t => t.tienda))]
    .filter(Boolean).sort();

  const gridCols = `180px repeat(7, 1fr)`;
  let htmlFinal = leyendaHTML; 

  tiendasConTurnos.forEach(tienda => {
    if (storeFilter && tienda !== storeFilter) return;
    const color = CONFIG.STORE_COLORS[tienda] || '#888';
    
    // Encabezado de la tienda
    htmlFinal += `
      <div style="grid-column:1/-1; background:${color}11; border-left:4px solid ${color}; padding:10px; font-weight:bold; margin-top:15px; display:grid; grid-template-columns:${gridCols}">
        <div style="color:${color}">📍 ${tienda}</div>
        ${nombresDias.map(dia => `<div style="text-align:center; font-size:11px; text-transform:uppercase; color:#666">${dia}</div>`).join('')}
      </div>`;

    // 2. Creamos una fila por cada tipo de turno (Mañana, Tarde, Partido)
    TIPOS_TURNO_ORDEN.forEach(tipoActual => {
      const labelTurno = tipoActual === 'M' ? '☀️ Mañana' : tipoActual === 'T' ? '🌙 Tarde' : tipoActual === 'MT' ? '🕒 Partido' : '☀️ Mañana 2';
      
      const rowTurnos = days.map(d => {
        // Buscamos empleados que tengan este turno específico en esta tienda y fecha
        // Filtramos para que NO aparezcan VAC (vacaciones) o B (baja)
        const turnosDia = DATA.turnos.filter(t => 
          t.tienda === tienda && 
          t.fecha === d && 
          t.turno === tipoActual &&
          t.turno !== 'VAC' && t.turno !== 'B'
        );

        if (turnosDia.length === 0) {
          return `<div class="cuad-cell ${d === hoy ? 'today-col' : ''}"><span class="pill pill-l">-</span></div>`;
        }

        // Si hay empleados en este turno, mostramos sus nombres
        const nombres = turnosDia.map(t => t.nombre.split(' ')[0]).join(', ');
        
        return `
          <div class="cuad-cell ${d === hoy ? 'today-col' : ''}">
            <span class="pill pill-${tipoActual.toLowerCase()}" style="padding: 2px 8px;">
              ${nombres}
            </span>
          </div>`;
      }).join('');

      htmlFinal += `
        <div class="cuad-row" style="grid-template-columns:${gridCols}">
          <div class="cuad-emp" style="font-weight:600; font-size:12px; color:#555; padding-left:15px">
            ${labelTurno}
          </div>
          ${rowTurnos}
        </div>`;
    });
  });

  const container = document.getElementById('cuadranteTable');
  if (container) container.innerHTML = htmlFinal || '<div style="padding:20px; text-align:center">No hay turnos para esta semana.</div>';
}

// ── EMPLEADOS ──
function renderEmpleados() {
  const search = document.getElementById('searchEmp').value.toLowerCase();
  const store  = document.getElementById('filterEmpStore').value;

  let emps = DATA.empleados;
  if (search) emps = emps.filter(e => e.nombre.toLowerCase().includes(search));
  if (store)  emps = emps.filter(e => e.tienda === store);

  document.getElementById('empCount').textContent = emps.length + ' empleados' + (store ? ' en ' + store : '');

  const rows = emps.map(emp => {
    const horas = calcHorasMes(emp.nombre);
    const contrato = parseInt(emp.horasContrato) || 160;
    const pct = Math.min(100, Math.round((horas / contrato) * 100));
    const vacUsadas = calcVacUsadas(emp.id);
    const stateClass = { activo: 'badge-ok', vacaciones: 'badge-info', baja: 'badge-warn' }[emp.estado] || 'badge-info';
    const stateLabel = { activo: 'Activo/a', vacaciones: 'Vacaciones', baja: 'Baja médica' }[emp.estado] || emp.estado;
    const storeColor = CONFIG.STORE_COLORS[emp.tienda] || '#888';
    const linkSlug = slugify(emp.nombre);
    const exceso = Math.max(0, horas - contrato);
    const extrasHtml = exceso > 0
      ? `<strong style="color:#E24B4A">+${exceso}h</strong>`
      : `<span style="color:var(--text3)">0h</span>`;
    return `
      <tr>
        <td>
          <div class="emp-name-cell">
            <div class="avatar-sm" style="${avatarStyle(emp.nombre)}">${initials(emp.nombre)}</div>
            ${emp.nombre}
          </div>
        </td>
        <td><span class="store-tag" style="border-color:${storeColor};color:${storeColor}">${emp.tienda}</span></td>
        <td>
          <div>${emp.puesto || '—'}</div>
          <div style="font-size:11px;color:var(--text3)">${emp.horasContrato || 40}h/sem</div>
        </td>
        <td>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span style="font-size:11px;color:var(--text2);margin-left:4px">${vacUsadas}/30 días</span>
        </td>
        <td>${extrasHtml}</td>
        <td><span class="badge ${stateClass}">${stateLabel}</span></td>
        <td>
          <button class="btn-sm" onclick="copyLink('${linkSlug}')" title="Copiar link del empleado">Link</button>
        </td>
      </tr>`;
  }).join('');

  document.getElementById('empTable').innerHTML = `
    <div class="emp-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Empleado</th><th>Tienda</th><th>Contrato</th>
            <th>Vacaciones</th><th>H. extra</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">Sin resultados</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ── TIENDAS ──
function renderTiendas() {
  const tiendas = [...new Set(DATA.empleados.map(e => e.tienda))];
  if (!activeStore) activeStore = tiendas[0];

  document.getElementById('storeTabs').innerHTML = tiendas.map(t => {
    const color = CONFIG.STORE_COLORS[t] || '#888';
    return `<button class="store-tab ${t === activeStore ? 'active' : ''}"
      onclick="selectStoreDet('${t}')"
      style="${t === activeStore ? 'border-color:' + color + ';color:' + color : ''}">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:5px"></span>
      ${t}
    </button>`;
  }).join('');

  renderStoreDetail(activeStore);
}

function selectStoreDet(tienda) {
  activeStore = tienda;
  renderTiendas();
}

function renderStoreDetail(tienda) {

  const emps = DATA.empleados.filter(e => e.tienda === tienda);
  const hoy  = toDateStr(new Date());
  const days  = weekDays(getMonday(new Date()));
  const color = CONFIG.STORE_COLORS[tienda] || '#888';

  const horasSem = emps.reduce((acc, emp) => acc + calcHorasSemanaEmp(emp.nombre), 0);
  const vacActivos = DATA.incidencias.filter(i => i.tienda === tienda && i.tipo === 'vacaciones' && i.estado === 'activa').length;
  const horarioTienda = CONFIG.HORARIOS[tienda] || CONFIG.HORARIOS['default'];
  const horarioHoy = horarioTienda[getHorarioTipo(hoy)];

  const statsHtml = `
    <div class="cards-row" style="grid-template-columns:repeat(4,1fr)">
      <div class="metric-card"><div class="label">Empleados</div><div class="value">${emps.length}</div></div>
      <div class="metric-card orange"><div class="label">Horas semana</div><div class="value">${horasSem}h</div></div>
      <div class="metric-card"><div class="label">Vacaciones</div><div class="value">${vacActivos}</div></div>
      <div class="metric-card"><div class="label">Horario hoy</div><div class="value" style="font-size:16px">${horarioHoy}</div></div>
    </div>`;

  const teamHtml = emps.map(emp => {
    const entry = getTurnoCompleto(emp.nombre, hoy);
    const turnoHoy = entry ? entry.turno : null;
    const pillHtml = turnoHoy
      ? `<span class="pill pill-${turnoHoy.toLowerCase()}" style="width:auto;padding:3px 10px">${turnoHoy === 'M' ? 'Mañana' : turnoHoy === 'T' ? 'Tarde' : turnoHoy}</span>`
      : '';
    return `<div class="monthly-row">
      <div class="avatar-xs" style="${avatarStyle(emp.nombre)}">${initials(emp.nombre)}</div>
      <div class="monthly-name" style="font-size:12px">${emp.nombre}</div>
      ${pillHtml}
    </div>`;
  }).join('');

  const horariosHtml = days.slice(0, 5).map(d => {
    const tipo = getHorarioTipo(d);
    const ht = CONFIG.HORARIOS[tienda] || CONFIG.HORARIOS['default'];
    const horario = ht[tipo];
    const badgeClass = tipo === 'cerrado' ? 'badge-danger' : tipo === 'reducido' ? 'badge-warn' : 'badge-ok';
    const badgeLabel = tipo === 'cerrado' ? 'Festivo' : tipo === 'reducido' ? 'Reducido' : 'Normal';
    return `<div class="festivo-item">
      <div class="festivo-date">${formatDayHeader(d)}</div>
      <div class="festivo-name" style="flex:1">${horario}</div>
      <span class="badge ${badgeClass}">${badgeLabel}</span>
    </div>`;
  }).join('');

  document.getElementById('storeDetail').innerHTML = `
    ${statsHtml}
    <div class="two-col">
      <div class="panel">
        <div class="panel-title">Equipo — ${tienda}</div>
        ${teamHtml}
      </div>
      <div class="panel">
        <div class="panel-title">Horario apertura — esta semana</div>
        <div class="festivo-list">${horariosHtml}</div>
      </div>
    </div>`;
}

// ── INCIDENCIAS ──
function renderIncidencias() {
  const incidencias = DATA.incidencias || [];
  if (!incidencias.length) {
    document.getElementById('incidenciasList').innerHTML =
      '<p style="color:var(--text3);font-size:13px;padding:20px 0">No hay incidencias registradas.</p>';
    return;
  }
  const colores = { urgente: '#E24B4A', pendiente: '#EF9F27', revision: '#378ADD', resuelta: '#639922' };
  const html = incidencias.map(inc => {
    const color = colores[inc.urgencia] || colores[inc.estado] || '#888';
    const badgeClass = inc.estado === 'resuelta' ? 'badge-ok' : inc.urgencia === 'urgente' ? 'badge-danger' : inc.estado === 'abierta' ? 'badge-warn' : 'badge-info';
    return `
      <div class="incidencia-item">
        <div class="inc-stripe" style="background:${color}"></div>
        <div class="inc-body">
          <div class="inc-title">${inc.titulo}</div>
          <div class="inc-detail">${inc.detalle}</div>
        </div>
        <span class="badge ${badgeClass}">${inc.estado}</span>
      </div>`;
  }).join('');
  document.getElementById('incidenciasList').innerHTML = `<div class="incidencias-list">${html}</div>`;
}

// ── PUBLICAR SEMANA ──
function showPublishLinks() {
  const days = weekDays(currentWeekStart);
  const weekStr = formatWeekRange(days[0], days[6]);
  const emps = DATA.empleados.filter(e => e.estado === 'activo');

  const linksHtml = emps.map(emp => {
    const slug = slugify(emp.nombre);
    const url = `${CONFIG.BASE_URL}/empleado.html?emp=${slug}`;
    return `
      <div style="padding:8px 0;border-bottom:0.5px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <div class="avatar-xs" style="${avatarStyle(emp.nombre)}">${initials(emp.nombre)}</div>
          <span style="font-size:12px;font-weight:500">${emp.nombre}</span>
          <span class="store-tag">${emp.tienda}</span>
        </div>
        <div class="link-copy">
          <code>${url}</code>
          <button class="btn-sm" onclick="copyToClipboard('${url}', this)">Copiar</button>
        </div>
      </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--radius-lg);padding:24px;max-width:560px;width:100%;max-height:80vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <div style="font-size:15px;font-weight:500">Links del cuadrante</div>
          <div style="font-size:12px;color:var(--text3)">${weekStr} — Envía el link de cada empleado</div>
        </div>
        <button class="btn-sm" onclick="this.closest('[style]').remove()">✕ Cerrar</button>
      </div>
      <div style="margin-bottom:14px;padding:10px 14px;background:var(--surface2);border-radius:var(--radius);font-size:12px;color:var(--text2)">
        Cada empleado ve solo su horario. Los links son permanentes — siempre muestran el cuadrante actualizado desde Google Sheets.
      </div>
      ${linksHtml}
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function copyLink(slug) {
  copyToClipboard(`${CONFIG.BASE_URL}/empleado.html?emp=${slug}`);
}
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (btn) { const orig = btn.textContent; btn.textContent = '✓ Copiado'; setTimeout(() => btn.textContent = orig, 1500); }
  });
}

// ── POPULATE STORE FILTERS ──
function populateStoreFilters() {
  const tiendas = [...new Set(DATA.empleados.map(e => e.tienda))];
  ['filterStore', 'filterEmpStore'].forEach(id => {
    const sel = document.getElementById(id);
    tiendas.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      sel.appendChild(opt);
    });
  });
}

// ── HELPERS DE DATOS ──

/**
 * Devuelve { turno, tienda } para un empleado en una fecha concreta,
 * buscando por nombre (como está en el Sheet). Null si no hay turno.
 * Si hay varios registros (ej: turno en dos tiendas ese día), devuelve el primero.
 */
function getTurnoCompleto(nombreEmp, fecha) {
  const t = DATA.turnos.find(t => t.nombre === nombreEmp && t.fecha === fecha);
  return t ? { turno: t.turno, tienda: t.tienda } : null;
}

/**
 * Compatibilidad: versión anterior buscaba por empId.
 * Ahora buscamos por nombre, igual que el Sheet.
 */
function getTurno(empId, fecha) {
  const emp = DATA.empleados.find(e => e.id === empId);
  if (!emp) return null;
  const t = DATA.turnos.find(t => t.nombre === emp.nombre && t.fecha === fecha);
  return t ? t.turno : null;
}

function calcHorasMes(nombreEmp) {
  const hoy = new Date();
  const mes = hoy.getMonth(); const año = hoy.getFullYear();
  return DATA.turnos
    .filter(t => {
      const d = new Date(t.fecha + 'T12:00:00');
      return t.nombre === nombreEmp && d.getMonth() === mes && d.getFullYear() === año;
    })
    .reduce((acc, t) => acc + (CONFIG.HORAS_TURNO[t.turno] || 0), 0);
}

function calcHorasSemanaEmp(nombreEmp) {
  const days = weekDays(currentWeekStart);
  return days.reduce((acc, d) => {
    const entry = getTurnoCompleto(nombreEmp, d);
    return acc + (entry ? CONFIG.HORAS_TURNO[entry.turno] || 0 : 0);
  }, 0);
}

function calcHorasSemana() {
  return DATA.empleados.reduce((acc, emp) => acc + calcHorasSemanaEmp(emp.nombre), 0);
}

function calcVacUsadas(empId) {
  return DATA.incidencias
    .filter(i => i.empleadoId === empId && i.tipo === 'vacaciones')
    .reduce((acc, i) => acc + (parseInt(i.dias) || 0), 0);
}

// ── HELPERS DE FECHA ──
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  if (day !== 1) date.setHours(-24 * (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function weekDays(monday) { return Array.from({length: 7}, (_, i) => toDateStr(addDays(monday, i))); }
function toDateStr(d) { return d.toISOString().slice(0, 10); }
function formatTime(d) { return d.toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'}); }
function formatDayHeader(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  return dias[d.getDay()] + ' ' + d.getDate();
}
function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', {day: 'numeric', month: 'long'});
}
function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', {day: '2-digit', month: 'short'}).replace('.','');
}
function formatWeekRange(d1, d2) {
  const a = new Date(d1 + 'T12:00:00'); const b = new Date(d2 + 'T12:00:00');
  return `Semana del ${a.getDate()} al ${b.getDate()} de ${b.toLocaleDateString('es-ES', {month: 'long', year: 'numeric'})}`;
}

// ── HELPERS DE UI ──
const AVATAR_COLORS = [
  ['#FFF3E8','#C0620E'], ['#E6F1FB','#185FA5'], ['#EAF3DE','#3B6D11'],
  ['#FBEAF0','#993556'], ['#E1F5EE','#0F6E56'], ['#FAEEDA','#854F0B'],
  ['#EEEDFE','#534AB7'], ['#FAECE7','#993C1D'],
];
function avatarStyle(nombre) {
  const i = nombre.charCodeAt(0) % AVATAR_COLORS.length;
  return `background:${AVATAR_COLORS[i][0]};color:${AVATAR_COLORS[i][1]}`;
}
function initials(nombre) {
  const parts = nombre.trim().split(' ');
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}
function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  }