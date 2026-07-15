const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(REPO_ROOT, fileName), "utf8");
}

test("guia.html is the single public guide entry point", () => {
  const html = read("guia.html");

  assert.match(html, /<div id="page-root"><\/div>/);
  assert.match(html, /js\/guia_router\.js/);
  assert.doesNotMatch(html, /window\.__PAGE_CONTEXT__\s*=/);
});

test("guide router maps every current guide to its real storage and access file", () => {
  const router = read(path.join("js", "guia_router.js"));
  const expectedFiles = [
    "grupo-10a-guia-01-induccion.html",
    "grupo-10b-guia-01-induccion.html",
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
    "grupo-11a-guia-06-planificar-informacion.html",
    "grupo-11b-guia-06-planificar-informacion.html",
    "santa-barbara-10a-guia-02-redes-rap01.html",
    "santa-barbara-10b-guia-02-redes-rap01.html",
  ];

  for (const fileName of expectedFiles) {
    assert.match(router, new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(router, /window\.__RUNTIME_PAGE_FILE__\s*=/);
  assert.match(router, /window\.__PAGE_CONTEXT__\s*=/);
  assert.match(router, /routePageFile:\s*"guia\.html"/);
});

test("runtime loaders and guide scripts honor the routed guide file", () => {
  assert.match(read(path.join("js", "page_runtime_loader.js")), /runtimeRequest\.routePageFile/);
  assert.match(read(path.join("js", "guia_template.js")), /__RUNTIME_PAGE_FILE__/);
  assert.match(read(path.join("js", "script_induccion.js")), /__RUNTIME_PAGE_FILE__/);
  assert.match(read(path.join("js", "script_guia2.js")), /__RUNTIME_PAGE_FILE__/);
  assert.match(read(path.join("js", "script.js")), /__RUNTIME_PAGE_FILE__/);
  assert.match(read(path.join("js", "script_guia6.js")), /__RUNTIME_PAGE_FILE__/);
  assert.match(read(path.join("js", "script_guia_redes.js")), /__RUNTIME_PAGE_FILE__/);
});

test("induction partial can run inside guia.html without global name collisions", () => {
  const partial = read(path.join("partials", "guia-01-induccion-content.html"));
  const bundle = read(path.join("partials", "guia-01-induccion-bundle.js"));

  assert.match(partial, /window\.__RUNTIME_PAGE_FILE__/);
  assert.match(partial, /induccionPortalAuth/);
  assert.doesNotMatch(partial, /\b(?:let|const)\s+portalAuth\b/);
  assert.match(bundle, /__RUNTIME_PAGE_FILE__/);
  assert.match(bundle, /induccionPortalAuth/);
});

test("every guide route loads activity_grades.js before guia_template.js", () => {
  // Regresion real (jul-8): activity_grades.js faltaba en TODAS las rutas, asi
  // que los badges de Aprobado/No aprobado y las notas del admin nunca llegaban
  // a renderizarse via guia.html?g=... (el unico entry point publico real) --
  // fallaba en silencio, sin error visible, para cualquier guia/aprendiz.
  const router = read(path.join("js", "guia_router.js"));
  const routeBlocks = [...router.matchAll(/key:\s*"([^"]+)"[\s\S]*?scripts:\s*\[([\s\S]*?)\]/g)];

  assert.ok(routeBlocks.length > 0, "deberia encontrar al menos una ruta con scripts[]");

  routeBlocks.forEach(([, routeKey, scriptsBlock]) => {
    const gradesIndex = scriptsBlock.indexOf("activity_grades.js");
    const plansIndex = scriptsBlock.indexOf("improvement_plans.js");
    const templateIndex = scriptsBlock.indexOf("guia_template.js");
    assert.ok(gradesIndex !== -1, `ruta "${routeKey}" no carga activity_grades.js`);
    assert.ok(plansIndex !== -1, `ruta "${routeKey}" no carga improvement_plans.js`);
    assert.ok(templateIndex !== -1, `ruta "${routeKey}" no carga guia_template.js`);
    assert.ok(
      gradesIndex < templateIndex,
      `ruta "${routeKey}" debe cargar activity_grades.js ANTES de guia_template.js`
    );
  });
});

test("every direct guide shell loads activity_grades.js and improvement_plans.js", () => {
  // Regresion real (jul-15): 7 shells directos en pages/guias/ (guia 3 de 10A/10B,
  // taller integrador 10A/10B, guia 7 de 11A/11B, guia Python) no cargaban ninguno
  // de los dos scripts, asi que un aprendiz que entrara directo al shell (marcador
  // o enlace guardado, sin pasar por guia.html?g=...) no veia badges de nota ni el
  // banner de plan de mejoramiento.
  const shellsDir = path.join(REPO_ROOT, "pages", "guias");
  const shells = fs.readdirSync(shellsDir).filter((name) => name.endsWith(".html"));

  assert.ok(shells.length > 0, "deberia haber shells en pages/guias/");

  shells.forEach((fileName) => {
    const html = fs.readFileSync(path.join(shellsDir, fileName), "utf8");
    const gradesIndex = html.indexOf("activity_grades.js");
    const plansIndex = html.indexOf("improvement_plans.js");
    const templateIndex = html.indexOf("guia_template.js");
    assert.ok(gradesIndex !== -1, `shell "${fileName}" no carga activity_grades.js`);
    assert.ok(plansIndex !== -1, `shell "${fileName}" no carga improvement_plans.js`);
    if (templateIndex !== -1) {
      assert.ok(
        gradesIndex < templateIndex,
        `shell "${fileName}" debe cargar activity_grades.js ANTES de guia_template.js`
      );
    }
  });
});

test("shared shell can initialize after dynamic route scripts load", () => {
  const shell = read(path.join("js", "shared_shell.js"));

  assert.match(shell, /window\.initSharedShell\s*=/);
  assert.match(shell, /document\.readyState === "loading"/);
  assert.match(shell, /sharedShellBooted/);
});
