#!/usr/bin/env node
"use strict";

const fs = require("fs");
const https = require("https");
const path = require("path");

const PROJECT_ID = "sena-portal";
const API_KEY = "AIzaSyC0zKUJGVcT0aYcujZyrRBtsbVo1VjBkAA";
const COLLECTION = "sena_portal_users";
const FICHA_10B_JFK = "3441942";
const GRUPO = "10B";
const INSTITUCION_CANONICA = "IE Jhon F. Kennedy";
const INST_LEGACY = "Institucion Educativa Jhon F. Kennedy";
const FUENTE = "Listado oficial 10B IE Jhon F. Kennedy";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const OFFICIAL_10B = [
  "ACOSTA ROJAS SARA JIZETH",
  "AGUILAR ACOSTA DARLY BANESSA",
  "ALVAREZ SANCHEZ EIMY DAHIANA",
  "ARCINIEGAS BUSTOS EYLIN KATALINA",
  "ARENAS PERDOMO EMANUEL",
  "BETANCOURT TRILLOS DANNA VALENTINA",
  "CARDONA SALAZAR ANGIE VALENTINA",
  "CARDOZO PARRA SHARY LORENA",
  "CASTELLANOS HINCAPIE ALJSSON SOFIA",
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
];

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeCompact(value) {
  return normalizeName(value).replace(/\s+/g, "");
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
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
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
      if (used.has(index)) return false;
      if (Math.min(candidate.length, token.length) < 5) return false;
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
    exactTokenSet:
      officialTokens.length === existingTokens.length &&
      exact === officialTokens.length,
    safeFuzzy:
      officialTokens.length === existingTokens.length &&
      matched === officialTokens.length &&
      fuzzy <= 1 &&
      exact >= officialTokens.length - 1,
    partial:
      matched >= 2 &&
      matched < officialTokens.length,
  };
}

function isJfk10B(user) {
  const ficha = String(user.ficha || "").trim();
  const grupo = String(user.grupo || "").trim().toUpperCase();
  const inst = String(user.inst || user.institucion || "").toLowerCase();
  return ficha === FICHA_10B_JFK || (grupo === GRUPO && inst.includes("jhon f. kennedy"));
}

function classifyOfficial(officialName, users10b) {
  const candidates = users10b
    .map((user) => {
      const existingName = user.fullName || user.nombreCompleto || "";
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
  return { officialName, classification: "no_encontrado_posible_retiro", candidates: [], selected: null };
}

function buildUpdatePayload(officialName, user, nowIso) {
  return {
    fullName: officialName,
    nombreCompleto: officialName,
    nombreNormalizado: normalizeName(officialName),
    grupo: GRUPO,
    ficha: user.ficha || FICHA_10B_JFK,
    inst: user.inst || INST_LEGACY,
    institucion: INSTITUCION_CANONICA,
    estado: "activo",
    validacionNombre: "oficial",
    fuenteValidacion: FUENTE,
    fechaActualizacionNombre: nowIso,
    observacionValidacion: "",
    updatedAt: nowIso,
  };
}

function buildComparisonPlan(allUsers, officialNames = OFFICIAL_10B, options = {}) {
  const nowIso = options.nowIso || new Date().toISOString();
  const users10b = allUsers.filter(isJfk10B);
  const officialResults = officialNames.map((name) => classifyOfficial(name, users10b));
  const safeUpdates = [];
  const safeCreates = [];
  const matchedDocIds = new Set();

  officialResults.forEach((result) => {
    if (result.classification === "coincidencia_segura" && result.selected) {
      const user = result.selected.user;
      matchedDocIds.add(user._docId || user.usernameKey);
      safeUpdates.push({
        officialName: result.officialName,
        docId: user._docId || user.usernameKey,
        usernameKey: user.usernameKey,
        previousFullName: user.fullName || user.nombreCompleto || "",
        payload: buildUpdatePayload(result.officialName, user, nowIso),
        confidence: result.selected.score.exactTokenSet ? "exacta_por_tokens" : "segura_fuzzy",
      });
    }
  });

  const existingNotOfficial = users10b.filter((user) => !matchedDocIds.has(user._docId || user.usernameKey));
  return {
    collection: COLLECTION,
    officialExpected: officialNames.length,
    totalUsersRead: allUsers.length,
    existing10BCount: users10b.length,
    officialResults,
    safeUpdates,
    safeCreates,
    existingNotOfficial,
    summary: {
      coincidenciaExacta: officialResults.filter((r) => r.classification === "coincidencia_segura" && r.selected?.score.exactTokenSet).length,
      coincidenciaProbable: officialResults.filter((r) =>
        r.classification === "coincidencia_segura" &&
        r.selected?.score.safeFuzzy &&
        !r.selected?.score.exactTokenSet
      ).length,
      noEncontradoPosibleRetiro: officialResults.filter((r) => r.classification === "no_encontrado_posible_retiro").length,
      posibleDuplicado: officialResults.filter((r) => r.classification === "posible_duplicado").length,
      pendienteRevision: officialResults.filter((r) => r.classification === "pendiente_revision").length,
      existing10BNotOfficial: existingNotOfficial.length,
      safeUpdates: safeUpdates.length,
      safeCreates: safeCreates.length,
    },
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
    const req = https.request({
      method,
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
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

async function listUsers() {
  const url = `${BASE_URL}/${COLLECTION}?key=${API_KEY}&pageSize=300`;
  const payload = await requestJson("GET", url);
  return (payload.documents || []).map(fromFsDoc);
}

async function patchFields(docId, fields) {
  const fieldNames = Object.keys(fields);
  const mask = fieldNames.map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`).join("&");
  const url = `${BASE_URL}/${COLLECTION}/${encodeURIComponent(docId)}?key=${API_KEY}&${mask}`;
  const body = { fields: {} };
  fieldNames.forEach((name) => { body.fields[name] = fsValue(fields[name]); });
  await requestJson("PATCH", url, body);
}

function writeAuditArtifacts(plan, users, applied) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "tmp", "jfk_10b_roster_sync");
  fs.mkdirSync(dir, { recursive: true });
  const backupPath = path.join(dir, `${stamp}_firestore_users_backup.json`);
  const planPath = path.join(dir, `${stamp}_comparison_plan.json`);
  const appliedPath = path.join(dir, `${stamp}_applied_result.json`);
  fs.writeFileSync(backupPath, JSON.stringify(users, null, 2));
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  if (applied) fs.writeFileSync(appliedPath, JSON.stringify(applied, null, 2));
  return { backupPath, planPath, appliedPath: applied ? appliedPath : "" };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const users = await listUsers();
  const plan = buildComparisonPlan(users);
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
        applied.updated.push({ docId: item.docId, officialName: item.officialName, confidence: item.confidence });
      } catch (error) {
        applied.errors.push({ action: "update", docId: item.docId, officialName: item.officialName, message: error.message });
      }
    }
  }

  const artifacts = writeAuditArtifacts(plan, users, applied);
  console.log(JSON.stringify({ plan: plan.summary, applied, artifacts }, null, 2));
  if (applied.errors.length) process.exitCode = 1;
}

module.exports = {
  OFFICIAL_10B,
  normalizeName,
  tokenScore,
  buildComparisonPlan,
  isJfk10B,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
