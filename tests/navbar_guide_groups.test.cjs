const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const shell = fs.readFileSync(path.join(REPO_ROOT, "js", "shared_shell.js"), "utf8");
const portalAuth = fs.readFileSync(path.join(REPO_ROOT, "js", "portal_auth.js"), "utf8");

test("navbar guide groups each carry a distinct institution+grade key", () => {
  const keys = (shell.match(/data-guide-group-key="([^"]+)"/g) || []).map(
    (m) => m.match(/"([^"]+)"/)[1]
  );
  assert.deepEqual(keys.sort(), ["kennedy-10", "sb-10", "sb-11"]);
});

test("student navbar filter scopes guides to the student's own ficha group", () => {
  // Regresión: las guías compartidas (p. ej. Práctica de Python) están listadas en
  // los tres grupos del navbar. El filtro del aprendiz debe acotar al grupo que
  // coincide con su institución+grado; de lo contrario la misma guía aparece varias
  // veces (incluido un encabezado de "Grado 11" que no corresponde al aprendiz).
  assert.match(shell, /getFichaInfo/);
  assert.match(shell, /getAttribute\("data-guide-group-key"\)/);
  assert.match(shell, /groupMatches/);
});

test("navbar publishes every guide enabled for Kennedy 10", () => {
  const kennedyBlock = portalAuth.match(/"3441939": \{[\s\S]*?\n    \},\n    "3441942": \{[\s\S]*?\n    \},/);
  assert.ok(kennedyBlock, "Kennedy 10 ficha blocks should be present");
  const enabledGuideFiles = new Set(
    (kennedyBlock[0].match(/"([^"]+\.html)"/g) || []).map((item) => item.slice(1, -1))
  );

  for (const fileName of enabledGuideFiles) {
    assert.match(
      shell,
      new RegExp(`data-guide-file="${fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
      `${fileName} is enabled for Kennedy 10 but missing from the shared guide navbar`
    );
  }
});

// ───────────────────────────────────────────────────────────────────────────
// Menu superior REAL (2026-09-23). Hallazgo: las Guias 9/10/11 de Redes de
// 11° (SB 11A/11B) estaban en FICHA_MAP pero NO en el catalogo hardcodeado del
// navbar -- funcionaban por URL y no aparecian en el menu. Estas pruebas
// ejecutan shared_shell.js completo (buildNavbarHtml + updateNavbarSession)
// sobre un DOM minimo, para las 6 fichas y para el instructor: no basta con
// getGuidesForFicha(), que siempre estuvo bien.
// ───────────────────────────────────────────────────────────────────────────
const vm = require("node:vm");
const { createDocument, isRendered } = require("./_mini_dom.cjs");

function makeStorage() {
  const data = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

function bootNavbar(session) {
  const document = createDocument();
  const ctx = {
    document,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    location: { protocol: "https:", hostname: "dubier-sena.github.io", pathname: "/Teleinformaticos-Sena/index.html", href: "https://dubier-sena.github.io/Teleinformaticos-Sena/index.html", search: "" },
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
  vm.runInContext(shell, ctx, { filename: "shared_shell.js" });
  return { ctx, document };
}

function visibleGuideLinks(document) {
  return document
    .querySelectorAll(".app-navbar__drop-link[data-guide-file]")
    .filter(isRendered)
    .map((a) => ({ file: a.getAttribute("data-guide-file"), href: a.getAttribute("href"), label: a.textContent }));
}

const ALL_FICHAS = ["3441939", "3441942", "3441944", "3441950", "3168850", "3168852"];

function fichaMap() {
  return bootNavbar(null).ctx.portalAuth.FICHA_MAP;
}

for (const ficha of ALL_FICHAS) {
  test(`menu superior (aprendiz ${ficha}): muestra exactamente las guias de SU ficha, una vez, con href correcto`, () => {
    const { ctx, document } = bootNavbar({ role: "student", user: { ficha, usernameKey: "prueba", fullName: "Aprendiz Prueba" } });
    const expected = Array.from(ctx.portalAuth.getGuidesForFicha(ficha));
    const links = visibleGuideLinks(document);
    const files = links.map((l) => l.file);

    assert.deepEqual([...files].sort(), [...expected].sort(), `ficha ${ficha}: el menu no coincide con FICHA_MAP`);
    assert.equal(new Set(files).size, files.length, `ficha ${ficha}: guia repetida en el menu`);
    for (const link of links) {
      assert.equal(link.href, "guia.html?g=" + encodeURIComponent(link.file));
    }
    // Ninguna guia de otra ficha (salvo compartidas, p. ej. Python).
    for (const other of ALL_FICHAS.filter((f) => f !== ficha)) {
      for (const foreign of ctx.portalAuth.getGuidesForFicha(other)) {
        if (!expected.includes(foreign)) {
          assert.ok(!files.includes(foreign), `ficha ${ficha} ve ${foreign}, que es de ${other}`);
        }
      }
    }
    // Solo un encabezado de grupo visible (su institucion + grado).
    const headings = document.querySelectorAll(".app-navbar__drop-heading").filter(isRendered);
    assert.equal(headings.length, 1, `ficha ${ficha}: deberia ver un solo grupo`);
  });
}

for (const [ficha, g] of [["3168850", "11a"], ["3168852", "11b"]]) {
  test(`menu superior (aprendiz ${ficha}): Redes de 11° visibles y en orden Guia 8 → Taller → 9 → 10 → 11`, () => {
    const { document } = bootNavbar({ role: "student", user: { ficha, usernameKey: "prueba" } });
    const links = visibleGuideLinks(document);
    const files = links.map((l) => l.file);
    const sequence = [
      `grupo-${g}-guia-08-documentar-gestion-informacion.html`,
      `grupo-${g}-guia-09-taller-integrador.html`,
      `grupo-${g}-guia-09-redes-rap01.html`,
      `grupo-${g}-guia-10-redes-rap02.html`,
      `grupo-${g}-guia-11-redes-rap03.html`,
    ];
    const start = files.indexOf(sequence[0]);
    assert.ok(start >= 0, "falta la Guia 8");
    assert.deepEqual(files.slice(start, start + sequence.length), sequence);
    const G = g.toUpperCase();
    const labels = links.filter((l) => /redes-rap/.test(l.file)).map((l) => l.label);
    assert.deepEqual(labels, [
      `${G} · Guía 9 — Redes RAP01`,
      `${G} · Guía 10 — Redes RAP02`,
      `${G} · Guía 11 — Redes RAP03`,
    ]);
  });
}

test("menu superior (instructor): ve los tres grupos y TODAS las guias de las 6 fichas, incluidas Redes de 11°", () => {
  const { document } = bootNavbar({ role: "admin", user: { username: "dubier", usernameKey: "dubier" } });
  const files = new Set(visibleGuideLinks(document).map((l) => l.file));
  const map = fichaMap();
  for (const ficha of ALL_FICHAS) {
    for (const file of map[ficha].guias) {
      assert.ok(files.has(file), `instructor: falta ${file} (ficha ${ficha})`);
    }
  }
  for (const g of ["11a", "11b"]) {
    for (const f of [`grupo-${g}-guia-09-redes-rap01.html`, `grupo-${g}-guia-10-redes-rap02.html`, `grupo-${g}-guia-11-redes-rap03.html`]) {
      assert.ok(files.has(f), `instructor: falta ${f}`);
    }
  }
  const headings = document.querySelectorAll(".app-navbar__drop-heading").filter(isRendered);
  assert.equal(headings.length, 3);
});

test("todas las guias del menu tienen ruta en guia_router.js (el clic abre una guia real)", () => {
  const router = fs.readFileSync(path.join(REPO_ROOT, "js", "guia_router.js"), "utf8");
  const navFiles = new Set((shell.match(/data-guide-file="([^"]+)"/g) || []).map((m) => m.slice(17, -1)));
  for (const file of navFiles) {
    assert.ok(router.includes(`pageFile: "${file}"`), `${file} esta en el menu pero no en guia_router.js`);
  }
});
