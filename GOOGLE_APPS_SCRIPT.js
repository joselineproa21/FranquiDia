// ============================================================
//  FranquiDía — Google Apps Script
//  Pega este código en https://script.google.com
//  y publícalo como Web App con acceso "Cualquiera"
// ============================================================
//
//  ESTRUCTURA ESPERADA EN GOOGLE SHEETS:
//
//  Hoja "Empleados":
//    A: id | B: nombre | C: tienda | D: direccion | E: horasContrato | F: estado | G: email
//
//  Hoja "Turnos":
//    A: empleadoId | B: fecha (YYYY-MM-DD) | C: turno (M/T/MT/L/VAC/F/B/X)
//
//  Hoja "Incidencias":
//    A: id | B: empleadoId | C: tienda | D: tipo | E: titulo | F: detalle | G: estado | H: urgencia | I: dias
//
// ============================================================

const SHEET_ID = '1SazVeI1ulRlUJPQwXdN2djXzvBQp01Z0vXp5lkOweMo'; // ID del Google Sheet (en la URL del sheet)

function doGet(e) {
  const action = e.parameter.action || 'getData';
  let result;

  try {
    if (action === 'getData') {
      result = getAllData();
    } else {
      result = { error: 'Acción no reconocida: ' + action };
    }
  } catch (err) {
    result = { error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({ 'Access-Control-Allow-Origin': '*' });
}

function getAllData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  return {
    empleados:   getEmpleados(ss),
    turnos:      getTurnos(ss),
    incidencias: getIncidencias(ss),
    lastUpdate:  new Date().toISOString(),
  };
}

function getEmpleados(ss) {
  const sheet = ss.getSheetByName('Empleados');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues().slice(1); // skip header
  return rows
    .filter(r => r[0]) // skip empty rows
    .map(r => ({
    id:           String(r[0]).trim(),
    nombre:       String(r[1]).trim(),
    tienda: String(r[2] || '').trim().replace('—', '').replace('-', '') || null,    
    puesto:       String(r[3] || '').trim(),
    direccion:    String(r[4] || '').trim(),
    horasContrato:String(r[5] || '40').trim(),
    estado:       String(r[6] || 'activo').toLowerCase().trim(),
    email:        String(r[7] || '').trim(),
  }));
}

function getTurnos(ss) {
  const sheet = ss.getSheetByName('Turnos');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues().slice(1);
  const diasSemana = ['lun','mar','mie','jue','vie','sab','dom']; // coincide con columnas C-I
  const turnos = [];

  rows.filter(r => r[0] && r[1] && r[2]).forEach(r => {
    const nombre = String(r[0]).trim();
    const tienda = String(r[1]).trim();
    let lunes = r[2];
    if (lunes instanceof Date) {
      lunes = Utilities.formatDate(lunes, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      lunes = String(lunes).trim();
    }

    diasSemana.forEach((dia, i) => {
    const turno = String(r[3 + i] || '').trim().toUpperCase();
    if (!turno || turno === '—' || turno === '-') return;
    const fechaDate = new Date(lunes + 'T12:00:00');
    fechaDate.setDate(fechaDate.getDate() + i);
    const fecha = Utilities.formatDate(fechaDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    turnos.push({ nombre, tienda, fecha, turno });
  });  
  })   

  return turnos;
}


function getIncidencias(ss) {
  const sheet = ss.getSheetByName('Incidencias');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues().slice(1);
  return rows
    .filter(r => r[0])
    .map(r => ({
      id:          String(r[0]).trim(),
      empleadoId:  String(r[1] || '').trim(),
      tienda:      String(r[2] || '').trim(),
      tipo:        String(r[3] || '').toLowerCase().trim(),
      titulo:      String(r[4] || '').trim(),
      detalle:     String(r[5] || '').trim(),
      estado:      String(r[6] || 'abierta').toLowerCase().trim(),
      urgencia:    String(r[7] || '').toLowerCase().trim(),
      dias:        String(r[8] || '0').trim(),
    }));
}
