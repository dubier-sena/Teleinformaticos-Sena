(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.productiveStageImport = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const runtimeScope =
    typeof self !== "undefined"
      ? self
      : typeof window !== "undefined"
        ? window
        : typeof globalThis !== "undefined"
          ? globalThis
          : {};
  const STATUS_MAP = {
    completo: "Completo",
    parcial: "Parcial",
    incompleto: "Incompleto",
  };

  function toAscii(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function normalizeKey(value) {
    return toAscii(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function sanitizeFilePart(value) {
    return toAscii(value)
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  }

  function normalizeReportText(rawText) {
    return String(rawText || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "\n")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function splitNames(value) {
    return String(value || "")
      .replace(/\s+y\s+/gi, " & ")
      .split(/\s*&\s*|,\s*/g)
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function isHeadingLine(line) {
    return /^(GRADO\s+11[AB]|Ficha\s+\d+|GRUPO\s+\d+|Estado del documento:|📋|🌟|🔧|💡)/i.test(
      line
    );
  }

  function isProjectTitle(line) {
    if (!line) {
      return false;
    }
    if (isHeadingLine(line)) {
      return false;
    }
    if (/^(👤|🎯|🛠️)/.test(line)) {
      return false;
    }
    return true;
  }

  function normalizeStatus(value) {
    const key = normalizeKey(
      String(value || "")
        .replace(/estado del documento:/i, "")
        .replace(/[✅⚠️❌]/g, "")
    );
    if (key.indexOf("completo") >= 0) {
      return STATUS_MAP.completo;
    }
    if (key.indexOf("parcial") >= 0) {
      return STATUS_MAP.parcial;
    }
    if (key.indexOf("incompleto") >= 0) {
      return STATUS_MAP.incompleto;
    }
    return "Sin estado";
  }

  function createUserMatchIndex(users) {
    const byName = {};
    (Array.isArray(users) ? users : []).forEach(function (user) {
      const key = normalizeKey(user && user.fullName);
      if (!key) {
        return;
      }
      byName[key] = {
        usernameKey: String(user.usernameKey || "").trim().toLowerCase(),
        fullName: user.fullName || "",
        ficha: String(user.ficha || "").trim(),
      };
    });
    return byName;
  }

  function matchStudentNames(studentNames, users, projectTitle) {
    const index = createUserMatchIndex(users);
    const matches = [];
    const alerts = [];

    studentNames.forEach(function (name) {
      const candidate = index[normalizeKey(name)];
      if (candidate) {
        matches.push(candidate.usernameKey);
      } else {
        alerts.push({
          type: "student-unmatched",
          projectTitle: projectTitle || "",
          studentName: name,
          message: "No se encontro coincidencia exacta para el aprendiz importado.",
        });
      }
    });

    return {
      usernames: matches.filter(Boolean),
      alerts: alerts,
    };
  }

  function consumeSectionLines(lines, startIndex) {
    const values = [];
    let index = startIndex;
    while (index < lines.length) {
      const line = lines[index];
      if (
        /^(🌟 FORTALEZAS|🔧 ASPECTOS A MEJORAR|💡 Nota del asesor:|📋 RESUMEN DEL PROYECTO|GRUPO\s+\d+|GRADO\s+11[AB]|Ficha\s+\d+)/i.test(
          line
        )
      ) {
        break;
      }
      values.push(line);
      index += 1;
    }
    return {
      text: values.join(" ").trim(),
      nextIndex: index,
    };
  }

  function consumeBulletSection(lines, startIndex) {
    const values = [];
    let index = startIndex;
    while (index < lines.length) {
      const line = lines[index];
      if (/^(💡 Nota del asesor:|📋 RESUMEN DEL PROYECTO|🌟 FORTALEZAS|🔧 ASPECTOS A MEJORAR|GRUPO\s+\d+|GRADO\s+11[AB]|Ficha\s+\d+)/i.test(line)) {
        break;
      }
      const normalized = line.replace(/^[✔→•\-\s]+/u, "").trim();
      if (normalized) {
        values.push(normalized);
      }
      index += 1;
    }
    return {
      items: values,
      nextIndex: index,
    };
  }

  function projectIdForRecord(record) {
    return [
      "productive",
      sanitizeFilePart(record.ficha),
      sanitizeFilePart(record.projectTitle),
    ]
      .filter(Boolean)
      .join(":");
  }

  function reportIdForRecord(record, importBatchId) {
    return [record.id, sanitizeFilePart(importBatchId || "batch")].join(":");
  }

  function parseProductiveStageReportText(rawText, options) {
    const text = normalizeReportText(rawText);
    const lines = text
      .split("\n")
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);

    const importedAt = options && options.importedAt ? options.importedAt : new Date().toISOString();
    const importBatchId =
      (options && options.importBatchId) || "batch-" + importedAt.replace(/[^0-9]/g, "").slice(0, 14);
    const sourceFileName = (options && options.sourceFileName) || "informe.docx";
    const users = (options && options.users) || [];

    const projects = [];
    const reports = [];
    const alerts = [];
    const summary = {
      totalProjects: 0,
      totalReports: 0,
      statusCounts: {
        Completo: 0,
        Parcial: 0,
        Incompleto: 0,
        "Sin estado": 0,
      },
      matchedStudents: 0,
      unmatchedStudents: 0,
    };

    let currentGrade = "";
    let currentFicha = "";
    let currentGroupCategory = "";

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (/^GRADO\s+(11[AB])/i.test(line)) {
        currentGrade = line.match(/^GRADO\s+(11[AB])/i)[1].toUpperCase();
        continue;
      }

      if (/^Ficha\s+(\d{6,})/i.test(line)) {
        currentFicha = line.match(/^Ficha\s+(\d{6,})/i)[1];
        continue;
      }

      if (/^GRUPO\s+\d+\s+·\s+/i.test(line)) {
        currentGroupCategory = line;
        continue;
      }

      const nextLine = lines[index + 1] || "";
      if (!isProjectTitle(line) || !/^👤\s*/.test(nextLine)) {
        continue;
      }

      const record = {
        id: "",
        ficha: currentFicha,
        grado: currentGrade,
        groupCategory: currentGroupCategory,
        projectTitle: line,
        studentNames: [],
        studentUsernameKeys: [],
        population: "",
        tool: "",
        currentStatus: "Sin estado",
        lastReportType: "Retroalimentacion",
        lastReportAt: importedAt,
        sourceFileName: sourceFileName,
        importBatchId: importBatchId,
        createdAt: importedAt,
        updatedAt: importedAt,
      };

      const studentNames = splitNames(nextLine.replace(/^👤\s*/, ""));
      record.studentNames = studentNames;
      index += 1;

      while (index + 1 < lines.length) {
        const currentLine = lines[index + 1];

        if (/^🎯\s*Poblacion:/i.test(currentLine)) {
          record.population = currentLine.replace(/^🎯\s*Poblacion:\s*/i, "").trim();
          index += 1;
          continue;
        }

        if (/^🛠️?\s*Herramienta:/i.test(currentLine)) {
          record.tool = currentLine.replace(/^🛠️?\s*Herramienta:\s*/i, "").trim();
          index += 1;
          continue;
        }

        if (/^Estado del documento:/i.test(currentLine)) {
          record.currentStatus = normalizeStatus(currentLine);
          index += 1;
          continue;
        }

        if (/^📋 RESUMEN DEL PROYECTO/i.test(currentLine)) {
          const consumedSummary = consumeSectionLines(lines, index + 2);
          record.summary = consumedSummary.text;
          index = consumedSummary.nextIndex - 1;
          continue;
        }

        if (/^🌟 FORTALEZAS/i.test(currentLine)) {
          const consumedStrengths = consumeBulletSection(lines, index + 2);
          record.strengths = consumedStrengths.items;
          index = consumedStrengths.nextIndex - 1;
          continue;
        }

        if (/^🔧 ASPECTOS A MEJORAR/i.test(currentLine)) {
          const consumedImprovements = consumeBulletSection(lines, index + 2);
          record.improvements = consumedImprovements.items;
          index = consumedImprovements.nextIndex - 1;
          continue;
        }

        if (/^💡 Nota del asesor:/i.test(currentLine)) {
          record.advisorNote = currentLine.replace(/^💡 Nota del asesor:\s*/i, "").trim();
          index += 1;
          continue;
        }

        if (
          /^GRUPO\s+\d+\s+·\s+/i.test(currentLine) ||
          /^GRADO\s+11[AB]/i.test(currentLine) ||
          /^Ficha\s+\d{6,}/i.test(currentLine) ||
          (isProjectTitle(currentLine) && /^👤\s*/.test(lines[index + 2] || ""))
        ) {
          break;
        }

        index += 1;
      }

      const matched = matchStudentNames(record.studentNames, users, record.projectTitle);
      record.studentUsernameKeys = matched.usernames;
      alerts.push.apply(alerts, matched.alerts);
      summary.matchedStudents += matched.usernames.length;
      summary.unmatchedStudents += matched.alerts.length;

      if (!record.ficha || !record.grado) {
        alerts.push({
          type: "project-context-missing",
          projectTitle: record.projectTitle,
          message: "El proyecto no quedo asociado a ficha o grado durante la importacion.",
        });
      }

      record.id = projectIdForRecord(record);
      projects.push(record);
      reports.push({
        reportId: reportIdForRecord(record, importBatchId),
        projectId: record.id,
        reportType: "Retroalimentacion",
        status: record.currentStatus,
        summary: record.summary || "",
        strengths: record.strengths || [],
        improvements: record.improvements || [],
        advisorNote: record.advisorNote || "",
        sourceFileName: sourceFileName,
        importBatchId: importBatchId,
        importedAt: importedAt,
        reportDate: importedAt,
      });

      summary.totalProjects += 1;
      summary.totalReports += 1;
      if (!summary.statusCounts[record.currentStatus]) {
        summary.statusCounts[record.currentStatus] = 0;
      }
      summary.statusCounts[record.currentStatus] += 1;
    }

    return {
      sourceFileName: sourceFileName,
      importBatchId: importBatchId,
      importedAt: importedAt,
      projects: projects,
      reports: reports,
      alerts: alerts,
      summary: summary,
    };
  }

  async function extractRawTextFromDocxArrayBuffer(arrayBuffer) {
    if (!arrayBuffer) {
      throw new Error("No se recibio contenido del archivo DOCX.");
    }
    if (!runtimeScope.mammoth || typeof runtimeScope.mammoth.extractRawText !== "function") {
      throw new Error("La libreria Mammoth no esta disponible en el navegador.");
    }
    const result = await runtimeScope.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return normalizeReportText((result && result.value) || "");
  }

  return {
    normalizeReportText: normalizeReportText,
    parseProductiveStageReportText: parseProductiveStageReportText,
    extractRawTextFromDocxArrayBuffer: extractRawTextFromDocxArrayBuffer,
    normalizeKey: normalizeKey,
  };
});
