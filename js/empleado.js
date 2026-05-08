// ============================================================
//  FranquiDía — Vista empleado (Corregida)
// ============================================================

let EMP_DATA = null;
let empWeekStart = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const nombreURL = params.get('nombre');

    if (!nombreURL) {
        showError('No se especificó ningún empleado.');
        return;
    }

    empWeekStart = getMonday(new Date());

    try {
        const url = CONFIG.SCRIPT_URL + '?action=getData&t=' + Date.now();
        const res = await fetch(url);
        const data = await res.json();

        // Buscamos al empleado ignorando mayúsculas/minúsculas
        const emp = data.empleados.find(e => 
            e.nombre.trim().toLowerCase() === nombreURL.trim().toLowerCase()
        );
        
        if (!emp) {
            showError('Empleado no encontrado en la base de datos.');
            return;
        }

        EMP_DATA = { 
            emp, 
            turnos: data.turnos || [], 
            incidencias: data.incidencias || [] 
        };
        
        renderEmpView();
    } catch (e) {
        showError('Error de conexión con los datos.');
    }
});

function renderEmpView() {
    const { emp } = EMP_DATA;
    document.getElementById('empLoading').style.display = 'none';
    document.getElementById('empMain').style.display = 'block';

    document.getElementById('empFullname').textContent = emp.nombre;
    document.getElementById('empMeta').textContent = `${emp.tienda} · Contrato ${emp.horasContrato || 40}h/semana`;

    // Pintar Avatar
    const initials = emp.nombre.split(' ').map(n => n[0]).join('').substring(0,2);
    document.getElementById('empAvatar').textContent = initials;
    document.getElementById('empAvatar').style.background = '#007bff';
    document.getElementById('empAvatar').style.color = 'white';

    setupWeekNav();
    renderEmpWeekLabel();
    renderEmpSchedule();
    renderEmpSummary(); // Aquí ocurre la magia
}

function renderEmpSummary() {
    const { emp, turnos, incidencias } = EMP_DATA;
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    // 1. Filtrar turnos del mes para este empleado
    const turnosMes = turnos.filter(t => {
        const d = new Date(t.fecha);
        const nombreCoincide = t.nombre.trim().toLowerCase() === emp.nombre.trim().toLowerCase();
        return nombreCoincide && d.getMonth() === mesActual && d.getFullYear() === añoActual;
    });

    // 2. Sumar horas según CONFIG
    const totalHoras = turnosMes.reduce((acc, t) => {
        const horas = CONFIG.HORAS_TURNO[t.turno] || 0;
        return acc + horas;
    }, 0);

    // 3. Calcular extras (vs contrato mensual estimado de 4 semanas)
    const horasContratoMes = (parseInt(emp.horasContrato) || 40) * 4;
    const extras = Math.max(0, totalHoras - horasContratoMes);

    // 4. Contar vacaciones (incidencias)
    const vacs = incidencias.filter(i => 
        i.nombre.trim().toLowerCase() === emp.nombre.trim().toLowerCase() && 
        i.tipo.toLowerCase().includes('vacac')
    ).length;

    // INYECTAR EN EL HTML
    document.getElementById('resumen-horas').textContent = totalHoras.toFixed(1) + 'h';
    document.getElementById('resumen-vacaciones').textContent = vacs + ' días';
    document.getElementById('resumen-extras').textContent = extras > 0 ? '+' + extras.toFixed(1) + 'h' : '0h';
}

// --- HELPERS REUTILIZADOS ---
function getTurno(nombre, fecha, turnosArr) {
    const t = turnosArr.find(t => 
        t.nombre.trim().toLowerCase() === nombre.trim().toLowerCase() && t.fecha === fecha
    );
    return t ? t.turno : null;
}

function setupWeekNav() {
    const btnPrev = document.getElementById('empPrevWeek');
    const btnNext = document.getElementById('empNextWeek');
    if (btnPrev && !btnPrev.onclick) {
        btnPrev.onclick = () => { empWeekStart = addDays(empWeekStart, -7); updateUI(); };
        btnNext.onclick = () => { empWeekStart = addDays(empWeekStart, 7); updateUI(); };
    }
}

function updateUI() {
    renderEmpWeekLabel();
    renderEmpSchedule();
}

function renderEmpWeekLabel() {
    const days = weekDays(empWeekStart);
    document.getElementById('empWeekLabel').textContent = formatWeekRange(days[0], days[6]);
}

function renderEmpSchedule() {
    const { emp, turnos } = EMP_DATA;
    const days = weekDays(empWeekStart);
    const html = days.map(d => {
        const t = getTurno(emp.nombre, d, turnos);
        const horas = CONFIG.HORAS_TURNO[t] ? CONFIG.HORAS_TURNO[t] + 'h' : '—';
        return `
            <div class="emp-day-row">
                <div class="emp-day-date">${new Date(d).toLocaleDateString('es-ES', {weekday: 'short', day: 'numeric'})}</div>
                <div class="emp-day-shift"><span class="pill pill-${(t||'v').toLowerCase()}">${t || '—'}</span></div>
                <div class="emp-day-hours">${horas}</div>
            </div>`;
    }).join('');
    document.getElementById('empSchedule').innerHTML = html;
}

function showError(m) {
    document.getElementById('empLoading').style.display = 'none';
    document.getElementById('empError').style.display = 'flex';
    document.getElementById('empError').querySelector('p').textContent = m;
}

function getMonday(d) { d = new Date(d); const day = d.getDay() || 7; if(day!==1) d.setHours(-24*(day-1)); return d; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function weekDays(m) { return Array.from({length:7}, (_,i) => addDays(m,i).toISOString().split('T')[0]); }
function formatWeekRange(d1, d2) { return `${new Date(d1).getDate()} - ${new Date(d2).getDate()} de mayo 2026`; }
