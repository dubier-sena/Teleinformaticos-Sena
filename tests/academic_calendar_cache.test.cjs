"use strict";
// Copia local del calendario por ficha (listCached, 2026-10-28): debe ser IDENTICA a la lectura completa,
// mostrar siempre ediciones, sesiones nuevas y cambios de fecha, y no mostrarse nunca tras perder el permiso.
// Firestore simulado en memoria con la semantica que garantizan las reglas candidatas (sin borrados,
// revision +1 por edicion, importadas en 0). Datos ficticios.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const C = require(path.join(__dirname, "..", "js", "academic_calendar_cloud.js"));

const FICHA = "3441939", YEAR = 2030, UID = "demoAprendizFicticio00000001";
const PFX = "/sena_portal_calendar_fichas/" + FICHA + "/years/" + YEAR;

function session(i, over) {
  const date = "2030-03-" + String(1 + (i % 28)).padStart(2, "0");
  return Object.assign({
    id: "legacy_" + String(i).padStart(4, "0"), ficha: FICHA, year: YEAR, date, originalDate: date,
    blocks: [{ start: "07:00", end: "07:55" }], plannedMinutes: 55, actualMinutes: 55, status: "Impartida",
    activity: "Actividad ficticia " + i, evidence: "", dueDate: "",
    curriculum: { id: "", competencyCode: "", competency: "", rap: "", order: "", source: "" },
    sourceStatuses: [{ sourceId: "r" + i, state: "Impartida", blocks: [{ start: "07:00", end: "07:55" }] }],
    origin: "legacy", protected: true, revision: 0, mutationId: "historical-import", updatedBy: "demoAdminFicticio00000000001",
  }, over || {});
}

function fakeFirestore(n) {
  const docs = new Map();
  let clock = 0;
  const put = (d) => docs.set(d.id, { data: JSON.parse(JSON.stringify(d)), updateTime: "2030-12-01T00:00:00." + String(++clock).padStart(6, "0") + "Z" });
  for (let i = 0; i < n; i++) put(session(i));
  const state = { reads: 0, requests: 0, deny: false, offline: false, assignment: { role: "aprendiz", active: true, fichas: [FICHA] } };
  const name = (id) => "projects/demo-sena-calendar/databases/(default)/documents" + PFX + "/sessions/" + id;
  const asDoc = (id) => ({ name: name(id), fields: C.fields(docs.get(id).data), updateTime: docs.get(id).updateTime });
  async function fetch(url, init) {
    state.requests++;
    if (state.offline) throw new TypeError("Failed to fetch");
    const u = new URL(url), p = decodeURIComponent(u.pathname.replace(/^.*\/documents/, ""));
    const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    // 2026-10-28: identidad por perfil existente. Roles: el aprendiz no tiene documento (404).
    if (p.startsWith("/sena_portal_roles/")) { state.reads++; return { ok: false, status: 404, text: async () => JSON.stringify({ error: { status: "NOT_FOUND" } }) }; }
    if (p.startsWith("/sena_portal_users/")) { state.reads++; const a = state.assignment; return ok({ name: "x", fields: C.fields({ usernameKey: "ficticio", ficha: a.fichas[0], validacionNombre: "oficial", active: a.active }), updateTime: "t" }); }
    if (state.deny) return { ok: false, status: 403, text: async () => JSON.stringify({ error: { status: "PERMISSION_DENIED" } }) };
    if (p === PFX + "/sessions" && (!init || init.method === "GET")) {
      const all = [...docs.keys()].sort();
      const size = Number(u.searchParams.get("pageSize")), start = Number(u.searchParams.get("pageToken") || 0);
      const page = all.slice(start, start + size);
      state.reads += Math.max(1, page.length);
      return ok({ documents: page.map(asDoc), nextPageToken: start + size < all.length ? String(start + size) : undefined });
    }
    if (p === PFX + ":runQuery" && init.method === "POST") {
      const q = JSON.parse(init.body).structuredQuery, f = q.where.fieldFilter;
      assert.equal(f.field.fieldPath, "revision"); assert.equal(f.op, "GREATER_THAN");
      const hit = [...docs.keys()].sort().filter((id) => docs.get(id).data.revision > Number(f.value.integerValue));
      state.reads += Math.max(1, hit.length);
      return ok(hit.length ? hit.map((id) => ({ document: asDoc(id), readTime: "t" })) : [{ readTime: "t" }]);
    }
    throw new Error("ruta no simulada " + p);
  }
  const edit = (id, change) => { const d = docs.get(id).data; put(Object.assign({}, d, change, { revision: d.revision + 1, mutationId: "m" + clock })); };
  return { docs, state, fetch, edit, put };
}

function storage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, _m: m };
}
const client = (fs, uid = UID) => C.create({ projectId: "demo-sena-calendar", emulatorHost: "127.0.0.1:9180", enabled: true, fetch: fs.fetch, auth: { getUid: async () => uid, getIdToken: async () => "tok", getUsernameKey: async () => "ficticio", isAdminHint: async () => false } });
const ids = (docs) => docs.map((d) => d.data.id + "@" + d.data.revision + ":" + d.data.date + ":" + d.data.activity);

test("1a apertura completa; 2a solo pide lo modificado y el resultado es IDENTICO a la lectura completa", async () => {
  const f = fakeFirestore(37), st = storage(), c = client(f);
  const first = await c.listCached(FICHA, YEAR, { storage: st });
  assert.equal(first.source, "full"); assert.equal(first.docs.length, 37);
  f.state.reads = 0;
  const second = await c.listCached(FICHA, YEAR, { storage: st });
  assert.equal(second.source, "delta"); assert.equal(second.changed, 0);
  assert.ok(f.state.reads <= 2, "asignación + consulta vacía: " + f.state.reads);
  assert.deepEqual(ids(second.docs), ids((await c.list(FICHA, YEAR)).sort((a, b) => (a.data.id < b.data.id ? -1 : 1))));
});

test("ediciones, cambios de fecha y sesiones nuevas aparecen en la apertura siguiente", async () => {
  const f = fakeFirestore(30), st = storage(), c = client(f);
  await c.listCached(FICHA, YEAR, { storage: st });
  f.edit("legacy_0003", { activity: "Actividad corregida", date: "2030-04-20" });
  f.put(session(99, { id: "draft_nueva", origin: "new", protected: false, sourceStatuses: [], status: "Programada", revision: 1, actualMinutes: null }));
  f.edit("legacy_0003", { evidence: "Informe", dueDate: "2030-04-27" });
  const r = await c.listCached(FICHA, YEAR, { storage: st });
  assert.equal(r.source, "delta"); assert.equal(r.changed, 2);
  const fresh = (await c.list(FICHA, YEAR)).sort((a, b) => (a.data.id < b.data.id ? -1 : 1));
  assert.deepEqual(ids(r.docs), ids(fresh), "igual a la lectura completa");
  const s3 = r.docs.find((d) => d.data.id === "legacy_0003").data;
  assert.equal(s3.date, "2030-04-20"); assert.equal(s3.dueDate, "2030-04-27"); assert.equal(s3.revision, 2);
  assert.ok(r.docs.some((d) => d.data.id === "draft_nueva"));
});

test("incoherencias (revision que retrocede o sesion editada que desaparece) -> lectura completa", async () => {
  const f = fakeFirestore(10), st = storage(), c = client(f);
  f.edit("legacy_0001", { activity: "x" });
  await c.listCached(FICHA, YEAR, { storage: st });
  // edición hecha por fuera de las reglas (consola): revision vuelve a 0
  f.docs.get("legacy_0001").data.revision = 0;
  const r = await c.listCached(FICHA, YEAR, { storage: st });
  assert.equal(r.source, "full");
  assert.equal(r.docs.find((d) => d.data.id === "legacy_0001").data.revision, 0, "se toma lo del servidor");
});

test("permiso revocado (403): la copia se BORRA y no se muestra", async () => {
  const f = fakeFirestore(10), st = storage(), c = client(f);
  await c.listCached(FICHA, YEAR, { storage: st });
  assert.equal([...st._m.keys()].length, 1);
  f.state.deny = true;
  await assert.rejects(() => c.listCached(FICHA, YEAR, { storage: st }), (e) => e.code === "PERMISSION");
  assert.equal([...st._m.keys()].length, 0, "copia eliminada");
});

test("aislamiento: otra cuenta en el mismo navegador no usa la copia ajena", async () => {
  const f = fakeFirestore(12), st = storage();
  await client(f, UID).listCached(FICHA, YEAR, { storage: st });
  f.state.reads = 0;
  const other = await client(f, "demoAprendizFicticio00000002").listCached(FICHA, YEAR, { storage: st });
  assert.equal(other.source, "full");
  const tampered = storage(); await client(f).listCached(FICHA, YEAR, { storage: tampered });
  const k = [...tampered._m.keys()][0]; const v = JSON.parse(tampered._m.get(k)); v.uid = "otro"; tampered._m.set(k, JSON.stringify(v));
  assert.equal((await client(f).listCached(FICHA, YEAR, { storage: tampered })).source, "full", "registro alterado");
});

test("caducidad de 7 dias, fecha futura y «Actualizar» fuerzan la lectura completa", async () => {
  const f = fakeFirestore(8), st = storage(), c = client(f);
  const t0 = Date.parse("2030-12-01T00:00:00Z");
  await c.listCached(FICHA, YEAR, { storage: st, now: () => t0 });
  assert.equal((await c.listCached(FICHA, YEAR, { storage: st, now: () => t0 + 6 * 86400e3 })).source, "delta");
  assert.equal((await c.listCached(FICHA, YEAR, { storage: st, now: () => t0 + 8 * 86400e3 })).source, "full");
  const t1 = t0 + 8 * 86400e3;
  assert.equal((await c.listCached(FICHA, YEAR, { storage: st, now: () => t1 - 3600e3 })).source, "full", "reloj hacia atras");
  assert.equal((await c.listCached(FICHA, YEAR, { storage: st, force: true })).source, "full");
});

test("red caida: nunca devuelve la copia sin verificar (error explicito)", async () => {
  const f = fakeFirestore(8), st = storage(), c = client(f);
  await c.listCached(FICHA, YEAR, { storage: st });
  f.state.offline = true;
  await assert.rejects(() => c.listCached(FICHA, YEAR, { storage: st }));
});

test("cerrar sesion borra todas las copias del calendario y nada mas", async () => {
  const f = fakeFirestore(5), st = storage();
  st.setItem("otra_clave", "1");
  await client(f).listCached(FICHA, YEAR, { storage: st });
  C.clearCache(st);
  assert.deepEqual([...st._m.keys()], ["otra_clave"]);
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "portal_auth.js"), "utf8");
  const i = src.indexOf("auth.logout = async function logoutWithFirebaseBridge");
  assert.match(src.slice(i, i + 900), /academicCalendarCloud[\s\S]{0,120}clearCache\(window\.localStorage\)/);
});

test("la vista del aprendiz usa la copia y «Actualizar» fuerza la lectura completa", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "student_calendar.js"), "utf8");
  assert.match(src, /cloud\.listCached\s*\n?\s*\?\s*await cloud\.listCached\(principal\.fichas\[0\], year, \{storage: window\.localStorage, force: !!forceFull\}\)/);
  assert.match(src, /btnReload\.addEventListener\("click", function \(\) \{ loadAndRender\(true\); \}\)/);
});

test("traslado de ficha: la copia de la ficha anterior se borra y la nueva se lee completa", async () => {
  const f = fakeFirestore(10), st = storage(), c = client(f);
  await c.listCached(FICHA, YEAR, { storage: st });
  assert.equal([...st._m.keys()].filter((k) => k.includes(":" + FICHA + ":")).length, 1);
  f.state.assignment = { role: "aprendiz", active: true, fichas: ["3441942"] };
  await assert.rejects(() => c.listCached(FICHA, YEAR, { storage: st }), (e) => e.code === "PERMISSION", "la ficha anterior ya no está autorizada");
  assert.equal([...st._m.keys()].filter((k) => k.includes(":" + FICHA + ":")).length, 0, "copia de la ficha anterior eliminada");
});

test("asignación desactivada: se borran todas las copias de la cuenta y no se muestra nada", async () => {
  const f = fakeFirestore(10), st = storage(), c = client(f);
  st.setItem("sena_calendar_cache_v1:demo-sena-calendar:otraCuentaFicticia000000001:3441939:2030", "{}");
  await c.listCached(FICHA, YEAR, { storage: st });
  f.state.assignment = { role: "aprendiz", active: false, fichas: [FICHA] };
  await assert.rejects(() => c.listCached(FICHA, YEAR, { storage: st }), (e) => e.code === "PERMISSION");
  assert.deepEqual([...st._m.keys()], ["sena_calendar_cache_v1:demo-sena-calendar:otraCuentaFicticia000000001:3441939:2030"], "solo se borran las de esta cuenta");
});

test("frescura: cada edición del instructor se ve en la apertura inmediatamente siguiente (10 rondas)", async () => {
  const f = fakeFirestore(20), st = storage(), c = client(f);
  await c.listCached(FICHA, YEAR, { storage: st });
  for (let k = 1; k <= 10; k++) {
    const id = "legacy_" + String(k % 20).padStart(4, "0");
    f.edit(id, { activity: "Ronda " + k, dueDate: "2030-05-" + String(k).padStart(2, "0") });
    const r = await c.listCached(FICHA, YEAR, { storage: st });
    assert.equal(r.docs.find((d) => d.data.id === id).data.activity, "Ronda " + k);
    assert.deepEqual(ids(r.docs), ids((await c.list(FICHA, YEAR)).sort((a, b) => (a.data.id < b.data.id ? -1 : 1))));
  }
});
