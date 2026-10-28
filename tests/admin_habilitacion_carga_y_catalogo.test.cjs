"use strict";

// Auditoria 2026-10-22 — modulo "Habilitacion de actividades".
// Etapa 1 (conservada): el selector de guias sale de las guias ASIGNADAS a la
// ficha (antes solo de las que ya tenian candados) y el estado consultado vive
// en memoria del modulo (el panel purga localStorage en cada carga).
// Etapa 2 (carga SELECTIVA): ficha -> aprendiz -> guia -> "Consultar
// actividades". Dibujar el panel, elegir ficha/aprendiz/guia o escribir en los
// buscadores NO consultan la nube; la consulta es solo del aprendiz elegido,
// usa la lectura detallada (distingue "no hay" de "no se pudo consultar") y
// reutiliza lo vigente.
//
// Se carga el modulo REAL en vm con el registro real de guias y el FICHA_MAP
// real. La nube es un mock de cloudReadGuideDataDetailed que cuenta llamadas
// y falla si alguien intenta escribir.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, ...rel.split("/")), "utf8");

function extractObjectLiteral(source, anchor) {
  const idx = source.indexOf(anchor);
  assert.notStrictEqual(idx, -1, "no se encontro el ancla: " + anchor);
  const start = source.indexOf("{", idx + anchor.length);
  let depth = 0;
  let i = start;
  for (; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === quote) break;
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "/") { const nl = source.indexOf("\n", i); i = nl === -1 ? source.length : nl; continue; }
    if (ch === "/" && next === "*") { const end = source.indexOf("*/", i + 2); i = end === -1 ? source.length : end + 1; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return new Function("return (" + source.slice(start, i) + ");")();
}

const FICHA_MAP = extractObjectLiteral(read("js/portal_auth.js"), "const FICHA_MAP =");
const GUIDE_TITLES = extractObjectLiteral(read("js/portal_auth.js"), "const GUIDE_TITLES =");
const SIX_FICHAS = ["3168850", "3168852", "3441939", "3441942", "3441944", "3441950"];
// 2026-10-28 (candidata unica): +2 guias de mantenimiento en Kennedy 10 (Guias 7 y 8, RAP02/RAP03) y +3 en
// Santa Barbara 10 (Guias 5, 6 y 7, RAP01-RAP03), creadas desde los documentos oficiales. Grado 11 sin cambios.
const EXPECTED_COUNTS = { 3168850: 9, 3168852: 9, 3441939: 13, 3441942: 13, 3441944: 9, 3441950: 9 };

// Nube simulada: docs[`${scopeKey}|${cloudFileName}`] = payload.
// failWith: estado de fallo forzado para todas las lecturas (o funcion por nombre).
function makeCloud(docs, options = {}) {
  const calls = [];
  return {
    calls,
    cloudReadGuideDataDetailed: async (scopeKey, names, opts) => {
      calls.push({ scopeKey, names: [...names], opts });
      await new Promise((r) => setTimeout(r, options.delayMs || 0));
      const files = {};
      let status = "ok";
      names.forEach((name) => {
        const fail = typeof options.failWith === "function" ? options.failWith(name) : options.failWith;
        if (fail) { files[name] = { status: fail, data: null }; status = fail; return; }
        const d = docs[`${scopeKey}|${name}`];
        files[name] = d ? { status: "found", data: JSON.parse(JSON.stringify(d)) } : { status: "missing", data: null };
      });
      return { status, files, stats: { firestoreRequests: 2, firestoreDocs: names.length * 2, driveRequests: 0 } };
    },
    cloudGetGuideData: () => { throw new Error("la consulta selectiva no debe usar cloudGetGuideData"); },
    cloudSaveGuideData: () => { throw new Error("consultar NO debe escribir en la nube"); },
  };
}

function load(cloud) {
  const writes = [];
  const localStorage = {
    getItem: () => null,
    setItem: (k) => writes.push(k),
    removeItem() {},
  };
  const windowObj = {};
  const sandbox = {
    window: windowObj,
    document: { addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; } },
    console: { log() {}, info() {}, warn() {}, error() {} },
    localStorage,
    setTimeout,
  };
  windowObj.window = windowObj;
  windowObj.document = sandbox.document;
  windowObj.portalAuth = {
    getGuidesForFicha: (ficha) => ((FICHA_MAP[String(ficha)] || {}).guias || []).slice(),
    getGuideTitle: (file) => GUIDE_TITLES[file] || file,
    getSelectionForFicha: (ficha) => ({ inst: (FICHA_MAP[ficha] || {}).inst || "", grupo: (FICHA_MAP[ficha] || {}).grupo || "" }),
    getStudentStorageKey: (u, key, opts) => `sena_portal:student:${u}:${(opts && opts.area) || "app"}:${key}`,
  };
  vm.createContext(sandbox);
  vm.runInContext(read("js/activity_standard.js"), sandbox, { filename: "activity_standard.js" });
  vm.runInContext(read("js/guide_declarations.js"), sandbox, { filename: "guide_declarations.js" });
  vm.runInContext(read("js/admin_habilitacion.js"), sandbox, { filename: "admin_habilitacion.js" });
  windowObj._firebaseDb = cloud || makeCloud({});
  const std = windowObj.ActivityStandard;
  const deps = (extra) => Object.assign({
    auth: windowObj.portalAuth,
    getUnlockActivitiesForGuide: (file) => std.getActivitiesForGuide(file) || [],
    getGuideActivityStateKey: (file) => (std.getConfigForGuide(file) || {}).stateKey || "",
    sessionKey: "admin|dubier|2026-10-22T10:00:00Z",
  }, extra || {});
  return { hab: windowObj.adminHabilitacion, std, deps, windowObj, sandbox, localWrites: writes };
}

const select = (html, id) => {
  const m = html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`));
  assert.ok(m, "no existe el selector " + id);
  return Array.from(m[1].matchAll(/<option value="([^"]*)"/g)).map((x) => x[1]).filter(Boolean);
};

function firstLockKey(std, file, idx = 0) {
  const acts = (std.getActivitiesForGuide(file) || []).filter((a) => (a.keys || []).some((k) => /-locked$/.test(k)));
  return { act: acts[idx], key: acts[idx].keys.find((k) => /-locked$/.test(k)) };
}

const usersFor = (ficha, n) => Array.from({ length: n }, (_, i) => ({
  usernameKey: `ap${ficha}_${i}`, fullName: `Aprendiz ${i} ${ficha}`, ficha, inst: "IE",
}));
const ALL_USERS = SIX_FICHAS.flatMap((f) => usersFor(f, 3));

// ── Navegacion sin consultas ───────────────────────────────────────────────

test("entrar al modulo: seis fichas, mensaje de espera y CERO consultas", () => {
  const cloud = makeCloud({});
  const { hab, deps } = load(cloud);
  const html = hab.buildHabilitacionPanel(ALL_USERS, deps({ filters: {} }));
  assert.deepStrictEqual(select(html, "hab-filter-ficha"), SIX_FICHAS);
  assert.match(html, /Seleccione una ficha y un aprendiz para consultar las actividades\./);
  assert.match(html, /id="hab-consult"[^>]*disabled/);
  assert.strictEqual(cloud.calls.length, 0);
});

for (const ficha of SIX_FICHAS) {
  test(`ficha ${ficha}: catalogo completo (${EXPECTED_COUNTS[ficha]} guias) y solo sus aprendices, sin consultar`, () => {
    const cloud = makeCloud({});
    const { hab, deps } = load(cloud);
    const html = hab.buildHabilitacionPanel(ALL_USERS, deps({ filters: { ficha } }));
    const guides = select(html, "hab-filter-guide");
    assert.deepStrictEqual(guides, FICHA_MAP[ficha].guias);
    assert.strictEqual(guides.length, EXPECTED_COUNTS[ficha]);
    assert.strictEqual(new Set(guides).size, guides.length);
    const learners = select(html, "hab-filter-learner");
    assert.deepStrictEqual(learners, usersFor(ficha, 3).map((u) => u.usernameKey), "valor = usernameKey, solo la ficha");
    assert.match(html, /id="hab-consult"[^>]*disabled/, "sin aprendiz no se puede consultar");
    assert.strictEqual(cloud.calls.length, 0);
  });
}

test("inventario: 62 asignaciones en las seis fichas", () => {
  assert.strictEqual(SIX_FICHAS.reduce((n, f) => n + FICHA_MAP[f].guias.length, 0), 62);
});

test("buscar aprendiz filtra localmente por nombre (sin consultas) y conserva el elegido", () => {
  const cloud = makeCloud({});
  const { hab } = load(cloud);
  const users = [
    { usernameKey: "laura.p", fullName: "Laura Pérez", ficha: "3168852" },
    { usernameKey: "luis.g", fullName: "Luis Gómez", ficha: "3168852" },
    { usernameKey: "otra", fullName: "Laura Otra Ficha", ficha: "3168850" },
  ];
  const opts = (html) => Array.from(html.matchAll(/<option value="([^"]+)"/g)).map((m) => m[1]);
  assert.deepStrictEqual(opts(hab.buildLearnerOptionsHtml(users, "3168852", "perez", "")), ["laura.p"], "sin tildes y solo la ficha");
  assert.deepStrictEqual(opts(hab.buildLearnerOptionsHtml(users, "3168852", "zz", "luis.g")), ["luis.g"], "conserva el elegido");
  assert.match(hab.buildLearnerOptionsHtml(users, "3168852", "zz", ""), /Ningún aprendiz coincide/);
  assert.strictEqual(cloud.calls.length, 0);
});

test("aprendiz elegido: boton habilitado, aun sin consultar (no se afirma que no haya bloqueos)", () => {
  const cloud = makeCloud({});
  const { hab, deps } = load(cloud);
  const html = hab.buildHabilitacionPanel(ALL_USERS, deps({ filters: { ficha: "3168852", learner: "ap3168852_1" } }));
  assert.doesNotMatch(html, /id="hab-consult"[^>]*disabled/);
  assert.match(html, /Pulse «Consultar actividades»/);
  assert.doesNotMatch(html, /no tiene actividades bloqueadas/);
  assert.strictEqual(cloud.calls.length, 0);
});

test("aislamiento: un aprendiz de OTRA ficha no se considera seleccionado", () => {
  const { hab, deps } = load();
  const html = hab.buildHabilitacionPanel(ALL_USERS, deps({ filters: { ficha: "3168852", learner: "ap3168850_0" } }));
  assert.match(html, /Seleccione una ficha y un aprendiz/);
  assert.match(html, /id="hab-consult"[^>]*disabled/);
});

// ── Consulta selectiva ─────────────────────────────────────────────────────

test("consultar UNA guia: una sola llamada, solo ese aprendiz y solo los documentos de esa guia", async () => {
  const cloud = makeCloud({});
  const { hab, deps } = load(cloud);
  const user = usersFor("3168852", 1)[0];
  const r = await hab.consultLearner(user, ["grupo-11b-guia-06-planificar-informacion.html"], deps());
  assert.strictEqual(r.status, "ok");
  assert.strictEqual(cloud.calls.length, 1);
  assert.strictEqual(cloud.calls[0].scopeKey, `student:${user.usernameKey}`);
  assert.deepStrictEqual(cloud.calls[0].names, ["11b_guia6.html"]);
});

test("consultar TODAS las guias: una llamada agrupada con las guias del aprendiz (y nadie mas)", async () => {
  const cloud = makeCloud({});
  const { hab, deps } = load(cloud);
  const user = usersFor("3441939", 1)[0];
  const r = await hab.consultLearner(user, FICHA_MAP["3441939"].guias, deps());
  assert.strictEqual(cloud.calls.length, 1);
  assert.strictEqual(r.consulted, 13);
  const names = cloud.calls[0].names;
  assert.ok(names.includes("10a_guia.html") && names.includes("jfk_10a_guia10_redes_rap01.html") && names.includes("grupo-10a-guia-10-redes-rap01.html"));
  assert.ok(names.includes("grupo-10a-guia-07-mantenimiento-integral.html") && names.includes("grupo-10a-guia-08-verificar-operacion.html"), "las guias de mantenimiento nuevas tambien se consultan");
  assert.strictEqual(names.length, 14, "13 guias + el documento adicional de Kennedy RAP01");
});

test("cache: lo vigente se reutiliza (0 llamadas); 'Cargar estado desde la nube' (force) relee; vence a los 10 min", async () => {
  const cloud = makeCloud({});
  const { hab, deps, sandbox } = load(cloud);
  const user = usersFor("3168852", 1)[0];
  const guides = FICHA_MAP["3168852"].guias;
  await hab.consultLearner(user, guides, deps());
  const again = await hab.consultLearner(user, [guides[2]], deps());
  assert.strictEqual(cloud.calls.length, 1, "una guia ya consultada no se vuelve a pedir");
  assert.strictEqual(again.fromCache, 1);
  await hab.consultLearner(user, [guides[2]], deps({ force: true }));
  assert.strictEqual(cloud.calls.length, 2);
  vm.runInContext("Date.now = (orig => () => orig() + 11 * 60 * 1000)(Date.now)", sandbox);
  await hab.consultLearner(user, [guides[3]], deps());
  assert.strictEqual(cloud.calls.length, 3, "vencida tras 10 min");
});

test("doble clic: dos consultas identicas simultaneas -> una sola llamada", async () => {
  const cloud = makeCloud({}, { delayMs: 5 });
  const { hab, deps } = load(cloud);
  const user = usersFor("3168852", 1)[0];
  const files = FICHA_MAP["3168852"].guias;
  await Promise.all([hab.consultLearner(user, files, deps()), hab.consultLearner(user, files, deps())]);
  assert.strictEqual(cloud.calls.length, 1);
});

test("otra sesion de admin: la cache se descarta", async () => {
  const cloud = makeCloud({});
  const { hab, deps } = load(cloud);
  const user = usersFor("3168852", 1)[0];
  const g = ["grupo-11b-guia-06-planificar-informacion.html"];
  await hab.consultLearner(user, g, deps());
  await hab.consultLearner(user, g, deps({ sessionKey: "admin|dubier|OTRA-SESION" }));
  assert.strictEqual(cloud.calls.length, 2);
  hab.clearCache();
  await hab.consultLearner(user, g, deps({ sessionKey: "admin|dubier|OTRA-SESION" }));
  assert.strictEqual(cloud.calls.length, 3, "clearCache (pagehide) descarta todo");
});

test("resultados: candados del aprendiz consultado, conteo por guia y guia sin candados con su mensaje", async () => {
  const { hab, deps, std, windowObj, localWrites } = load();
  const user = usersFor("3168852", 1)[0];
  const file = "grupo-11b-guia-06-planificar-informacion.html";
  const { act, key } = firstLockKey(std, file);
  windowObj._firebaseDb = makeCloud({ [`student:${user.usernameKey}|11b_guia6.html`]: { state: { [key]: true }, updatedAt: "2026-10-01T00:00:00Z" } });
  await hab.consultLearner(user, FICHA_MAP["3168852"].guias, deps());
  const filters = { ficha: "3168852", learner: user.usernameKey };
  const html = hab.buildHabilitacionPanel(ALL_USERS, deps({ filters, consult: { status: "ok", text: "Consultado" } }));
  assert.match(html, /1 actividad bloqueada encontrada/);
  assert.ok(html.includes(act.label));
  assert.match(html, /\(1 bloqueada\)<\/option>/);
  const other = hab.buildHabilitacionPanel(ALL_USERS, deps({ filters: { ...filters, guide: "grupo-11b-guia-10-redes-rap02.html" }, consult: { status: "ok" } }));
  assert.match(other, /Esta guía no tiene actividades bloqueadas que requieran habilitación\./);
  assert.ok(select(other, "hab-filter-guide").includes("grupo-11b-guia-10-redes-rap02.html"));
  assert.deepStrictEqual(localWrites, [], "nada academico a localStorage");
});

test("sin candados en todas sus guias: mensaje del aprendiz", async () => {
  const { hab, deps } = load();
  const user = usersFor("3441944", 1)[0];
  await hab.consultLearner(user, FICHA_MAP["3441944"].guias, deps());
  const html = hab.buildHabilitacionPanel(ALL_USERS, deps({ filters: { ficha: "3441944", learner: user.usernameKey }, consult: { status: "ok" } }));
  assert.match(html, /El aprendiz no tiene actividades bloqueadas que requieran habilitación\./);
});

const ERRORS = [
  ["offline", /No fue posible conectar con la nube\. Verifique su conexión e intente nuevamente\./],
  ["denied", /No tiene autorización para consultar esta información\./],
  ["unavailable", /Ocurrió un problema al consultar la información\. Intente nuevamente\./],
  ["timeout", /Ocurrió un problema al consultar la información\. Intente nuevamente\. \(tiempo de espera agotado\)/],
];
for (const [failure, message] of ERRORS) {
  test(`error "${failure}": mensaje propio, nunca "no tiene actividades bloqueadas"`, async () => {
    const { hab, deps, windowObj } = load();
    windowObj._firebaseDb = makeCloud({}, { failWith: failure });
    const user = usersFor("3168852", 1)[0];
    const r = await hab.consultLearner(user, FICHA_MAP["3168852"].guias, deps());
    assert.strictEqual(r.status, failure);
    const html = hab.buildHabilitacionPanel(ALL_USERS, deps({ filters: { ficha: "3168852", learner: user.usernameKey }, consult: { status: r.status } }));
    assert.match(html, message);
    assert.doesNotMatch(html, /no tiene actividades bloqueadas|No se encontraron/);
  });
}

test("consulta incompleta: muestra lo recuperado y avisa que pueden faltar resultados", async () => {
  const { hab, deps, std, windowObj } = load();
  const user = usersFor("3168852", 1)[0];
  const { key } = firstLockKey(std, "grupo-11b-guia-06-planificar-informacion.html");
  windowObj._firebaseDb = makeCloud(
    { [`student:${user.usernameKey}|11b_guia6.html`]: { state: { [key]: true } } },
    { failWith: (name) => (name === "11b_guia7.html" ? "unavailable" : null) }
  );
  const r = await hab.consultLearner(user, FICHA_MAP["3168852"].guias, deps());
  assert.strictEqual(r.status, "incomplete");
  const html = hab.buildHabilitacionPanel(ALL_USERS, deps({ filters: { ficha: "3168852", learner: user.usernameKey }, consult: { status: r.status } }));
  assert.match(html, /1 actividad bloqueada encontrada/);
  assert.match(html, /No fue posible recuperar toda la información\. Algunos resultados podrían no aparecer\./);
});

test("error tras una consulta valida: conserva lo anterior marcado como posiblemente desactualizado", async () => {
  const { hab, deps, std, windowObj } = load();
  const user = usersFor("3168852", 1)[0];
  const { key } = firstLockKey(std, "grupo-11b-guia-06-planificar-informacion.html");
  windowObj._firebaseDb = makeCloud({ [`student:${user.usernameKey}|11b_guia6.html`]: { state: { [key]: true } } });
  await hab.consultLearner(user, FICHA_MAP["3168852"].guias, deps());
  windowObj._firebaseDb = makeCloud({}, { failWith: "offline" });
  const r = await hab.consultLearner(user, FICHA_MAP["3168852"].guias, deps({ force: true }));
  assert.strictEqual(r.status, "offline");
  const html = hab.buildHabilitacionPanel(ALL_USERS, deps({ filters: { ficha: "3168852", learner: user.usernameKey }, consult: { status: r.status } }));
  assert.match(html, /1 actividad bloqueada encontrada/);
  assert.match(html, /No fue posible conectar con la nube.*podría estar desactualizada/);
});

test("Kennedy Guia 10 RAP01: lee alias jfk_ y nombre crudo; el candado recuerda su documento", async () => {
  const file = "grupo-10a-guia-10-redes-rap01.html";
  const { hab, deps, std, windowObj } = load();
  assert.deepStrictEqual([...hab.getCloudFileNamesForGuide(file)], ["jfk_10a_guia10_redes_rap01.html", file]);
  const user = usersFor("3441939", 1)[0];
  const { act, key } = firstLockKey(std, file);
  windowObj._firebaseDb = makeCloud({ [`student:${user.usernameKey}|${file}`]: { state: { [key]: true }, updatedAt: "2026-10-02T00:00:00Z" } });
  await hab.consultLearner(user, [file], deps());
  const rows = hab.getLockedActivities([user], deps({ cacheOnly: true }));
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].activityId, act.id);
  assert.deepStrictEqual([...rows[0].lockSources], [file]);
});

test("habilitar: invalidate descarta lo consultado y la relectura muestra el estado nuevo", async () => {
  const { hab, deps, std, windowObj } = load();
  const user = usersFor("3168852", 1)[0];
  const file = "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html";
  const { key } = firstLockKey(std, file);
  const docKey = `student:${user.usernameKey}|11b_guia7.html`;
  windowObj._firebaseDb = makeCloud({ [docKey]: { state: { [key]: true }, updatedAt: "2026-10-01T00:00:00Z" } });
  await hab.consultLearner(user, [file], deps());
  const row = hab.getLockedActivities([user], deps({ cacheOnly: true }))[0];
  hab.invalidate(row.storageKey);
  assert.strictEqual(hab.getLockedActivities([user], deps({ cacheOnly: true })).length, 0, "invalidado: no se muestra como vigente");
  windowObj._firebaseDb = makeCloud({ [docKey]: { state: { [key]: false }, updatedAt: "2026-10-05T00:00:00Z" } });
  await hab.consultLearner(user, [file], deps({ force: true }));
  assert.strictEqual(hab.getLockedActivities([user], deps({ cacheOnly: true })).length, 0);
});

test("no reemplaza un estado mas nuevo por una lectura mas vieja", async () => {
  const { hab, deps, std, windowObj } = load();
  const user = usersFor("3168852", 1)[0];
  const file = "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html";
  const { key } = firstLockKey(std, file);
  const docKey = `student:${user.usernameKey}|11b_guia7.html`;
  windowObj._firebaseDb = makeCloud({ [docKey]: { state: { [key]: false }, updatedAt: "2026-10-05T00:00:00Z" } });
  await hab.consultLearner(user, [file], deps());
  windowObj._firebaseDb = makeCloud({ [docKey]: { state: { [key]: true }, updatedAt: "2026-10-01T00:00:00Z" } });
  await hab.consultLearner(user, [file], deps({ force: true }));
  assert.strictEqual(hab.getLockedActivities([user], deps({ cacheOnly: true })).length, 0);
});

test("firebase_db.js anterior (sin lectura detallada): la consulta queda marcada como incompleta", async () => {
  const { hab, deps, windowObj } = load();
  windowObj._firebaseDb = { cloudGetGuideData: async () => null };
  const r = await hab.consultLearner(usersFor("3168852", 1)[0], ["grupo-11b-guia-06-planificar-informacion.html"], deps());
  assert.strictEqual(r.status, "incomplete");
});

// ── Consistencia permanente: lo que lee el admin == donde guarda la guia ──

test("toda guia de las seis fichas tiene stateKey y el admin lee el documento donde su script guarda", () => {
  const { hab, std } = load();
  const real = {};
  fs.readdirSync(path.join(ROOT, "js")).filter((f) => /^script_.*\.js$/.test(f)).forEach((f) => {
    const src = read("js/" + f);
    const re = /(STORAGE_FILE_ALIASES(?:_REDES)?|PAGE_FILE_ALIASES)\s*=\s*\{/g;
    let m;
    while ((m = re.exec(src))) Object.assign(real, extractObjectLiteral(src.slice(m.index), "="));
  });
  const problems = [];
  SIX_FICHAS.forEach((ficha) => FICHA_MAP[ficha].guias.forEach((file) => {
    if (!(std.getConfigForGuide(file) || {}).stateKey) problems.push(`${ficha} ${file}: sin stateKey`);
    const saves = real[file] || file;
    if (!hab.getCloudFileNamesForGuide(file).includes(saves)) problems.push(`${ficha} ${file}: guarda en ${saves}`);
  }));
  assert.deepStrictEqual(problems, []);
});

// ── Integracion con admin_usuarios.js (estatica) ──────────────────────────

const AU = read("js/admin_usuarios.js");
const slice = (from, to) => AU.slice(AU.indexOf(from), AU.indexOf(to, AU.indexOf(from) + 1));

test("admin_usuarios: dibujar y seleccionar NO consultan; solo los botones (y la confirmacion al habilitar)", () => {
  assert.doesNotMatch(AU, /ensureHabilitacionLoaded|pullCloudStateForUsers|maybeAutoSyncHabilitacionFicha/);
  const render = slice("function renderHabilitacionPanel()", "function bindHabilitacionHandlers()");
  assert.doesNotMatch(render, /consultHabilitacionSelection|consultLearner/);
  const bind = slice("function bindHabilitacionHandlers()", "function debounce(");
  const calls = bind.match(/consultHabilitacionSelection\(/g) || [];
  assert.strictEqual(calls.length, 2, "solo #hab-consult y #hab-cloud-sync");
  assert.match(bind, /#hab-consult"\)\?\.addEventListener\("click"/);
  assert.match(bind, /#hab-cloud-sync"\)\?\.addEventListener\("click", \(\) => \{ void consultHabilitacionSelection\(\{ force: true \}\)/);
  const users = slice("async function loadUsers", "// ── Backfill Firestore");
  assert.doesNotMatch(users, /consultHabilitacionSelection/);
});

test("admin_usuarios: consulta sin duplicados, con permisos y resultado obsoleto descartado", () => {
  const consult = slice("async function consultHabilitacionSelection", "function renderHabilitacionPanel()");
  assert.match(consult, /status === "loading"\) return null;/, "no duplica una consulta en curso");
  assert.match(consult, /hasAdminPanelAccess\(\)/);
  assert.match(consult, /habConsult\.current !== entry\) return result;/, "seleccion cambiada: no se pinta");
});

test("admin_usuarios: habilitar confirma la escritura, NO recarga a todos los aprendices y relee solo esa guia", () => {
  const unlock = slice("async function handleUnlockClick", "function getUser(");
  assert.match(unlock, /if \(!savedPrimary\) throw/);
  assert.match(unlock, /habLockSources/);
  assert.match(unlock, /invalidate\?\.\(storageKey\)/);
  assert.match(unlock, /consultHabilitacionSelection\(\{ force: true, guides: \[guideFile\] \}\)/);
  assert.doesNotMatch(unlock, /fetchStudentsWithProgress\(\)/);
  assert.doesNotMatch(unlock, /writeGuideDataLocal\(/, "nada academico a localStorage");
});

test("admin_usuarios: la cache se limpia al salir de la pagina y depende de la sesion", () => {
  assert.match(AU, /addEventListener\("pagehide"[\s\S]{0,160}clearCache/);
  assert.match(AU, /function habSessionKey\(\)/);
});

test("panel admin: versiones de cache-bust actualizadas", () => {
  const html = read("panel-administrativo-usuarios.html");
  // 2026-10-28 (candidata unica): proteccion + optimizaciones + guias en un solo paquete; todos los
  // recursos modificados del panel llevan el mismo sufijo nuevo (antes 20261022_3 / 20261027_x).
  assert.match(html, /js\/admin_habilitacion\.js\?v=20261028_1/);
  assert.match(html, /js\/admin_usuarios\.js\?v=20261028_1/);
  assert.match(html, /js\/firebase_db\.js\?v=20261028_1/);
  assert.match(html, /js\/activity_grades\.js\?v=20261028_1/);
  assert.match(html, /css\/page_admin\.css\?v=20261028_1/);
});
