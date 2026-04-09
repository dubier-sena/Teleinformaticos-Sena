const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing project file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function assertMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

const indexHtml = readProjectFile("index.html");
const guideHtml = readProjectFile(
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html"
);
const guideCss = readProjectFile("css/guia_template.css");
const guideJs = readProjectFile("js/guia_template.js");
const portalCss = readProjectFile("css/page_portal.css");

const portalChecks = [
  {
    pattern: /href="css\/site_tokens\.css\?v=20260409_1"/,
    message: "Portal missing shared token import.",
  },
  {
    pattern: /href="css\/shared_shell\.css\?v=20260409_1"/,
    message: "Portal missing shared shell stylesheet import.",
  },
  {
    pattern: /href="css\/page_portal\.css\?v=20260409_1"/,
    message: "Portal missing portal page stylesheet import.",
  },
  {
    pattern: /<script[^>]*defer[^>]*src="js\/shared_shell\.js\?v=20260409_1"/i,
    message: "Portal missing shared shell script import with defer.",
  },
  {
    pattern: /<body[^>]*class="[^"]*\bapp-shell\b[^"]*\bapp-shell--portal\b[^"]*"/i,
    message: "Portal body is not using the shared shell classes.",
  },
  {
    pattern: /<header[^>]*class="[^"]*\bapp-hero\b[^"]*"/i,
    message: "Portal hero is not connected to app-hero.",
  },
  {
    pattern: /class="[^"]*\bapp-hero__inner\b[^"]*"/i,
    message: "Portal hero inner wrapper is missing app-hero__inner.",
  },
  {
    pattern: /<main[^>]*class="[^"]*\bapp-main\b[^"]*\bportal-grid\b[^"]*"/i,
    message: "Portal main layout is not using app-main portal-grid.",
  },
  {
    pattern: /class="[^"]*\bportal-guides\b[^"]*"/i,
    message: "Portal is missing the portal-guides layer in visible markup.",
  },
  {
    pattern: /class="[^"]*\bguide-card\b[^"]*"/i,
    message: "Portal is missing guide-card usage in visible markup.",
  },
  {
    pattern: /class="[^"]*\bguide-card__badge\b[^"]*"/i,
    message: "Portal is missing guide-card__badge usage in visible markup.",
  },
  {
    pattern: /id="portal-flash"/,
    message: "Portal is missing the portal-flash integration hook.",
  },
  {
    pattern: /id="auth-login-form"/,
    message: "Portal is missing the auth-login-form integration hook.",
  },
  {
    pattern: /id="auth-session-card"/,
    message: "Portal is missing the auth-session-card integration hook.",
  },
  {
    pattern: /id="guide-options"/,
    message: "Portal is missing the guide-options integration hook.",
  },
  {
    pattern: /id="btn-enter"/,
    message: "Portal is missing the btn-enter integration hook.",
  },
  {
    pattern: /id="share-panel"/,
    message: "Portal is missing the share-panel integration hook.",
  },
  {
    pattern: /class="[^"]*\bgroup-btn\b[^"]*"/,
    message: "Portal is missing the group-btn integration hook.",
  },
  {
    pattern: /function\s+selectGroup\s*\(/,
    message: "Portal is missing the selectGroup handler.",
  },
  {
    pattern: /async\s+function\s+refreshShareStatus\s*\(/,
    message: "Portal is missing the refreshShareStatus handler.",
  },
  {
    pattern: /async\s+function\s+stopShareServer\s*\(/,
    message: "Portal is missing the stopShareServer handler.",
  },
  {
    pattern: /function\s+getGuideNames\s*\(/,
    message: "Portal is missing lazy access to guide titles.",
  },
  {
    pattern: /function\s+getFichaMap\s*\(/,
    message: "Portal is missing lazy access to ficha mapping.",
  },
  {
    pattern: /function\s+buildShareEndpoint\s*\(/,
    message: "Portal is missing the shared URL builder for share endpoints.",
  },
];

portalChecks.forEach(({ pattern, message }) => {
  assertMatch(indexHtml, pattern, message);
});

if (/<style[\s>]/i.test(indexHtml)) {
  throw new Error("Portal still contains inline style blocks.");
}

if (/const\s+GUIDE_NAMES\s*=/.test(indexHtml)) {
  throw new Error("Portal still freezes GUIDE_NAMES too early.");
}

if (/const\s+FICHA_MAP\s*=/.test(indexHtml)) {
  throw new Error("Portal still freezes FICHA_MAP too early.");
}

if (/getShareStatusEndpoint\(\)\}\?t=\$?\{?Date\.now\(\)\}?/.test(indexHtml)) {
  throw new Error("Portal still appends cache-busters to share status URLs via string concatenation.");
}

if (/getShareStopEndpoint\(\)\}\?t=\$?\{?Date\.now\(\)\}?/.test(indexHtml)) {
  throw new Error("Portal still appends cache-busters to share stop URLs via string concatenation.");
}

const portalCssChecks = [
  {
    pattern: /\.portal-guides\b/,
    message: "Portal stylesheet is missing portal-guides styles.",
  },
  {
    pattern: /\.guide-card\b/,
    message: "Portal stylesheet is missing guide-card styles.",
  },
  {
    pattern: /\.guide-card__badge\b/,
    message: "Portal stylesheet is missing guide-card__badge styles.",
  },
];

portalCssChecks.forEach(({ pattern, message }) => {
  assertMatch(portalCss, pattern, message);
});

console.log("Portal shared shell markers present.");

assertMatch(
  guideHtml,
  /href="css\/site_tokens\.css\?v=20260409_1"/,
  "Pilot guide is not connected to shared tokens yet."
);
assertMatch(
  guideHtml,
  /href="css\/shared_shell\.css\?v=20260409_1"/,
  "Pilot guide is missing the shared shell stylesheet import."
);
assertMatch(
  guideHtml,
  /href="css\/guia_template\.css\?v=20260409_1"/,
  "Pilot guide is missing the versioned guide stylesheet import."
);
assertMatch(
  guideHtml,
  /<script[^>]*defer[^>]*src="js\/shared_shell\.js\?v=20260409_1"/i,
  "Pilot guide is missing the shared shell script import with defer."
);
assertMatch(
  guideHtml,
  /<script[^>]*defer[^>]*src="js\/guia_template\.js\?v=20260409_1"/i,
  "Pilot guide is missing the versioned guia_template.js import."
);
assertMatch(
  guideHtml,
  /<body[^>]*class="[^"]*\bapp-shell\b[^"]*\bapp-shell--guide\b[^"]*"/i,
  "Pilot guide body is not using the shared shell classes."
);
assertMatch(
  guideHtml,
  /class="[^"]*\bactivity\b[^"]*\bmission-card\b[^"]*"/i,
  "Pilot guide is missing mission-card activity markup."
);
assertMatch(
  guideHtml,
  /class="[^"]*\bmission-chip\b[^"]*"/i,
  "Pilot guide is missing mission-chip markup."
);
assertMatch(
  guideCss,
  /\.mission-card\b/,
  "Guide stylesheet is missing mission-card styles."
);
assertMatch(
  guideCss,
  /\.mission-chip\b/,
  "Guide stylesheet is missing mission-chip styles."
);
assertMatch(
  guideCss,
  /font-family:\s*var\(--font-body\)/,
  "Guide stylesheet is not consuming shared font tokens."
);
assertMatch(
  guideJs,
  /function\s+ensureGuideRevealShell\s*\(/,
  "Guide behavior is missing the reveal shell fallback."
);
assertMatch(
  guideJs,
  /new\s+MutationObserver\s*\(/,
  "Guide behavior is missing MutationObserver support for reveal fallback."
);
assertMatch(
  guideJs,
  /setAttribute\("data-reveal",\s*""\)/,
  "Guide behavior is missing data-reveal wiring."
);

console.log("Pilot redesign markers present.");
