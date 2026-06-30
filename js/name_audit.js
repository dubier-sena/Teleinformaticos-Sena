// js/name_audit.js
// Logica pura para AUDITAR y ACTUALIZAR los nombres completos de los aprendices
// contra un listado oficial pegado por el instructor.
//
// Empareja por CONJUNTO DE PALABRAS (sin importar orden, mayusculas ni acentos),
// asi "BELTRAN PINILLA JHON DEIBY" (formato oficial: apellidos primero) empareja
// con "Jhon Deiby Beltran Pinilla" (como suele registrarlo el aprendiz).
//
// - SEGURO  = coincidencia UNICA de palabras y el nombre actual difiere -> se actualiza.
// - SIN CAMBIO = coincide y el nombre ya es identico.
// - DUDOSO  = sin coincidencia exacta, o varios aprendices coinciden -> el instructor valida.
//
// Exportada para tests (CommonJS) y expuesta como window.nameAudit para el panel.
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.nameAudit = api;
})(typeof window !== "undefined" ? window : null, function () {
  // NFD + quita diacriticos (incluida la tilde de la ñ -> n) + minusculas + trim.
  function normalize(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  function words(name) {
    return normalize(name).split(/\s+/).filter(Boolean);
  }

  // Clave canonica: palabras normalizadas, ordenadas alfabeticamente y unidas.
  function wordSetKey(name) {
    return words(name).slice().sort().join(" ");
  }

  // Texto pegado -> lineas limpias (colapsa espacios, descarta vacios/muy cortos).
  function parseOfficialNames(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(function (line) { return line.replace(/\s+/g, " ").trim(); })
      .filter(function (line) { return line.length >= 3; });
  }

  // officialNames: string[] ya parseados.
  // fichaUsers: [{ usernameKey, username, fullName, ficha }] de la ficha elegida.
  function matchOfficialNames(officialNames, fichaUsers) {
    var users = Array.isArray(fichaUsers) ? fichaUsers : [];
    var byKey = {};
    users.forEach(function (user) {
      var key = wordSetKey(user.fullName);
      (byKey[key] = byKey[key] || []).push(user);
    });

    var matched = {};
    var sure = [];
    var uncertain = [];
    var noChange = [];

    (officialNames || []).forEach(function (official) {
      var key = wordSetKey(official);
      var candidates = byKey[key] || [];

      if (candidates.length === 1) {
        matched[key] = true;
        var user = candidates[0];
        if (String(user.fullName).trim() === String(official).trim()) {
          noChange.push({ user: user, official: official });
        } else {
          sure.push({ user: user, official: official });
        }
      } else if (candidates.length > 1) {
        matched[key] = true;
        uncertain.push({
          official: official,
          reason: "Varios aprendices coinciden",
          candidates: candidates.slice(),
        });
      } else {
        // Sin coincidencia exacta: sugiere el mejor candidato parcial (mas
        // palabras compartidas) para que el instructor lo revise.
        var officialWords = {};
        words(official).forEach(function (word) { officialWords[word] = true; });
        var best = null;
        var bestShared = 0;
        users.forEach(function (user) {
          var shared = 0;
          words(user.fullName).forEach(function (word) { if (officialWords[word]) shared++; });
          if (shared > bestShared) { bestShared = shared; best = user; }
        });
        uncertain.push({
          official: official,
          reason: "Sin coincidencia exacta",
          candidates: best && bestShared >= 2 ? [best] : [],
        });
      }
    });

    // Aprendices de la ficha que NINGUN nombre oficial empareja.
    var unmatchedStudents = users.filter(function (user) {
      return !matched[wordSetKey(user.fullName)];
    });

    return {
      sure: sure,
      uncertain: uncertain,
      noChange: noChange,
      unmatchedStudents: unmatchedStudents,
    };
  }

  return {
    normalize: normalize,
    words: words,
    wordSetKey: wordSetKey,
    parseOfficialNames: parseOfficialNames,
    matchOfficialNames: matchOfficialNames,
  };
});
