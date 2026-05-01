// ============================================================
//  FranquiDía — Vista empleado (solo lectura)
// ============================================================

let EMP_DATA = null;
let empWeekStart = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const empSlug = params.get('emp');

  if (!empSlug) {
    showError('No se especificó ningún empleado en el enlace.');
    return;
  }

  empWeekStart = getMonday(new Date());

  try {
    const url = CONFIG.SCRIPT_URL + '?action=getData&t=' + Date.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const emp = data.empleados.find(e => slugify(e.nombre) === empSlug);
    if (!emp) {
      showError('Empleado no encontrado. Comprueba que el enlace es correcto.');
      return;
    }

    EMP_DATA = { emp, turnos: data.turnos, incidencias: data.incidencias };
    renderEmpView();
  } catch (e) {
    showError('No se pudo cargar el horario: ' + e.message);
  }
});

function renderEmpView() {
  const { emp, turnos, incidencias } = EMP_DATA;

  document.title = `Mi horario — ${emp.nombre}`;
  document.getElementById('empLoading').style.display = 'none';
  document.getElementById('empMain').style.display = 'block';

  // Avatar & profile
  const [bg, fg] = avatarColors(emp.nombre);
  document.getElementById('empAvatar').textContent = initials(emp.nombre);
  document.getElementById('empAvatar').style.cssText = `background:${bg};color:${fg};width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600`;
  document.getElementById('empFullname').textContent = emp.nombre;
  document.getElementById('empMeta').textContent = `${emp.tienda} · Contrato ${emp.horasContrato || 40}h/semana`;

  // Week nav
  document.getElementById('empPrevWeek').addEventListener('click', () => {
    empWeekStart = addDays(empWeekStart, -7);
    renderEmpSchedule();
    renderEmpWeekLabel();
  });
  document.getElementById('empNextWeek').addEventListener('click', () => {
    empWeekStart = addDays(empWeekStart, 7);
    renderEmpSchedule();
    renderEmpWeekLabel();
  });

  renderEmpWeekLabel();
  renderEmpSchedule();
  renderEmpSummary();

  document.getElementById('empUpdateTime').textContent =
    'Última actualización: ' + new Date().toLocaleString('es-ES', {dateStyle: 'medium', timeStyle: 'short'});
}

function renderEmpWeekLabel() {
  const days = weekDays(empWeekStart);
  document.getElementById('empWeekLabel').textContent = formatWeekRange(days[0], days[6]);
}

function renderEmpSchedule() {
  const { emp, turnos } = EMP_DATA;
  const days = weekDays(empWeekStart);
  const hoy  = toDateStr(new Date());

  // Festivo alerts this week
  const festivosSem = days.filter(d => esFestivo(d));
  document.getElementById('empFestivoAlert').innerHTML = festivosSem.map(d => {
    const f = getFestivo(d);
    return `<div class="festivo-bar ${f.tipo === 'cierre' ? 'festivo-danger' : ''}" style="margin-bottom:8px">
      <strong>${formatDateLong(d)}:</strong> ${f.nombre} · ${f.tipo === 'cierre' ? 'Tienda cerrada' : 'Horario reducido'}
    </div>`;
  }).join('');

  const DIAS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const TURNO_LABEL = { M: 'Turno de mañana · 09:00 – 14:00', T: 'Turno de tarde · 15:00 – 21:00', L: 'Día libre', VAC: 'Vacaciones', F: 'Festivo · Tienda cerrada', B: 'Baja médica', '—': 'Sin asignar' };
  const TURNO_HOURS = { M: '5h', T: '6h', L: '—', VAC: '—', F: '—', B: '—' };

  const rowsHtml = days.map((d, i) => {
    const t = getTurno(emp.id, d, turnos);
    const isHoy = d === hoy;
    const fest  = esFestivo(d);
    const rowCls = isHoy ? 'today-row' : fest ? 'festivo-row' : '';
    const dayNameCls = isHoy ? 'today-label' : fest ? 'festivo-label' : '';
    const date = new Date(d + 'T12:00:00');
    const pillClass = t ? `pill-${t.toLowerCase()}` : 'pill-v';
    const pillLabel = t || '—';
    const horaLabel = TURNO_HOURS[t] || '—';
    const desc = TURNO_LABEL[t] || (fest ? getFestivo(d).nombre : 'Sin asignar');

    return `
      <div class="emp-day-row ${rowCls}">
        <div class="emp-day-name ${dayNameCls}">${DIAS_ES[i]}</div>
        <div class="emp-day-date">${formatDateShort(d)}</div>
        <div class="emp-day-shift" style="flex:1">
          <span class="pill ${pillClass}" style="width:auto;display:inline-block;padding:2px 10px;margin-bottom:2px">${pillLabel}</span>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${desc}</div>
        </div>
        <div class="emp-day-hours">${horaLabel}</div>
      </div>`;
  }).join('');

  document.getElementById('empSchedule').innerHTML = rowsHtml;
}

function renderEmpSummary() {
  const { emp, turnos, incidencias } = EMP_DATA;
  const horas = calcHorasMesEmp(emp.id, turnos);
  const contrato = parseInt(emp.horasContrato) * 4 || 160;
  const vacUsadas = incidencias
    .filter(i => i.empleadoId === emp.id && i.tipo === 'vacaciones')
    .reduce((acc, i) => acc + (parseInt(i.dias) || 0), 0);
  const extras = Math.max(0, horas - contrato);

  document.getElementById('empSummary').innerHTML = `
    <div class="emp-summary-stat">
      <div class="sl">Horas trabajadas</div>
      <div class="sv">${horas}h</div>
    </div>
    <div class="emp-summary-stat">
      <div class="sl">Vacaciones usadas</div>
      <div class="sv">${vacUsadas} días</div>
    </div>
    <div class="emp-summary-stat">
      <div class="sl">Horas extra</div>
      <div class="sv" style="color:${extras > 0 ? '#E24B4A' : 'inherit'}">${extras > 0 ? '+' + extras : '0'}h</div>
    </div>`;
}

function getTurno(empId, fecha, turnosArr) {
  const src = turnosArr || (EMP_DATA && EMP_DATA.turnos) || [];
  const emp = EMP_DATA && EMP_DATA.emp;
  if (!emp) return null;
  const t = src.find(t => t.nombre === emp.nombre && t.fecha === fecha);
  return t ? t.turno : null;
}
function calcHorasMesEmp(empId, turnosArr) {
  const hoy = new Date(); const mes = hoy.getMonth(); const año = hoy.getFullYear();
  return (turnosArr || [])
    .filter(t => { const d = new Date(t.fecha); return t.empleadoId === empId && d.getMonth() === mes && d.getFullYear() === año; })
    .reduce((acc, t) => acc + (CONFIG.HORAS_TURNO[t.turno] || 0), 0);
}

function showError(msg) {
  document.getElementById('empLoading').style.display = 'none';
  document.getElementById('empError').style.display = 'flex';
  const p = document.querySelector('#empError p');
  if (p) p.textContent = msg;
}

// ── HELPERS (copiados de app.js, independientes) ──
function getMonday(d) {
  const date = new Date(d); const day = date.getDay() || 7;
  if (day !== 1) date.setHours(-24 * (day - 1));
  date.setHours(0, 0, 0, 0); return date;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function weekDays(monday) { return Array.from({length: 7}, (_, i) => toDateStr(addDays(monday, i))); }
function toDateStr(d) { return d.toISOString().slice(0, 10); }
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
  return `${a.getDate()} – ${b.getDate()} de ${b.toLocaleDateString('es-ES',{month:'long',year:'numeric'})}`;
}
const AV_COLORS = [
  ['#FFF3E8','#C0620E'],['#E6F1FB','#185FA5'],['#EAF3DE','#3B6D11'],
  ['#FBEAF0','#993556'],['#E1F5EE','#0F6E56'],['#FAEEDA','#854F0B'],
  ['#EEEDFE','#534AB7'],['#FAECE7','#993C1D'],
];
function avatarColors(nombre) { return AV_COLORS[nombre.charCodeAt(0) % AV_COLORS.length]; }
function initials(n) { const p = n.trim().split(' '); return (p[0]?.[0]||'')+(p[1]?.[0]||''); }
function slugify(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
}
