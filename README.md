# FranquiDía — Guía de instalación

## Lo que vas a montar

- **Dashboard web** en GitHub Pages (gratis, siempre online)
- **Google Sheets** como base de datos (tu padre lo edita como siempre)
- **Links por empleado** del tipo `tuperfil.github.io/franquidia/empleado.html?emp=maria-lopez`

Tiempo estimado de configuración: **30–45 minutos** la primera vez.

---

## PASO 1 — Prepara el Google Sheet

1. Ve a [sheets.google.com](https://sheets.google.com) y crea un spreadsheet nuevo.
2. Llámalo **"FranquiDía - Datos"**.
3. Crea **3 pestañas** con exactamente estos nombres:

### Pestaña `Empleados`
t
|----|--------|--------|-----------|---------------|--------|-------|
| EMP001 | María López | Vallecas | C/ Gran Vía del Este, 12 | 40 | activo | maria@email.com |
| EMP002 | Juan Ramírez | Moratalaz | C/ Vinateros, 55 | 40 | activo | juan@email.com |

- **id**: cualquier código único (EMP001, EMP002, etc.)
- **estado**: `activo`, `vacaciones` o `baja`
- **horasContrato**: horas semanales (20, 30, 40...)

### Pestaña `Turnos`
| nombre | semana | lun | mar | mier | jue | vie | sab | dom
|------------|-------|---|---|---|---|---|---|---|
| EMP001 | 2025-05-05 | M |M |M |M |M |M |M |
| EMP001 | 2025-05-05 | T |T |T |T |T |T |T |
| EMP002 | 2025-05-05 | L |L |L |L |L |L |L |

nombre (columna A) — el nombre tal cual está en la hoja Empleados
semana (columna B) — la fecha del lunes de esa semana en formato YYYY-MM-DD
lun → dom (columnas C a I) — el turno de cada día

- **nombre**: el nombre tal cual está en la hoja Empleados
- **semana**: la fecha del lunes de esa semana en formato `YYYY-MM-DD` (ej: 2025-05-05). En Sheets puedes formatear la columna como texto para evitar que la cambie automáticamente.
- **lun → dom**: usa estos códigos:
  - `M` = Mañana (9–14h)
  - `T` = Tarde (15–21h)
  - `MT` = Partido (mañana y tarde)
  - `L` = Libre
  - `VAC` = Vacaciones
  - `F` = Festivo
  - `B` = Baja
  - `X` = Hora extra

### Pestaña `Incidencias`
| id | empleadoId | tienda | tipo | titulo | detalle | estado | urgencia | dias |
|----|------------|--------|------|--------|---------|--------|----------|------|
| INC001 | EMP002 | Moratalaz | extra | Horas extra Juan | +8h sobre contrato en mayo | pendiente | normal | 0 |
| INC002 | | Rivas | baja | Baja médica Beatriz | Desde 22 abr | abierta | urgente | 0 |

- **tipo**: `baja`, `vacaciones`, `extra`, `cambio`, `aviso`
- **estado**: `abierta`, `pendiente`, `resuelta`, `activa`
- **urgencia**: `urgente`, `normal`
- **dias**: número de días (para vacaciones)

---

## PASO 2 — Configura Google Apps Script

1. En el Google Sheet, ve a **Extensiones > Apps Script**
2. Borra todo el código que haya por defecto
3. Copia y pega el contenido del archivo `GOOGLE_APPS_SCRIPT.js`
4. En la línea `const SHEET_ID = '...'`, pon el ID de tu Sheet. Lo encuentras en la URL:
   ```
   https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
   ```
5. Guarda el proyecto (Ctrl+S). Ponle el nombre "FranquiDía API".
6. Haz clic en **Implementar > Nueva implementación**
7. Tipo: **Aplicación web**
8. Descripción: "v1"
9. Ejecutar como: **Yo**
10. Quién puede acceder: **Cualquiera**
11. Haz clic en **Implementar** y copia la URL que aparece. Tiene esta pinta:
    ```
    https://script.google.com/macros/s/AKfycbx.../exec
    ```

---

## PASO 3 — Configura la web

Abre el archivo `js/config.js` y rellena:

```javascript
SCRIPT_URL: 'https://script.google.com/macros/s/TU_ID_AQUI/exec',  // URL del paso anterior
BASE_URL:   'https://TUPERFIL.github.io/franquidia',                 // Tu URL de GitHub Pages
```

También puedes cambiar los colores por tienda y el nombre del negocio.

---

## PASO 4 — Sube a GitHub Pages

1. Ve a [github.com](https://github.com) y crea una cuenta si no tienes.
2. Crea un nuevo repositorio llamado **`franquidia`** (público).
3. Sube todos los archivos de esta carpeta al repositorio.
   - Opción fácil: arrastra y suelta los archivos en la web de GitHub.
4. Ve a **Settings > Pages**.
5. En "Source", selecciona **Deploy from a branch > main > / (root)**.
6. Guarda. En 1–2 minutos la web estará en `https://TUPERFIL.github.io/franquidia`.

---

## PASO 5 — Envía links a los empleados

En el dashboard, ve a **Cuadrante > "Publicar semana"**. Aparece una ventana con los links de todos los empleados. Cópialos y mándelos por WhatsApp, email o lo que prefieras.

Cada link es permanente. El empleado siempre verá el cuadrante actualizado. Si tu padre cambia algo en el Sheet, la web lo refleja automáticamente.

---

## Preguntas frecuentes

**¿Cuánto cuesta?**
Nada. GitHub Pages es gratis para repositorios públicos. Google Sheets es gratis.

**¿Es seguro que los empleados vean el Sheet?**
No ven el Sheet para nada. Solo ven su página web, que es solo-lectura.

**¿Puede tu padre editar el cuadrante desde el móvil?**
Sí. Google Sheets tiene app móvil. Edita igual que en el ordenador.

**¿Qué pasa si cambia algo en el Sheet?**
La web lo carga automáticamente la próxima vez que alguien abre la página.

**¿Puedo añadir más tiendas?**
Sí. Solo añade empleados con el nombre de la nueva tienda en el Sheet y añade su color en `js/config.js`.

---

## Estructura de archivos

```
franquidia/
├── index.html              ← Dashboard principal (para tu padre)
├── empleado.html           ← Vista empleado (link que se envía al empleado)
├── css/
│   ├── style.css           ← Estilos principales
│   └── empleado.css        ← Estilos vista empleado
├── js/
│   ├── config.js           ← ← EDITAR ESTE con tu URL y Sheet ID
│   ├── festivos.js         ← Festivos de Madrid 2025–2026
│   ├── app.js              ← Lógica del dashboard
│   └── empleado.js         ← Lógica vista empleado
└── GOOGLE_APPS_SCRIPT.js   ← Código para pegar en Apps Script
```
