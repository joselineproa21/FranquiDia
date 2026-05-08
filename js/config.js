// ============================================================
//  FranquiDía — Configuración
//  EDITA ESTE ARCHIVO con tus datos de Google Apps Script
// ============================================================

const CONFIG = {

  // ── PASO 1: URL del Web App de Google Apps Script ──
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwlyH0S_6wy3-Id26zNd9T1TbiMokHiVJVfKiQxzQS3Bc78P4GvfuAKVIJyMxxoit_x/exec',

  // ── PASO 2: URL base de tu GitHub Pages ──
  // Asegúrate de que termine SIN la barra final, el código la añade después
BASE_URL: 'https://joselineproa21.github.io/Franquidia',
  
  // ── Nombre del negocio ──
  NOMBRE_NEGOCIO: 'FranquiDía',

  // ── Colores por tienda ──
  STORE_COLORS: {
    'ALM':       '#F5821F',
    'COKINEITOR': '#3B8BD4',
    'PROAMAR':    '#1D9E75',
    'PROPINOS':   '#D4537E'
  },

  // ── Horarios de apertura ──
  HORARIOS: {
    'default': {
      normal:   '09:00 – 21:30',
      reducido: '10:00 – 15:00',
      cerrado:  'CERRADO'
    },
    'ALM': {
      normal:   '08:30 – 21:30',
      reducido: '10:00 – 20:00',
      cerrado:  'CERRADO'
    },
    'PROPINOS': {
      normal:   '09:00 – 21:30',
      reducido: '09:00 – 15:00',
      cerrado:  'CERRADO'
    }
  },

  // ── Horas por turno (para cálculos de carga de trabajo) ──
  HORAS_TURNO: {
    'M':   6.67,
    'T':   6.67,
    'MT':  10.17,
    'L':   0,
    'VAC': 0,
    'F':   0,
    'B':   0,
    'M2':  9.67
  }
};
