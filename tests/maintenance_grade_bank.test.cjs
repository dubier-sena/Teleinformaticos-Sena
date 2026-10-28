"use strict";
// Calificacion de las guias de mantenimiento (220501001, grado 10):
//   guia-06-mantener-equipos  RAP 01: Guia 6 Kennedy (publicada) + Guia 5 Santa Barbara
//   guia-mant-rap02           RAP 02: Guia 7 Kennedy + Guia 6 Santa Barbara
//   guia-mant-rap03           RAP 03: Guia 8 Kennedy + Guia 7 Santa Barbara
//
// El banco de respuestas (grade_solutions_bank.json) se indexa por FAMILIA -> actividad ->
// data-store. Por eso las dos guias de una familia deben declarar exactamente los mismos
// campos: si no, al aprobar se escribirian en el documento del aprendiz campos que su guia
// no tiene (adminApplySolutionToGuide copia todas las llaves de la solucion).
//
// Las pruebas del contenido del banco se saltan donde el archivo no existe (esta en
// .gitignore a proposito, igual que en tests/ciberseguridad335_grade_solutions.test.cjs).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const BANK_PATH = path.join(ROOT, "grade_solutions_bank.json");
const BANK_EXISTS = fs.existsSync(BANK_PATH);
const SKIP_REASON = "grade_solutions_bank.json no existe en este checkout (gitignored a proposito)";
const REF = "Referencia del instructor";

const FAMILIES = {
  "guia-06-mantener-equipos": {
    jfk: ["grupo-10a-guia-06-mantener-equipos.html", "grupo-10b-guia-06-mantener-equipos.html"],
    sb: ["santa-barbara-10a-guia-05-preparar-mantenimiento.html", "santa-barbara-10b-guia-05-preparar-mantenimiento.html"],
  },
  "guia-mant-rap02": {
    jfk: ["grupo-10a-guia-07-mantenimiento-integral.html", "grupo-10b-guia-07-mantenimiento-integral.html"],
    sb: ["santa-barbara-10a-guia-06-mantenimiento-integral.html", "santa-barbara-10b-guia-06-mantenimiento-integral.html"],
  },
  "guia-mant-rap03": {
    jfk: ["grupo-10a-guia-08-verificar-operacion.html", "grupo-10b-guia-08-verificar-operacion.html"],
    sb: ["santa-barbara-10a-guia-07-verificar-operacion.html", "santa-barbara-10b-guia-07-verificar-operacion.html"],
  },
};

function loadDeclarations() {
  const byFile = {};
  const ctx = { window: {}, console };
  ctx.ActivityStandard = { registerGuide: (c) => (c.files || []).forEach((f) => { byFile[f] = c; }) };
  ctx.window.ActivityStandard = ctx.ActivityStandard;
  vm.createContext(ctx);
  vm.runInContext(read("js/guide_declarations.js"), ctx);
  return byFile;
}

function loadGrades(session) {
  const fields = {};
  const store = {};
  const ctx = {
    console, Event, URL,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: {
      querySelector: () => null,
      createElement: () => ({ setAttribute() {}, appendChild() {} }),
      querySelectorAll(sel) {
        const m = /^\[data-store="(.*)"\]$/.exec(sel);
        return m && fields[m[1]] ? [fields[m[1]]] : [];
      },
    },
  };
  ctx.window = ctx;
  ctx.window.location = { href: "https://x/" };
  ctx.window.ActivityStandard = { registerGuide() {} };
  ctx.window.portalAuth = {
    getCurrentSession: () => session,
    getStudentStorageKey: (u, k, o) => `sena_portal:student:${u}:${(o && o.area) || "app"}:${k}`,
  };
  vm.createContext(ctx);
  vm.runInContext(read("js/activity_grades.js"), ctx, { filename: "activity_grades.js" });
  vm.runInContext(read("js/guide_declarations.js"), ctx, { filename: "guide_declarations.js" });
  return {
    mgr: ctx.window.activityGradesManager,
    ctx,
    field(key, value) { fields[key] = { value: value || "", dispatchEvent() {} }; return fields[key]; },
  };
}

const decl = loadDeclarations();

test("las dos guias de cada familia declaran las mismas actividades y los mismos campos", () => {
  for (const [family, { jfk, sb }] of Object.entries(FAMILIES)) {
    const shape = (file) => decl[file].activities.map((a) => `${a.id}:${(a.formFields || []).join(",")}`);
    assert.deepEqual(shape(sb[0]), shape(jfk[0]), `${family}: Santa Barbara y Kennedy deben compartir campos`);
    assert.deepEqual(shape(jfk[1]), shape(jfk[0]));
    assert.deepEqual(shape(sb[1]), shape(sb[0]));
    assert.notEqual(decl[sb[0]].stateKey, decl[jfk[0]].stateKey, `${family}: el progreso sigue separado por institucion`);
  }
});

test("cada archivo resuelve a su familia y cada ficha ve solo las familias de sus guias", () => {
  const { mgr } = loadGrades(null);
  for (const [family, { jfk, sb }] of Object.entries(FAMILIES)) {
    for (const f of [...jfk, ...sb]) assert.equal(mgr.GUIDE_FAMILY_BY_FILE[f], family, f);
  }
  const src = read("js/portal_auth.js");
  const guiasDe = (ficha) => {
    const i = src.indexOf(`"${ficha}": {`, src.indexOf("FICHA_MAP ="));
    const block = src.slice(i, src.indexOf("],", src.indexOf("guias:", i)));
    return [...block.matchAll(/"([^"]+\.html)"/g)].map((m) => m[1]);
  };
  const famsDe = (ficha) => new Set(guiasDe(ficha).map((f) => mgr.GUIDE_FAMILY_BY_FILE[f]));
  for (const ficha of ["3441939", "3441942", "3441944", "3441950"]) {
    for (const family of Object.keys(FAMILIES)) assert.ok(famsDe(ficha).has(family), `${ficha} debe ver ${family}`);
  }
  for (const ficha of ["3168850", "3168852"]) {
    for (const family of Object.keys(FAMILIES)) assert.ok(!famsDe(ficha).has(family), `${ficha} (11.°) no debe ver ${family}`);
  }
  const mant = /-guia-0[5-8]-(preparar-mantenimiento|mantener-equipos|mantenimiento-integral|verificar-operacion)\.html$/;
  assert.ok(!guiasDe("3441939").some((f) => mant.test(f) && f.startsWith("santa-barbara-")), "Kennedy no recibe guias de mantenimiento de Santa Barbara");
  assert.ok(!guiasDe("3441944").some((f) => /^grupo-10[ab]-guia-0[678]-/.test(f)), "Santa Barbara no recibe paginas de Kennedy");
});

test("el IE-01 del RAP 03 (3.3.4) es una columna calificable sin formulario, con su insignia en la guia", () => {
  const { mgr } = loadGrades(null);
  const act = mgr.GRADE_CATALOG["guia-mant-rap03"].activities.find((a) => a.id === "ie01334");
  assert.ok(act, "falta ie01334 en el catalogo");
  assert.equal(act.mount, "#ie01334GradeMount");
  for (const file of [...FAMILIES["guia-mant-rap03"].jfk, ...FAMILIES["guia-mant-rap03"].sb]) {
    const d = decl[file].activities.find((a) => a.id === "ie01334");
    assert.ok(d && !(d.formFields || []).length && !d.driveTarget, `${file}: ie01334 sin campos ni entrega`);
  }
  for (const p of ["partials/guia-08-verificar-operacion-content.html", "partials/sb10-guia-07-verificar-operacion-content.html"]) {
    assert.match(read(p), /id="ie01334GradeMount"/, p);
  }
  for (const family of Object.keys(FAMILIES)) {
    for (const a of mgr.GRADE_CATALOG[family].activities) assert.ok(!a.aliasIds, `${family}/${a.id}: sin aliasIds`);
  }
});

test("el banco cubre todos los campos de las actividades con formulario, sin huerfanos ni vacios", { skip: !BANK_EXISTS && SKIP_REASON }, () => {
  const bank = JSON.parse(fs.readFileSync(BANK_PATH, "utf8"));
  for (const [family, { jfk }] of Object.entries(FAMILIES)) {
    const entry = bank[family];
    assert.ok(entry, `falta la familia ${family} en el banco`);
    const acts = decl[jfk[0]].activities;
    for (const a of acts) {
      const fields = a.formFields || [];
      if (!fields.length) { assert.ok(!entry[a.id], `${a.id} no tiene formulario: no lleva banco`); continue; }
      assert.deepEqual(Object.keys(entry[a.id] || {}).sort(), [...fields].sort(), `${family}/${a.id}`);
      for (const k of fields) assert.ok(String(entry[a.id][k]).trim().length > (/_tema_fila$/.test(k) ? 5 : 20), `${family}/${a.id}/${k} vacio o demasiado corto`);
    }
    assert.deepEqual(Object.keys(entry).filter((id) => !acts.some((a) => a.id === id)), [], `${family}: actividades huerfanas`);
  }
});

test("el banco no inventa datos medidos: lecturas, seriales y registros propios llevan texto de referencia", { skip: !BANK_EXISTS && SKIP_REASON }, () => {
  const bank = JSON.parse(fs.readFileSync(BANK_PATH, "utf8"));
  const measured = /_(registros|comparativa|hallazgos|hv_identificacion|hv_especificaciones|cpu|placa|memoria|modulos|grafica|msinfo|disco|salud|horas|espacio|rendimiento|actualizaciones|antivirus|estado_inicial|d_resultados|experiencia|reparto|temas)$/;
  let n = 0;
  for (const family of Object.keys(FAMILIES)) {
    for (const [act, fields] of Object.entries(bank[family])) {
      for (const [k, v] of Object.entries(fields)) {
        // m2_311_disco es una pregunta conceptual; las filas del protocolo (3.2.2) son criterios, no lecturas.
        if (!measured.test(k) || k === "m2_311_disco" || act === "protocolo322") continue;
        n++;
        assert.ok(v.startsWith(REF), `${family}/${act}/${k} debe ser texto de referencia, no un dato inventado`);
        assert.doesNotMatch(v, /\d+\s?(°C|RPM|GB|horas de encendido)/, `${family}/${act}/${k} no debe traer lecturas numericas`);
      }
    }
  }
  assert.ok(n >= 30, `se esperaban al menos 30 campos de datos medidos, hubo ${n}`);
});

test("al aprobar, el relleno llena solo los campos vacios (Kennedy y Santa Barbara) y respeta lo respondido", { skip: !BANK_EXISTS && SKIP_REASON }, () => {
  const bank = JSON.parse(fs.readFileSync(BANK_PATH, "utf8"));
  for (const user of ["aprendiz.prueba.jfk", "aprendiz.prueba.sb"]) {
    const { mgr, ctx, field } = loadGrades({ role: "student", usernameKey: user, user: { usernameKey: user } });
    const sol = bank["guia-06-mantener-equipos"].caso311;
    const vacio = field("g6mant_311_sintomas", "");
    const propio = field("g6mant_311_causas", "Respuesta propia del aprendiz");
    ctx.sol = sol;
    vm.runInContext(`window.activityGradesManager.setStudentGrades(${JSON.stringify(user)}, "guia-06-mantener-equipos", { caso311: "A", "caso311:solution": sol })`, ctx);
    assert.equal(mgr.applyApprovedSolutionsForFamily("guia-06-mantener-equipos"), true);
    assert.equal(vacio.value, sol.g6mant_311_sintomas);
    assert.equal(propio.value, "Respuesta propia del aprendiz");
  }
});

test("una actividad No aprobada (D) no recibe respuesta modelo", { skip: !BANK_EXISTS && SKIP_REASON }, () => {
  const bank = JSON.parse(fs.readFileSync(BANK_PATH, "utf8"));
  const user = "aprendiz.prueba.d";
  const { mgr, ctx, field } = loadGrades({ role: "student", usernameKey: user, user: { usernameKey: user } });
  const vacio = field("m3_342_h_conclusion", "");
  ctx.sol = bank["guia-mant-rap03"].registro342;
  vm.runInContext(`window.activityGradesManager.setStudentGrades(${JSON.stringify(user)}, "guia-mant-rap03", { registro342: "D", "registro342:solution": sol })`, ctx);
  mgr.applyApprovedSolutionsForFamily("guia-mant-rap03");
  assert.equal(vacio.value, "");
});
