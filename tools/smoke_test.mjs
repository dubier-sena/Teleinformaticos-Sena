#!/usr/bin/env node
// tools/smoke_test.mjs
// Fase 15 (CI): smoke test liviano de navegador headless. Abre unas pocas
// paginas representativas y falla si aparece un ReferenceError/TypeError en
// consola, un script 404, o una excepcion no atrapada -- exactamente la
// clase de bug que la suite de Node NO puede ver (la Fase 14 encontro un bug
// real de orden de carga que solo un navegador real detecto).
//
// Sin dependencias nuevas: usa Chrome ya instalado en el runner (Ubuntu
// GitHub-hosted trae google-chrome-stable) via Chrome DevTools Protocol
// crudo (WebSocket nativo de Node, requiere Node 22+), y un servidor
// estatico minimo propio (no depende de .claude/static_server.cjs, que esta
// en .gitignore y no existe en un checkout limpio de CI).
//
// Sesion simulada por localStorage (mismo metodo ya usado en verificaciones
// manuales de fases anteriores): nunca crea una cuenta real de Firebase, no
// toca produccion. Ver CLAUDE.md / memoria de sesion "headless-cdp-real-
// click-testing" para el precedente de esta tecnica.
//
// Uso: node tools/smoke_test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 9091;
const CDP_PORT = 9333;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found: " + urlPath);
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    "google-chrome-stable",
    "google-chrome",
    "chromium-browser",
    "chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", // conveniencia para correrlo a mano en Mac
  ].filter(Boolean);
  return candidates;
}

async function launchChrome() {
  const { execFileSync } = await import("node:child_process");
  const candidates = findChromeBinary();
  let lastError = null;
  for (const bin of candidates) {
    try {
      // No lanza el navegador todavia -- solo confirma que el binario existe
      // y responde a --version, para elegir uno que de verdad este instalado.
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      const proc = spawn(
        bin,
        [
          "--headless=new",
          "--disable-gpu",
          "--no-sandbox",
          "--remote-debugging-port=" + CDP_PORT,
          "--user-data-dir=" + fs.mkdtempSync(path.join(fs.realpathSync(require_os_tmpdir()), "smoke-chrome-")),
        ],
        { stdio: "ignore" }
      );
      return proc;
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error("No se encontro un binario de Chrome/Chromium instalado. Ultimo error: " + (lastError && lastError.message));
}

function require_os_tmpdir() {
  return process.env.TMPDIR || process.env.TEMP || "/tmp";
}

async function waitForCdp(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) return;
    } catch (e) {
      // todavia arrancando
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Chrome no respondio en el puerto de depuracion a tiempo");
}

async function pickTarget() {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
  const list = await res.json();
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("no se encontro un target de tipo 'page'");
  return page;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });
}

function send(ws, method, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => {
      ws.removeEventListener("message", handler);
      reject(new Error("CDP timeout esperando " + method));
    }, timeoutMs);
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        clearTimeout(timer);
        ws.removeEventListener("message", handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

// ── Sesiones simuladas (localStorage) -- nunca toca Firebase real ──────────
const STUDENT_SEED = `
  localStorage.clear();
  var usernameKey = "smoketest.aprendiz";
  localStorage.setItem("sena_portal_users_v1", JSON.stringify([{
    usernameKey: usernameKey, username: usernameKey, fullName: "Smoke Test",
    ficha: "3441939", inst: "", grupo: "",
  }]));
  localStorage.setItem("sena_portal_session_v1", JSON.stringify({
    role: "student", usernameKey: usernameKey, loggedAt: new Date().toISOString(),
  }));
`;
const ADMIN_SEED = `
  localStorage.clear();
  localStorage.setItem("sena_portal_session_v1", JSON.stringify({ role: "admin", loggedAt: new Date().toISOString() }));
`;
const GUEST_SEED = `localStorage.clear();`;

const PAGES = [
  { label: "index.html (invitado)", url: "/index.html", seed: GUEST_SEED },
  { label: "panel-administrativo-usuarios.html (admin simulado)", url: "/panel-administrativo-usuarios.html", seed: ADMIN_SEED },
  { label: "pages/auxiliares/talleres-refuerzo.html (aprendiz simulado)", url: "/pages/auxiliares/talleres-refuerzo.html", seed: STUDENT_SEED },
  {
    label: "guia.html (aprendiz simulado)",
    url: "/guia.html?g=grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    seed: STUDENT_SEED,
  },
  {
    // Bloque G (auditoria 2026-08-31, Prueba A / Guia 4 RAP03): esta pagina
    // depende de window.GuideCloudSync para persistir bloqueos/entregas en
    // Firestore (ver saveState() en script_guia_redes_rap03.js). Si falta
    // <script src="js/guide_cloud_sync.js"> en el HTML, la llamada queda en
    // undefined?.() -- SIN lanzar ningun error de consola ni request fallido,
    // por eso ninguna otra pagina de este smoke test lo habria detectado.
    label: "santa-barbara-10b-guia-04-redes-rap03.html (aprendiz simulado, depende de GuideCloudSync)",
    url: "/pages/guias/santa-barbara-10b-guia-04-redes-rap03.html",
    seed: STUDENT_SEED,
    expectGlobals: ["GuideCloudSync"],
  },
];

async function checkPage(ws, base, { label, url, seed, expectGlobals }) {
  const consoleErrors = [];
  const failedRequests = [];

  const onMessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Runtime.exceptionThrown") {
      const ex = msg.params.exceptionDetails;
      const text = (ex.exception && (ex.exception.description || ex.exception.value)) || ex.text || "excepcion sin descripcion";
      consoleErrors.push(String(text).split("\n")[0]);
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      consoleErrors.push(text);
    } else if (msg.method === "Network.responseReceived") {
      const resp = msg.params.response;
      if (resp.status >= 400 && /\.(js|css)(\?|$)/.test(resp.url)) {
        failedRequests.push(`${resp.status} ${resp.url}`);
      }
    }
  };
  ws.addEventListener("message", onMessage);

  try {
    // Primero se navega para tener el origen real (localStorage no es
    // accesible desde about:blank), se siembra la sesion, y se recarga --
    // asi la pagina arranca ya con ese estado, como en una visita real.
    await send(ws, "Page.navigate", { url: base + url });
    await new Promise((r) => setTimeout(r, 500));
    if (seed) {
      await send(ws, "Runtime.evaluate", { expression: seed, awaitPromise: true });
    }
    await send(ws, "Page.navigate", { url: base + url });
    await new Promise((r) => setTimeout(r, 2500));
  } finally {
    ws.removeEventListener("message", onMessage);
  }

  // Globales que la pagina DEBE exponer tras cargar (p.ej. un modulo cargado
  // por <script>). A diferencia de consoleErrors, esto detecta un script
  // faltante que no lanza ninguna excepcion -- solo deja el global sin
  // definir (ver PAGES arriba para el caso real que motivo esto).
  const missingGlobals = [];
  if (expectGlobals && expectGlobals.length) {
    for (const name of expectGlobals) {
      const result = await send(ws, "Runtime.evaluate", { expression: `typeof window.${name}` });
      const type = result && result.result && result.result.value;
      if (type === "undefined") missingGlobals.push(name);
    }
  }

  return { label, url, consoleErrors, failedRequests, missingGlobals };
}

async function main() {
  console.log("[smoke] iniciando servidor estatico en :" + PORT + " ...");
  const server = await startServer();
  const base = `http://127.0.0.1:${PORT}`;

  console.log("[smoke] lanzando Chrome headless ...");
  const chromeProc = await launchChrome();
  try {
    await waitForCdp(15000);
    const target = await pickTarget();
    const ws = await connect(target.webSocketDebuggerUrl);
    await send(ws, "Runtime.enable");
    await send(ws, "Network.enable");
    await send(ws, "Page.enable");

    const results = [];
    for (const page of PAGES) {
      console.log(`[smoke] visitando: ${page.label}`);
      results.push(await checkPage(ws, base, page));
    }

    ws.close();

    let hasProblems = false;
    console.log("\n=== Resultado del smoke test ===");
    for (const r of results) {
      const problems = r.consoleErrors.length + r.failedRequests.length + r.missingGlobals.length;
      console.log(`\n${r.label} (${r.url}) -> ${problems === 0 ? "OK" : problems + " problema(s)"}`);
      r.consoleErrors.forEach((e) => console.log("  [error consola] " + e));
      r.failedRequests.forEach((e) => console.log("  [request fallido] " + e));
      r.missingGlobals.forEach((g) => console.log(`  [global faltante] window.${g} es undefined tras cargar la pagina`));
      if (problems > 0) hasProblems = true;
    }

    if (hasProblems) {
      console.error("\n[smoke] FALLO: se encontraron errores en al menos una pagina.");
      process.exitCode = 1;
    } else {
      console.log("\n[smoke] OK: todas las paginas cargaron sin errores de consola ni scripts 404.");
    }
  } finally {
    chromeProc.kill();
    server.close();
  }
}

main().catch((err) => {
  console.error("[smoke] ERROR INESPERADO:", err);
  process.exitCode = 1;
});
