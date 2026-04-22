const fs = require("fs");
const path = require("path");
const http = require("http");
const assert = require("assert");

const root = path.resolve(__dirname, "..");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function resolvePlaywrightModule() {
  try {
    return require("playwright");
  } catch {}

  const cacheRoot = path.join(process.env.LOCALAPPDATA || "", "npm-cache", "_npx");
  if (!cacheRoot || !fs.existsSync(cacheRoot)) {
    throw new Error("No fue posible resolver Playwright desde node_modules ni desde el cache local de npx.");
  }

  const packageJsonPaths = [];
  for (const entry of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageJsonPath = path.join(cacheRoot, entry.name, "node_modules", "playwright", "package.json");
    if (fs.existsSync(packageJsonPath)) {
      packageJsonPaths.push(packageJsonPath);
    }
  }

  if (!packageJsonPaths.length) {
    throw new Error("No se encontro playwright/package.json dentro del cache local de npx.");
  }

  packageJsonPaths.sort((left, right) => {
    const rightTime = fs.statSync(right).mtimeMs;
    const leftTime = fs.statSync(left).mtimeMs;
    return rightTime - leftTime;
  });

  return require(path.dirname(packageJsonPaths[0]));
}

function createStaticServer() {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    let relativePath = decodeURIComponent(requestUrl.pathname || "/");
    if (relativePath === "/") {
      relativePath = "/index.html";
    }

    const relativeFilePath = path.normalize(relativePath).replace(/^[/\\]+/, "");
    const filePath = path.resolve(root, relativeFilePath);
    if (!filePath.startsWith(root)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, buffer) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        response.end(error.code === "ENOENT" ? "Not found" : "Server error");
        return;
      }

      const extension = path.extname(filePath).toLowerCase();
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(buffer);
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        origin: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const { chromium } = resolvePlaywrightModule();
  const user = {
    username: "quiztester",
    usernameKey: "quiztester",
    fullName: "Aprendiz Quiz Tester",
    ficha: "3441944",
    grupo: "10A",
    inst: "Institucion Educativa Santa Barbara",
    passwordHash: "plain:1234",
    createdAt: "2026-04-21T15:00:00.000Z",
    updatedAt: "2026-04-21T15:00:00.000Z",
  };

  const { server, origin } = await createStaticServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addInitScript(({ seededUser }) => {
    const USERS_KEY = "sena_portal_users_v1";
    const SESSION_KEY = "sena_portal_session_v1";
    const cloudPrefix = "__pw_cloud__:";

    if (!localStorage.getItem(USERS_KEY)) {
      localStorage.setItem(USERS_KEY, JSON.stringify([seededUser]));
    }

    if (!localStorage.getItem(SESSION_KEY)) {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          role: "student",
          usernameKey: seededUser.usernameKey,
          loggedAt: "2026-04-21T15:05:00.000Z",
        })
      );
    }

    localStorage.setItem("sena_ficha", seededUser.ficha);
    localStorage.setItem("sena_grupo", seededUser.grupo);
    localStorage.setItem("sena_inst", seededUser.inst);

    const cloudDb = {
      async cloudGetGuideData(scopeKey, fileName) {
        const raw = localStorage.getItem(`${cloudPrefix}${scopeKey}:${fileName}`);
        return raw ? JSON.parse(raw) : null;
      },
      async cloudSaveGuideData(scopeKey, fileName, snapshot) {
        localStorage.setItem(`${cloudPrefix}${scopeKey}:${fileName}`, JSON.stringify(snapshot));
        return true;
      },
      shouldDeferCloudReads() {
        return false;
      },
    };

    Object.defineProperty(window, "_firebaseDb", {
      configurable: true,
      get() {
        return cloudDb;
      },
      set(value) {
        if (!value || typeof value !== "object") {
          return;
        }
        Object.keys(value).forEach((key) => {
          if (!(key in cloudDb)) {
            cloudDb[key] = value[key];
          }
        });
      },
    });

    window.__pwSetVisibilityState = (value) => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => value,
      });
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => value === "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    };
  }, { seededUser: user });

  const page = await context.newPage();
  const dialogs = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  try {
    await page.goto(`${origin}/santa-barbara-10a-guia-02-redes-rap01.html`, {
      waitUntil: "load",
    });
    await page.waitForSelector("#quizRedesActionLink");

    await page.click("#quizRedesActionLink");
    await page.waitForURL(/redes-rap01-quiz\.html$/);
    await page.waitForSelector("#quizStartBtn");

    await page.click("#quizStartBtn");
    await page.waitForSelector(".redes-quiz-question");

    const variant = (await page.textContent("#quizVariant")).trim();
    assert(["A", "B", "C"].includes(variant), `La variante del quiz debe ser A, B o C. Recibido: ${variant}`);

    const questionCount = await page.locator(".redes-quiz-question").count();
    assert.strictEqual(questionCount, 10, "El quiz debe renderizar 10 preguntas.");

    await page.check('input[name="quiz-q1"][value="0"]');
    await page.check('input[name="quiz-q2"][value="1"]');

    await page.evaluate(() => {
      window.__pwSetVisibilityState("hidden");
    });
    await page.waitForTimeout(1200);

    const warningsAfterFirst = (await page.textContent("#quizWarnings")).trim();
    assert.strictEqual(warningsAfterFirst, "1 / 2", "La primera advertencia debe incrementar el contador a 1 / 2.");

    await page.evaluate(() => {
      window.__pwSetVisibilityState("hidden");
    });
    await page.waitForTimeout(1200);

    const warningsAfterSecond = (await page.textContent("#quizWarnings")).trim();
    assert.strictEqual(warningsAfterSecond, "2 / 2", "La segunda advertencia debe cerrar el quiz con contador 2 / 2.");

    const statusMessage = (await page.textContent("#quizStatus")).trim();
    assert(
      statusMessage.includes("finalizado automaticamente"),
      "El quiz debe indicar que fue finalizado automaticamente tras la segunda advertencia."
    );

    const lockBannerText = (await page.textContent("#quizLockBanner")).trim();
    assert(lockBannerText.includes("Quiz cerrado"), "El quiz debe mostrar el banner de cierre.");

    const storedGuideState = await page.evaluate(() => {
      const guideKey = Object.keys(localStorage).find((key) => key.includes("guia_interactiva_sb_10a_redes_html"));
      const raw = guideKey ? localStorage.getItem(guideKey) : "";
      return raw ? JSON.parse(raw) : null;
    });

    assert(storedGuideState && typeof storedGuideState === "object", "El intento debe guardarse en el estado local de la guia.");
    assert(storedGuideState["quiz-redes-321h"], "El estado local debe incluir la clave quiz-redes-321h.");
    assert.strictEqual(
      storedGuideState["quiz-redes-321h"].status,
      "terminated_visibility",
      "El intento debe guardarse como terminado por visibilidad."
    );
    assert.strictEqual(
      storedGuideState["quiz-redes-321h"].locked,
      true,
      "El intento debe quedar bloqueado tras la segunda advertencia."
    );

    await page.goto(`${origin}/santa-barbara-10a-guia-02-redes-rap01.html`, {
      waitUntil: "load",
    });
    await page.waitForSelector("#quizRedesStatus");
    const guideStatusText = (await page.textContent("#quizRedesStatus")).trim();
    assert(
      guideStatusText.includes("Finalizado por visibilidad"),
      "La guia debe resumir que el quiz fue finalizado por visibilidad."
    );
    assert(
      guideStatusText.includes(`Variante: ${variant}`),
      "La guia debe mostrar la variante asignada del quiz."
    );

    const guideActionText = (await page.textContent("#quizRedesActionLink")).trim();
    assert(
      guideActionText.includes("Ver quiz presentado"),
      "La guia debe cambiar la accion a 'Ver quiz presentado' cuando el intento esta bloqueado."
    );

    await page.evaluate(() => {
      localStorage.setItem(
        "sena_portal_session_v1",
        JSON.stringify({
          role: "admin",
          usernameKey: "dubier",
          loggedAt: "2026-04-21T15:40:00.000Z",
        })
      );
      localStorage.removeItem("sena_ficha");
      localStorage.removeItem("sena_grupo");
      localStorage.removeItem("sena_inst");
    });

    await page.goto(`${origin}/panel-administrativo-usuarios.html`, {
      waitUntil: "load",
    });
    await page.click('[data-tab="actividades"]');
    await page.waitForSelector('button[data-view-redes-quiz="quiztester"]', { timeout: 15000 });

    const adminText = await page.locator("body").textContent();
    assert(
      adminText.includes("Quiz 3.2.1.H - Redes Santa Barbara"),
      "El panel admin debe mostrar la seccion del quiz de redes."
    );
    assert(
      adminText.includes("Aprendiz Quiz Tester"),
      "El panel admin debe listar al aprendiz que presento el quiz."
    );
    assert(
      adminText.includes("Finalizado por visibilidad"),
      "El panel admin debe mostrar el estado finalizado por visibilidad."
    );

    await page.click('button[data-view-redes-quiz="quiztester"]');
    await page.waitForTimeout(500);

    const modalText = await page.locator("body").textContent();
    assert(
      modalText.includes("Evidencia de visibilidad"),
      "El detalle admin debe incluir la evidencia de visibilidad."
    );
    assert(
      modalText.includes(`Variante ${variant}`),
      "El detalle admin debe mostrar la variante del intento."
    );
    assert(
      modalText.includes("Advertencia 1"),
      "El detalle admin debe mostrar al menos la primera advertencia registrada."
    );

    assert.strictEqual(dialogs.length, 2, "La simulacion del quiz debe lanzar exactamente dos alertas.");
    console.log("OK: el quiz de redes completa el flujo E2E local de aprendiz, guia y admin.");
  } finally {
    await browser.close();
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
