const path = require("path");

const store = require(path.join(process.cwd(), "js", "productive_stage_store.js"));

if (typeof store.getProjectDeliveries !== "function") {
  throw new Error("Falta el helper getProjectDeliveries en productive_stage_store.js");
}

if (typeof store.appendProjectDeliveryToSnapshot !== "function") {
  throw new Error("Falta el helper appendProjectDeliveryToSnapshot en productive_stage_store.js");
}

const baseSnapshot = {
  schemaVersion: 1,
  updatedAt: "2026-04-11T08:00:00.000Z",
  projects: [
    {
      id: "project-alpha",
      projectTitle: "Proyecto Alpha",
      studentUsernameKeys: ["ana", "carlos"],
    },
  ],
  reports: [],
  imports: [],
  deliveries: [],
  studentIndex: {
    ana: ["project-alpha"],
    carlos: ["project-alpha"],
  },
  lastImportSummary: null,
};

const updatedSnapshot = store.appendProjectDeliveryToSnapshot(baseSnapshot, {
  deliveryId: "delivery-002",
  projectId: "project-alpha",
  projectTitle: "Proyecto Alpha",
  uploadedAt: "2026-04-11T09:30:00.000Z",
  uploadedByName: "Carlos Perez",
  uploadedByUsernameKey: "carlos",
  driveUrl: "https://drive.google.com/file/d/mock/view",
  savedFileName: "Carlos_Avance-Proyecto.docx",
});

const firstSnapshot = store.appendProjectDeliveryToSnapshot(updatedSnapshot, {
  deliveryId: "delivery-001",
  projectId: "project-alpha",
  projectTitle: "Proyecto Alpha",
  uploadedAt: "2026-04-10T09:30:00.000Z",
  uploadedByName: "Ana Gomez",
  uploadedByUsernameKey: "ana",
  driveUrl: "https://drive.google.com/file/d/mock-old/view",
  savedFileName: "Ana_Avance-Proyecto.docx",
});

const deliveries = store.getProjectDeliveries(firstSnapshot, "project-alpha");
if (!Array.isArray(deliveries) || deliveries.length !== 2) {
  throw new Error("getProjectDeliveries no devolvio el historial completo del proyecto.");
}

if (deliveries[0].deliveryId !== "delivery-002") {
  throw new Error("getProjectDeliveries no ordeno primero la entrega mas reciente.");
}

if (!Array.isArray(firstSnapshot.deliveries) || firstSnapshot.deliveries.length !== 2) {
  throw new Error("appendProjectDeliveryToSnapshot no agrego correctamente las entregas.");
}

console.log("OK: productive_stage_store guarda y lista entregas de avance por proyecto.");
