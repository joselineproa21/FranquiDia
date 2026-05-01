// ============================================================
//  FranquiDía — Configuración
//  EDITA ESTE ARCHIVO con tus datos de Google Apps Script
// ============================================================

const CONFIG = {

  // ── PASO 1: Pega aquí la URL del Web App de Google Apps Script ──
  // (la obtienes al publicar el script en Implementar > Nueva implementación)
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwlyH0S_6wy3-Id26zNd9T1TbiMokHiVJVfKiQxzQS3Bc78P4GvfuAKVIJyMxxoit_x/exec',

  // ── PASO 2: URL base de tu GitHub Pages ──
  // (ej: 'https://tuperfil.github.io/franquidia')
  BASE_URL: 'https://joselineproa21.github.io/FranquiDia',

  // ── Nombre del negocio (aparece en la web) ──
  NOMBRE_NEGOCIO: 'FranquiDía',

  // ── Colores por tienda (deben coincidir con los nombres en el Sheet) ──
  STORE_COLORS: {
    'ALM':   '#F5821F',
    'COKINEITOR ':  '#3B8BD4',
    'PROAMAR':  '#1D9E75',
    'PROPINOS':      '#D4537E',
  },

  // ── Horarios de apertura por tipo de día ──
 HORARIOS: {
  'default': {
    normal:   '09:00 – 21:30',
    reducido: '10:00 – 15:00',
    cerrado:  'CERRADO',
  },
  'ALM': {
    normal:   '08:30 – 21:30',
    reducido: '10:00 – 20:00',
    cerrado:  'CERRADO',
  },
  'PROPINOS': {
    normal:   '09:00 – 21:30',
    reducido: '09:00 – 15:00',
    cerrado:  'CERRADO',
  },
},

  // ── Horas por turno (para calcular totales) ──
  HORAS_TURNO: {
    M:   6.40,   // Mañana
    T:   6.40,   // Tarde
    MT:  10.10,  // Mañana + tarde (turno partido)
    L:   0,   // Libre
    VAC: 0,   // Vacaciones
    F:   0,   // Festivo
    B:   0,   // Baja
    M2: 9.40,  // turno partido en dos tiendas (2h mañana + 6h tarde)
},
  };
