#!/usr/bin/env node
"use strict";

const fs = require("fs");
const https = require("https");
const path = require("path");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "sena-portal";
const API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyC0zKUJGVcT0aYcujZyrRBtsbVo1VjBkAA";
const AUTH_TOKEN = process.env.FIREBASE_AUTH_TOKEN || "";
const COLLECTION = "sena_portal_users";
const FUENTE = "Listado oficial de fichas SENA";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const FICHA_META = {
  "3441939": { inst: "Institucion Educativa Jhon F. Kennedy", grupo: "10A", grado: "10" },
  "3441942": { inst: "Institucion Educativa Jhon F. Kennedy", grupo: "10B", grado: "10" },
  "3441944": { inst: "Institucion Educativa Santa Barbara", grupo: "10A", grado: "10" },
  "3441950": { inst: "Institucion Educativa Santa Barbara", grupo: "10B", grado: "10" },
  "3168850": { inst: "Institucion Educativa Santa Barbara", grupo: "11A", grado: "11" },
  "3168852": { inst: "Institucion Educativa Santa Barbara", grupo: "11B", grado: "11" },
};

const OFFICIAL_ROSTERS = {
  "3441939": [
    "ARCINIEGAS OCAMPO JOHAN SNEIDER",
    "AVILA LAVERDE DANA SOFIA",
    "BONILLA VARGAS JHUPSON STIWAR",
    "DIAZ DIAZ ANGIE SOFIA",
    "DIAZ OQUENDO MARIA FERNANDA",
    "FARFAN ARAGON EDGAR SMIT",
    "GOMEZ PRADA NICOL DAYANA",
    "GUTIERREZ ANGEL DANIELA",
    "ISIS MARIANA HERNANDEZ RONDON",
    "MAHECHA FLOREZ SHAIAN MICHEL",
    "MORENO GUIZA BLEIDY MARIED",
    "MUÑOZ MAHECHA NICOL DAYANNA",
    "OROZCO QUINTERO LUISA FERNANDA",
    "QUINTERO SUAREZ JARRISON STIVEN",
    "RESTREPO GUTIERREZ KAREN DAYANA",
    "RIAÑO BERJAN SEBASTIAN",
    "RIANO ROJAS KLEIN MATEO",
    "SANCHEZ HERNANDEZ JHON EDWIN",
    "SUAREZ AMARIS ANAHI SHADAI",
    "ZARATE ORJUELA JESUS JAVIER",
  ],
  "3441942": [
    "ACOSTA ROJAS SARA JIZETH",
    "AGUILAR ACOSTA DARLY BANESSA",
    "ALVAREZ SANCHEZ EIMY DAHIANA",
    "ARCINIEGAS BUSTOS EYLIN KATALINA",
    "ARENAS PERDOMO EMANUEL",
    "BETANCOURT TRILLOS DANNA VALENTINA",
    "CARDONA SALAZAR ANGIE VALENTINA",
    "CARDOZO PARRA SHARY LORENA",
    "CASTELLANOS HINCAPIE ALISSON SOFIA",
    "CEBALLOS GUZMAN SARA VALENTINA",
    "CRUZ CARDONA JULIAN SANTIAGO",
    "CUBILLOS HERNANDEZ MAIRA ALEJANDRA",
    "GOMEZ RESTREPO LIZETH JOHANA",
    "LAGUNA ROLDAN SAHIAN STACY",
    "MARTELO SANCHEZ SANTIAGO RAFAEL",
    "MENDEZ ORTIZ ANGEL SANTIAGO",
    "OSPINA BERNAL SANTIAGO",
    "RAMOS PIRACOA JOHAN SMITH",
    "RUBIANO MURCIA ROBINSON YANDIEL",
    "VELEZ VERGARA JOHAN ESTEBAN",
  ],
  "3441944": [
    "BELTRAN PINILLA JHON DEIBY",
    "CORREDOR BERNAL ASHLIE SOFIA",
    "FRANCO PORRAS JHON ALEXANDER",
    "GARCIA RODRIGUEZ JOHANNA LIZETH",
    "HERNANDEZ GUERRERO ZAIRA CAMILA",
    "MONTAÑA LEYNOR EMMANUEL",
    "MURCIA GUERRERO LAURA ESTEFANIA",
    "MURCIA RAMOS MARLY YULIANA",
    "ORJUELA RODRIGUEZ YINA PAOLA",
    "ORTIZ LANCHEROS CRISTIAN SAUL",
    "ORTIZ RODRIGUEZ BRAYAN ESNEYDER",
    "ORTIZ SANABRIA SARA YINETH",
    "ORTIZ SANABRIA YERID ADRIANA",
    "PINZON ROMERO ADRIAN NICOLAS",
    "PIÑEROS PINILLA JAIDER ALEJANDRO",
    "RODRIGUEZ COCA YANEY GERMAYORI",
    "RODRIGUEZ PINSON JUAN DAVID",
    "SERRATO MATAMOROS EMANUEL SANTIAGO",
    "VARGAS TORRES BRIYITH LIZETH",
    "VILLAMIL CUELLAR LICETH FERNANDA",
  ],
  "3441950": [
    "ARIAS ADAN JOSE DAVID",
    "CANDELA AGUIRRE ZAHIRA MARIANA",
    "CARRANZA MURILLO JULIAN ARBEY",
    "CASTILLO CORDOBA LAURA VALENTINA",
    "CASTRO MOZO NICOLAS ALEJANDRO",
    "CASTRO OSORIO ALLISON DANIELA",
    "CHALA HUEPENDO YURANY",
    "DELGADILLO PINILLA VANIA BRYGITH",
    "ESCARRAGA SASTRE LENIS",
    "HERNANDEZ AVENDAÑO AYLIN TEHANI",
    "MARTINEZ SANCHEZ KAROLL SOFIA",
    "MURILLO LOPEZ ZAIRA ALEJANDRA",
    "NEIZA GARCIA KEVIN SAMUEL",
    "PAEZ ESPITIA JOHAN ESTIBEN",
    "SALAZAR VIRGUEZ LUISA FERNANDA",
    "SANCHEZ RIVERA YEINER JULIAN",
    "TORRES LOPEZ MARIA PAULA",
    "TRIANA CRUZ YESICA NATALIA",
    "VASCO HERRERA JUAN MANUEL",
  ],
  "3168850": [
    "BRAVO MARTINEZ LAURA DANIELA",
    "CARANTON MENDIETA NICOLAS ANDRES",
    "CORREDOR HERNANDEZ IVAN SANTIAGO",
    "ECHEVERRI RESTREPO MARIA JOSE",
    "FORERO MURILLO GISELLE SOFIA",
    "FORERO SIERRA LUNA GABRIELA",
    "GOMEZ MARTINEZ DANNA VALERIA",
    "GUERRERO PERILLA HEIDY TATIANA",
    "HERNANDEZ RAMIREZ LINA MARCELA",
    "HERNANDEZ REYES DUBAN ESNEIDER",
    "LANCHEROS RUEDA DANA SOFIA",
    "MONROY LANCHEROS KEVIN SANTIAGO",
    "PINEDA SALAS MARCOS DYLLIAM MARCELO",
    "RODRIGUEZ RODRIGUEZ HEYNAR EMANUEL",
    "RUIZ HERNANDEZ DIDIER ORLANDO",
    "SANTANA GONZALEZ GABRIELA",
    "SIERRA PORRAS CHARIT LORENA",
  ],
  "3168852": [
    "BONILLA CIFUENTES DIOMEDES",
    "AVILA SANCHEZ MICHELL SOFIA",
    "AVILA SANCHEZ NELLY LITZE",
    "BARRERA FONSECA LUIS MIGUEL",
    "BELTRAN CAÑON LUISA FERNANDA",
    "CAÑON PINILLA LAURA ZARICK",
    "CAÑON PUENTES LINA FERNANDA",
    "CARVAJAL CRUZ JARELIN ZARAY",
    "CASTELLANOS HENAO MAURENN SOFIA",
    "GAMBOA JIMENEZ ADRIAN CAMILO",
    "GONZALEZ CASTELLANOS JUAN DAVID",
    "MAHECHA GALLO ALISON ELIANA",
    "MOSCOSO CAMACHO KEVIN ALEJANDRO",
    "ORJUELA LOPEZ JULIAN DAVID",
    "SIERRA ORTEGA EYLLEL SOFIA",
    "SUAREZ REINA MAICOL STIVEN",
    "VANEGAS DEL PORTILLO JANIER STIVEN",
  ],
};

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ñ/g, "N")
    .replace(/ñ/g, "n")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeCompact(value) {
  return normalizeName(value).replace(/\s+/g, "");
}

function normalizeUsername(value) {
  return normalizeName(value).toLowerCase().replace(/\s+/g, ".");
}

function tokens(value) {
  return normalizeName(value).split(" ").filter(Boolean);
}

function levenshtein(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  const matrix = Array.from({ length: left.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= right.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[left.length][right.length];
}

function tokenScore(officialName, existingName) {
  const officialTokens = tokens(officialName);
  const existingTokens = tokens(existingName);
  const used = new Set();
  let exact = 0;
  let fuzzy = 0;

  officialTokens.forEach((token) => {
    const exactIndex = existingTokens.findIndex((candidate, index) => !used.has(index) && candidate === token);
    if (exactIndex >= 0) {
      used.add(exactIndex);
      exact += 1;
      return;
    }
    const fuzzyIndex = existingTokens.findIndex((candidate, index) => {
      if (used.has(index) || Math.min(candidate.length, token.length) < 5) return false;
      return levenshtein(candidate, token) <= 1;
    });
    if (fuzzyIndex >= 0) {
      used.add(fuzzyIndex);
      fuzzy += 1;
    }
  });

  const matched = exact + fuzzy;
  return {
    exact,
    fuzzy,
    matched,
    officialCount: officialTokens.length,
    existingCount: existingTokens.length,
    ratio: officialTokens.length ? matched / officialTokens.length : 0,
    exactTokenSet: officialTokens.length === existingTokens.length && exact === officialTokens.length,
    safeFuzzy:
      officialTokens.length === existingTokens.length &&
      matched === officialTokens.length &&
      fuzzy <= 1 &&
      exact >= officialTokens.length - 1,
    partial: matched >= 2 && matched < officialTokens.length,
  };
}

function getExistingName(user) {
  return user.fullName || user.nombreCompleto || user.displayName || user.name || "";
}

function isFichaUser(user, ficha) {
  return String(user.ficha || "").trim() === String(ficha || "").trim();
}

function classifyOfficial(officialName, usersForFicha) {
  const candidates = usersForFicha
    .map((user) => {
      const existingName = getExistingName(user);
      const score = tokenScore(officialName, existingName);
      const compactDistance = levenshtein(normalizeCompact(officialName), normalizeCompact(existingName));
      return { user, existingName, score, compactDistance };
    })
    .filter((item) => item.score.matched > 0 || item.compactDistance <= 3)
    .sort((a, b) =>
      Number(b.score.exactTokenSet) - Number(a.score.exactTokenSet) ||
      Number(b.score.safeFuzzy) - Number(a.score.safeFuzzy) ||
      b.score.ratio - a.score.ratio ||
      a.compactDistance - b.compactDistance
    );

  const exact = candidates.filter((item) => item.score.exactTokenSet);
  const safeFuzzy = candidates.filter((item) => item.score.safeFuzzy);
  const strong = candidates.filter((item) => item.score.exactTokenSet || item.score.safeFuzzy);
  const partial = candidates.filter((item) => item.score.partial && !item.score.exactTokenSet && !item.score.safeFuzzy);

  if (exact.length > 1 || safeFuzzy.length > 1) {
    return { officialName, classification: "posible_duplicado", candidates: strong, selected: null };
  }
  if (strong.length === 1) {
    return { officialName, classification: "coincidencia_segura", candidates, selected: strong[0] };
  }
  if (partial.length) {
    return { officialName, classification: "pendiente_revision", candidates: partial, selected: null };
  }
  return { officialName, classification: "aprendiz_nuevo", candidates: [], selected: null };
}

function buildUpdatePayload(officialName, user, ficha, nowIso) {
  const meta = FICHA_META[ficha] || {};
  const payload = {
    fullName: officialName,
    nombreCompleto: officialName,
    nombreNormalizado: normalizeName(officialName),
    ficha,
    estado: "activo",
    validacionNombre: "oficial",
    fuenteValidacion: FUENTE,
    fechaActualizacionNombre: nowIso,
    observacionValidacion: "",
    updatedAt: nowIso,
  };
  if (!user.grupo && meta.grupo) payload.grupo = meta.grupo;
  if (!user.inst && meta.inst) payload.inst = meta.inst;
  if (!user.institucion && meta.inst) payload.institucion = meta.inst;
  if (!user.grado && meta.grado) payload.grado = meta.grado;
  if (!user.role && !user.rol) payload.rol = "aprendiz";
  if (user.active !== false) payload.active = true;
  if (!user.status || user.status === "active") payload.status = "active";
  return payload;
}

function buildCreatePayload(officialName, ficha, allUsers, nowIso) {
  const meta = FICHA_META[ficha] || {};
  const baseUsername = normalizeUsername(officialName).slice(0, 30).replace(/\.$/, "") || `aprendiz.${ficha}`;
  const existingKeys = new Set(allUsers.map((user) => normalizeUsername(user.usernameKey || user.username || user._docId)));
  let usernameKey = baseUsername;
  let counter = 2;
  while (existingKeys.has(usernameKey)) {
    usernameKey = `${baseUsername.slice(0, 27)}.${counter}`;
    counter += 1;
  }
  return {
    id: `student_pending_${ficha}_${Date.now()}`,
    fullName: officialName,
    nombreCompleto: officialName,
    nombreNormalizado: normalizeName(officialName),
    username: usernameKey,
    usernameKey,
    ficha,
    inst: meta.inst || "",
    institucion: meta.inst || "",
    grado: meta.grado || "",
    grupo: meta.grupo || "",
    rol: "aprendiz",
    role: "aprendiz",
    estado: "activo",
    active: true,
    status: "active",
    validacionNombre: "oficial",
    fuenteValidacion: FUENTE,
    fechaActualizacionNombre: nowIso,
    observacionValidacion: "Registro creado desde listado oficial; contraseña pendiente de activación por administrador.",
    activationPending: true,
    passwordPending: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function emptySummary() {
  return {
    coincidenciaExacta: 0,
    coincidenciaProbable: 0,
    nombreDiferenteMismoAprendiz: 0,
    aprendizNuevo: 0,
    posibleDuplicado: 0,
    aprendizExistenteNoOficial: 0,
    pendienteRevision: 0,
    safeUpdates: 0,
    safeCreates: 0,
    found: 0,
    expected: 0,
  };
}

function addSummary(target, source) {
  Object.keys(target).forEach((key) => {
    target[key] += Number(source[key] || 0);
  });
}

function buildComparisonPlan(allUsers, options = {}) {
  const nowIso = options.nowIso || new Date().toISOString();
  const rosters = options.rosters || OFFICIAL_ROSTERS;
  const allowCreates = options.allowCreates !== false;
  const byFicha = {};
  const safeUpdates = [];
  const safeCreates = [];
  const globalSummary = emptySummary();
  const fichas = Object.keys(rosters);

  fichas.forEach((ficha) => {
    const officialNames = rosters[ficha] || [];
    const usersForFicha = allUsers.filter((user) => isFichaUser(user, ficha));
    const officialResults = officialNames.map((name) => classifyOfficial(name, usersForFicha));
    const matchedDocIds = new Set();

    officialResults.forEach((result) => {
      if (result.classification === "coincidencia_segura" && result.selected) {
        const user = result.selected.user;
        const docId = user._docId || user.usernameKey;
        matchedDocIds.add(docId);
        const payload = buildUpdatePayload(result.officialName, user, ficha, nowIso);
        const currentName = getExistingName(user);
        const nameAlreadyCorrect =
          currentName === result.officialName &&
          user.nombreCompleto === result.officialName &&
          user.nombreNormalizado === normalizeName(result.officialName) &&
          String(user.validacionNombre || "").toLowerCase() === "oficial";
        if (!nameAlreadyCorrect) {
          safeUpdates.push({
            ficha,
            docId,
            usernameKey: user.usernameKey,
            previousFullName: currentName,
            officialName: result.officialName,
            payload,
            confidence: result.selected.score.exactTokenSet ? "exacta_por_tokens" : "segura_fuzzy",
          });
        }
      }
    });

    officialResults.forEach((result) => {
      if (result.classification === "aprendiz_nuevo" && allowCreates) {
        const payload = buildCreatePayload(result.officialName, ficha, allUsers.concat(safeCreates.map((item) => item.payload)), nowIso);
        safeCreates.push({ ficha, docId: payload.usernameKey, officialName: result.officialName, payload });
      }
    });

    const existingNotOfficial = usersForFicha.filter((user) => !matchedDocIds.has(user._docId || user.usernameKey));
    const fichaSummary = emptySummary();
    fichaSummary.expected = officialNames.length;
    fichaSummary.found = usersForFicha.length;
    fichaSummary.coincidenciaExacta = officialResults.filter((r) => r.classification === "coincidencia_segura" && r.selected?.score.exactTokenSet).length;
    fichaSummary.coincidenciaProbable = officialResults.filter((r) => r.classification === "coincidencia_segura" && r.selected?.score.safeFuzzy && !r.selected?.score.exactTokenSet).length;
    fichaSummary.nombreDiferenteMismoAprendiz = fichaSummary.coincidenciaProbable;
    fichaSummary.aprendizNuevo = officialResults.filter((r) => r.classification === "aprendiz_nuevo").length;
    fichaSummary.posibleDuplicado = officialResults.filter((r) => r.classification === "posible_duplicado").length;
    fichaSummary.pendienteRevision = officialResults.filter((r) => r.classification === "pendiente_revision").length;
    fichaSummary.aprendizExistenteNoOficial = existingNotOfficial.length;
    fichaSummary.safeUpdates = safeUpdates.filter((item) => item.ficha === ficha).length;
    fichaSummary.safeCreates = safeCreates.filter((item) => item.ficha === ficha).length;

    addSummary(globalSummary, fichaSummary);
    byFicha[ficha] = {
      meta: FICHA_META[ficha] || {},
      officialExpected: officialNames.length,
      found: usersForFicha.length,
      officialResults,
      existingNotOfficial,
      summary: fichaSummary,
    };
  });

  return {
    collection: COLLECTION,
    officialExpected: fichas.reduce((sum, ficha) => sum + (rosters[ficha] || []).length, 0),
    totalUsersRead: allUsers.length,
    byFicha,
    safeUpdates,
    safeCreates,
    summary: globalSummary,
  };
}

function fsValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fsValue) } };
  if (typeof value === "object") {
    const fields = {};
    Object.keys(value).forEach((key) => { fields[key] = fsValue(value[key]); });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function fromFsValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("stringValue" in value) return String(value.stringValue);
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromFsValue);
  if ("mapValue" in value) {
    const output = {};
    Object.entries(value.mapValue.fields || {}).forEach(([key, nested]) => {
      output[key] = fromFsValue(nested);
    });
    return output;
  }
  return null;
}

function fromFsDoc(doc) {
  const output = {
    _docName: doc.name,
    _docId: String(doc.name || "").split("/").pop(),
    _createTime: doc.createTime || "",
    _updateTime: doc.updateTime || "",
  };
  Object.entries(doc.fields || {}).forEach(([key, value]) => {
    output[key] = fromFsValue(value);
  });
  return output;
}

function requestJson(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : "";
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    };
    if (AUTH_TOKEN) {
      headers.Authorization = `Bearer ${AUTH_TOKEN}`;
    }
    const req = https.request({
      method,
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch {}
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`Firestore ${method} ${res.statusCode}: ${data}`);
          err.statusCode = res.statusCode;
          reject(err);
          return;
        }
        resolve(json);
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function queryUsersByFicha(ficha) {
  const url = `${BASE_URL}:runQuery?key=${API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: COLLECTION }],
      where: {
        fieldFilter: {
          field: { fieldPath: "ficha" },
          op: "EQUAL",
          value: { stringValue: String(ficha) },
        },
      },
    },
  };
  const payload = await requestJson("POST", url, body);
  return payload.filter((item) => item.document).map((item) => fromFsDoc(item.document));
}

async function listUsersForOfficialFichas() {
  const byId = new Map();
  for (const ficha of Object.keys(OFFICIAL_ROSTERS)) {
    const docs = await queryUsersByFicha(ficha);
    docs.forEach((doc) => byId.set(doc._docId, doc));
  }
  return Array.from(byId.values());
}

async function patchFields(docId, fields) {
  const fieldNames = Object.keys(fields);
  const mask = fieldNames.map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`).join("&");
  const url = `${BASE_URL}/${COLLECTION}/${encodeURIComponent(docId)}?key=${API_KEY}&${mask}`;
  const body = { fields: {} };
  fieldNames.forEach((name) => { body.fields[name] = fsValue(fields[name]); });
  await requestJson("PATCH", url, body);
}

async function createDoc(docId, fields) {
  const url = `${BASE_URL}/${COLLECTION}/${encodeURIComponent(docId)}?key=${API_KEY}`;
  const body = { fields: {} };
  Object.keys(fields).forEach((name) => { body.fields[name] = fsValue(fields[name]); });
  await requestJson("PATCH", url, body);
}

function sanitizePlanForConsole(plan, applied, debug) {
  const byFicha = {};
  Object.entries(plan.byFicha).forEach(([ficha, item]) => {
    byFicha[ficha] = item.summary;
  });
  const output = {
    collection: plan.collection,
    officialExpected: plan.officialExpected,
    totalUsersRead: plan.totalUsersRead,
    byFicha,
    summary: plan.summary,
    applied: {
      dryRun: applied.dryRun,
      updated: applied.updated.length,
      created: applied.created.length,
      errors: applied.errors.length,
    },
  };
  if (debug) {
    output.debugApplied = applied;
  }
  return output;
}

function writeAuditArtifacts(plan, users, applied) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "tmp", "sena_roster_sync");
  fs.mkdirSync(dir, { recursive: true });
  const backupPath = path.join(dir, `${stamp}_firestore_users_backup.json`);
  const planPath = path.join(dir, `${stamp}_comparison_plan.json`);
  const appliedPath = path.join(dir, `${stamp}_applied_result.json`);
  fs.writeFileSync(backupPath, JSON.stringify(users, null, 2));
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  fs.writeFileSync(appliedPath, JSON.stringify(applied, null, 2));
  return { backupPath, planPath, appliedPath };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const createMissing = process.argv.includes("--create-missing");
  const debug = process.argv.includes("--debug");
  const users = await listUsersForOfficialFichas();
  const plan = buildComparisonPlan(users, { allowCreates: createMissing });
  const applied = {
    dryRun: !apply,
    updated: [],
    created: [],
    errors: [],
  };

  if (apply) {
    for (const item of plan.safeUpdates) {
      try {
        await patchFields(item.docId, item.payload);
        applied.updated.push(debug ? { docId: item.docId, ficha: item.ficha, officialName: item.officialName, confidence: item.confidence } : { docId: item.docId, ficha: item.ficha, confidence: item.confidence });
      } catch (error) {
        applied.errors.push({ action: "update", docId: item.docId, ficha: item.ficha, message: error.message });
      }
    }
    if (createMissing) {
      for (const item of plan.safeCreates) {
        try {
          await createDoc(item.docId, item.payload);
          applied.created.push(debug ? { docId: item.docId, ficha: item.ficha, officialName: item.officialName } : { docId: item.docId, ficha: item.ficha });
        } catch (error) {
          applied.errors.push({ action: "create", docId: item.docId, ficha: item.ficha, message: error.message });
        }
      }
    }
  }

  const artifacts = writeAuditArtifacts(plan, users, applied);
  console.log(JSON.stringify({ ...sanitizePlanForConsole(plan, applied, debug), artifacts }, null, 2));
  if (applied.errors.length) process.exitCode = 1;
}

module.exports = {
  OFFICIAL_ROSTERS,
  FICHA_META,
  normalizeName,
  tokenScore,
  buildComparisonPlan,
  isFichaUser,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
