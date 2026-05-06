const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(REPO_ROOT, fileName), "utf8");
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    },
    get length() {
      return store.size;
    },
  };
}

function loadPortalAuth() {
  const localStorage = createLocalStorage();
  const sandbox = {
    URL,
    AbortController,
    TextEncoder,
    Uint8Array,
    console,
    fetch: async () => {
      throw new Error("fetch should not be called in this test");
    },
    localStorage,
    window: {
      localStorage,
      location: {
        protocol: "file:",
        hostname: "",
        origin: "file://",
        replace() {},
      },
      TextEncoder,
      crypto: null,
      setTimeout() {
        return 0;
      },
      clearTimeout() {},
    },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.fetch = sandbox.fetch;
  sandbox.window.AbortController = AbortController;
  vm.runInNewContext(read(path.join("js", "portal_auth.js")), sandbox, {
    filename: "portal_auth.js",
  });
  return { auth: sandbox.window.portalAuth, localStorage };
}

test("portal auth keeps guide titles in a single source block", () => {
  const source = read(path.join("js", "portal_auth.js"));

  assert.doesNotMatch(
    source,
    /Object\.assign\s*\(\s*GUIDE_TITLES/,
    "GUIDE_TITLES should not be redeclared through a second Object.assign block"
  );
});

test("portal auth expires old local sessions and clears them", () => {
  const { auth, localStorage } = loadPortalAuth();
  localStorage.setItem(
    "sena_portal_session_v1",
    JSON.stringify({
      role: "admin",
      token: "stale-token",
      loggedAt: "2000-01-01T00:00:00.000Z",
    })
  );

  assert.equal(auth.getCurrentSession(), null);
  assert.equal(localStorage.getItem("sena_portal_session_v1"), null);
});

test("portal auth rejects short passwords for registration and admin resets", async () => {
  const { auth, localStorage } = loadPortalAuth();
  const shortPassword = Array.from({ length: 5 }, (_item, index) => String(index)).join("");
  const registration = await auth.registerStudent({
    fullName: "Aprendiz Seguro",
    username: "aprendiz.seguro",
    ficha: "3441939",
    password: shortPassword,
  });

  assert.equal(registration.ok, false);
  assert.match(registration.message, /6 caracteres/i);

  localStorage.setItem(
    "sena_portal_session_v1",
    JSON.stringify({
      role: "admin",
      token: "admin-token",
      loggedAt: new Date().toISOString(),
    })
  );

  const reset = await auth.updateStudentPassword("aprendiz.seguro", shortPassword);
  assert.equal(reset.ok, false);
  assert.match(reset.message, /6 caracteres/i);
});

test("portal auth preserves the academic identity fields for real auth migration", async () => {
  const { auth } = loadPortalAuth();
  const validPassword = Array.from({ length: 6 }, (_item, index) => String(index)).join("");
  const selection = auth.getSelectionForFicha("3441944");

  assert.equal(selection.inst, "Institucion Educativa Santa Barbara");
  assert.equal(selection.ficha, "3441944");
  assert.equal(selection.grado, "10");
  assert.equal(selection.grupo, "10A");

  const registration = await auth.registerStudent({
    fullName: "Aprendiz Identidad Completa",
    username: "aprendiz.identidad",
    ficha: "3441944",
    password: validPassword,
  });

  assert.equal(registration.ok, true);
  assert.equal(registration.user.fullName, "Aprendiz Identidad Completa");
  assert.equal(registration.user.ficha, "3441944");
  assert.equal(registration.user.inst, "Institucion Educativa Santa Barbara");
  assert.equal(registration.user.grado, "10");
  assert.equal(registration.user.grupo, "10A");
});
