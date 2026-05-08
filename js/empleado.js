// ============================================================
//  FranquiDía — Vista empleado (Gestión interna)
// ============================================================

let EMP_DATA = null;
let empWeekStart = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    // Cambiamos 'emp' por 'nombre' para coincidir con el enlace del panel
    const nombreURL = params.get('nombre');
    const tiendaURL = params.get('tienda');

    if (!nombreURL) {
        showError('No se especificó ningún empleado en el enlace.');
        return;
    }

    empWeekStart = getMonday(new Date());

    try {
        // Cargamos los datos globales desde tu Script de Google
        const url = CONFIG.SCRIPT_URL + '?action=getData&t=' + Date.now();
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        // Buscamos al empleado por su nombre exacto
        const emp = data.empleados.find(e => e.nombre === nombreURL);
        
        if (!emp) {
            showError('Empleado no encontrado. Comprueba que el nombre es correcto.');
            return;
        }

        // Guardamos en el estado global del archivo
        EMP_DATA = { emp, turnos: data.turnos, incidencias: data.incidencias || [] };
        renderEmpView();
    } catch (e) {
        showError('No se pudo cargar la información: ' + e.message);
    }
});

function renderEmpView() {
    const { emp } = EMP_DATA;

    document.title = `Ficha — ${emp.nombre}`;
    document.getElementById('empLoading').style.display = 'none';
    document.getElementById('empMain').style.display = 'block';

    // Perfil y Avatar
    const [bg, fg] = avatarColors(emp.nombre);
    const avatarEl = document.getElementById('empAvatar');
    if (avatarEl) {
        avatarEl.textContent = initials(emp.nombre);
        avatarEl.style.cssText = `background:${bg};color:${fg};width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600`;
    }
    
    document.getElementById('empFullname').textContent = emp.nombre;
    document.getElementById('empMeta').textContent = `${emp.tienda} · Contrato ${emp.horasContrato || 40}h/semana`;

    // Configuración de navegación de semanas
    setupWeekNav();
    
    renderEmpWeekLabel();
    renderEmpSchedule();
    renderEmpSummary();

    document.getElementById('empUpdateTime').textContent =
        'Última actualización: ' + new Date().toLocaleString('es-ES', {dateStyle: 'medium', timeStyle: 'short'});
}

function setupWeekNav() {
    const prev = document.getElementById('empPrevWeek');
    const next = document.getElementById('empNextWeek');
    
    if (prev && !prev.dataset.linked) {
        prev.addEventListener('click', () => {
            empWeekStart = addDays(empWeekStart, -7);
            renderEmpSchedule();
            renderEmpWeekLabel();
        });
        prev.dataset.linked = "true";
    }
    if (next && !next.dataset.linked) {
        next.addEventListener('click', () => {
            empWeekStart = addDays(empWeekStart, 7);
            renderEmpSchedule();
            renderEmpWeekLabel();
        });
        next.dataset.linked = "true";
    }
}

function renderEmpWeekLabel() {
    const days = weekDays(empWeekStart);
    document.getElementById('empWeekLabel').textContent = formatWeekRange(days[0], days[6]);
}

function renderEmpSchedule() {
    const { emp, turnos } = EMP_DATA;
    const days = weekDays(empWeekStart);
    const hoy = toDateStr(new Date());

    const DIAS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const TURNO_LABEL = { 
        M: 'Mañana · 09:00 – 14:00', 
        T: 'Tarde · 15:00 – 21:00', 
        L: 'Libre', 
        VAC: 'Vacaciones', 
        F: 'Festivo', 
        B: 'Baja' 
    };

    const rowsHtml = days.map((d, i) => {
        const t = getTurno(emp.nombre, d, turnos);
        const isHoy = d === hoy;
        const pillClass = t ? `pill-${t.toLowerCase()}` : 'pill-v';
        const horaVal = CONFIG.HORAS_TURNO[t] ? `${CONFIG.HORAS_TURNO[t]}h` : '—';

        return `
            <div class="emp-day-row ${isHoy ? 'today-row' : ''}">
                <div class="emp-day-name">${DIAS_ES[i]}</div>
                <div class="emp-day-date">${formatDateShort(d)}</div>
                <div class="emp-day-shift" style="flex:1">
                    <span class="pill ${pillClass}">${t || '—'}</span>
                    <div style="font-size:11px;color:#666;margin-top:2px">${TURNO_LABEL[t] || 'Sin asignar'}</div>
                </div>
                <div class="emp-day-hours">${horaVal}</div>
            </div>`;
    }).join('');

    document.getElementById('empSchedule').innerHTML = rowsHtml;
}

function renderEmpSummary() {
    const { emp, turnos, incidencias } = EMP_DATA;
    
    // Cálculo de horas del mes actual
    const horasTrabajadas = calcHorasMesEmp(emp.nombre, turnos);
    
    // Estimación de contrato mensual (horas semana * 4)
    const horasContrato = (parseInt(emp.horasContrato) * 4) || 160;
    
    // Contamos incidencias de tipo vacaciones
    const vacUsadas = incidencias.filter(i => 
        i.nombre === emp.nombre && i.tipo.toLowerCase().includes('vacac')
    ).length;

    const extras = Math.max(0, horasTrabajadas - horasContrato);

    // Actualizamos las tarjetas del HTML
    const hEl = document.getElementById('resumen-horas');
    const vEl = document.getElementById('resumen-vacaciones');
    const eEl = document.getElementById('resumen-extras');

    if(hEl) hEl.innerText = horasTrabajadas.toFixed(1) + 'h';
    if(vEl) vEl.innerText = vacUsadas + ' días';
    if(eEl) {
        eEl.innerText = (extras > 0 ? '+' : '') + extras.toFixed(1) + 'h';
        eEl.style.color = extras > 0 ? '#e67e22' : 'inherit';
    }
}

// ── LÓGICA DE BÚSQUEDA Y CÁLCULO ──

function getTurno(nombre, fecha, turnosArr) {
    const t = turnosArr.find(t => t.nombre === nombre && t.fecha === fecha);
    return t ? t.turno : null;
}

function calcHorasMesEmp(nombre, turnosArr) {
    const hoy = new Date();
    const mes = hoy.getMonth();
    const año = hoy.getFullYear();
    
    return turnosArr
        .filter(t => {
            const d = new Date(t.fecha);
            return t.nombre === nombre && d.getMonth() === mes && d.getFullYear() === año;
        })
        .reduce((acc, t) => acc + (CONFIG.HORAS_TURNO[t.turno] || 0), 0);
}

function showError(msg) {
    const loadEl = document.getElementById('empLoading');
    const errEl = document.getElementById('empError');
    if(loadEl) loadEl.style.display = 'none';
    if(errEl) {
        errEl.style.display = 'flex';
        errEl.querySelector('p').textContent = msg;
    }
}

// ── HELPERS ──
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
function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', {day: '2-digit', month: 'short'}).replace('.','');
}
function formatWeekRange(d1, d2) {
    const a = new Date(d1 + 'T12:00:00');
    const b = new Date(d2 + 'T12:00:00');
    return `${a.getDate()} – ${b.getDate()} de ${b.toLocaleDateString('es-ES',{month:'long',year:'numeric'})}`;
}
function avatarColors(n) {
    const colors = [['#FFF3E8','#C0620E'],['#E6F1FB','#185FA5'],['#EAF3DE','#3B6D11']];
    return colors[n.charCodeAt(0) % colors.length];
}
function initials(n) { 
    const p = n.trim().split(' '); 
    return (p[0]?.[0]||'') + (p[1]?.[0]||''); 
}
