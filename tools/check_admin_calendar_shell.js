const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const pageChecks = [
  {
    file: "panel-administrativo-usuarios.html",
    requiredPatterns: [
      {
        pattern: /href="css\/site_tokens\.css\?v=20260409_1"/,
        message: "missing site tokens import",
      },
      {
        pattern: /href="css\/shared_shell\.css\?v=20260409_1"/,
        message: "missing shared shell stylesheet import",
      },
      {
        pattern: /href="css\/page_admin\.css\?v=20260409_1"/,
        message: "missing admin page stylesheet import",
      },
      {
        pattern: /<script[^>]*\bsrc="js\/shared_shell\.js\?v=20260409_1"[^>]*\bdefer\b|<script[^>]*\bdefer\b[^>]*\bsrc="js\/shared_shell\.js\?v=20260409_1"[^>]*>/i,
        message: "missing shared shell script import",
      },
      {
        pattern: /<body[^>]*class="[^"]*\bapp-shell\b[^"]*\bapp-shell--admin\b[^"]*"/i,
        message: "missing admin shell body classes",
      },
      {
        pattern: /if \(!window\.portalAuth \|\| !window\.portalAuth\.requireAdminAccess\(\{ redirectUrl: "index\.html" \}\)\) \{/,
        message: "missing fail-closed admin access guard",
      },
      {
        pattern: /<header[^>]*class="[^"]*\bapp-hero\b[^"]*"/i,
        message: "missing shared hero wrapper",
      },
      {
        pattern: /<main[^>]*class="[^"]*\bapp-main\b[^"]*\badmin-main\b[^"]*"/i,
        message: "missing shared admin main wrapper",
      },
      {
        pattern: /id="users-container"/,
        message: "missing users container hook",
      },
      {
        pattern: /id="summary-users"/,
        message: "missing summary users hook",
      },
      {
        pattern: /id="summary-active"/,
        message: "missing summary active hook",
      },
      {
        pattern: /id="summary-fichas"/,
        message: "missing summary fichas hook",
      },
      {
        pattern: /id="summary-admin"/,
        message: "missing summary admin hook",
      },
      {
        pattern: /id="user-search"/,
        message: "missing user search hook",
      },
      {
        pattern: /id="refresh-users"/,
        message: "missing refresh users hook",
      },
      {
        pattern: /id="admin-feedback"/,
        message: "missing admin feedback hook",
      },
      {
        pattern: /id="guide2-responses-modal"/,
        message: "missing guide 2 modal hook",
      },
      {
        pattern: /id="guide2-responses-title"/,
        message: "missing guide 2 modal title hook",
      },
      {
        pattern: /id="guide2-responses-subtitle"/,
        message: "missing guide 2 modal subtitle hook",
      },
      {
        pattern: /id="guide2-responses-meta"/,
        message: "missing guide 2 modal meta hook",
      },
      {
        pattern: /id="guide2-responses-body"/,
        message: "missing guide 2 modal body hook",
      },
    ],
    forbiddenPatterns: [
      {
        pattern: /<style[\s>]/i,
        message: "still contains inline style block",
      },
    ],
  },
  {
    file: "calendario-academico-2026.html",
    requiredPatterns: [
      {
        pattern: /href="css\/site_tokens\.css\?v=20260409_1"/,
        message: "missing site tokens import",
      },
      {
        pattern: /href="css\/shared_shell\.css\?v=20260409_1"/,
        message: "missing shared shell stylesheet import",
      },
      {
        pattern: /href="css\/page_calendar\.css\?v=20260409_1"/,
        message: "missing calendar page stylesheet import",
      },
      {
        pattern: /<script[^>]*\bsrc="js\/shared_shell\.js\?v=20260409_1"[^>]*\bdefer\b|<script[^>]*\bdefer\b[^>]*\bsrc="js\/shared_shell\.js\?v=20260409_1"[^>]*>/i,
        message: "missing shared shell script import",
      },
      {
        pattern: /<body[^>]*class="[^"]*\bapp-shell\b[^"]*\bapp-shell--calendar\b[^"]*"/i,
        message: "missing calendar shell body classes",
      },
      {
        pattern: /if \(!window\.portalAuth \|\| !window\.portalAuth\.requireAdminAccess\(\{ redirectUrl: "index\.html" \}\)\) \{/,
        message: "missing fail-closed admin access guard",
      },
      {
        pattern: /<header[^>]*id="header"[^>]*class="[^"]*\bapp-hero\b[^"]*\bcalendar-hero\b[^"]*"/i,
        message: "missing shared calendar hero wrapper",
      },
      {
        pattern: /<main[^>]*class="[^"]*\bapp-main\b[^"]*\bcalendar-main-shell\b[^"]*"/i,
        message: "missing shared calendar main wrapper",
      },
      {
        pattern: /id="main"/,
        message: "missing calendar main mount hook",
      },
      {
        pattern: /id="modal-bg"/,
        message: "missing calendar modal background hook",
      },
      {
        pattern: /id="modal"/,
        message: "missing calendar modal hook",
      },
      {
        pattern: /id="firebase-sync-button"/,
        message: "missing firebase sync button hook",
      },
      {
        pattern: /id="firebase-load-button"/,
        message: "missing firebase load button hook",
      },
      {
        pattern: /id="calendar-reset-button"/,
        message: "missing calendar reset button hook",
      },
      {
        pattern: /id="save-chip"/,
        message: "missing save chip hook",
      },
      {
        pattern: /id="sync-help"/,
        message: "missing sync help hook",
      },
      {
        pattern: /id="nav"/,
        message: "missing calendar nav hook",
      },
      {
        pattern: /id="m-title"/,
        message: "missing modal title hook",
      },
      {
        pattern: /id="m-sub"/,
        message: "missing modal subtitle hook",
      },
      {
        pattern: /id="m-obs-sel"/,
        message: "missing modal observation select hook",
      },
      {
        pattern: /id="m-obs-inp"/,
        message: "missing modal observation input hook",
      },
      {
        pattern: /id="m-grado"/,
        message: "missing modal grade hook",
      },
      {
        pattern: /id="m-act-nombre"/,
        message: "missing activity name hook",
      },
      {
        pattern: /id="m-act-fecha"/,
        message: "missing activity date hook",
      },
      {
        pattern: /id="act-preview"/,
        message: "missing activity preview hook",
      },
    ],
    forbiddenPatterns: [
      {
        pattern: /<style[\s>]/i,
        message: "still contains inline style block",
      },
    ],
  },
];

function readProjectFile(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing project file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, "utf8");
}

for (const { file, requiredPatterns, forbiddenPatterns } of pageChecks) {
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

console.log("Admin and calendar shared shell markers are present.");
