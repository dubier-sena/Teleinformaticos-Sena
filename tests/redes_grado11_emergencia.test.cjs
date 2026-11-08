"use strict";
// EMERGENCIA 2026-11-07 — Guias 10 (RAP 02) y 11 (RAP 03) de Redes de GRADO 11
// (Santa Barbara 11A 3168850 / 11B 3168852) corregidas segun los Word oficiales:
//   1. GA_Comprobar_Conectividad.docx  -> partials/guia-redes11-rap02-content.html
//   1. GA_Documentar_Acciones_Red.docx -> partials/guia-redes11-rap03-content.html
// Estas pruebas fijan: correspondencia con el documento oficial, formularios
// funcionales (cada campo declarado existe y cada actividad tiene su boton/panel),
// calificaciones (familia propia + revision manual de notas anteriores), banco de
// respuestas exclusivo del instructor, preservacion de registros anteriores y que
// grado 10 no cambio.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const sha = (rel) => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");

function loadDeclarations() {
  const guides = [];
  const w = { ActivityStandard: { registerGuide: (c) => guides.push(c) } };
  new Function("window", "ActivityStandard", read("js/guide_declarations.js"))(w, w.ActivityStandard);
  const byFile = {};
  guides.forEach((g) => (g.files || []).forEach((f) => { byFile[f] = g; }));
  return byFile;
}

function loadGrades() {
  const ctx = {
    window: {}, console, URL,
    document: { querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ setAttribute() {}, appendChild() {} }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  };
  ctx.window.location = { href: "https://x/" };
  vm.createContext(ctx);
  vm.runInContext(read("js/activity_grades.js"), ctx);
  return ctx.window.activityGradesManager;
}

const GUIAS = {
  rap01: { file: "grupo-11a-guia-09-redes-rap01.html", fileB: "grupo-11b-guia-09-redes-rap01.html", partial: "partials/guia-redes11-rap01-content.html", family: "guia-redes11-rap01" },
  rap02: { file: "grupo-11a-guia-10-redes-rap02.html", fileB: "grupo-11b-guia-10-redes-rap02.html", partial: "partials/guia-redes11-rap02-content.html", family: "guia-redes11-rap02" },
  rap03: { file: "grupo-11a-guia-11-redes-rap03.html", fileB: "grupo-11b-guia-11-redes-rap03.html", partial: "partials/guia-redes11-rap03-content.html", family: "guia-redes11-rap03" },
};

// Textos tomados literalmente de los Word oficiales (preguntas, ejercicios, productos y evidencias).
const OFICIAL = {
  rap01: [
    "La señora Carmen tiene una papelería en Tunja con 3 computadores, una impresora y un punto de venta.",
    "¿Cómo le explicaría a la señora Carmen qué es una red y para qué sirve, en términos sencillos?",
    "Dé al menos 5 ejemplos específicos.",
    "BLOQUE A — Tipos de redes: LAN, MAN y WAN".replace("BLOQUE A", "Bloque A"),
    "¿Qué red usa el SENA para conectar todas sus regionales?",
    "¿Qué ocurre si se daña el switch central en una topología estrella?",
    "¿Cuál es la distancia máxima de un cable UTP y qué pasa si se supera?",
    "¿En qué capa del modelo OSI opera el switch? ¿Y el router?",
    "REDES INFORMÁTICAS", "Rama 5 — Modelo OSI",
    "identifique al menos 3 diferencias significativas",
    "¿Por qué no puede haber dos dispositivos con la misma IP en la misma red?",
    "¿Qué son las direcciones privadas y por qué no se pueden usar en internet directamente?",
    "¿Puede un computador funcionar en red local sin tener configurado el DNS? ¿Por qué?",
    "10.5.20.1", "172.20.0.1", "200.14.5.3", "192.168.10.45", "La Ferretería El Tornillo",
    "Miscelánea Lucía — Tunja", "Corporación con sedes en todo el país",
    "PC1_Caja, PC2_Admin, PC3_Bodega, PC4_Punto1, PC5_Punto2, PC6_Gerencia", "192.168.10.255",
    "Exploracion_Contextual_NombreAprendiz_FICHA.pdf", "MapaMental_Redes_NombreAprendiz_FICHA.pdf",
    "Taller_IP_NombreAprendiz_FICHA.pdf", "Lab1_EstrellaCarmen_NombreAprendiz_FICHA.pkt",
    "Lista de chequeo + guía de respuestas (clave de solución)",
  ],
  rap02: [
    "¿Por qué separar la red de ventas y la red administrativa podría mejorar la organización y la seguridad de la papelería?",
    "¿Qué problemas podría tener la señora Carmen si mantiene los 6 equipos (3 de ventas y 3 administrativos) en una sola red sin dividir?",
    "Si tuviera que repartir 254 direcciones disponibles en una red entre 2 grupos de igual tamaño",
    "¿Qué características debe tener la red de ventas de la papelería para considerarse una LAN?",
    "¿Qué equipo actúa como frontera entre la LAN y la WAN?",
    "¿Por qué la primera y la última dirección de cada subred no se pueden asignar a un equipo?",
    "¿Qué diferencia hay entre lo que muestra ping y lo que muestra tracert?",
    "COMPROBAR LA CONECTIVIDAD DE LA RED",
    "Preparen 1 pregunta técnica genuina",
    "Subred 1 (Ventas): 192.168.20.0/25 — Rango de host: 192.168.20.1 a 192.168.20.126 — Broadcast: 192.168.20.127",
    "Si necesita dividir la red 192.168.20.0/24 en 2 subredes iguales",
    "dejando la primera IP de cada subred para el gateway (router)",
    "Agregue 1 Router (genérico) y 2 Switch 2960",
    "GigabitEthernet0/0 con Ventas, GigabitEthernet0/1 con Administración",
    "verifique que el paquete pasa por el router (1 salto)",
    "Exploracion_Contextual_NombreAprendiz_FICHA.pdf", "MapaMental_Redes_NombreAprendiz_FICHA.pdf",
    "Taller_Subneteo_NombreAprendiz_FICHA.pdf", "Lab_Subredes_Carmen_NombreAprendiz_FICHA.pkt",
    "Lista de chequeo (IE-01)", "Lista de chequeo (IE-02)", "Lista de chequeo (IE-03)",
  ],
  rap03: [
    "¿Cómo puede un negocio darse cuenta si alguien no autorizado está usando su red WiFi?",
    "¿Qué documentos o políticas cree que debería tener un negocio para proteger su red inalámbrica?",
    "Rogue Access Point", "Evil Twin", "Ataque de desautenticación", "Fuerza bruta de contraseña WiFi",
    "¿Por qué el protocolo WEP ya no se considera seguro para ninguna red actual?",
    "¿Qué es “Wi-Fi Enhanced Open” y en qué tipo de red",
    "¿Por qué es importante documentar cuándo fue la última vez que se cambió la contraseña del WiFi?",
    "¿Qué diferencia hay entre una política de seguridad y un simple manual técnico?",
    "Mínimo 6 secciones",
    "Contextualizacion_SeguridadInalambrica_NombreAprendiz_FICHA.pdf",
    "máximo 10 minutos", "Protected Management Frames (PMF), obligatorio en WPA3",
    "Plantilla 1 — Inventario de redes y dispositivos inalámbricos",
    "Plantilla 2 — Registro de políticas de acceso",
    "Plantilla 3 — Registro de auditoría y hallazgos",
    "Plan de respuesta a incidentes", "Extensión mínima: 6 páginas",
    "Protocolo_SeguridadInalambrica_NombreAprendiz_FICHA.pdf",
    "sustentación oral (5–7 minutos)", "Ley 1273 de 2009", "Lista de verificación LC-02", "Rúbrica LC-03",
  ],
};

test("cada partial de grado 11 contiene los enunciados, productos y evidencias del Word oficial", () => {
  for (const [rap, textos] of Object.entries(OFICIAL)) {
    const html = read(GUIAS[rap].partial);
    const faltan = textos.filter((t) => !html.includes(t));
    assert.deepEqual(faltan, [], `${rap}: textos oficiales ausentes`);
  }
});

test("formularios funcionales: cada campo declarado existe una sola vez y cada actividad tiene boton/panel/nota", () => {
  const decl = loadDeclarations();
  for (const g of Object.values(GUIAS)) {
    const html = read(g.partial);
    const cfg = decl[g.file];
    assert.ok(cfg, g.file);
    assert.equal(decl[g.fileB], cfg, "11A y 11B comparten la misma declaracion");
    const stores = [...html.matchAll(/data-store="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(stores).size, stores.length, "data-store duplicado");
    const declarados = new Set();
    for (const a of cfg.activities) {
      assert.match(a.id, /^[A-Za-z][A-Za-z0-9]*$/, "id valido como sufijo de funcion");
      for (const k of (a.formFields || []).concat(a.optionalFields || [])) {
        assert.ok(stores.includes(k), `${a.id}: campo ${k} sin control en el partial`);
        declarados.add(k);
      }
      for (const s of ((a.wordExport || {}).sections || [])) {
        if (s.storeKey) assert.ok(stores.includes(s.storeKey), `${a.id}: seccion Word ${s.storeKey} sin campo`);
      }
      if (a.type === "form" || a.type === "both") {
        assert.ok(a.formFields.length > 0, `${a.id} sin campos`);
        assert.ok(html.includes(`id="${a.buttonIds.save}"`) && html.includes(`actStd_save_${a.id}()`), `${a.id}: boton guardar`);
        assert.ok(html.includes(`id="${a.buttonIds.status}"`), `${a.id}: aviso de estado`);
        assert.ok(html.includes(`actStd_export_${a.id}()`), `${a.id}: exportar a Word`);
        assert.ok(html.includes(`id="${a.id}DeadlineControls"`), `${a.id}: controles de fecha`);
      }
      if (a.type === "file" || a.type === "both") {
        assert.ok(a.driveTarget && a.driveTarget.panelKey && a.driveTarget.allowedExtensions.length, `${a.id}: entrega a Drive`);
        assert.ok(html.includes(`data-act-std-delivery="${a.id}"`), `${a.id}: panel de entrega`);
      }
      assert.ok(html.includes(`id="${a.id}GradeMount"`), `${a.id}: punto de la insignia de nota`);
    }
    assert.deepEqual(stores.filter((s) => !declarados.has(s)), [], "campos sin actividad (no se guardarian ni exportarian)");
    assert.ok(!/\sstyle="/.test(html), "sin estilos inline (ratchet CSP)");
    assert.ok(html.includes("data-act-std-avance") && html.includes("data-redes11-legacy"));
  }
});

test("calificaciones: familia propia por guia, una columna por actividad y mapeo de 11A/11B", () => {
  const mgr = loadGrades();
  const decl = loadDeclarations();
  for (const g of Object.values(GUIAS)) {
    assert.equal(mgr.GUIDE_FAMILY_BY_FILE[g.file], g.family);
    assert.equal(mgr.GUIDE_FAMILY_BY_FILE[g.fileB], g.family);
    const cols = JSON.parse(JSON.stringify(mgr.GRADE_CATALOG[g.family].activities.map((a) => a.id)));
    const acts = decl[g.file].activities.map((a) => a.id);
    assert.deepEqual(cols, acts, "todas las actividades evaluables tienen columna");
  }
  // grado 10 conserva sus familias y columnas
  assert.equal(mgr.GUIDE_FAMILY_BY_FILE["santa-barbara-10a-guia-03-redes-rap02.html"], "guia-redes-rap02");
  assert.equal(mgr.GUIDE_FAMILY_BY_FILE["santa-barbara-10a-guia-04-redes-rap03.html"], "guia-redes-rap03");
  assert.equal(mgr.GRADE_CATALOG["guia-redes-rap02"].activities[0].id, "reflexion311");
});

test("notas anteriores de 11A/11B (familias de grado 10) se ofrecen SOLO para revision manual de esas fichas", () => {
  const mgr = loadGrades();
  assert.deepEqual(JSON.parse(JSON.stringify(mgr.LEGACY_REVIEW_FAMILIES_BY_FICHA)), {
    "3168850": ["guia-redes-rap01", "guia-redes-rap02", "guia-redes-rap03"],
    "3168852": ["guia-redes-rap01", "guia-redes-rap02", "guia-redes-rap03"],
  });
  const admin = read("js/admin_usuarios.js");
  assert.match(admin, /VERSIÓN ANTERIOR \(solo revisión manual\)/);
  assert.match(admin, /LEGACY_REVIEW_FAMILIES_BY_FICHA/);
});

function extractFn(src, signature) {
  const i = src.indexOf(signature);
  assert.ok(i >= 0, signature);
  let depth = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error("sin cierre " + signature);
}

test("banco: los criterios del instructor (__criterios) NUNCA se embeben en la nota del aprendiz", () => {
  const admin = read("js/admin_usuarios.js");
  const ctx = {
    _gradeSolutionsBank: {
      "guia-redes11-rap02": {
        c11Taller331: { g11c_331_e1_cidr: "/25", __criterios: "solo instructor" },
        c11Lab341Solo: { __criterios: "rubrica" },
      },
    },
    getGradeCatalog: () => ({ "guia-redes11-rap02": { activities: [{ id: "c11Taller331" }, { id: "c11Lab341Solo" }] } }),
  };
  // Fase 3 (Codex): en las familias de 11.° el banco ya NO se embebe nunca (solo 📘);
  // para las demas familias se sigue filtrando "__criterios".
  ctx._gradeSolutionsBank["guia-02-herramientas"] = { act: { campo: "modelo", __criterios: "solo instructor" }, soloArchivo: { __criterios: "rubrica" } };
  ctx.window = { activityGradesManager: { isEvidenceStrictFamily: (f) => /^guia-redes11-rap0[123]$/.test(f) } };
  vm.createContext(ctx);
  vm.runInContext(extractFn(admin, "function isEvidenceStrictFamily(") + extractFn(admin, "function lookupBankSolution(") + ";this.lookupBankSolution=lookupBankSolution;", ctx);
  assert.equal(ctx.lookupBankSolution("guia-redes11-rap02", "c11Taller331"), null, "11.°: nunca se embebe");
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.lookupBankSolution("guia-02-herramientas", "act"))), { campo: "modelo" });
  assert.equal(ctx.lookupBankSolution("guia-02-herramientas", "soloArchivo"), null, "actividad de archivo: no embebe nada");
  // y del lado del aprendiz tampoco se aplica una clave __ (defensa en profundidad)
  assert.match(read("js/activity_grades.js"), /if \(isInstructorOnlyBankKey\(storeKey\)\) return;/);
});

test("banco: la importacion conserva familias y respuestas que el archivo no trae (fusion campo a campo)", () => {
  // Fase 3 (Codex): la fusion por FAMILIA (07-nov) se reemplazo por fusion campo a
  // campo con analisis previo, respaldo y escritura condicionada (ver
  // tests/redes_grado11_fase3_evidencia.test.cjs).
  const admin = read("js/admin_usuarios.js");
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(extractFn(admin, "function mergeGradeBanksByField(") + ";this.m=mergeGradeBanksByField;", ctx);
  const out = JSON.parse(JSON.stringify(ctx.m({ "guia-01": { a: { x: "1" } }, "guia-redes11-rap02": { old: { o: "1" } } }, { "guia-redes11-rap02": { nuevo: { y: "2" } } })));
  assert.deepEqual(out, { "guia-01": { a: { x: "1" } }, "guia-redes11-rap02": { old: { o: "1" }, nuevo: { y: "2" } } });
  assert.match(admin, /cloudGetGradeSolutionsVersioned/);
  // el banco nunca se publica en el repositorio
  assert.match(read(".gitignore"), /^grade_solutions_bank\.json$/m);
  for (const g of Object.values(GUIAS)) assert.ok(!read(g.partial).includes("__criterios"));
});

test("preservacion: la version anterior se lista en solo lectura y los ids nuevos no la pisan", () => {
  const src = read("js/script_guia_redes11.js");
  const ctx = { window: {}, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {} } };
  ctx.window.addEventListener = () => {};
  ctx.window.location = { pathname: "/pages/guias/grupo-11a-guia-10-redes-rap02.html" };
  ctx.window.requestAnimationFrame = (f) => f();
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const { LEGACY, legacyEntries } = ctx.window.__redes11Internals;
  const estado = {
    g3r_311_p1: "respuesta vieja", "laboratorio341-locked": true,
    "laboratorio341-delivery": { savedFileName: "Guia10_3.4.1_LabConectividad.pkt" },
    g11c_311_p1: "respuesta nueva", "c11Lab341-locked": true, otra: "x",
  };
  const rows = JSON.parse(JSON.stringify(legacyEntries(estado, LEGACY["guia-redes11-rap02"]).map((r) => r.key)));
  assert.deepEqual(rows, ["g3r_311_p1", "laboratorio341-delivery", "laboratorio341-locked"]);
  // el reinicio NUNCA borra la version anterior ni lo ya enviado
  assert.match(src, /if \(state\[a\.id \+ "-locked"\]\) return;\s+\/\/ lo enviado no se toca/);
  assert.doesNotMatch(src, /state = \{\}/);
  // ids de la version anterior y nuevos son disjuntos
  const decl = loadDeclarations();
  for (const [tpl, legacy] of Object.entries(LEGACY)) {
    const file = GUIAS[tpl.slice(-5)].file;
    const nuevos = decl[file].activities.map((a) => a.id);
    assert.deepEqual(nuevos.filter((id) => legacy.ids.includes(id)), [], tpl);
  }
});

test("el documento de la guia (pageFile/stateKey) es el MISMO: no se pierden respuestas ni entregas", () => {
  const decl = loadDeclarations();
  assert.equal(decl[GUIAS.rap01.file].stateKey, "guia_interactiva_sb_11a_guia09_redes_rap01");
  assert.equal(decl[GUIAS.rap02.file].stateKey, "guia_interactiva_sb_11a_guia10_redes_rap02");
  assert.equal(decl[GUIAS.rap03.file].stateKey, "guia_interactiva_sb_11a_guia11_redes_rap03");
  const w = {};
  new Function("window", read("data/guide_contexts_bundle.js"))(w);
  for (const [key, file] of [["sb11-redes-rap01-11a", GUIAS.rap01.file], ["sb11-redes-rap01-11b", GUIAS.rap01.fileB], ["sb11-redes-rap02-11a", GUIAS.rap02.file], ["sb11-redes-rap02-11b", GUIAS.rap02.fileB], ["sb11-redes-rap03-11a", GUIAS.rap03.file], ["sb11-redes-rap03-11b", GUIAS.rap03.fileB]]) {
    const c = w.__GUIDE_RUNTIME_CONTEXTS__[key];
    assert.equal(c.pageFile, file);
    assert.equal(c.cloudFileName, file, "mismo documento en la nube");
    assert.equal(c.ficha, key.endsWith("11a") ? "3168850" : "3168852", "separacion 11A/11B");
    assert.equal(c.supportTemplate, "guia-redes-rap0" + key.match(/rap0(\d)/)[1]);
    assert.ok(!c.quizRedesUrl && !c.quizIpUrl, `${key}: el Word oficial no incluye quiz`);
  }
  const json = JSON.parse(read("data/guide_contexts.json"));
  // (el bundle trae contextos de otras guias que el JSON no repite: solo se comparan los 4 de grado 11)
  for (const k of ["sb11-redes-rap01-11a", "sb11-redes-rap01-11b", "sb11-redes-rap02-11a", "sb11-redes-rap02-11b", "sb11-redes-rap03-11a", "sb11-redes-rap03-11b"]) {
    assert.deepEqual(json[k], w.__GUIDE_RUNTIME_CONTEXTS__[k], `contexto ${k} igual en json y bundle`);
  }
});

test("rutas y paginas de 11A/11B cargan el script y el bundle de grado 11; grado 10 sigue con los suyos", () => {
  const router = read("js/guia_router.js");
  for (const key of ["11a-guia-9-redes-rap01", "11b-guia-9-redes-rap01", "11a-guia-10-redes-rap02", "11b-guia-10-redes-rap02", "11a-guia-11-redes-rap03", "11b-guia-11-redes-rap03"]) {
    const i = router.indexOf(`"${key}": {`);
    const blk = router.slice(i, router.indexOf("\n    },\n", i));
    assert.match(blk, /template: "guia-redes11-rap0[123]"/);
    assert.match(blk, /"js\/script_guia_redes11\.js\?v=/);
    assert.match(blk, /"partials\/guia-redes11-rap0[123]-bundle\.js\?v=/);
    assert.match(blk, /"js\/guide_cloud_sync\.js\?v=/);
    assert.doesNotMatch(blk, /script_guia_redes(_rap0[23])?\.js|guia-redes-rap0[123]-bundle/);
  }
  for (const g of Object.values(GUIAS)) {
    for (const f of [g.file, g.fileB]) {
      const html = read(`pages/guias/${f}`);
      assert.match(html, /template: "guia-redes11-rap0[123]"/);
      assert.match(html, /js\/script_guia_redes11\.js\?v=/);
      assert.match(html, /js\/guide_cloud_sync\.js\?v=/, `${f}: sin GuideCloudSync no se sincroniza con la nube`);
      assert.match(html, /partials\/guia-redes11-rap0[123]-bundle\.js\?v=/);
    }
  }
  for (const f of ["santa-barbara-10a-guia-03-redes-rap02.html", "grupo-10b-guia-12-redes-rap03.html"]) {
    assert.match(read(`pages/guias/${f}`), /script_guia_redes_rap0[23]\.js/);
  }
});

test("grado 10 sin cambios academicos: partials y scripts de Redes identicos a produccion (8297063)", () => {
  const base = {
    "partials/guia-redes-rap01-content.html": "a4a3eeed00da655d9d063623cf7148324f003205f8b341140ca83b0b865f8f2e",
    "partials/guia-redes-rap02-content.html": "ce940cb3564251801ac120e4fc3e8dfd4f7e2be38ff69269f743cd4a00a3ef68",
    "partials/guia-redes-rap03-content.html": "99b75d9663aac1d802adcb430d5b499817e6e5d3d699329f75c0ad2d60fe2aaa",
    "js/script_guia_redes_rap02.js": "7987d9fa2b36e36ebb1b761f375f4121e9e6681dc1f00e37f1b5e532f168a956",
    "js/script_guia_redes_rap03.js": "ba0eea5fe868fd0b8b506d2c598b92a3190776d10ebac742ea1f035d294e62a2",
    "js/script_guia_redes.js": "ee4b438cded06cb2856ba0fa9a3f33bb1335e0cb5ce55a3fc963b6f3b3d1c1de",
  };
  for (const [f, h] of Object.entries(base)) assert.equal(sha(f), h, f);
});

test("material de apoyo de grado 11 se conserva via supportTemplate", () => {
  assert.match(read("js/guide_support_materials.js"), /groupsFor\(context\.supportTemplate \|\| context\.template, /);
});

// ── Fase 2 (2026-11-08): rediseno visual de las 3 guias ─────────────────────
test("rediseno: Guia 10 Ej. 4 en dos grupos (Subred Ventas / Subred Administracion) con campos IP compactos", () => {
  const html = read(GUIAS.rap02.partial);
  const i = html.indexOf('class="r11-subnets"');
  assert.ok(i > 0, "sin los dos grupos de subred");
  const zona = html.slice(i, html.indexOf("</section>", i));
  const ventas = zona.slice(zona.indexOf("Subred Ventas"), zona.indexOf("Subred Administración"));
  const admin = zona.slice(zona.indexOf("Subred Administración"));
  for (const k of ["gw_ventas", "caja", "venta1", "venta2"]) assert.match(ventas, new RegExp(`class="r11-input r11-input--ip"[^>]*data-store="g11c_331_e4_${k}"`));
  for (const k of ["gw_admin", "gerencia", "contable", "bodega"]) assert.match(admin, new RegExp(`data-store="g11c_331_e4_${k}"`));
});

test("rediseno: zonas de evidencia muestran producto y formatos IGUALES a los que acepta la entrega", () => {
  const decl = loadDeclarations();
  for (const g of Object.values(GUIAS)) {
    const html = read(g.partial);
    for (const a of decl[g.file].activities.filter((x) => x.driveTarget)) {
      const at = html.indexOf(`data-act-std-delivery="${a.id}"`);
      const sec = html.lastIndexOf('<section class="r11-evidence"', at);
      assert.ok(at > 0 && sec > 0 && html.indexOf("</section>", sec) > at, `${a.id}: sin zona de evidencia propia`);
      const m = html.slice(sec, at).match(/data-r11-formats="([^"]*)"/);
      assert.equal(m[1], a.driveTarget.allowedExtensions.join(","), `${a.id}: formatos mostrados != aceptados`);
    }
  }
});

test("rediseno: tarjetas con proposito/producto, botones diferenciados y hoja de estilos solo en grado 11", () => {
  for (const g of Object.values(GUIAS)) {
    const html = read(g.partial);
    assert.ok((html.match(/class="r11-meta"/g) || []).length >= 8, `${g.partial}: tarjetas sin proposito/producto`);
    assert.ok(html.includes("r11-actions"));
  }
  const css = read("css/guia_redes11.css");
  assert.ok(!/^[^\/\s@}][^{]*\{/m.test(css.replace(/\[data-redes11-guide\][^{]*\{/g, "").replace(/@media[^{]*\{/g, "").replace(/^\s*}\s*$/gm, "")), "todo selector acotado a [data-redes11-guide]");
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(read("js/script_guia_redes11.js"), /css\/guia_redes11\.css\?v=/);
});

test("Guia 9: las actividades antiguas extra (bloque E, quizzes, labs 2 y 3, socializacion final) ya no son evaluables", () => {
  const mgr = loadGrades();
  const cols = JSON.parse(JSON.stringify(mgr.GRADE_CATALOG["guia-redes11-rap01"].activities.map((a) => a.id)));
  for (const viejo of ["bloqueE", "quiz-redes-321h", "quiz-redes-33h", "lab2", "lab3", "social"]) assert.ok(!cols.includes(viejo), viejo);
  assert.equal(cols.length, 13);
  assert.ok(cols.includes("b11Lab1Estrella341") && cols.includes("b11TallerIP334"));
});
