// Configuracion de Firebase para el Portal SENA.
// Este archivo se carga antes de firebase_db.js para activar la sincronizacion
// en la nube de usuarios y progreso de aprendices.
// La apiKey de Firebase es publica por diseno; la seguridad se gestiona
// en las Firestore Rules del proyecto.
window.PORTAL_FIREBASE_CONFIG = {
  enabled: true,
  projectId: "sena-portal",
  apiKey: "AIzaSyC0zKUJGVcT0aYcujZyrRBtsbVo1VjBkAA",
};
