const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const guideFiles = [
  "grupo-10a-guia-01-induccion.html",
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
  "grupo-10b-guia-01-induccion.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-06-planificar-informacion.html",
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11b-guia-06-planificar-informacion.html",
  "plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html",
  "plantilla-grado-11-guia-06-planificar-informacion.html",
];

const requiredChecks = [
  {
    pattern: /href="css\/site_tokens\.css\?v=20260409_1"/,
    message: "missing site tokens import",
  },
  {
    pattern: /href="css\/shared_shell\.css\?v=20260409_1"/,
    message: "missing shared shell stylesheet import",
  },
  {
    pattern: /<script[^>]*\bsrc="js\/shared_shell\.js\?v=20260409_1"[^>]*\bdefer\b|<script[^>]*\bdefer\b[^>]*\bsrc="js\/shared_shell\.js\?v=20260409_1"[^>]*>/i,
    message: "missing shared shell script import",
  },
  {
    pattern: /<body[^>]*class="[^"]*\bapp-shell\b[^"]*\bapp-shell--guide\b[^"]*"/i,
    message: "missing app-shell app-shell--guide body classes",
  },
  {
    pattern: /<(?:div|main)[^>]*class="layout app-layout"[^>]*>/i,
    message: "missing layout app-layout wrapper",
  },
  {
    pattern: /<(?:div|main)[^>]*class="(?:main app-main|app-main)"[^>]*>/i,
    message: "missing main app-main wrapper",
  },
];

const inductionChecks = [
  {
    file: "grupo-10a-guia-01-induccion.html",
    requiredPatterns: [
      {
        pattern: /const PAGE_STORAGE_PREFIX = '10a_guia';/,
        message: "missing aligned induction storage prefix",
      },
      {
        pattern: /const LEGACY_PAGE_STORAGE_PREFIX = 'grupo-10a-guia-01-induccion';/,
        message: "missing legacy induction storage fallback",
      },
      {
        pattern: /function clearPageStorage\(key\)\s*\{\s*localStorage\.removeItem\(pageStorageKey\(key\)\);\s*localStorage\.removeItem\(`\$\{PAGE_STORAGE_PREFIX\}:\$\{key\}`\);\s*localStorage\.removeItem\(`\$\{LEGACY_PAGE_STORAGE_PREFIX\}:\$\{key\}`\);\s*\}/s,
        message: "missing legacy-aware induction reset cleanup helper",
      },
      {
        pattern: /\['arbol-vida', 'curricular', 'compromiso', 'checks'\]\.forEach\(function \(k\) \{\s*clearPageStorage\(k\);\s*\}\);/s,
        message: "reset progress does not clear all induction storage variants",
      },
      {
        pattern: /href="grupo-10a-guia-02-herramientas-informaticas-digitales\.html"[^>]*data-route-key="10A-guide-2"/i,
        message: "missing Guide 2 induction navigation for 10A",
      },
      {
        pattern: /'10A-guide-2': \{ file: 'grupo-10a-guia-02-herramientas-informaticas-digitales\.html', ficha: '3441939' \}/,
        message: "missing Guide 2 route-map entry for 10A",
      },
    ],
    forbiddenPatterns: [
      {
        pattern: /script_induccion\.js/i,
        message: "still loads the legacy induction script",
      },
    ],
  },
  {
    file: "grupo-10b-guia-01-induccion.html",
    requiredPatterns: [
      {
        pattern: /const PAGE_STORAGE_PREFIX = '10b_guia';/,
        message: "missing aligned induction storage prefix",
      },
      {
        pattern: /const LEGACY_PAGE_STORAGE_PREFIX = 'grupo-10b-guia-01-induccion';/,
        message: "missing legacy induction storage fallback",
      },
      {
        pattern: /function clearPageStorage\(key\)\s*\{\s*localStorage\.removeItem\(pageStorageKey\(key\)\);\s*localStorage\.removeItem\(`\$\{PAGE_STORAGE_PREFIX\}:\$\{key\}`\);\s*localStorage\.removeItem\(`\$\{LEGACY_PAGE_STORAGE_PREFIX\}:\$\{key\}`\);\s*\}/s,
        message: "missing legacy-aware induction reset cleanup helper",
      },
      {
        pattern: /\['arbol-vida', 'curricular', 'compromiso', 'checks'\]\.forEach\(function \(k\) \{\s*clearPageStorage\(k\);\s*\}\);/s,
        message: "reset progress does not clear all induction storage variants",
      },
      {
        pattern: /href="grupo-10b-guia-02-herramientas-informaticas-digitales\.html"[^>]*data-route-key="10B-guide-2"/i,
        message: "missing Guide 2 induction navigation for 10B",
      },
      {
        pattern: /'10B-guide-2': \{ file: 'grupo-10b-guia-02-herramientas-informaticas-digitales\.html', ficha: '3441942' \}/,
        message: "missing Guide 2 route-map entry for 10B",
      },
    ],
    forbiddenPatterns: [
      {
        pattern: /script_induccion\.js/i,
        message: "still loads the legacy induction script",
      },
    ],
  },
];

const scriptChecks = [
  {
    file: "js/script_guia2.js",
    requiredPatterns: [
      {
        pattern: /const printButton = document\.querySelector\("\[data-print\]"\);\s*if \(printButton\) \{/s,
        message: "missing guarded print binding",
      },
    ],
    forbiddenPatterns: [
      {
        pattern: /document\.querySelector\("\[data-print\]"\)\.addEventListener\(/,
        message: "still contains unguarded print binding",
      },
    ],
  },
  {
    file: "js/script.js",
    requiredPatterns: [
      {
        pattern: /const printButton = document\.querySelector\("\[data-print\]"\);\s*if \(printButton\) \{/s,
        message: "missing guarded print binding",
      },
    ],
    forbiddenPatterns: [
      {
        pattern: /document\.querySelector\("\[data-print\]"\)\.addEventListener\(/,
        message: "still contains unguarded print binding",
      },
    ],
  },
];

const portalAuthChecks = {
  file: "js/portal_auth.js",
  requiredPatterns: [
    {
      pattern: /legacyDataPrefixes:\s*\["grupo-10a-guia-01-induccion:"\]/,
      message: "missing 10A induction legacy prefix cleanup config",
    },
    {
      pattern: /legacyDataPrefixes:\s*\["grupo-10b-guia-01-induccion:"\]/,
      message: "missing 10B induction legacy prefix cleanup config",
    },
    {
      pattern: /function removeUnscopedStorageByPrefix\(keyPrefix\)/,
      message: "missing unscoped legacy cleanup helper",
    },
    {
      pattern: /removeUnscopedStorageByPrefix\(config\.dataPrefix\);/,
      message: "missing alias legacy cleanup during admin reset",
    },
    {
      pattern: /\(config\.legacyDataPrefixes \|\| \[\]\)\.forEach\(\(prefix\) => \{\s*removeUnscopedStorageByPrefix\(prefix\);\s*\}\);/s,
      message: "missing induction filename-prefix cleanup during admin reset",
    },
  ],
  minStateKeyCleanupOccurrences: 2,
};

function readProjectFile(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing project file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, "utf8");
}

for (const fileName of guideFiles) {
  const html = readProjectFile(fileName);

  for (const { pattern, message } of requiredChecks) {
    if (!pattern.test(html)) {
      throw new Error(`${fileName}: ${message}`);
    }
  }
}

for (const { file, requiredPatterns, forbiddenPatterns } of inductionChecks) {
  const html = readProjectFile(file);

  for (const { pattern, message } of requiredPatterns) {
    if (!pattern.test(html)) {
      throw new Error(`${file}: ${message}`);
    }
  }

  for (const { pattern, message } of forbiddenPatterns) {
    if (pattern.test(html)) {
      throw new Error(`${file}: ${message}`);
    }
  }
}

for (const { file, requiredPatterns, forbiddenPatterns } of scriptChecks) {
  const source = readProjectFile(file);

  for (const { pattern, message } of requiredPatterns) {
    if (!pattern.test(source)) {
      throw new Error(`${file}: ${message}`);
    }
  }

  for (const { pattern, message } of forbiddenPatterns) {
    if (pattern.test(source)) {
      throw new Error(`${file}: ${message}`);
    }
  }
}

{
  const source = readProjectFile(portalAuthChecks.file);

  for (const { pattern, message } of portalAuthChecks.requiredPatterns) {
    if (!pattern.test(source)) {
      throw new Error(`${portalAuthChecks.file}: ${message}`);
    }
  }

  const stateKeyCleanupMatches =
    source.match(/localStorage\.removeItem\(config\.stateKey\);/g) || [];
  if (stateKeyCleanupMatches.length < portalAuthChecks.minStateKeyCleanupOccurrences) {
    throw new Error(
      `${portalAuthChecks.file}: missing legacy state cleanup for admin reset flows`
    );
  }
}

console.log("Shared redesign rollout markers and runtime safeguards are present.");
