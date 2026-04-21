(function () {
  const auth = window.portalAuth;
  if (!auth) {
    return;
  }

  function getById(id) {
    return document.getElementById(id);
  }

  function setVisible(element, visible) {
    if (!element) {
      return;
    }
    element.style.display = visible ? "" : "none";
  }

  function setFeedback(targetId, message, type) {
    const box = getById(targetId);
    if (!box) {
      return;
    }

    if (!message) {
      box.textContent = "";
      box.className = "auth-feedback";
      box.style.display = "none";
      return;
    }

    box.textContent = message;
    box.className = `auth-feedback ${type || "info"}`;
    box.style.display = "block";
  }

  function renderGuideChips(container, labels) {
    if (!container) {
      return;
    }

    container.textContent = "";
    labels.forEach((label) => {
      const chip = document.createElement("span");
      chip.className = "auth-guide-chip";
      chip.textContent = label;
      container.appendChild(chip);
    });
  }

  function canAccessProductiveStage(session) {
    return session?.role === "student" && ["3168850", "3168852"].includes(String(session.user?.ficha || ""));
  }

  function showFlashMessage() {
    const flash = auth.consumeFlashMessage();
    if (!flash) {
      return;
    }

    setFeedback("portal-flash", flash.message, flash.type || "info");
  }

  function switchAuthTab(tabName) {
    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authTab === tabName);
    });

    document.querySelectorAll("[data-auth-pane]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.authPane === tabName);
    });
  }

  function clearGroupLocks() {
    document.querySelectorAll(".group-btn").forEach((button) => {
      button.classList.remove("is-locked");
      button.removeAttribute("aria-disabled");
    });
  }

  function hideCtaPanel() {
    const panel = getById("cta-panel");
    if (panel) {
      panel.classList.remove("visible");
    }
  }

  function updateAccessNote(message, type) {
    const note = getById("access-note");
    if (!note) {
      return;
    }
    note.textContent = message;
    note.classList.toggle("is-error", type === "error");
  }

  function updateSensitivePanels(session) {
    const isAdmin = session?.role === "admin";
    setVisible(getById("calendar-callout"), isAdmin);
  }

  function restrictGroupsForStudent(session) {
    const ficha = session?.user?.ficha;
    if (!ficha) {
      return;
    }

    document.querySelectorAll(".group-btn").forEach((button) => {
      const locked = button.dataset.ficha !== ficha;
      button.classList.toggle("is-locked", locked);
      if (locked) {
        button.setAttribute("aria-disabled", "true");
      } else {
        button.removeAttribute("aria-disabled");
      }
    });

    const targetButton = document.querySelector(`.group-btn[data-ficha="${ficha}"]`);
    if (targetButton && typeof window.selectGroup === "function") {
      window.selectGroup(targetButton);
    }
  }

  function renderGuestState() {
    setVisible(getById("auth-guest-card"), true);
    setVisible(getById("auth-session-card"), false);
    setVisible(getById("auth-session-actions"), false);
    setVisible(getById("auth-student-actions"), false);
    hideCtaPanel();
    updateAccessNote("Inicia sesi\u00f3n o crea tu usuario para abrir las gu\u00edas habilitadas por tu ficha.");
    document.querySelectorAll(".group-btn.active").forEach((button) => {
      button.classList.remove("active");
    });
    setFeedback("auth-login-feedback", "", "info");
    setFeedback("auth-register-feedback", "", "info");
    setFeedback("auth-admin-feedback", "", "info");
  }

  function renderAdminPane() {
    const help = getById("auth-admin-help");
    const submit = getById("auth-admin-submit");
    const passwordInput = getById("auth-admin-password");

    if (!help || !submit || !passwordInput) {
      return;
    }

    help.textContent =
      "Ingresa la clave administrativa para ver el calendario y la gesti\u00f3n de aprendices.";
    submit.disabled = false;
    passwordInput.disabled = false;
    submit.textContent = "Ingresar como administrador";
  }

  function renderSessionState(session) {
    const role = getById("auth-session-role");
    const name = getById("auth-session-name");
    const meta = getById("auth-session-meta");
    const guides = getById("auth-session-guides");
    const actions = getById("auth-session-actions");
    const studentActions = getById("auth-student-actions");
    const productiveStageButton = getById("btn-productive-stage-access");

    setVisible(getById("auth-guest-card"), false);
    setVisible(getById("auth-session-card"), true);

    if (!role || !name || !meta || !guides) {
      return;
    }

    if (session.role === "admin") {
      role.textContent = "Administrador";
      name.textContent = "Acceso administrativo activo";
      meta.textContent =
        "Acceso completo al portal, calendario y gestion de usuarios.";
      renderGuideChips(guides, [
        "Todas las gu\u00edas",
        "Calendario 2026",
        "Panel de usuarios",
      ]);
      setVisible(actions, true);
      setVisible(studentActions, false);
      updateAccessNote("Como administrador puedes abrir cualquier gu\u00eda y administrar usuarios.");
      return;
    }

    const user = session.user;
    role.textContent = "Estudiante";
    name.textContent = user.fullName;
    meta.textContent = `${user.username} | Ficha ${user.ficha} | ${user.inst} | Grupo ${user.grupo}`;
    const guideLabels = auth.getGuidesForFicha(user.ficha).map((file) => auth.getGuideTitle(file));
    if (canAccessProductiveStage(session)) {
      guideLabels.push("Mi proyecto de etapa productiva");
    }
    renderGuideChips(guides, guideLabels);
    setVisible(actions, false);
    setVisible(studentActions, canAccessProductiveStage(session));
    if (productiveStageButton) {
      productiveStageButton.href = "etapa-productiva-estudiante.html";
      productiveStageButton.textContent = "Mi proyecto y retroalimentacion";
    }
    updateAccessNote("Tu usuario solo puede abrir las gu\u00edas asociadas a su ficha.");
  }

  function renderAccessState() {
    const session = auth.getCurrentSession();
    clearGroupLocks();
    renderAdminPane();
    updateSensitivePanels(session);

    if (!session) {
      renderGuestState();
      return;
    }

    renderSessionState(session);

    if (session.role === "student") {
      restrictGroupsForStudent(session);
    }

    if (typeof window.refreshSelectedGroupPanel === "function") {
      window.refreshSelectedGroupPanel();
    }
  }

  async function handleStudentRegister(event) {
    event.preventDefault();
    const result = await auth.registerStudent({
      fullName: getById("auth-register-name")?.value,
      username: getById("auth-register-user")?.value,
      ficha: getById("auth-register-ficha")?.value,
      password: getById("auth-register-password")?.value,
    });

    if (!result.ok) {
      setFeedback("auth-register-feedback", result.message, "error");
      return;
    }

    auth.setFlashMessage(
      "Usuario creado correctamente. El acceso y el progreso quedar\u00e1n guardados en este equipo y en el panel administrativo.",
      "success"
    );
    window.location.reload();
  }

  async function handleStudentLogin(event) {
    event.preventDefault();
    const result = await auth.loginStudent({
      username: getById("auth-login-user")?.value,
      password: getById("auth-login-password")?.value,
    });

    if (!result.ok) {
      setFeedback("auth-login-feedback", result.message, "error");
      return;
    }

    auth.setFlashMessage("Sesi\u00f3n iniciada correctamente.", "success");
    window.location.reload();
  }

  async function handleAdmin(event) {
    event.preventDefault();
    const result = await auth.loginAdmin(getById("auth-admin-password")?.value || "");

    if (!result.ok) {
      setFeedback("auth-admin-feedback", result.message, "error");
      return;
    }

    auth.setFlashMessage("Acceso administrativo activado.", "success");
    window.location.reload();
  }

  async function handleLogout() {
    await auth.logout();
    window.location.reload();
  }

  function bindEvents() {
    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        switchAuthTab(button.dataset.authTab);
      });
    });

    getById("auth-register-form")?.addEventListener("submit", handleStudentRegister);
    getById("auth-login-form")?.addEventListener("submit", handleStudentLogin);
    getById("auth-admin-form")?.addEventListener("submit", handleAdmin);
    getById("auth-session-logout")?.addEventListener("click", handleLogout);

    document.addEventListener(
      "click",
      (event) => {
        const enterButton = event.target.closest("#btn-enter");
        if (!enterButton) {
          return;
        }

        const session = auth.getCurrentSession();
        const target = enterButton.dataset.target;
        const ficha = enterButton.dataset.ficha;

        if (!target || !ficha) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setFeedback("portal-flash", "Primero selecciona tu grupo en el panel principal.", "error");
          return;
        }

        if (!session) {
          event.preventDefault();
          event.stopImmediatePropagation();
          updateAccessNote("Inicia sesi\u00f3n o crea tu usuario para abrir una gu\u00eda.", "error");
          return;
        }

        if (session.role === "student" && session.user.ficha !== ficha) {
          event.preventDefault();
          event.stopImmediatePropagation();
          updateAccessNote("Tu usuario solo tiene permiso para abrir las gu\u00edas de su ficha.", "error");
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        window.location.href = target;
      },
      true
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    showFlashMessage();
    renderAccessState();
  });

  window.refreshPortalAccessState = renderAccessState;
})();
