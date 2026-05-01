// ============================================================
//  FranquiDía — Festivos de Madrid 2025–2026
//  Formato: 'YYYY-MM-DD': { nombre, tipo }
//  tipo: 'cierre' | 'reducido'
// ============================================================

const FESTIVOS = {
  // 2025
  '2025-01-01': { nombre: 'Año Nuevo',                    tipo: 'cierre'   },
  '2025-01-06': { nombre: 'Reyes Magos',                  tipo: 'cierre'   },
  '2025-04-17': { nombre: 'Jueves Santo',                 tipo: 'reducido' },
  '2025-04-18': { nombre: 'Viernes Santo',                tipo: 'cierre'   },
  '2025-05-01': { nombre: 'Día del Trabajo',              tipo: 'cierre'   },
  '2025-05-02': { nombre: 'Fiesta Comunidad de Madrid',   tipo: 'reducido' },
  '2025-05-15': { nombre: 'San Isidro',                   tipo: 'reducido' },
  '2025-08-15': { nombre: 'Asunción de la Virgen',        tipo: 'reducido' },
  '2025-10-12': { nombre: 'Fiesta Nacional de España',    tipo: 'reducido' },
  '2025-11-01': { nombre: 'Todos los Santos',             tipo: 'reducido' },
  '2025-11-09': { nombre: 'Almudena (Madrid capital)',    tipo: 'reducido' },
  '2025-12-06': { nombre: 'Día de la Constitución',       tipo: 'reducido' },
  '2025-12-08': { nombre: 'Inmaculada Concepción',        tipo: 'cierre'   },
  '2025-12-25': { nombre: 'Navidad',                      tipo: 'cierre'   },
  // 2026
  '2026-01-01': { nombre: 'Año Nuevo',                    tipo: 'cierre'   },
  '2026-01-06': { nombre: 'Reyes Magos',                  tipo: 'cierre'   },
  '2026-04-02': { nombre: 'Jueves Santo',                 tipo: 'reducido' },
  '2026-04-03': { nombre: 'Viernes Santo',                tipo: 'cierre'   },
  '2026-05-01': { nombre: 'Día del Trabajo',              tipo: 'cierre'   },
  '2026-05-02': { nombre: 'Fiesta Comunidad de Madrid',   tipo: 'reducido' },
  '2026-05-15': { nombre: 'San Isidro',                   tipo: 'reducido' },
  '2026-08-15': { nombre: 'Asunción de la Virgen',        tipo: 'reducido' },
  '2026-10-12': { nombre: 'Fiesta Nacional de España',    tipo: 'reducido' },
  '2026-11-01': { nombre: 'Todos los Santos',             tipo: 'reducido' },
  '2026-12-06': { nombre: 'Día de la Constitución',       tipo: 'reducido' },
  '2026-12-08': { nombre: 'Inmaculada Concepción',        tipo: 'cierre'   },
  '2026-12-25': { nombre: 'Navidad',                      tipo: 'cierre'   },
};

// Helpers
function esFestivo(dateStr) {
  return FESTIVOS.hasOwnProperty(dateStr);
}
function getFestivo(dateStr) {
  return FESTIVOS[dateStr] || null;
}
function getFestivosProximos(n = 6) {
  const hoy = toDateStr(new Date());
  return Object.entries(FESTIVOS)
    .filter(([d]) => d >= hoy)
    .slice(0, n)
    .map(([d, f]) => ({ fecha: d, ...f }));
}
function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}
function getHorarioTipo(dateStr) {
  const f = getFestivo(dateStr);
  if (f) return f.tipo === 'cierre' ? 'cerrado' : 'reducido';
  const diaSemana = new Date(dateStr + 'T12:00:00').getDay();
  if (diaSemana === 0) return 'reducido'; // 0 = domingo
  return 'normal';
}