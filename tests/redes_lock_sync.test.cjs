const test = require("node:test");
const assert = require("node:assert/strict");

const { syncRemoteLockFlagsRedes } = require("../js/redes_lock_sync.js");

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
