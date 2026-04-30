(function () {
  const portalAuth = window.portalAuth || null;
  const pageFile =
    window.__RUNTIME_PAGE_FILE__ ||
    window.location.pathname.split("/").pop() ||
    "guia.html";
  const storageFileAliases = {
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html": "10a_guia2.html",
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html": "10b_guia2.html",
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "11a_guia.html",
    "grupo-11a-guia-06-planificar-informacion.html": "11a_guia6.html",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "11b_guia.html",
    "grupo-11b-guia-06-planificar-informacion.html": "11b_guia6.html",
    "plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html": "grado_guia.html",
    "plantilla-grado-11-guia-06-planificar-informacion.html": "grado_guia6.html",
    "santa-barbara-10a-guia-02-redes-rap01.html": "sb_10a_redes.html",
    "santa-barbara-10b-guia-02-redes-rap01.html": "sb_10b_redes.html",
  };
  const pageStateFile = storageFileAliases[pageFile] || pageFile;
  const pageName = pageStateFile.replace(/\.html$/i, "");
  const GUIDE_UI_SYNC_DELAY_MS = 1200;
  const GUIDE_UI_REFRESH_MS = 60000;
  const GUIDE_CALENDAR_REMOTE_REFRESH_MS = 15 * 60 * 1000;
  const GUIDE_REVEAL_SELECTOR = ".activity, .card, .support-card, .checklist-card";
  const GUIDE_CALENDAR_DOC = "calendario_2026_admin";
  const GUIDE_CALENDAR_STORAGE_KEY = "sena-calendario-pro-2026-v2";
  const GUIDE_CALENDAR_LEGACY_STORAGE_KEY = "sena-calendario-pro-2026-v1";
  let guideRevealObserver = null;
  let guideCalendarState = null;
  let guideCalendarRemotePromise = null;
  let guideCalendarRemoteLoaded = false;
  let guideTemplateBooted = false;

  if (portalAuth && !portalAuth.requireFileAccess(pageFile, { redirectUrl: "index.html" })) {
    return;
  }

  function templateStorageKey(key) {
    const storageKey = pageName + ":" + key;
    return portalAuth
      ? portalAuth.getScopedStorageKey(storageKey, { area: "guide-ui" })
      : storageKey;
  }

  function uiMetaStorageKey() {
    return portalAuth
      ? portalAuth.getScopedStorageKey(pageName + ":ui_sync_meta", { area: "guide-meta" })
      : pageName + ":ui_sync_meta";
  }

  function uiStoragePrefix() {
    return portalAuth
      ? portalAuth.getScopedStorageKey(pageName + ":", { area: "guide-ui" })
      : pageName + ":";
  }

  function getCloudScopeKey() {
    const session = portalAuth?.getCurrentSession?.();
    if (!session) {
      return "";
    }

    if (session.role === "admin") {
      return "admin:" + (session.usernameKey || session.user?.usernameKey || "admin");
    }

    if (session.role === "student") {
      return "student:" + (session.user?.usernameKey || session.usernameKey || "");
    }

    return "";
  }

  function getCloudActor() {
    const session = portalAuth?.getCurrentSession?.();
    return session?.user?.fullName || session?.user?.username || "Administrador";
  }

  function readGuideUiMeta() {
    try {
      const saved = localStorage.getItem(uiMetaStorageKey());
      return saved ? JSON.parse(saved) || {} : {};
    } catch (error) {
      return {};
    }
  }

  function saveGuideUiMeta(meta) {
    try {
      if (!meta) {
        localStorage.removeItem(uiMetaStorageKey());
        return;
      }
      localStorage.setItem(uiMetaStorageKey(), JSON.stringify(meta));
    } catch (error) {
    }
  }

  function snapshotTime(snapshot) {
    const parsed = Date.parse(snapshot?.updatedAt || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function localUiSnapshotTime() {
    return snapshotTime(readGuideUiMeta());
  }

  function collectGuideUiState() {
    const prefix = uiStoragePrefix();
    const result = {};

    Object.keys(localStorage).forEach(function (key) {
      if (key.indexOf(prefix) !== 0) {
        return;
      }

      const relativeKey = key.slice(prefix.length);
      if (!relativeKey) {
        return;
      }

      result[relativeKey] = localStorage.getItem(key);
    });

    return result;
  }

  function applyGuideUiStateMap(map) {
    const prefix = uiStoragePrefix();

    Object.keys(localStorage).forEach(function (key) {
      if (key.indexOf(prefix) === 0) {
        localStorage.removeItem(key);
      }
    });

    Object.keys(map || {}).forEach(function (relativeKey) {
      localStorage.setItem(prefix + relativeKey, String(map[relativeKey]));
    });
  }

  let guideUiSyncTimer = null;
  let guideUiRetryTimer = null;
  let pendingGuideUiSnapshot = null;

  function buildGuideUiSnapshot() {
    return {
      scopeKey: getCloudScopeKey(),
      fileName: pageStateFile,
      updatedAt: new Date().toISOString(),
      updatedBy: getCloudActor(),
      uiState: collectGuideUiState(),
    };
  }

  function queueGuideUiCloudSync() {
    if (!getCloudScopeKey()) {
      return;
    }

    pendingGuideUiSnapshot = buildGuideUiSnapshot();
    window.clearTimeout(guideUiSyncTimer);
    window.clearTimeout(guideUiRetryTimer);
    guideUiSyncTimer = window.setTimeout(function () {
      window.syncGuideUiStateImmediately(false);
    }, GUIDE_UI_SYNC_DELAY_MS);
  }

  function queueGuideUiRetry() {
    if (!getCloudScopeKey() || !pendingGuideUiSnapshot) {
      return;
    }
    if (window._firebaseDb?.shouldSkipGuideUiCloudSave?.()) {
      return;
    }

    window.clearTimeout(guideUiRetryTimer);
    guideUiRetryTimer = window.setTimeout(function () {
      window.syncGuideUiStateImmediately(true);
    }, 3000);
  }

  async function loadGuideUiCloudSnapshot(force) {
    const scopeKey = getCloudScopeKey();
    if (!scopeKey || !window._firebaseDb || typeof window._firebaseDb.cloudGetGuideUiState !== "function") {
      return null;
    }
    if (!force && window._firebaseDb?.shouldDeferCloudReads?.()) {
      return null;
    }

    if (force && typeof window._firebaseDb.resetCache === "function") {
      window._firebaseDb.resetCache();
    }

    try {
      return await window._firebaseDb.cloudGetGuideUiState(scopeKey, pageStateFile);
    } catch (error) {
      return null;
    }
  }

  window.syncGuideUiStateImmediately = async function () {
    const scopeKey = getCloudScopeKey();
    if (!scopeKey || !window._firebaseDb || typeof window._firebaseDb.cloudSaveGuideUiState !== "function") {
      return false;
    }

    const snapshot = pendingGuideUiSnapshot || buildGuideUiSnapshot();
    pendingGuideUiSnapshot = snapshot;
    if (window._firebaseDb?.shouldSkipGuideUiCloudSave?.()) {
      pendingGuideUiSnapshot = null;
      window.clearTimeout(guideUiRetryTimer);
      saveGuideUiMeta({
        updatedAt: snapshot.updatedAt,
        updatedBy: snapshot.updatedBy,
      });
      return false;
    }

    try {
      const saved = await window._firebaseDb.cloudSaveGuideUiState(scopeKey, pageStateFile, snapshot);
      if (!saved) {
        queueGuideUiRetry();
        return false;
      }

      pendingGuideUiSnapshot = null;
      window.clearTimeout(guideUiRetryTimer);
      saveGuideUiMeta({
        updatedAt: snapshot.updatedAt,
        updatedBy: snapshot.updatedBy,
      });
      return true;
    } catch (error) {
      queueGuideUiRetry();
      return false;
    }
  };

  window.flushGuideUiStateSync = function () {
    const scopeKey = getCloudScopeKey();
    if (!scopeKey || (!pendingGuideUiSnapshot && !Object.keys(collectGuideUiState()).length)) {
      return false;
    }

    pendingGuideUiSnapshot = pendingGuideUiSnapshot || buildGuideUiSnapshot();
    window.syncGuideUiStateImmediately(true);
    return true;
  };

  function normalizeGroup(value) {
    return String(value || "").trim().replace(/^grupo\s+/i, "").toUpperCase();
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char];
    });
  }

  function formatGrupo(grupo) {
    const normalized = normalizeGroup(grupo);
    return normalized ? "Grupo " + normalized : "";
  }

  function formatFicha(ficha) {
    const value = String(ficha || "").trim();
    if (!value) {
      return "";
    }
    return /^ficha/i.test(value) ? value : "Ficha " + value;
  }

  function shortInst(inst) {
    return String(inst || "").replace(/^Institucion Educativa\s+/i, "").trim();
  }

  function normalizeGuideText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function guideInstitutionKey(value) {
    const normalized = normalizeGuideText(value);
    if (normalized.indexOf("kennedy") !== -1) {
      return "kennedy";
    }
    if (normalized.indexOf("santa") !== -1 && normalized.indexOf("barbara") !== -1) {
      return "santa-barbara";
    }
    return normalized;
  }

  function cloneGuideCalendarValue(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value && typeof value === "object" ? Object.assign({}, value) : value;
    }
  }

  function getGuideCalendarRecords() {
    return Array.isArray(window.CALENDAR_2026_RECORDS) ? window.CALENDAR_2026_RECORDS : [];
  }

  function getGuideCalendarBaseState() {
    const source =
      window.CALENDAR_2026_INITIAL_STATE && typeof window.CALENDAR_2026_INITIAL_STATE === "object"
        ? window.CALENDAR_2026_INITIAL_STATE
        : {};
    return normalizeGuideCalendarEntries(source);
  }

  function normalizeGuideCalendarEntries(source) {
    const normalized = {};
    const records = getGuideCalendarRecords();
    const recordIds = new Set(records.map((record) => record.id));
    const recordsByBaseId = records.reduce(function (acc, record) {
      const baseId = record.baseId || record.id;
      if (!acc[baseId]) {
        acc[baseId] = [];
      }
      acc[baseId].push(record);
      return acc;
    }, {});

    Object.entries(source || {}).forEach(function ([key, value]) {
      if (recordIds.has(key)) {
        normalized[key] = cloneGuideCalendarValue(value);
        return;
      }

      const expandedRecords = recordsByBaseId[key];
      if (expandedRecords) {
        expandedRecords.forEach(function (record) {
          normalized[record.id] = cloneGuideCalendarValue(value);
        });
      }
    });

    return normalized;
  }

  function normalizeGuideCalendarSnapshot(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const source = raw.state && typeof raw.state === "object" ? raw.state : raw;
    return {
      calendarId: raw.calendarId || GUIDE_CALENDAR_DOC,
      version: Number(raw.version) || 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
      updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : "",
      state: normalizeGuideCalendarEntries(source),
    };
  }

  function readGuideCalendarLocalSnapshot() {
    try {
      const current = localStorage.getItem(GUIDE_CALENDAR_STORAGE_KEY);
      if (current) {
        return normalizeGuideCalendarSnapshot(JSON.parse(current));
      }
    } catch (error) {
    }

    try {
      const legacy = localStorage.getItem(GUIDE_CALENDAR_LEGACY_STORAGE_KEY);
      if (legacy) {
        return normalizeGuideCalendarSnapshot({
          calendarId: GUIDE_CALENDAR_DOC,
          version: 1,
          updatedAt: "",
          updatedBy: "",
          state: JSON.parse(legacy),
        });
      }
    } catch (error) {
    }

    return null;
  }

  function saveGuideCalendarLocalSnapshot(snapshot) {
    const normalized = normalizeGuideCalendarSnapshot(snapshot);
    if (!normalized) {
      return;
    }

    try {
      localStorage.setItem(GUIDE_CALENDAR_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
    }
  }

  function guideCalendarSnapshotTime(snapshot) {
    const value = Date.parse(snapshot?.updatedAt || "");
    return Number.isFinite(value) ? value : 0;
  }

  function isGuideCalendarSnapshotFresh(snapshot) {
    const updatedAt = guideCalendarSnapshotTime(snapshot);
    if (!updatedAt) {
      return false;
    }
    return Date.now() - updatedAt <= GUIDE_CALENDAR_REMOTE_REFRESH_MS;
  }

  function mergeGuideCalendarSnapshots(localSnapshot, remoteSnapshot) {
    const state = Object.assign({}, getGuideCalendarBaseState());
    const latestSnapshot =
      remoteSnapshot && guideCalendarSnapshotTime(remoteSnapshot) >= guideCalendarSnapshotTime(localSnapshot)
        ? remoteSnapshot
        : localSnapshot;
    if (latestSnapshot?.state) {
      Object.assign(state, latestSnapshot.state);
    }
    return state;
  }

  function getGuideCalendarState() {
    if (!guideCalendarState) {
      guideCalendarState = mergeGuideCalendarSnapshots(readGuideCalendarLocalSnapshot(), null);
    }
    return guideCalendarState;
  }

  async function loadGuideCalendarState() {
    if (guideCalendarRemotePromise) {
      return guideCalendarRemotePromise;
    }

    guideCalendarRemotePromise = (async function () {
      const localSnapshot = readGuideCalendarLocalSnapshot();
      if (localSnapshot && isGuideCalendarSnapshotFresh(localSnapshot)) {
        guideCalendarState = mergeGuideCalendarSnapshots(localSnapshot, null);
        guideCalendarRemoteLoaded = true;
        return guideCalendarState;
      }
      if (window._firebaseDb?.shouldDeferCloudReads?.()) {
        guideCalendarState = mergeGuideCalendarSnapshots(localSnapshot, null);
        guideCalendarRemoteLoaded = true;
        return guideCalendarState;
      }

      let remoteSnapshot = null;

      if (window._firebaseDb && typeof window._firebaseDb.cloudGetCalendar === "function") {
        try {
          remoteSnapshot = normalizeGuideCalendarSnapshot(
            await window._firebaseDb.cloudGetCalendar(GUIDE_CALENDAR_DOC)
          );
          if (remoteSnapshot) {
            saveGuideCalendarLocalSnapshot(remoteSnapshot);
          }
        } catch (error) {
          remoteSnapshot = null;
        }
      }

      guideCalendarState = mergeGuideCalendarSnapshots(localSnapshot, remoteSnapshot);
      guideCalendarRemoteLoaded = true;
      return guideCalendarState;
    })();

    return guideCalendarRemotePromise;
  }

  function getGuideCalendarEntry(record) {
    const entry = getGuideCalendarState()[record.id] || {};
    return {
      estado: entry.estado || record.defE || "",
      obs: entry.obs || record.defO || "",
      act: entry.act || null,
      grado: entry.grado || record.grado || "",
    };
  }

  function formatGuideScheduleDateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function getGuideScheduleNowDate() {
    if (window.GUIDE_SCHEDULE_NOW_OVERRIDE) {
      const overrideDate = new Date(window.GUIDE_SCHEDULE_NOW_OVERRIDE);
      if (!Number.isNaN(overrideDate.getTime())) {
        return overrideDate;
      }
    }

    return new Date();
  }

  function getGuideTodayKey() {
    if (window.GUIDE_SCHEDULE_TODAY_OVERRIDE) {
      return String(window.GUIDE_SCHEDULE_TODAY_OVERRIDE);
    }

    return formatGuideScheduleDateKey(getGuideScheduleNowDate());
  }

  function getGuideNowMinutes() {
    if (window.GUIDE_SCHEDULE_MINUTES_OVERRIDE !== undefined) {
      const minutes = Number(window.GUIDE_SCHEDULE_MINUTES_OVERRIDE);
      if (Number.isFinite(minutes)) {
        return minutes;
      }
    }

    const now = getGuideScheduleNowDate();
    return now.getHours() * 60 + now.getMinutes();
  }

  function getGuideScheduleTimeValue(record) {
    const match = String(record?.horario || "").match(/(\d{1,2}):(\d{2})(am|pm)/i);
    if (!match) {
      return 9999;
    }
    let hour = Number(match[1]) % 12;
    if (match[3].toLowerCase() === "pm") {
      hour += 12;
    }
    return hour * 60 + Number(match[2]);
  }

  function parseGuideScheduleRange(record) {
    const match = String(record?.horario || "").match(
      /(\d{1,2}):(\d{2})(am|pm)\D+(\d{1,2}):(\d{2})(am|pm)/i
    );
    if (!match) {
      return null;
    }

    let startHour = Number(match[1]) % 12;
    if (match[3].toLowerCase() === "pm") {
      startHour += 12;
    }

    let endHour = Number(match[4]) % 12;
    if (match[6].toLowerCase() === "pm") {
      endHour += 12;
    }

    return {
      start: startHour * 60 + Number(match[2]),
      end: endHour * 60 + Number(match[5]),
    };
  }

  function compareGuideScheduleRecords(a, b) {
    const dateCompare = String(a.fecha || "").localeCompare(String(b.fecha || ""));
    if (dateCompare) {
      return dateCompare;
    }
    const timeCompare = getGuideScheduleTimeValue(a) - getGuideScheduleTimeValue(b);
    if (timeCompare) {
      return timeCompare;
    }
    return String(a.id || "").localeCompare(String(b.id || ""));
  }

  function matchesGuideScheduleSelection(record, selection) {
    const entry = getGuideCalendarEntry(record);
    const selectedGroup = normalizeGroup(selection?.grupo);
    const recordGroup = normalizeGroup(entry.grado || record.grado);
    if (!selectedGroup || !recordGroup || selectedGroup !== recordGroup) {
      return false;
    }
    return guideInstitutionKey(record.colegio) === guideInstitutionKey(selection?.inst);
  }

  function isGuideClassAvailable(record) {
    const estado = normalizeGuideText(getGuideCalendarEntry(record).estado);
    return !["cancelada", "sin programacion", "no aplica", "novedad"].includes(estado);
  }

  function isGuideClassAfterNow(record) {
    const today = getGuideTodayKey();
    const classDate = String(record.fecha || "");
    if (classDate > today) {
      return true;
    }
    if (classDate < today) {
      return false;
    }
    return getGuideScheduleTimeValue(record) > getGuideNowMinutes();
  }

  function findCurrentGuideClass(selection) {
    const today = getGuideTodayKey();
    const nowMinutes = getGuideNowMinutes();

    return (
      getGuideCalendarRecords()
        .filter(function (record) {
          if (
            record.tipo !== "CLASE" ||
            String(record.fecha || "") !== today ||
            !matchesGuideScheduleSelection(record, selection) ||
            !isGuideClassAvailable(record)
          ) {
            return false;
          }

          const range = parseGuideScheduleRange(record);
          return range ? nowMinutes >= range.start && nowMinutes <= range.end : false;
        })
        .sort(compareGuideScheduleRecords)[0] || null
    );
  }

  function findNextGuideClass(selection) {
    return getGuideCalendarRecords()
      .filter(function (record) {
        return (
          record.tipo === "CLASE" &&
          isGuideClassAfterNow(record) &&
          matchesGuideScheduleSelection(record, selection) &&
          isGuideClassAvailable(record)
        );
      })
      .sort(compareGuideScheduleRecords)[0] || null;
  }

  function findNextGuideClasses(selection, limit) {
    return getGuideCalendarRecords()
      .filter(function (record) {
        return (
          record.tipo === "CLASE" &&
          isGuideClassAfterNow(record) &&
          matchesGuideScheduleSelection(record, selection) &&
          isGuideClassAvailable(record)
        );
      })
      .sort(compareGuideScheduleRecords)
      .slice(0, Math.max(1, limit || 5));
  }

  function findNextGuideDelivery(selection) {
    const today = getGuideTodayKey();
    const deliveries = [];

    getGuideCalendarRecords().forEach(function (record) {
      if (
        record.tipo !== "CLASE" ||
        !matchesGuideScheduleSelection(record, selection) ||
        !isGuideClassAvailable(record)
      ) {
        return;
      }

      const act = getGuideCalendarEntry(record).act;
      if (!act || (!act.nombre && !act.fecha)) {
        return;
      }

      const dueDate = String(act.fecha || record.fecha || "");
      if (dueDate && dueDate < today) {
        return;
      }

      deliveries.push({
        record,
        act,
        dueDate,
      });
    });

    return (
      deliveries.sort(function (a, b) {
        const dueCompare = String(a.dueDate || "").localeCompare(String(b.dueDate || ""));
        if (dueCompare) {
          return dueCompare;
        }
        return compareGuideScheduleRecords(a.record, b.record);
      })[0] || null
    );
  }

  function formatGuideDate(isoDate) {
    const parts = String(isoDate || "").split("-");
    if (parts.length !== 3) {
      return "Fecha pendiente";
    }

    const label = parts[2] + "/" + parts[1] + "/" + parts[0];
    return isoDate === getGuideTodayKey() ? "Hoy " + label : label;
  }

  function formatGuideClassListDate(isoDate) {
    const parts = String(isoDate || "").split("-");
    if (parts.length !== 3) {
      return "Fecha pendiente";
    }

    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    return dayNames[date.getDay()] + " " + parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function formatGuideClassListTime(horario) {
    return String(horario || "Sin horario")
      .replace(/\s*[–—-]\s*/g, "-")
      .trim();
  }

  function buildGuideNextClassesPanel(classes) {
    if (!classes || !classes.length) {
      return "";
    }

    const items = classes
      .map(function (record, index) {
        const text =
          index +
          1 +
          ". " +
          formatGuideClassListDate(record.fecha) +
          " · " +
          formatGuideClassListTime(record.horario);
        return '<div class="guide-schedule-popover__item">' + escapeHtml(text) + "</div>";
      })
      .join("");

    return (
      '<span class="guide-schedule-popover" role="tooltip">' +
      '<span class="guide-schedule-popover__title">Proximas clases</span>' +
      items +
      "</span>"
    );
  }

  function ensureGuideScheduleMeta() {
    const meta = document.querySelector(".topbar-meta");
    if (!meta) {
      return null;
    }

    let classItem = document.getElementById("guideScheduleNextClass");
    let deliveryItem = document.getElementById("guideScheduleNextDelivery");

    if (!classItem) {
      classItem = document.createElement("span");
      classItem.id = "guideScheduleNextClass";
      meta.appendChild(classItem);
    }

    if (!deliveryItem) {
      deliveryItem = document.createElement("span");
      deliveryItem.id = "guideScheduleNextDelivery";
      meta.appendChild(deliveryItem);
    }

    return { classItem, deliveryItem };
  }

  function renderGuideScheduleItem(element, type, title, body, isEmpty, popoverHtml) {
    element.className =
      "meta-item guide-schedule-item guide-schedule-item--" +
      type +
      (isEmpty ? " is-empty" : "");
    element.tabIndex = 0;
    element.title = title + ": " + body;
    element.innerHTML =
      '<span class="guide-schedule-dot" aria-hidden="true"></span>' +
      '<span class="guide-schedule-copy"><strong>' +
      escapeHtml(title) +
      '</strong><span>' +
      escapeHtml(body) +
      "</span></span>" +
      (popoverHtml || "");
  }

  function renderGuideScheduleSummary(selection, options) {
    if (!getGuideCalendarRecords().length) {
      return;
    }

    const nodes = ensureGuideScheduleMeta();
    if (!nodes) {
      return;
    }

    const currentClass = findCurrentGuideClass(selection);
    const nextClass = findNextGuideClass(selection);
    const nextClasses = findNextGuideClasses(selection, 5);
    const nextClassesPanel = buildGuideNextClassesPanel(nextClasses);

    if (currentClass) {
      const currentBody = [formatGuideDate(currentClass.fecha), currentClass.horario]
        .filter(Boolean)
        .join(" - ");
      renderGuideScheduleItem(
        nodes.classItem,
        "class",
        "Estoy dentro de la hora de clase",
        currentBody,
        false,
        nextClassesPanel
      );
    } else if (nextClass) {
      const classBody = [formatGuideDate(nextClass.fecha), nextClass.horario]
        .filter(Boolean)
        .join(" - ");
      renderGuideScheduleItem(nodes.classItem, "class", "Proxima clase", classBody, false, nextClassesPanel);
    } else {
      renderGuideScheduleItem(
        nodes.classItem,
        "class",
        "Proxima clase",
        "Sin fecha programada",
        true
      );
    }

    if (currentClass && nextClass) {
      const nextClassBody = [formatGuideDate(nextClass.fecha), nextClass.horario]
        .filter(Boolean)
        .join(" - ");
      renderGuideScheduleItem(nodes.deliveryItem, "class", "Proxima clase", nextClassBody, false);
    } else {
      const nextDelivery = findNextGuideDelivery(selection);
      if (nextDelivery) {
        const deliveryBody = [
          nextDelivery.act?.nombre || "Actividad sin nombre",
          nextDelivery.dueDate ? formatGuideDate(nextDelivery.dueDate) : "Sin fecha",
        ]
          .filter(Boolean)
          .join(" - ");
        renderGuideScheduleItem(
          nodes.deliveryItem,
          "delivery",
          "Entrega pendiente",
          deliveryBody,
          false
        );
      } else {
        renderGuideScheduleItem(
          nodes.deliveryItem,
          "delivery",
          "Sin entrega proxima",
          "No hay actividad con fecha pendiente",
          true
        );
      }
    }

    if (currentClass && !nextClass) {
      renderGuideScheduleItem(
        nodes.deliveryItem,
        "class",
        "Proxima clase",
        "Sin fecha programada",
        true
      );
    }

    if (!options?.skipRemote && !guideCalendarRemoteLoaded) {
      loadGuideCalendarState()
        .then(function () {
          renderGuideScheduleSummary(selection, { skipRemote: true });
        })
        .catch(function () {
        });
    }
  }

  function getGuideDisplayMeta(fileName, selection) {
    const rawTitle = portalAuth?.getGuideTitle(fileName) || fileName;
    const match = String(rawTitle).match(/^Gu(?:i|\u00ed)a\s*([0-9]+)\s*-\s*(.+?)(?:\s*\|\s*Grupo\s+(.+))?$/i);

    if (!match) {
      return {
        number: rawTitle,
        name: selection?.grupo ? rawTitle + " | " + selection.grupo : rawTitle,
      };
    }

    return {
      number: "Gu\u00eda " + match[1],
      name: match[2] + " | " + (match[3] || selection?.grupo || ""),
    };
  }

  function renderAssignedGuides(selection) {
    const guideSection = Array.from(document.querySelectorAll(".nav-section")).find(function (section) {
      return section.querySelector(".nav-guide[data-current-file]");
    });

    if (!guideSection || !portalAuth) {
      return;
    }

    const files = portalAuth.getGuidesForFicha(selection?.ficha).filter(Boolean);
    if (!files.length) {
      return;
    }

    guideSection.innerHTML =
      '<div class="nav-label">Guia asignada</div>' +
      files
        .map(function (file) {
          const meta = getGuideDisplayMeta(file, selection);
          const isCurrent = file === pageFile;
          const tagClass = isCurrent ? "g-tag actual" : "g-tag linked";
          const tagText = isCurrent ? "Actual" : "Abrir";
          return (
            '<a class="nav-guide' +
            (isCurrent ? " current" : "") +
            '" href="' +
            escapeHtml(file) +
            '" data-current-file="' +
            escapeHtml(file) +
            '">' +
            '<span class="g-icon">&#128215;</span>' +
            '<span class="g-info">' +
            '<span class="g-num">' +
            escapeHtml(meta.number) +
            "</span>" +
            '<span class="g-name">' +
            escapeHtml(meta.name) +
            "</span>" +
            "</span>" +
            '<span class="' +
            tagClass +
            '">' +
            escapeHtml(tagText) +
            "</span>" +
            "</a>"
          );
        })
        .join("");
  }

  function renderProductiveStageLink(selection) {
    const existing = document.querySelector("[data-productive-stage-link]");
    const canShow = ["3168850", "3168852"].includes(String(selection?.ficha || "").trim());

    if (!canShow) {
      if (existing) {
        existing.remove();
      }
      return;
    }

    if (existing) {
      return;
    }

    const homeLinks = Array.from(document.querySelectorAll(".nav-home-link"));
    const referenceLink = homeLinks.length ? homeLinks[0] : null;
    const link = document.createElement("a");
    link.className = "nav-home-link";
    link.href = "etapa-productiva-estudiante.html";
    link.setAttribute("data-productive-stage-link", "true");
    link.innerHTML = "&#128188; <span>Mi proyecto</span>";

    if (referenceLink && referenceLink.parentNode) {
      referenceLink.parentNode.insertBefore(link, referenceLink);
      return;
    }

    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.appendChild(link);
    }
  }

  function syncSelectionWithUrl(defaults) {
    if (portalAuth?.isStudentSession()) {
      portalAuth.applySelection(portalAuth.getCurrentSelection(defaults));
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("ficha")) {
        localStorage.setItem("sena_ficha", params.get("ficha"));
      } else if (defaults.ficha && !localStorage.getItem("sena_ficha")) {
        localStorage.setItem("sena_ficha", defaults.ficha);
      }

      if (params.get("inst")) {
        localStorage.setItem("sena_inst", params.get("inst"));
      } else if (defaults.inst && !localStorage.getItem("sena_inst")) {
        localStorage.setItem("sena_inst", defaults.inst);
      }

      if (params.get("grupo")) {
        localStorage.setItem("sena_grupo", normalizeGroup(params.get("grupo")));
      } else if (defaults.grupo && !localStorage.getItem("sena_grupo")) {
        localStorage.setItem("sena_grupo", normalizeGroup(defaults.grupo));
      }
    } catch (error) {
      if (defaults.ficha && !localStorage.getItem("sena_ficha")) {
        localStorage.setItem("sena_ficha", defaults.ficha);
      }
      if (defaults.inst && !localStorage.getItem("sena_inst")) {
        localStorage.setItem("sena_inst", defaults.inst);
      }
      if (defaults.grupo && !localStorage.getItem("sena_grupo")) {
        localStorage.setItem("sena_grupo", normalizeGroup(defaults.grupo));
      }
    }
  }

  function currentSelection() {
    const body = document.body;
    const defaults = {
      ficha: body.dataset.defaultFicha || "",
      inst: body.dataset.defaultInst || "",
      grupo: body.dataset.defaultGrupo || "",
    };

    const runtimeContext = window.__PAGE_RUNTIME_CONTEXT__ || null;
    if (runtimeContext) {
      return defaults;
    }

    if (portalAuth?.isStudentSession()) {
      const selection = portalAuth.getCurrentSelection(defaults);
      portalAuth.applySelection(selection);
      return selection;
    }

    syncSelectionWithUrl(defaults);

    return {
      ficha: localStorage.getItem("sena_ficha") || defaults.ficha,
      inst: localStorage.getItem("sena_inst") || defaults.inst,
      grupo: normalizeGroup(localStorage.getItem("sena_grupo") || defaults.grupo),
    };
  }

  function applySelection(selection) {
    const okPanel = document.getElementById("sb-ficha-ok");
    const warnPanel = document.getElementById("sb-ficha-warn");
    const hasFicha = Boolean(selection.ficha);

    if (okPanel) {
      okPanel.style.display = hasFicha ? "" : "none";
    }
    if (warnPanel) {
      warnPanel.style.display = hasFicha ? "none" : "";
    }

    setText("sb-inst", selection.inst);
    setText("sb-grupo-meta", formatGrupo(selection.grupo));
    setText("sb-badge", formatFicha(selection.ficha));
    const topbarText = [shortInst(selection.inst), selection.grupo].filter(Boolean).join(" | ");
    if (topbarText) {
      setText("topbarCampus", topbarText);
    }
    renderGuideScheduleSummary(selection);

    const heroText =
      formatGrupo(selection.grupo) +
      (selection.ficha ? " - " + formatFicha(selection.ficha) : "") +
      (selection.inst ? " - " + selection.inst : "");
    if (heroText.trim()) {
      setText("heroGroupLine", heroText);
    }

    const identText =
      selection.inst && selection.grupo && selection.ficha
        ? selection.inst + " - " + selection.grupo + " (" + formatFicha(selection.ficha) + ")"
        : "";
    if (identText) {
      setText("identGroupValue", identText);
    }

    renderAssignedGuides(selection);
    renderProductiveStageLink(selection);

    document.querySelectorAll("[data-current-file]").forEach((link) => {
      const file = link.dataset.currentFile || (window.location.pathname.split("/").pop() || "");
      const params = new URLSearchParams();
      if (selection.inst) {
        params.set("inst", selection.inst);
      }
      if (selection.grupo) {
        params.set("grupo", selection.grupo);
      }
      if (selection.ficha) {
        params.set("ficha", selection.ficha);
      }
      link.href = params.toString() ? file + "?" + params.toString() : file;
    });
  }

  function bindSidebarLinks() {
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", function () {
        document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
        link.classList.add("active");
        if (window.innerWidth <= 768) {
          const sidebar = document.getElementById("sidebar");
          if (sidebar) {
            sidebar.classList.remove("open");
          }
        }
      });
    });
  }

  function activityStorageKey(activityKey) {
    return templateStorageKey("activity_seen:" + activityKey);
  }

  function collapsibleStorageKey(type, elementKey) {
    return templateStorageKey(type + "_open:" + elementKey);
  }

  function normalizeActivityKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function activityKeyFromElement(activity, index) {
    const explicit = activity.dataset.activityKey;
    if (explicit) {
      return normalizeActivityKey(explicit);
    }

    const num = activity.querySelector(".activity-num")?.textContent || "";
    const title = activity.querySelector(".activity-title")?.textContent || "";
    return normalizeActivityKey(num || title || "activity-" + index);
  }

  function cardKeyFromElement(card, index) {
    const explicit = card.dataset.cardKey;
    if (explicit) {
      return normalizeActivityKey(explicit);
    }

    const sectionTitle = card.previousElementSibling?.classList.contains("section-title")
      ? card.previousElementSibling.textContent || ""
      : "";
    const title = card.querySelector(".card-header h3")?.textContent || "";
    const normalized = normalizeActivityKey(sectionTitle + "-" + title);
    return normalized || "card-" + index;
  }

  function setOpenState(element, isOpen) {
    element.classList.toggle("open", isOpen);
  }

  function isMobileViewport() {
    return window.innerWidth <= 768;
  }

  function isGuideDocumentVisible() {
    return typeof document === "undefined" || document.visibilityState !== "hidden";
  }

  function applyResponsiveSidebarState() {
    const sidebar = document.getElementById("sidebar");
    const hiddenByPreference = localStorage.getItem(templateStorageKey("sidebar_hidden")) === "1";

    if (isMobileViewport()) {
      document.body.classList.remove("sb-hidden");
      if (sidebar) {
        sidebar.classList.remove("open");
      }
      return;
    }

    document.body.classList.toggle("sb-hidden", hiddenByPreference);
    if (sidebar) {
      sidebar.classList.remove("open");
    }
  }

  function markGuideRevealTargets() {
    document.querySelectorAll(GUIDE_REVEAL_SELECTOR).forEach(function (element) {
      element.setAttribute("data-reveal", "");
    });
  }

  function activateGuideRevealTargets() {
    let revealIndex = 0;
    document.querySelectorAll("[data-reveal]").forEach(function (element) {
      element.style.setProperty("--reveal-index", String(revealIndex));
      revealIndex += 1;
      element.classList.add("is-visible");
    });
  }

  function ensureGuideRevealShell() {
    markGuideRevealTargets();

    if (document.documentElement.classList.contains("shell-ready")) {
      activateGuideRevealTargets();
      if (guideRevealObserver) {
        guideRevealObserver.disconnect();
        guideRevealObserver = null;
      }
      return;
    }

    if (guideRevealObserver) {
      return;
    }

    guideRevealObserver = new MutationObserver(function () {
      if (!document.documentElement.classList.contains("shell-ready")) {
        return;
      }

      activateGuideRevealTargets();
      guideRevealObserver.disconnect();
      guideRevealObserver = null;
    });

    guideRevealObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  function initCollapsibleState() {
    document.querySelectorAll(".card").forEach((card, index) => {
      const cardKey = cardKeyFromElement(card, index);
      card.dataset.cardKey = cardKey;

      const saved = localStorage.getItem(collapsibleStorageKey("card", cardKey));
      if (saved === "1" || saved === "0") {
        setOpenState(card, saved === "1");
      }
    });

    document.querySelectorAll(".activity").forEach((activity, index) => {
      const activityKey = activityKeyFromElement(activity, index);
      activity.dataset.activityKey = activityKey;

      const saved = localStorage.getItem(collapsibleStorageKey("activity", activityKey));
      if (saved === "1" || saved === "0") {
        setOpenState(activity, saved === "1");
      }
    });
  }

  function setActivityCheckState(button, checked) {
    button.classList.toggle("checked", checked);
    button.setAttribute("aria-pressed", checked ? "true" : "false");
    button.title = checked ? "Marcar actividad como no vista" : "Marcar actividad como vista";
  }

  function updateActivityNavDone() {
    document.querySelectorAll(".nav-link[href^='#']").forEach((link) => {
      const targetId = (link.getAttribute("href") || "").replace(/^#/, "");
      if (!targetId) {
        return;
      }

      const sectionCard = document.querySelector(".cat-" + targetId);
      if (!sectionCard) {
        return;
      }

      const checks = Array.from(sectionCard.querySelectorAll(".activity-check"));
      if (!checks.length) {
        return;
      }

      const allDone = checks.every((button) => button.classList.contains("checked"));
      link.classList.toggle("done", allDone);
    });
  }

  function notifyGuideProgressChanged() {
    try {
      if (typeof window.updateGuideProgress === "function") {
        window.updateGuideProgress();
      }
    } catch (error) {
    }

    document.dispatchEvent(new CustomEvent("guide-activity-check-change"));
  }

  function initActivityChecks() {
    document.querySelectorAll(".activity").forEach((activity, index) => {
      const header = activity.querySelector(".activity-header");
      if (!header || header.querySelector(".activity-check")) {
        return;
      }

      const activityKey = activityKeyFromElement(activity, index);
      activity.dataset.activityKey = activityKey;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "activity-check";
      button.dataset.activityKey = activityKey;
      button.setAttribute("aria-label", "Marcar actividad como vista");

      const isChecked = localStorage.getItem(activityStorageKey(activityKey)) === "1";
      setActivityCheckState(button, isChecked);

      button.addEventListener("click", function (event) {
        event.stopPropagation();
        const checked = !button.classList.contains("checked");
        localStorage.setItem(activityStorageKey(activityKey), checked ? "1" : "0");
        setActivityCheckState(button, checked);
        updateActivityNavDone();
        notifyGuideProgressChanged();
        queueGuideUiCloudSync();
      });

      const toggle = header.querySelector(".activity-toggle");
      if (toggle) {
        header.insertBefore(button, toggle);
      } else {
        header.appendChild(button);
      }
    });

    updateActivityNavDone();
    notifyGuideProgressChanged();
  }

  function applyCurrentGuideUiState() {
    document.querySelectorAll(".card").forEach(function (card, index) {
      const cardKey = card.dataset.cardKey || cardKeyFromElement(card, index);
      card.dataset.cardKey = cardKey;
      const saved = localStorage.getItem(collapsibleStorageKey("card", cardKey));
      if (saved === "1" || saved === "0") {
        setOpenState(card, saved === "1");
      }
    });

    document.querySelectorAll(".activity").forEach(function (activity, index) {
      const activityKey = activity.dataset.activityKey || activityKeyFromElement(activity, index);
      activity.dataset.activityKey = activityKey;
      const saved = localStorage.getItem(collapsibleStorageKey("activity", activityKey));
      if (saved === "1" || saved === "0") {
        setOpenState(activity, saved === "1");
      }

      const button = activity.querySelector(".activity-check");
      if (button) {
        const checked = localStorage.getItem(activityStorageKey(activityKey)) === "1";
        setActivityCheckState(button, checked);
      }
    });

    applyResponsiveSidebarState();

    updateActivityNavDone();
    notifyGuideProgressChanged();
  }

  async function initializeGuideUiCloudSync() {
    const scopeKey = getCloudScopeKey();
    if (!scopeKey) {
      return;
    }

    const localState = collectGuideUiState();
    const remoteSnapshot = await loadGuideUiCloudSnapshot(true);
    const localHasState = Object.keys(localState).length > 0;
    const remoteIsNewer = snapshotTime(remoteSnapshot) > localUiSnapshotTime();

    if (remoteSnapshot && (!localHasState || remoteIsNewer)) {
      applyGuideUiStateMap(remoteSnapshot.uiState || {});
      saveGuideUiMeta({
        updatedAt: remoteSnapshot.updatedAt || new Date().toISOString(),
        updatedBy: remoteSnapshot.updatedBy || getCloudActor(),
      });
      applyCurrentGuideUiState();
    } else if (localHasState) {
      queueGuideUiCloudSync();
    }

    window.setInterval(async function () {
      if (!isGuideDocumentVisible()) {
        return;
      }

      if (pendingGuideUiSnapshot) {
        return;
      }

      const nextSnapshot = await loadGuideUiCloudSnapshot(false);
      if (!nextSnapshot) {
        return;
      }

      if (snapshotTime(nextSnapshot) > localUiSnapshotTime()) {
        applyGuideUiStateMap(nextSnapshot.uiState || {});
        saveGuideUiMeta({
          updatedAt: nextSnapshot.updatedAt || new Date().toISOString(),
          updatedBy: nextSnapshot.updatedBy || getCloudActor(),
        });
        applyCurrentGuideUiState();
      }
    }, GUIDE_UI_REFRESH_MS);
  }

  window.clearGuideActivityChecks = function () {
    const prefix = templateStorageKey("activity_seen:");
    Object.keys(localStorage).forEach((key) => {
      if (key.indexOf(prefix) === 0) {
        localStorage.removeItem(key);
      }
    });
    queueGuideUiCloudSync();
  };

  window.clearGuideLayoutState = function () {
    const prefixes = [templateStorageKey("card_open:"), templateStorageKey("activity_open:")];
    Object.keys(localStorage).forEach((key) => {
      if (prefixes.some((prefix) => key.indexOf(prefix) === 0)) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem(templateStorageKey("sidebar_hidden"));
    queueGuideUiCloudSync();
  };

  window.toggleCard = function (card) {
    const cardKey =
      card.dataset.cardKey ||
      cardKeyFromElement(card, Array.from(document.querySelectorAll(".card")).indexOf(card));
    card.dataset.cardKey = cardKey;

    const nextState = !card.classList.contains("open");
    setOpenState(card, nextState);
    localStorage.setItem(collapsibleStorageKey("card", cardKey), nextState ? "1" : "0");
    queueGuideUiCloudSync();
  };

  window.toggleActivity = function (activity) {
    const activityKey =
      activity.dataset.activityKey ||
      activityKeyFromElement(
        activity,
        Array.from(document.querySelectorAll(".activity")).indexOf(activity)
      );
    activity.dataset.activityKey = activityKey;

    const nextState = !activity.classList.contains("open");
    setOpenState(activity, nextState);
    localStorage.setItem(
      collapsibleStorageKey("activity", activityKey),
      nextState ? "1" : "0"
    );
    queueGuideUiCloudSync();
  };

  window.setActive = function (element) {
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
    element.classList.add("active");
  };

  window.toggleSidebar = function () {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      if (isMobileViewport()) {
        document.body.classList.remove("sb-hidden");
      }
      sidebar.classList.toggle("open");
    }
  };

  window.hideSidebar = function () {
    document.body.classList.add("sb-hidden");
    localStorage.setItem(templateStorageKey("sidebar_hidden"), "1");
    queueGuideUiCloudSync();
  };

  window.showSidebar = function () {
    document.body.classList.remove("sb-hidden");
    localStorage.setItem(templateStorageKey("sidebar_hidden"), "0");
    queueGuideUiCloudSync();
  };

  function initGuiaTemplateShell() {
    if (guideTemplateBooted) {
      applySelection(currentSelection());
      updateActivityNavDone();
      notifyGuideProgressChanged();
      applyResponsiveSidebarState();
      return;
    }

    guideTemplateBooted = true;
    ensureGuideRevealShell();
    initCollapsibleState();
    initActivityChecks();
    initializeGuideUiCloudSync();
    applySelection(currentSelection());
    bindSidebarLinks();
    updateActivityNavDone();
    notifyGuideProgressChanged();
    applyResponsiveSidebarState();
  }

  window.initGuiaTemplateShell = initGuiaTemplateShell;

  window.addEventListener("pagehide", function () {
    window.flushGuideUiStateSync();
  });
  window.addEventListener("beforeunload", function () {
    window.flushGuideUiStateSync();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      window.flushGuideUiStateSync();
    }
  });

  if (!window.__GUIDE_CONTEXT__) {
    document.addEventListener("DOMContentLoaded", initGuiaTemplateShell);
  }

  window.addEventListener("resize", applyResponsiveSidebarState);
})();
