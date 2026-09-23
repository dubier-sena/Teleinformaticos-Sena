const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createDocument, isRendered } = require("./_mini_dom.cjs");

const REPO_ROOT = path.join(__dirname, "..");
const shell = fs.readFileSync(path.join(REPO_ROOT, "js", "shared_shell.js"), "utf8");
const portalAuth = fs.readFileSync(path.join(REPO_ROOT, "js", "portal_auth.js"), "utf8");

// ───────────────────────────────────────────────────────────────────────────
// Menu "Guias" (rediseño 2026-09-23). El menu se GENERA desde FICHA_MAP
// (portal_auth.js) -- antes era una lista manual de 49 enlaces en
// shared_shell.js, y las Guias 9/10/11 de Redes de 11° llegaron a estar en
// FICHA_MAP sin aparecer en el menu. Aprendiz: un solo bloque de su ficha (los
// grupos ajenos NO existen en el DOM; antes se ocultaban y sus bordes quedaban
// como lineas sueltas). Instructor: acordeon por ficha, un grupo abierto a la
// vez. Interaccion solo por clic (sin mouseenter/mouseleave).
// Estas pruebas ejecutan shared_shell.js REAL sobre un DOM minimo.
// ───────────────────────────────────────────────────────────────────────────

function makeStorage() {
  const data = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

function bootNavbar(session, options = {}) {
  const document = createDocument();
  const pathname = options.pathname || "/Teleinformaticos-Sena/index.html";
  const search = options.search || "";
  const ctx = {
    document,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    location: { protocol: "https:", hostname: "dubier-sena.github.io", pathname, href: "https://dubier-sena.github.io" + pathname + search, search },
    navigator: {},
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    addEventListener() {},
    removeEventListener() {},
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(portalAuth, ctx, { filename: "portal_auth.js" });
  ctx.portalAuth.getCurrentSession = () => session;
  if (options.beforeShell) options.beforeShell(ctx.portalAuth);
  vm.runInContext(shell, ctx, { filename: "shared_shell.js" });
  return { ctx, document, panel: document.querySelector("[data-guides-panel]") };
}

const STUDENT = (ficha) => ({ role: "student", user: { ficha, usernameKey: "prueba", fullName: "Aprendiz Prueba" } });
const ADMIN = { role: "admin", user: { username: "dubier", usernameKey: "dubier" } };

const hrefOf = (file) => "guia.html?g=" + encodeURIComponent(file);
const guideLinks = (root) => root.querySelectorAll("a[data-guide-file]");
const linkFiles = (root) => guideLinks(root).map((a) => a.getAttribute("data-guide-file"));
const linkLabels = (root) => guideLinks(root).map((a) => a.textContent);

// Orden visual aprobado por ficha (el ya publicado): identico a FICHA_MAP salvo
// Practica de Python, que va al final. FICHA_MAP NO se reordena.
const EXPECTED = {
  "3441939": {
    heading: "Kennedy · Grado 10 · 10A",
    labels: ["Guía 1 — Inducción", "Guía 2 — Herramientas", "Guía 3 — Planificar", "Guía 4 — Ciberseguridad", "Guía 5 — Documentar la gestión", "Guía 6 — Mantener equipos", "Guía 10 — Redes RAP01", "Guía 11 — Redes RAP02", "Guía 12 — Redes RAP03", "Taller Integrador", "Práctica de Python"],
  },
  "3441942": {
    heading: "Kennedy · Grado 10 · 10B",
    labels: ["Guía 1 — Inducción", "Guía 2 — Herramientas", "Guía 3 — Planificar", "Guía 4 — Ciberseguridad", "Guía 5 — Documentar la gestión", "Guía 6 — Mantener equipos", "Guía 10 — Redes RAP01", "Guía 11 — Redes RAP02", "Guía 12 — Redes RAP03", "Taller Integrador", "Práctica de Python"],
  },
  "3441944": {
    heading: "Santa Bárbara · Grado 10 · 10A",
    labels: ["Guía 1 — Inducción", "Guía 2 — Redes RAP01", "Guía 3 — Redes RAP02", "Guía 4 — Redes RAP03", "Taller Integrador", "Práctica de Python"],
  },
  "3441950": {
    heading: "Santa Bárbara · Grado 10 · 10B",
    labels: ["Guía 1 — Inducción", "Guía 2 — Redes RAP01", "Guía 3 — Redes RAP02", "Guía 4 — Redes RAP03", "Taller Integrador", "Práctica de Python"],
  },
  "3168850": {
    heading: "Santa Bárbara · Grado 11 · 11A",
    labels: ["Guía 5 — Herramientas", "Guía 6 — Implementar componentes", "Guía 7 — Ciberseguridad", "Guía 8 — Documentar la gestión", "Taller Integrador", "Guía 9 — Redes RAP01", "Guía 10 — Redes RAP02", "Guía 11 — Redes RAP03", "Práctica de Python"],
  },
  "3168852": {
    heading: "Santa Bárbara · Grado 11 · 11B",
    labels: ["Guía 5 — Herramientas", "Guía 6 — Implementar componentes", "Guía 7 — Ciberseguridad", "Guía 8 — Documentar la gestión", "Taller Integrador", "Guía 9 — Redes RAP01", "Guía 10 — Redes RAP02", "Guía 11 — Redes RAP03", "Práctica de Python"],
  },
};
// Orden explicito: Object.keys() ordena numericamente las claves de ficha.
const ALL_FICHAS = ["3441939", "3441942", "3441944", "3441950", "3168850", "3168852"];
const PYTHON = "santa-barbara-guia-python.html";
const menuOrder = (files) => files.filter((f) => f !== PYTHON).concat(files.includes(PYTHON) ? [PYTHON] : []);

// ── Fuente de verdad ───────────────────────────────────────────────────────

test("shared_shell.js ya no tiene una lista manual de guias (se genera desde FICHA_MAP)", () => {
  assert.doesNotMatch(shell, /data-guide-file="[^"]+\.html"/, "hay enlaces de guia escritos a mano en shared_shell.js");
  assert.doesNotMatch(shell, /guia\.html\?g=grupo-|guia\.html\?g=santa-barbara-/);
  assert.match(shell, /getGuidesForFicha\(/);
  assert.match(shell, /getGuideHref\(/);
});

test("FICHA_MAP NO se reordeno: Python sigue antes del Taller en Santa Barbara", () => {
  const { ctx } = bootNavbar(null);
  for (const [ficha, taller] of [["3441944", "santa-barbara-10a-guia-04-taller-integrador.html"], ["3168850", "grupo-11a-guia-09-taller-integrador.html"]]) {
    const guias = Array.from(ctx.portalAuth.getGuidesForFicha(ficha));
    assert.ok(guias.indexOf(PYTHON) < guias.indexOf(taller), `FICHA_MAP ${ficha} fue reordenado`);
  }
});

test("todas las guias de FICHA_MAP tienen ruta en guia_router.js (el clic abre una guia real)", () => {
  const router = fs.readFileSync(path.join(REPO_ROOT, "js", "guia_router.js"), "utf8");
  const { ctx } = bootNavbar(null);
  for (const ficha of ALL_FICHAS) {
    for (const file of ctx.portalAuth.getGuidesForFicha(ficha)) {
      assert.ok(router.includes(`pageFile: "${file}"`), `${file} (ficha ${ficha}) no esta en guia_router.js`);
    }
  }
});

test("CSS: sin separadores de los grupos antiguos y el encabezado <p> sin margen por defecto", () => {
  const css = fs.readFileSync(path.join(REPO_ROOT, "css", "shared_shell.css"), "utf8");
  assert.doesNotMatch(css, /\.app-navbar__drop-group/, "quedan reglas de los grupos antiguos (bordes sueltos)");
  const heading = css.match(/\.app-navbar__drop-heading\s*\{([^}]*)\}/);
  assert.ok(heading && /margin:\s*0/.test(heading[1]), "el encabezado es un <p>: necesita margin: 0 (si no, hueco de ~10px)");
});

test("una guia sin nombre corto NO desaparece: usa su titulo oficial", () => {
  const { panel } = bootNavbar(ADMIN, {
    beforeShell(auth) {
      auth.FICHA_MAP["9999999"] = { inst: "Institucion Educativa Santa Barbara", grupo: "12A", guias: ["grupo-12a-guia-20-tema-nuevo.html"] };
      auth.GUIDE_TITLES["grupo-12a-guia-20-tema-nuevo.html"] = "Guía 20 - Tema nuevo de prueba | Grupo 12A";
    },
  });
  const buttons = panel.querySelectorAll("[data-guide-group-toggle]").map((b) => b.textContent.replace("▾", "").trim());
  assert.equal(buttons[buttons.length - 1], "Santa Bárbara · 12A", "una ficha nueva se agrega al final");
  assert.ok(linkLabels(panel).includes("Guía 20 — Tema nuevo de prueba"));
});

// ── Aprendiz: las seis fichas ──────────────────────────────────────────────

for (const ficha of ALL_FICHAS) {
  test(`aprendiz ${ficha}: un solo bloque con exactamente sus guias, en orden, sin restos de otras fichas`, () => {
    const { ctx, panel } = bootNavbar(STUDENT(ficha));
    const expectedFiles = menuOrder(Array.from(ctx.portalAuth.getGuidesForFicha(ficha)));

    // 1, 5. Un unico grupo y NINGUN contenedor ajeno en el DOM (ni oculto).
    assert.equal(panel.children.length, 1, "el panel debe tener un solo hijo");
    assert.equal(panel.querySelectorAll(".app-navbar__guide-student").length, 1);
    assert.equal(panel.querySelectorAll(".app-navbar__guide-group").length, 0);
    assert.equal(panel.querySelectorAll("[data-guide-group-toggle]").length, 0);

    // 2. Encabezado: institucion · grado · grupo.
    const headings = panel.querySelectorAll(".app-navbar__drop-heading");
    assert.equal(headings.length, 1);
    assert.equal(headings[0].textContent, EXPECTED[ficha].heading);

    // 3, 6, 8. Exactamente sus guias, sin duplicados, en el orden aprobado.
    const files = linkFiles(panel);
    assert.deepEqual(files, expectedFiles);
    assert.equal(new Set(files).size, files.length, "guia repetida");
    assert.deepEqual(linkLabels(panel), EXPECTED[ficha].labels);

    // 4. Ningun enlace exclusivo de otra ficha.
    for (const other of ALL_FICHAS.filter((f) => f !== ficha)) {
      for (const foreign of ctx.portalAuth.getGuidesForFicha(other)) {
        if (!expectedFiles.includes(foreign)) assert.ok(!files.includes(foreign), `ve ${foreign}, que es de ${other}`);
      }
    }

    // 7. href oficial.
    for (const a of guideLinks(panel)) {
      assert.equal(a.getAttribute("href"), hrefOf(a.getAttribute("data-guide-file")));
    }

    // 9, 10. Sin prefijos de grupo ni "11A/11B".
    for (const label of linkLabels(panel)) {
      assert.doesNotMatch(label, /\b1[01][AB]\b/, `prefijo de grupo en "${label}"`);
      assert.doesNotMatch(label, /\//, `etiqueta compartida en "${label}"`);
    }
  });
}

test("aprendiz: la guia abierta se marca con aria-current y todo el bloque sigue visible", () => {
  const { panel } = bootNavbar(STUDENT("3168850"), { pathname: "/Teleinformaticos-Sena/guia.html", search: "?g=grupo-11a-guia-10-redes-rap02.html" });
  const current = panel.querySelectorAll('a[aria-current="page"]');
  assert.equal(current.length, 1);
  assert.equal(current[0].getAttribute("data-guide-file"), "grupo-11a-guia-10-redes-rap02.html");
});

test("sin sesion: no se listan guias de ninguna ficha (solo invitacion a iniciar sesion)", () => {
  const { panel } = bootNavbar(null);
  assert.equal(guideLinks(panel).length, 0);
  assert.match(panel.textContent, /Inicia sesión/);
});

test("aprendiz con ficha desconocida: mensaje, sin guias ajenas", () => {
  const { panel } = bootNavbar(STUDENT("0000000"));
  assert.equal(guideLinks(panel).length, 0);
  assert.match(panel.textContent, /No hay guías asignadas/);
});

// ── Instructor: acordeon ───────────────────────────────────────────────────

const GROUP_LABELS = ["Kennedy · 10A", "Kennedy · 10B", "Santa Bárbara · 10A", "Santa Bárbara · 10B", "Santa Bárbara · 11A", "Santa Bárbara · 11B"];

function adminGroups(panel) {
  return panel.querySelectorAll(".app-navbar__guide-group").map((group) => {
    const btn = group.querySelector("[data-guide-group-toggle]");
    const panelEl = group.querySelector(".app-navbar__guide-group-panel");
    return { group, btn, panel: panelEl, label: btn.textContent.replace("▾", "").trim(), ficha: group.getAttribute("data-guide-ficha") };
  });
}
const openLabels = (panel) => adminGroups(panel).filter((g) => !g.panel.hidden).map((g) => g.label);

test("instructor: exactamente seis grupos, en orden, cada uno con SOLO sus guias", () => {
  const { ctx, panel } = bootNavbar(ADMIN);
  const groups = adminGroups(panel);
  assert.deepEqual(groups.map((g) => g.label), GROUP_LABELS);
  assert.equal(panel.querySelectorAll(".app-navbar__drop-heading").length, 0, "sin encabezados sueltos");
  assert.deepEqual(groups.map((g) => g.ficha), ALL_FICHAS);

  const ids = new Set();
  for (const g of groups) {
    assert.equal(g.btn.tagName, "BUTTON");
    assert.equal(g.btn.getAttribute("type"), "button");
    assert.equal(g.btn.getAttribute("aria-expanded"), "false");
    assert.equal(g.btn.getAttribute("aria-controls"), g.panel.id);
    assert.ok(!ids.has(g.panel.id), "id repetido");
    ids.add(g.panel.id);
    assert.equal(g.panel.hidden, true, "empieza cerrado");

    const files = linkFiles(g.panel);
    assert.deepEqual(files, menuOrder(Array.from(ctx.portalAuth.getGuidesForFicha(g.ficha))));
    assert.equal(new Set(files).size, files.length);
    assert.deepEqual(linkLabels(g.panel), EXPECTED[g.ficha].labels);
    for (const a of guideLinks(g.panel)) assert.equal(a.getAttribute("href"), hrefOf(a.getAttribute("data-guide-file")));
  }
  assert.ok(ids.has("app-navbar-guias-santa-barbara-11a") && ids.has("app-navbar-guias-kennedy-10a"));
});

test("instructor: sin role=menu/menuitem en el menu Guias", () => {
  const { document } = bootNavbar(ADMIN);
  const drop = document.querySelector('.app-navbar__drop[data-nav-key="guias"]');
  assert.equal(drop.querySelectorAll("[role]").length, 0);
  assert.equal(drop.querySelector(".app-navbar__drop-btn").getAttribute("aria-controls"), "app-navbar-guias-panel");
  assert.equal(drop.querySelector(".app-navbar__drop-btn").hasAttribute("aria-haspopup"), false);
});

test("instructor: acordeon exclusivo -- 11A y 11B nunca abiertos a la vez", () => {
  const { panel } = bootNavbar(ADMIN);
  const byLabel = Object.fromEntries(adminGroups(panel).map((g) => [g.label, g]));

  byLabel["Kennedy · 10A"].btn.click();
  assert.deepEqual(openLabels(panel), ["Kennedy · 10A"]);

  byLabel["Santa Bárbara · 11A"].btn.click();
  assert.deepEqual(openLabels(panel), ["Santa Bárbara · 11A"]);
  assert.equal(byLabel["Kennedy · 10A"].btn.getAttribute("aria-expanded"), "false");
  assert.equal(byLabel["Santa Bárbara · 11A"].btn.getAttribute("aria-expanded"), "true");

  byLabel["Santa Bárbara · 11B"].btn.click();
  assert.deepEqual(openLabels(panel), ["Santa Bárbara · 11B"]);

  byLabel["Santa Bárbara · 11B"].btn.click();
  assert.deepEqual(openLabels(panel), [], "segundo clic cierra el grupo");

  // Enlaces visibles = solo los del grupo abierto (no se mezclan fichas).
  byLabel["Santa Bárbara · 11A"].btn.click();
  const visible = guideLinks(panel).filter(isRendered).map((a) => a.getAttribute("data-guide-file"));
  assert.ok(visible.length === 9 && visible.every((f) => /^grupo-11a-/.test(f) || f === PYTHON));
});

test("instructor: Python aparece en sus grupos sin etiqueta compartida", () => {
  const { panel } = bootNavbar(ADMIN);
  for (const g of adminGroups(panel)) {
    const labels = linkLabels(g.panel);
    assert.equal(labels[labels.length - 1], "Práctica de Python", g.label);
    for (const label of labels) assert.doesNotMatch(label, /\/|\b1[01][AB]\b/);
  }
});

test("instructor en una guia de UNA sola ficha: ese grupo empieza abierto y marcado", () => {
  const { panel } = bootNavbar(ADMIN, { pathname: "/Teleinformaticos-Sena/guia.html", search: "?g=grupo-11b-guia-09-redes-rap01.html" });
  assert.deepEqual(openLabels(panel), ["Santa Bárbara · 11B"]);
  const current = panel.querySelectorAll('a[aria-current="page"]');
  assert.equal(current.length, 1);
  assert.equal(current[0].getAttribute("data-guide-file"), "grupo-11b-guia-09-redes-rap01.html");
});

test("instructor en pages/guias/<archivo>.html de una sola ficha: tambien lo detecta", () => {
  const { panel } = bootNavbar(ADMIN, { pathname: "/Teleinformaticos-Sena/pages/guias/grupo-10b-guia-06-mantener-equipos.html" });
  assert.deepEqual(openLabels(panel), ["Kennedy · 10B"]);
});

for (const shared of ["grupo-10a-guia-01-induccion.html", PYTHON]) {
  test(`instructor en guia compartida (${shared}): no adivina grupo, todos cerrados y sin aria-current`, () => {
    const { panel } = bootNavbar(ADMIN, { pathname: "/Teleinformaticos-Sena/guia.html", search: "?g=" + shared });
    assert.deepEqual(openLabels(panel), []);
    assert.equal(panel.querySelectorAll('a[aria-current="page"]').length, 0);
  });
}

// ── Interaccion del desplegable principal ──────────────────────────────────

// El mini DOM no propaga eventos: un clic "real" = listeners del elemento + los
// del document con ese target (como haria el burbujeo).
function userClick(document, el) {
  el.dispatch("click");
  document.dispatchEvent({ type: "click", target: el });
}

function drops(document) {
  // "Laboratorios" es un desplegable solo en algunos estados del repo (en
  // produccion es un enlace simple): get() devuelve null si no es desplegable.
  const get = (key) => {
    const drop = document.querySelector(`.app-navbar__drop[data-nav-key="${key}"]`);
    if (!drop) return null;
    return { drop, btn: drop.querySelector(".app-navbar__drop-btn"), isOpen: () => drop.classList.contains("is-open") };
  };
  return { guias: get("guias"), etapa: get("etapa"), lab: get("laboratorio") };
}

test("clic abre Guias, segundo clic cierra, aria-expanded sincronizado", () => {
  const { document } = bootNavbar(STUDENT("3168850"));
  const { guias } = drops(document);
  userClick(document, guias.btn);
  assert.ok(guias.isOpen());
  assert.equal(guias.btn.getAttribute("aria-expanded"), "true");
  userClick(document, guias.btn);
  assert.ok(!guias.isOpen());
  assert.equal(guias.btn.getAttribute("aria-expanded"), "false");
});

test("clic dentro del panel (encabezado / grupo del acordeon) NO cierra; clic fuera si", () => {
  const { document, panel } = bootNavbar(ADMIN);
  const { guias } = drops(document);
  userClick(document, guias.btn);
  userClick(document, panel.querySelector("[data-guide-group-toggle]"));
  assert.ok(guias.isOpen(), "abrir un grupo no debe cerrar el desplegable");
  userClick(document, panel.querySelector(".app-navbar__guide-group-panel"));
  assert.ok(guias.isOpen());
  userClick(document, document.body);
  assert.ok(!guias.isOpen(), "clic fuera cierra");
});

test("Escape cierra y devuelve el foco al boton Guias", () => {
  const { document } = bootNavbar(STUDENT("3441939"));
  const { guias } = drops(document);
  userClick(document, guias.btn);
  document.activeElement = null;
  document.dispatchEvent({ type: "keydown", key: "Escape" });
  assert.ok(!guias.isOpen());
  assert.equal(document.activeElement, guias.btn);
});

test("Escape con todo cerrado no roba el foco", () => {
  const { document } = bootNavbar(STUDENT("3441939"));
  document.activeElement = null;
  document.dispatchEvent({ type: "keydown", key: "Escape" });
  assert.equal(document.activeElement, null);
});

test("abrir cualquier otro desplegable del navbar (Etapa Productiva, ...) cierra Guias", () => {
  const { document } = bootNavbar(ADMIN);
  const d = drops(document);
  const others = document.querySelectorAll(".app-navbar__drop").filter((x) => x !== d.guias.drop);
  assert.ok(others.length >= 1, "al menos Etapa Productiva");
  for (const other of others) {
    userClick(document, d.guias.btn);
    assert.ok(d.guias.isOpen());
    userClick(document, other.querySelector(".app-navbar__drop-btn"));
    assert.ok(!d.guias.isOpen() && other.classList.contains("is-open"), other.getAttribute("data-nav-key"));
    userClick(document, other.querySelector(".app-navbar__drop-btn"));
  }
});

test("Tab fuera del desplegable cierra; foco perdido por clic interno (relatedTarget null) no", () => {
  const { document } = bootNavbar(STUDENT("3441944"));
  const { guias } = drops(document);
  userClick(document, guias.btn);
  guias.drop.dispatch("focusout", { relatedTarget: null });
  assert.ok(guias.isOpen());
  guias.drop.dispatch("focusout", { relatedTarget: guias.drop.querySelector("a") });
  assert.ok(guias.isOpen());
  guias.drop.dispatch("focusout", { relatedTarget: document.body });
  assert.ok(!guias.isOpen());
});

test("sin hover: ningun desplegable tiene listeners mouseenter/mouseleave ni depende del ancho", () => {
  const { document } = bootNavbar(ADMIN);
  for (const drop of document.querySelectorAll(".app-navbar__drop")) {
    assert.equal((drop.listeners.mouseenter || []).length, 0);
    assert.equal((drop.listeners.mouseleave || []).length, 0);
  }
  assert.doesNotMatch(shell, /addEventListener\(\s*["']mouse(enter|leave|over|out)/);
  assert.doesNotMatch(shell, /innerWidth/);
});

test("Etapa Productiva y Laboratorios conservan su contenido", () => {
  const { document } = bootNavbar(ADMIN);
  const d = drops(document);
  assert.deepEqual(d.etapa.drop.querySelectorAll("a").map((a) => a.textContent), ["Panel del instructor", "Mi proyecto"]);
  // Laboratorios: enlace simple o desplegable segun el estado del repo; en
  // ambos casos sigue existiendo y apunta al laboratorio 3D.
  const lab = document.querySelector('[data-nav-key="laboratorio"]');
  assert.ok(lab, "falta Laboratorios");
  const labHrefs = [lab].concat(lab.querySelectorAll("a")).map((a) => a.getAttribute("href") || "");
  assert.ok(labHrefs.some((h) => h.includes("laboratorio-virtual-hardware.html")), "Laboratorios ya no enlaza al laboratorio 3D");
});

// ── Selector de guias del Panel de gestion (index.html) ───────────────────

test("portada: el selector de guias monta el mismo acordeon (no copia el HTML del navbar)", () => {
  const home = fs.readFileSync(path.join(REPO_ROOT, "js", "portal_home.js"), "utf8");
  assert.match(home, /portalGuideNav/);
  assert.doesNotMatch(home, /body\.innerHTML\s*=\s*src\.innerHTML/);

  const { ctx, document } = bootNavbar(ADMIN);
  const box = document.body.appendChild(document.createElement("div"));
  assert.equal(ctx.portalGuideNav.mount(box, "guide-picker"), true);
  const groups = adminGroups(box);
  assert.deepEqual(groups.map((g) => g.label), GROUP_LABELS);
  assert.ok(groups.every((g) => g.panel.id.startsWith("guide-picker-")), "ids propios, sin chocar con el navbar");
  groups[4].btn.click();
  assert.deepEqual(openLabels(box), ["Santa Bárbara · 11A"]);
});
