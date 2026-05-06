(function () {
  const GRADES_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

  function normalizeForMatch(str) {
    return String(str || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ").trim();
  }

  function validateExcelFile(file) {
    if (!file) {
      return { ok: false, message: "Selecciona un archivo Excel." };
    }
    const name = String(file.name || "").toLowerCase();
    if (!/(\.xlsx|\.xls)$/i.test(name)) {
      return { ok: false, message: "Solo se permiten archivos Excel .xlsx o .xls." };
    }
    if (file.size > GRADES_IMPORT_MAX_BYTES) {
      return { ok: false, message: "El archivo Excel supera el limite de 10 MB." };
    }
    return { ok: true };
  }

  const EXCEL_GUIDE_SIGNATURES = [
    {
      guideFamily: "guia-01-induccion",
      keywords: ["arbol de la vida", "árbol de la vida", "logo-simbolos", "logo-símbolos", "diseño curricular", "reglamento del aprendiz"],
      descToActivity: {
        arbol: "arbol312",
        "árbol": "arbol312",
        logo: "sena331",
        simbolo: "sena331",
        "símbolo": "sena331",
        cuestionario: "programa332",
        "diseño curricular": "programa332",
        "diseno curricular": "programa332",
        reglamento: "reglamento333",
        plataforma: "plataformas334",
        portafolio: "portafolio342",
      },
    },
    {
      guideFamily: "guia-02-herramientas",
      keywords: ["extensiones", "sistemas operativos", "colaborativas", "reto de transferencia"],
      descToActivity: {
        extensi: "extensiones331",
        "sistema operativo": "sistemas332",
        colaborativ: "colaborativas334",
        reto: "transferReto341",
        transferencia: "transferReto341",
      },
    },
    {
      guideFamily: "guia-redes-rap01",
      keywords: ["tipos de redes", "topologias", "topologías", "medios de transmision", "medios de transmisión", "dispositivos", "modelo osi", "laboratorio"],
      descToActivity: {
        reflexi: "reflexion311",
        socializaci: "socializacion311",
        "tipos de red": "bloqueA",
        topolog: "bloqueB",
        medios: "bloqueC",
        dispositivo: "bloqueD",
        osi: "bloqueE",
        "ip 1": "ip1",
        "ip 3": "ip3",
        "laboratorio 1": "lab1",
        "laboratorio 2": "lab2",
        "laboratorio 3": "lab3",
        social: "social",
      },
    },
    {
      guideFamily: "guia-06-planificar",
      keywords: ["bitacora", "bitácora", "tabla resumen", "mapa conceptual", "checklist", "diagnostico", "diagnóstico", "presupuesto"],
      descToActivity: {
        bitacora: "bitacora311",
        "bitácora": "bitacora311",
        socializaci: "socializacion312",
        "tabla resumen": "tabla321",
        mapa: "mapa322",
        checklist: "checklist331",
        diagnosti: "diagnostico332",
        "diagnósti": "diagnostico332",
        diagnostico: "diagnostico332",
        presupuesto: "presupuesto341",
      },
    },
    {
      guideFamily: "guia-05-herramientas",
      keywords: ["bitacora de analisis", "bitácora de análisis", "evidencias de herramientas", "informe final integrador"],
      descToActivity: {
        bitacora: "guia5-311",
        "bitácora": "guia5-311",
        evidencia: "guia5-331",
        informe: "guia5-341",
      },
    },
  ];

  function detectGuideSignature(evidenceDescriptions) {
    const combined = evidenceDescriptions.map(normalizeForMatch).join(" ");
    return EXCEL_GUIDE_SIGNATURES.find((signature) =>
      signature.keywords.some((keyword) => combined.includes(normalizeForMatch(keyword)))
    ) || null;
  }

  function mapDescToActivity(desc, descToActivity) {
    const norm = normalizeForMatch(desc);
    for (const [key, activityId] of Object.entries(descToActivity)) {
      if (norm.includes(normalizeForMatch(key))) {
        return activityId;
      }
    }
    return null;
  }

  function parseWorkbook(wb) {
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const data = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    const evidenceDescriptions = [];

    for (let rowIndex = 12; rowIndex <= 19; rowIndex += 1) {
      const row = data[rowIndex] || [];
      const evidenceNumber = String(row[1] || "").trim();
      const description = String(row[2] || "").trim();
      if (evidenceNumber && description) {
        evidenceDescriptions.push(description);
      }
    }

    const signature = detectGuideSignature(evidenceDescriptions);
    if (!signature) {
      return { error: "No se reconocio el tipo de guia en este archivo." };
    }

    const evidenceToActivity = {};
    for (let rowIndex = 12; rowIndex <= 19; rowIndex += 1) {
      const row = data[rowIndex] || [];
      const evidenceNumber = parseInt(String(row[1] || "").trim(), 10);
      const description = String(row[2] || "").trim();
      if (!Number.isNaN(evidenceNumber) && description) {
        const activityId = mapDescToActivity(description, signature.descToActivity);
        if (activityId) evidenceToActivity[evidenceNumber] = activityId;
      }

      const secondEvidenceNumber = parseInt(String(row[21] || "").trim(), 10);
      const secondDescription = String(row[22] || "").trim();
      if (!Number.isNaN(secondEvidenceNumber) && secondDescription) {
        const activityId = mapDescToActivity(secondDescription, signature.descToActivity);
        if (activityId) evidenceToActivity[secondEvidenceNumber] = activityId;
      }
    }

    const JUICIO_COL_OFFSET = 19;
    const NAME_COL = 0;
    const STOP_KEYWORDS = [
      "juicio de evaluaci",
      "causas de deserci",
      "instructor",
      "ana lucelia",
      "dora lilia",
      "gladys forero",
      "luz edilsa",
      "orfidio",
      "fanny quiros",
    ];
    const students = [];

    for (let rowIndex = 23; rowIndex < data.length; rowIndex += 1) {
      const row = data[rowIndex] || [];
      const rawName = String(row[NAME_COL] || "").trim();
      if (!rawName || rawName.length < 4) continue;

      const normalizedName = normalizeForMatch(rawName);
      if (STOP_KEYWORDS.some((keyword) => normalizedName.startsWith(normalizeForMatch(keyword)))) {
        continue;
      }

      const grades = {};
      Object.entries(evidenceToActivity).forEach(([evidenceNumberText, activityId]) => {
        const evidenceNumber = parseInt(evidenceNumberText, 10);
        const columnIndex = JUICIO_COL_OFFSET + (evidenceNumber - 1);
        const value = String(row[columnIndex] || "").trim().toUpperCase();
        if (value === "A" || value === "D") {
          grades[activityId] = value;
        }
      });

      students.push({ name: rawName, grades });
    }

    return { guideFamily: signature.guideFamily, students };
  }

  function applyParsedGrades(guideFamily, students, allUsers, gradesManager) {
    if (!gradesManager) return { saved: 0, unmatched: [] };

    let saved = 0;
    const unmatched = [];

    students.forEach(({ name, grades }) => {
      if (!Object.keys(grades).length) return;
      const normExcel = normalizeForMatch(name);
      let user = allUsers.find((item) => normalizeForMatch(item.fullName) === normExcel);
      if (!user) {
        const parts = normExcel.split(" ");
        const lastNames = parts.slice(0, 2).join(" ");
        user = allUsers.find((item) => {
          const normalizedFullName = normalizeForMatch(item.fullName);
          return normalizedFullName === lastNames ||
            normalizedFullName.startsWith(lastNames + " ") ||
            normalizedFullName.includes(lastNames);
        });
      }
      if (!user) {
        unmatched.push(name);
        return;
      }

      const existing = gradesManager.getStudentGrades(user.usernameKey, guideFamily) || {};
      const merged = Object.assign({}, existing, grades);
      gradesManager.setStudentGrades(user.usernameKey, guideFamily, merged);
      saved += 1;
    });

    return { saved, unmatched };
  }

  window.adminGrades = Object.freeze({
    GRADES_IMPORT_MAX_BYTES,
    normalizeForMatch,
    parseWorkbook,
    applyParsedGrades,
    validateExcelFile,
  });
})();
