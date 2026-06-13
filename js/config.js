// =====================================================================
// FIREBASE CONFIGURATION
// =====================================================================
// Credenciales del proyecto Firebase. Son públicas (se envían al cliente)
// por lo que la seguridad debe reforzarse con Firebase Realtime Database
// Rules en la consola de Firebase.
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBfjYWT2Ex9V4x6ec9Ko1VyJxK_sdhsDpA",
    authDomain: "ledemisorreceptor.firebaseapp.com",
    databaseURL: "https://ledemisorreceptor-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ledemisorreceptor",
    storageBucket: "ledemisorreceptor.firebasestorage.app",
    messagingSenderId: "20805551895",
    appId: "1:20805551895:web:f7ee7ccbb900f8b5ee9952"
};

// =====================================================================
// VALID TASK STATUSES
// =====================================================================
// Lista blanca de estados. Usada en renderTask, moveTask, drop e
// importTasks para evitar tareas con estados inválidos que quedarían
// en el array `state.tasks` pero sin columna en el DOM.
export const VALID_STATUSES = ['no-iniciado', 'en-proceso', 'finalizado'];

// Versión del esquema de exportación (para compatibilidad hacia atrás)
export const EXPORT_VERSION = '2.0-firebase';

// Tiempo máximo (ms) que esperaremos a Firebase antes de reactivar el
// formulario en modo local-only.
export const FIREBASE_LOAD_TIMEOUT_MS = 10000;
