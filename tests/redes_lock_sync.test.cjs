const test = require("node:test");
const assert = require("node:assert/strict");

const {
  syncRemoteLockFlagsRedes,
  syncAuthoritativeLockFlagsOnlyRedes,
  buildRedesGuideSnapshot,
} = require("../js/redes_lock_sync.js");

const LOCK_KEYS = [
  "reflexion-socializacion-locked",
  "reflexion-311-locked",
  "bloqueA-locked",
  "bloqueB-locked",
  "bloqueC-locked",
  "bloqueD-locked",
  "bloqueE-locked",
  "ip1-locked",
  "ip2-locked",
  "ip3-locked",
  "taller-ip-ej1-locked",
  "taller-ip-ej2-locked",
  "taller-ip-ej3-locked",
  "taller-ip-ej4-locked",
  "taller-ip-ej5-locked",
  "social-locked",
];

test("quita locks locales cuando la version remota ya no los trae", () => {
  const nextState = syncRemoteLockFlagsRedes(
    {
      "bloqueA-1": "Respuesta previa",
      "bloqueA-locked": true,
      "ip2-locked": true,
      "ip1-imagen": "data:image/png;base64,abc123",
    },
    {
      "bloqueA-1": "Respuesta previa",
    },
    LOCK_KEYS
  );

  assert.equal(nextState["bloqueA-1"], "Respuesta previa");
  assert.equal(nextState["ip1-imagen"], "data:image/png;base64,abc123");
  assert.equal("bloqueA-locked" in nextState, false);
  assert.equal("ip2-locked" in nextState, false);
});

test("mantiene locks cuando la version remota los sigue marcando", () => {
  const nextState = syncRemoteLockFlagsRedes(
    {
      "social-diferencias": "Texto local",
      "social-locked": false,
    },
    {
      "social-diferencias": "Texto remoto",
      "social-locked": true,
      "ip3-locked": true,
    },
    LOCK_KEYS
  );

  assert.equal(nextState["social-diferencias"], "Texto remoto");
  assert.equal(nextState["social-locked"], true);
  assert.equal(nextState["ip3-locked"], true);
});

test("sincroniza desbloqueos remotos sin pisar respuestas locales mas nuevas", () => {
  const syncResult = syncAuthoritativeLockFlagsOnlyRedes(
    {
      "bloqueA-1": "Respuesta local mas nueva",
      "bloqueA-locked": true,
      "social-diferencias": "Mapa local",
      "social-locked": true,
    },
    {
      "bloqueA-1": "Respuesta remota antigua",
    },
    LOCK_KEYS
  );

  assert.equal(syncResult.changed, true);
  assert.equal(syncResult.state["bloqueA-1"], "Respuesta local mas nueva");
  assert.equal(syncResult.state["social-diferencias"], "Mapa local");
  assert.equal("bloqueA-locked" in syncResult.state, false);
  assert.equal("social-locked" in syncResult.state, false);
});

test("actualiza data y state al construir el snapshot desbloqueado de redes", () => {
  const updatedAt = "2026-04-22T20:15:00.000Z";
  const nextSnapshot = buildRedesGuideSnapshot(
    {
      data: {
        "bloqueA-locked": true,
        "bloqueA-1": "Respuesta previa",
      },
      state: {
        "bloqueA-locked": true,
      },
      updatedAt: "2026-04-21T10:00:00.000Z",
      updatedBy: "aprendiz",
    },
    {
      "bloqueA-1": "Respuesta previa",
    },
    {
      updatedAt,
      updatedBy: "admin-redes-unlock",
    }
  );

  assert.deepEqual(nextSnapshot.data, {
    "bloqueA-1": "Respuesta previa",
  });
  assert.deepEqual(nextSnapshot.state, {
    "bloqueA-1": "Respuesta previa",
  });
  assert.equal(nextSnapshot.updatedAt, updatedAt);
  assert.equal(nextSnapshot.updatedBy, "admin-redes-unlock");
});
