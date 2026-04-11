(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.productiveStageStore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const LOCAL_KEY = "sena_portal_admin_productive_stage_v1";
  const SCOPE_KEY = "admin:productive-stage";
  const FILE_NAME = "productive-stage-catalog";

  function readJson(raw, fallback) {
    if (!raw) {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function snapshotTime(snapshot) {
    const parsed = Date.parse((snapshot && snapshot.updatedAt) || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function buildStudentIndex(projects) {
    const index = {};
    (Array.isArray(projects) ? projects : []).forEach(function (project) {
      (project.studentUsernameKeys || []).forEach(function (usernameKey) {
        if (!index[usernameKey]) {
          index[usernameKey] = [];
        }
        if (index[usernameKey].indexOf(project.id) === -1) {
          index[usernameKey].push(project.id);
        }
      });
    });
    return index;
  }

  function createEmptySnapshot() {
    return {
      schemaVersion: 1,
      updatedAt: "",
      projects: [],
      reports: [],
      imports: [],
      studentIndex: {},
      lastImportSummary: null,
    };
  }

  function getStudentProjectIds(snapshot, usernameKey) {
    const key = String(usernameKey || "").trim().toLowerCase();
    if (!key) {
      return [];
    }

    const normalizedSnapshot = Object.assign(createEmptySnapshot(), snapshot || {});
    const index =
      normalizedSnapshot.studentIndex && typeof normalizedSnapshot.studentIndex === "object"
        ? normalizedSnapshot.studentIndex
        : {};

    return Array.isArray(index[key]) ? index[key].slice() : [];
  }

  function getStudentProjects(snapshot, usernameKey) {
    const normalizedSnapshot = Object.assign(createEmptySnapshot(), snapshot || {});
    const projectIds = getStudentProjectIds(normalizedSnapshot, usernameKey);
    if (!projectIds.length) {
      return [];
    }

    return normalizedSnapshot.projects.filter(function (project) {
      return projectIds.indexOf(project.id) >= 0;
    });
  }

  function getProjectReports(snapshot, projectId) {
    const normalizedSnapshot = Object.assign(createEmptySnapshot(), snapshot || {});
    if (!projectId) {
      return [];
    }

    return normalizedSnapshot.reports
      .filter(function (report) {
        return report.projectId === projectId;
      })
      .sort(function (left, right) {
        const rightTime = Date.parse(
          (right && (right.importedAt || right.reportDate || right.updatedAt)) || ""
        );
        const leftTime = Date.parse(
          (left && (left.importedAt || left.reportDate || left.updatedAt)) || ""
        );
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });
  }

  function readLocalSnapshot() {
    if (typeof localStorage === "undefined") {
      return createEmptySnapshot();
    }
    return readJson(localStorage.getItem(LOCAL_KEY), createEmptySnapshot());
  }

  function writeLocalSnapshot(snapshot) {
    if (typeof localStorage === "undefined") {
      return false;
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot));
    return true;
  }

  async function readCloudSnapshot() {
    if (
      !root._firebaseDb ||
      typeof root._firebaseDb.cloudGetGuideData !== "function"
    ) {
      return null;
    }

    try {
      return await root._firebaseDb.cloudGetGuideData(SCOPE_KEY, FILE_NAME);
    } catch (error) {
      return null;
    }
  }

  async function writeCloudSnapshot(snapshot) {
    if (
      !root._firebaseDb ||
      typeof root._firebaseDb.cloudSaveGuideData !== "function"
    ) {
      return false;
    }

    try {
      return await root._firebaseDb.cloudSaveGuideData(SCOPE_KEY, FILE_NAME, snapshot);
    } catch (error) {
      return false;
    }
  }

  function mergeImportIntoSnapshot(previousSnapshot, importResult) {
    const base = Object.assign(createEmptySnapshot(), previousSnapshot || {});
    const nextProjects = Array.isArray(base.projects) ? base.projects.slice() : [];
    const nextReports = Array.isArray(base.reports) ? base.reports.slice() : [];
    const nextImports = Array.isArray(base.imports) ? base.imports.slice() : [];

    (importResult.projects || []).forEach(function (project) {
      const index = nextProjects.findIndex(function (item) {
        return item.id === project.id;
      });
      if (index >= 0) {
        nextProjects[index] = Object.assign({}, nextProjects[index], project, {
          createdAt: nextProjects[index].createdAt || project.createdAt,
          updatedAt: importResult.importedAt,
        });
      } else {
        nextProjects.push(project);
      }
    });

    (importResult.reports || []).forEach(function (report) {
      const exists = nextReports.some(function (item) {
        return item.reportId === report.reportId;
      });
      if (!exists) {
        nextReports.push(report);
      }
    });

    nextImports.push({
      importBatchId: importResult.importBatchId,
      sourceFileName: importResult.sourceFileName,
      importedAt: importResult.importedAt,
      summary: importResult.summary,
      alerts: importResult.alerts || [],
    });

    return {
      schemaVersion: 1,
      updatedAt: importResult.importedAt,
      projects: nextProjects,
      reports: nextReports,
      imports: nextImports,
      studentIndex: buildStudentIndex(nextProjects),
      lastImportSummary: {
        importBatchId: importResult.importBatchId,
        sourceFileName: importResult.sourceFileName,
        importedAt: importResult.importedAt,
        summary: importResult.summary,
        alerts: importResult.alerts || [],
      },
    };
  }

  async function loadSnapshot() {
    const localSnapshot = readLocalSnapshot();
    const cloudSnapshot = await readCloudSnapshot();
    if (!cloudSnapshot) {
      return Object.assign(createEmptySnapshot(), localSnapshot);
    }
    return snapshotTime(cloudSnapshot) >= snapshotTime(localSnapshot)
      ? Object.assign(createEmptySnapshot(), cloudSnapshot)
      : Object.assign(createEmptySnapshot(), localSnapshot);
  }

  async function saveSnapshot(snapshot) {
    const normalized = Object.assign(createEmptySnapshot(), snapshot || {});
    const savedLocal = writeLocalSnapshot(normalized);
    const savedCloud = await writeCloudSnapshot(normalized);
    return {
      ok: savedLocal || savedCloud,
      savedLocal: savedLocal,
      savedCloud: savedCloud,
    };
  }

  return {
    LOCAL_KEY: LOCAL_KEY,
    SCOPE_KEY: SCOPE_KEY,
    FILE_NAME: FILE_NAME,
    createEmptySnapshot: createEmptySnapshot,
    mergeImportIntoSnapshot: mergeImportIntoSnapshot,
    loadSnapshot: loadSnapshot,
    saveSnapshot: saveSnapshot,
    buildStudentIndex: buildStudentIndex,
    getStudentProjectIds: getStudentProjectIds,
    getStudentProjects: getStudentProjects,
    getProjectReports: getProjectReports,
  };
});
