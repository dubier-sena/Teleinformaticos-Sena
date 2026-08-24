// js/admin_grades_excel_transform.js
// Fase 14 (mantenibilidad): transformaciones de datos PURAS para "Calificar en
// bloque con Excel" (panel admin, Calificaciones), extraidas de
// admin_usuarios.js sin cambiar su comportamiento (mismo codigo, movido
// literal). No tocan el DOM, no llaman a Firestore ni a window.XLSX -- toman
// datos ya resueltos y devuelven arreglos/objetos listos para que
// admin_usuarios.js se los pase a la libreria de Excel o los use para decidir
// que guardar. Por eso se pueden probar aisladas, sin mockear XLSX ni el DOM.
//
// admin_usuarios.js sigue siendo dueno de: leer el DOM, pedir los datos a
// Firestore/activityGradesManager, invocar window.XLSX.utils.* con lo que
// estas funciones devuelven, y aplicar los cambios (guardar notas, actualizar
// UI). Aqui solo vive el "que fila va en que celda" y el "que es valido".
//
// Expuesta como window.adminGradesExcelTransform (uso en pagina) y
// module.exports (tests).
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.adminGradesExcelTransform = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // ── Descarga: construye las filas de cada hoja ────────────────────────────

  // header/rows de la hoja de datos "Calificaciones". resolveGrade es la
  // misma funcion que ya usa la grilla manual (activityGradesManager.
  // resolveGradeValue), inyectada para no depender de ese modulo aqui.
  function buildGradesMainSheetRows(sortedStudents, activities, gradesByUser, resolveGrade) {
    var header = ["Nombre completo", "Usuario", "% Aprobado"].concat(activities.map(function (a) { return a.id; }));
    var rows = [header];
    sortedStudents.forEach(function (user) {
      var g = gradesByUser[user.usernameKey] || {};
      var values = activities.map(function (a) { return resolveGrade(g, a) || ""; });
      var approved = values.filter(function (v) { return v === "A"; }).length;
      var pct = activities.length ? Math.round((approved / activities.length) * 100) : 0;
      rows.push([user.fullName, user.usernameKey, pct + "%"].concat(values));
    });
    return { header: header, rows: rows };
  }

  // generatedAtText: string ya formateada (p.ej. new Date().toLocaleString
  // ("es-CO")) -- se recibe como parametro para que esta funcion sea 100%
  // determinista y facil de probar sin depender del reloj del sistema.
  function buildGradesInstructionsRows(entry, guideFamily, ficha, studentsCount, activitiesCount, generatedAtText) {
    return [
      ["Calificar en bloque -- " + (entry.label || guideFamily) + " -- Ficha " + ficha],
      [""],
      ["Como usar este archivo:"],
      ["1. En la hoja \"Calificaciones\", escribe A (Aprobado) o D (No aprobado) en las celdas de cada actividad."],
      ["2. Deja en blanco las celdas que no quieras cambiar: la calificacion que ya exista no se toca."],
      ["3. No edites la columna \"Usuario\" ni los encabezados de las actividades: se usan para identificar al aprendiz y la actividad al subir el archivo."],
      ["4. Los encabezados de actividad son un codigo corto, no el nombre completo (para que la tabla no quede tan ancha). Revisa la hoja \"Leyenda\" para ver a que actividad corresponde cada codigo."],
      ["5. La columna \"% Aprobado\" es solo informativa (se recalcula sola en el portal); no hace falta editarla."],
      ["6. Guarda el archivo y subelo en el panel admin: Calificaciones > Calificar en bloque con Excel > Subir Excel calificado."],
      [""],
      ["Generado: " + generatedAtText],
      ["Aprendices activos: " + studentsCount + "    Actividades: " + activitiesCount],
    ];
  }

  function buildGradesLegendRows(activities) {
    var legendRows = [["Codigo (encabezado en Calificaciones)", "Actividad completa"]];
    activities.forEach(function (a) { legendRows.push([a.id, a.label]); });
    return legendRows;
  }

  function buildGradesExportFileName(entry, guideFamily, ficha) {
    var safeName = (entry.label || guideFamily).replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
    return "Calificaciones_" + ficha + "_" + safeName + ".xlsx";
  }

  // ── Subida: interpreta y valida las filas leidas del Excel ────────────────

  // header ya viene trim()eado por fila (String(h==null?"":h).trim() por celda,
  // hecho por el llamador antes de invocar esto -- aqui solo se resuelve el
  // mapeo columna->actividad).
  function mapGradesExcelHeader(header, activities) {
    var usuarioIdx = header.indexOf("Usuario");
    if (usuarioIdx === -1) {
      return { ok: false, reason: "no-usuario-column" };
    }
    // El encabezado exportado es el id corto de la actividad (ver
    // buildGradesMainSheetRows); tambien se acepta la etiqueta completa por
    // si el archivo se descargo con una version anterior de este flujo.
    var headerToId = {};
    activities.forEach(function (a) {
      headerToId[String(a.id).trim().toLowerCase()] = a.id;
      headerToId[String(a.label).trim().toLowerCase()] = a.id;
    });
    var colToActivityId = {};
    header.forEach(function (h, idx) {
      var id = headerToId[h.toLowerCase()];
      if (id) colToActivityId[idx] = id;
    });
    if (!Object.keys(colToActivityId).length) {
      return { ok: false, reason: "no-activity-columns" };
    }
    return { ok: true, usuarioIdx: usuarioIdx, colToActivityId: colToActivityId };
  }

  // rows: filas crudas de XLSX.utils.sheet_to_json (rows[0] es el encabezado,
  // por eso se empieza en r=1). studentsByKey: { usernameKey: userObject } de
  // los aprendices ACTIVOS de la ficha -- una fila con un usernameKey que no
  // este ahi cuenta como "unmatched" (aprendiz inactivo o de otra ficha).
  function parseGradesExcelRows(rows, usuarioIdx, colToActivityId, studentsByKey) {
    var parsedRows = [];
    var unmatched = [];
    var invalidCells = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var usernameKey = String(row[usuarioIdx] == null ? "" : row[usuarioIdx]).trim().toLowerCase();
      if (!usernameKey) continue;
      if (!studentsByKey[usernameKey]) { unmatched.push(usernameKey); continue; }
      var grades = {};
      Object.keys(colToActivityId).forEach(function (idxStr) {
        var idx = Number(idxStr);
        var actId = colToActivityId[idx];
        var raw = String(row[idx] == null ? "" : row[idx]).trim().toUpperCase();
        if (!raw) return; // celda vacia: no se toca
        if (raw === "A" || raw === "D") { grades[actId] = raw; return; }
        invalidCells.push(usernameKey + "/" + actId + "=\"" + raw + "\"");
      });
      if (Object.keys(grades).length) parsedRows.push({ usernameKey: usernameKey, grades: grades });
    }
    return { parsedRows: parsedRows, unmatched: unmatched, invalidCells: invalidCells };
  }

  return {
    buildGradesMainSheetRows: buildGradesMainSheetRows,
    buildGradesInstructionsRows: buildGradesInstructionsRows,
    buildGradesLegendRows: buildGradesLegendRows,
    buildGradesExportFileName: buildGradesExportFileName,
    mapGradesExcelHeader: mapGradesExcelHeader,
    parseGradesExcelRows: parseGradesExcelRows,
  };
});
