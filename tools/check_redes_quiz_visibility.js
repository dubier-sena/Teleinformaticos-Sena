const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const guideContexts = JSON.parse(read(path.join("data", "guide_contexts.json")));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function expectIncludes(source, snippet, message) {
  assert(source.includes(snippet), `${message}\nEsperado: ${snippet}`);
}

const sharedGuide = read(path.join("partials", "guia-redes-rap01-content.html"));
const quiz10A = read(path.join("pages", "auxiliares", "santa-barbara-10a-guia-02-redes-rap01-quiz.html"));
const quiz10B = read(path.join("pages", "auxiliares", "santa-barbara-10b-guia-02-redes-rap01-quiz.html"));
const quizJs = read(path.join("js", "script_redes_quiz.js"));
const bankJs = read(path.join("js", "redes_quiz_bank.js"));
const guideScript = read(path.join("js", "script_guia_redes.js"));

for (const [label, href] of [
  ["10A", "pages/auxiliares/santa-barbara-10a-guia-02-redes-rap01-quiz.html"],
  ["10B", "pages/auxiliares/santa-barbara-10b-guia-02-redes-rap01-quiz.html"],
]) {
  expectIncludes(
    sharedGuide,
    '<span class="activity-num">3.2.1.H</span>',
    `La guia compartida ${label} debe agregar la actividad 3.2.1.H para el quiz de redes.`
  );
  expectIncludes(
    sharedGuide,
    "Quiz individual de fundamentos de redes",
    `La guia compartida ${label} debe mostrar el titulo del quiz individual de redes.`
  );
  expectIncludes(
    sharedGuide,
    'id="quizRedesStatus"',
    `La guia compartida ${label} debe mostrar un resumen del estado del quiz en la misma actividad.`
  );
  expectIncludes(
    sharedGuide,
    'id="quizRedesActionLink"',
    `La guia compartida ${label} debe exponer el enlace de accion del quiz para actualizar su etiqueta segun el estado.`
  );
  expectIncludes(
    JSON.stringify(guideContexts),
    href,
    `El contexto runtime ${label} debe enlazar a la pagina independiente del quiz.`
  );
}

for (const [label, quizHtml, ficha, cloudFile] of [
  ["10A", quiz10A, 'data-quiz-ficha="3441944"', 'data-quiz-cloud-file="sb_10a_redes.html"'],
  ["10B", quiz10B, 'data-quiz-ficha="3441950"', 'data-quiz-cloud-file="sb_10b_redes.html"'],
]) {
  expectIncludes(
    quizHtml,
    "Iniciar quiz",
    `La pagina del quiz ${label} debe incluir el boton de inicio del intento.`
  );
  expectIncludes(
    quizHtml,
    "2 advertencias por cambio de pestana",
    `La pagina del quiz ${label} debe advertir la regla de Page Visibility API.`
  );
  expectIncludes(
    quizHtml,
    ficha,
    `La pagina del quiz ${label} debe declarar la ficha del grupo en atributos de configuracion.`
  );
  expectIncludes(
    quizHtml,
    cloudFile,
    `La pagina del quiz ${label} debe declarar el archivo cloud de redes que reutiliza.`
  );
  assert(
    !quizHtml.includes("data-correct"),
    `La pagina del quiz ${label} no debe exponer respuestas correctas en atributos HTML.`
  );
  assert(
    !quizHtml.includes("Topologia en estrella facilita agregar equipos"),
    `La pagina del quiz ${label} no debe incrustar contenido de respuestas en el HTML.`
  );
}

expectIncludes(
  bankJs,
  "window.REDES_QUIZ_VARIANTS = {",
  "El banco del quiz debe definir las variantes compartidas fuera del HTML."
);
expectIncludes(
  bankJs,
  "A:",
  "El banco del quiz debe incluir la variante A."
);
expectIncludes(
  bankJs,
  "B:",
  "El banco del quiz debe incluir la variante B."
);
expectIncludes(
  bankJs,
  "C:",
  "El banco del quiz debe incluir la variante C."
);

expectIncludes(
  quizJs,
  'const QUIZ_STORAGE_KEY = String(body.dataset.quizStorageKey || "quiz-redes-321h").trim();',
  "El controlador del quiz debe usar una clave estable para el intento."
);
expectIncludes(
  quizJs,
  'document.addEventListener("visibilitychange"',
  "El controlador del quiz debe registrar el listener de Page Visibility API."
);
expectIncludes(
  quizJs,
  "attempt.warningCount >= 2",
  "El controlador del quiz debe terminar el intento en la segunda advertencia."
);
expectIncludes(
  quizJs,
  "chooseRandomVariant",
  "El controlador del quiz debe elegir una variante al azar."
);
expectIncludes(
  quizJs,
  "window._firebaseDb.cloudSaveGuideData",
  "El controlador del quiz debe guardar el intento en el mismo snapshot cloud de redes."
);
expectIncludes(
  guideScript,
  "Quiz individual de fundamentos de redes (3.2.1.H).",
  "La tabla de evidencias de la guia debe incluir el nuevo quiz individual de redes."
);
expectIncludes(
  guideScript,
  "Resultado registrado en plataforma con puntaje sobre 100 y evidencia de advertencias por cambio de pestana.",
  "La evidencia del quiz debe describir el registro de puntaje y advertencias."
);
expectIncludes(
  guideScript,
  "renderQuizRedesStatus",
  "La guia de redes debe renderizar el estado resumido del quiz 3.2.1.H."
);

console.log("OK: el quiz de redes usa variante aleatoria, Page Visibility API y contenido fuera del HTML.");
