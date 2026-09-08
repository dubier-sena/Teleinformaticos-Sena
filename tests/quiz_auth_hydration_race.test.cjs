// Cierre Bloque B (auditoria E2E Guias 10/11/12 Kennedy, 2026-09-08).
//
// Observacion confirmada en produccion con sesion real: el quiz de Guia 11
// guarda correctamente en Firestore (HTTP 200 verificado en Network), pero
// tras un hard reload inmediato volvia a mostrar "Listo para iniciar" en vez
// de restaurar el intento en curso. Determinado como BUG REAL, no
// comportamiento intencional: script_redes_quiz.js es una pagina standalone
// (no pasa por guide_runtime_loader.js, que retrasa naturalmente su primera
// lectura al esperar el fetch de contexto + partial) -- su DOMContentLoaded
// dispara la primera lectura en la nube casi de inmediato, demasiado pronto
// para que window.portalFirebaseAuth termine de hidratar la sesion desde
// IndexedDB tras un reload en frio. getBridgeCurrentUid() (el camino rapido
// de resolveUidForScope en firebase_db.js) es sincrono: sin hidratacion
// lista, cae al camino lento (una lectura REST adicional), y esa carrera
// podia dejar guideState sin el intento en curso justo despues del reload.
//
// Mismo mecanismo que firebase_db.js YA usa para authHeaders() (ver
// ensureAuthHydrated/waitForAuthHydration ahi) -- aqui se aplica la MISMA
// espera, ya probada en produccion para ese caso, antes de la primera
// lectura en la nube de esta pagina.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function extractFunctionSource(src, marker) {
  const start = src.indexOf(marker);
  if (start === -1) return null;
  const braceStart = src.indexOf("{", start);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

test("readCloudSnapshot() espera waitForAuthHydration() ANTES de leer cloudGetGuideData (mismo mecanismo probado de firebase_db.js)", () => {
  const src = read("js/script_redes_quiz.js");
  const fn = extractFunctionSource(src, "async function readCloudSnapshot()");
  assert.ok(fn, "no se encontro el cuerpo de readCloudSnapshot");

  const hydrationCallIdx = fn.indexOf("waitForAuthHydration(");
  const cloudReadIdx = fn.indexOf("cloudGetGuideData(");
  assert.notEqual(hydrationCallIdx, -1, "readCloudSnapshot debe esperar portalFirebaseAuth.waitForAuthHydration() antes de leer la nube");
  assert.notEqual(cloudReadIdx, -1, "no se encontro la llamada real a cloudGetGuideData dentro de readCloudSnapshot");
  assert.ok(
    hydrationCallIdx < cloudReadIdx,
    "waitForAuthHydration debe ejecutarse ANTES de cloudGetGuideData -- si el orden se invierte, la carrera de hidratacion vuelve a estar presente"
  );

  // La espera debe estar realmente en el camino de ejecucion (await), no solo
  // mencionada en un comentario o en codigo muerto tras un return temprano.
  assert.match(
    fn,
    /await window\.portalFirebaseAuth\.waitForAuthHydration\(/,
    "la espera debe usarse con await, no dispararse en fire-and-forget (eso no elimina la carrera)"
  );
});

test("la espera de hidratacion no rompe el camino sin sesion Firebase Auth (portalFirebaseAuth ausente)", () => {
  const src = read("js/script_redes_quiz.js");
  const fn = extractFunctionSource(src, "async function readCloudSnapshot()");
  assert.match(
    fn,
    /window\.portalFirebaseAuth\s*&&\s*typeof window\.portalFirebaseAuth\.waitForAuthHydration\s*===\s*"function"/,
    "debe verificar que portalFirebaseAuth y waitForAuthHydration existan antes de llamarlos -- sin esta guarda, un entorno sin el puente (tests, preview local) lanzaria en vez de continuar con localStorage"
  );
});
