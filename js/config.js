// =====================================================================
// FIREBASE CONFIGURATION
// =====================================================================
// Credenciales del proyecto Firebase. Son públicas (se envían al cliente)
// por lo que la seguridad debe reforzarse con Firebase Realtime Database
// Rules en la consola de Firebase.

// Namespace único para esta app dentro de la Realtime Database.
// Todas las rutas (tareas, contador, usuarios) cuelgan de aquí para
// evitar colisiones con otras apps que compartan la misma base de datos.
export const APP_NAMESPACE = 'tablero_kanban_v2';

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

// =====================================================================
// LABELS / ETIQUETAS
// =====================================================================
// Etiquetas predefinidas con colores para categorizar tareas.
// Cada etiqueta tiene: id, name (texto mostrado), y clases Tailwind.
// También se pueden crear etiquetas personalizadas que se guardan
// en localStorage bajo la clave `kanban-custom-labels`.

const CUSTOM_LABELS_KEY = 'kanban-custom-labels';

// Paleta de colores disponibles para etiquetas personalizadas.
export const COLOR_PALETTE = [
    { id: 'slate',   dot: 'bg-slate-500',   bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-300' },
    { id: 'pink',    dot: 'bg-pink-500',    bg: 'bg-pink-100',    text: 'text-pink-700',    border: 'border-pink-300' },
    { id: 'teal',    dot: 'bg-teal-500',    bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-300' },
    { id: 'indigo',  dot: 'bg-indigo-500',  bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-300' },
    { id: 'cyan',    dot: 'bg-cyan-500',    bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-300' },
    { id: 'amber',   dot: 'bg-amber-500',   bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300' },
    { id: 'lime',    dot: 'bg-lime-500',    bg: 'bg-lime-100',    text: 'text-lime-700',    border: 'border-lime-300' },
    { id: 'rose',    dot: 'bg-rose-500',    bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-300' }
];

// Etiquetas predefinidas (siempre disponibles, no editables)
const PREDEFINED_LABELS = [
    { id: 'trabajo',    name: 'Trabajo',    bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-300', predefined: true },
    { id: 'personal',   name: 'Personal',   bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', border: 'border-green-300', predefined: true },
    { id: 'urgente',    name: 'Urgente',    bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500',   border: 'border-red-300', predefined: true },
    { id: 'idea',       name: 'Idea',       bg: 'bg-purple-100',text: 'text-purple-700',dot: 'bg-purple-500',border: 'border-purple-300', predefined: true },
    { id: 'importante', name: 'Importante', bg: 'bg-yellow-100',text: 'text-yellow-700',dot: 'bg-yellow-500',border: 'border-yellow-300', predefined: true },
    { id: 'estudio',    name: 'Estudio',    bg: 'bg-orange-100',text: 'text-orange-700',dot: 'bg-orange-500',border: 'border-orange-300', predefined: true }
];

/** Obtiene las etiquetas personalizadas desde localStorage. */
function getCustomLabels() {
    try {
        return JSON.parse(localStorage.getItem(CUSTOM_LABELS_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveCustomLabels(labels) {
    localStorage.setItem(CUSTOM_LABELS_KEY, JSON.stringify(labels));
}

/** Devuelve todas las etiquetas (predefinidas + personalizadas). */
export function getAllLabels() {
    return [...PREDEFINED_LABELS, ...getCustomLabels()];
}

/** Devuelve solo las etiquetas predefinidas. */
export function getPredefinedLabels() {
    return PREDEFINED_LABELS;
}

/**
 * Añade una etiqueta personalizada.
 * @param {string} name - Nombre visible de la etiqueta
 * @param {string} colorId - Id del color de COLOR_PALETTE
 * @returns {Object} La etiqueta creada
 */
export function addCustomLabel(name, colorId) {
    const color = COLOR_PALETTE.find(c => c.id === colorId) || COLOR_PALETTE[0];
    const customLabels = getCustomLabels();
    const id = 'custom_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newLabel = {
        id,
        name,
        bg: color.bg,
        text: color.text,
        dot: color.dot,
        border: color.border,
        predefined: false
    };
    customLabels.push(newLabel);
    saveCustomLabels(customLabels);
    return newLabel;
}

/** Elimina una etiqueta personalizada por su id. */
export function deleteCustomLabel(labelId) {
    const customLabels = getCustomLabels().filter(l => l.id !== labelId);
    saveCustomLabels(customLabels);
}

/**
 * Devuelve el objeto de una etiqueta por su id, o null si no existe.
 */
export function getLabelById(id) {
    return getAllLabels().find(l => l.id === id) || null;
}

/**
 * Devuelve la siguiente etiqueta en el ciclo (para cambiar al hacer clic).
 * Si la actual es null/undefined, devuelve la primera.
 */
export function getNextLabel(currentId) {
    const all = getAllLabels();
    if (!currentId) return all[0] || null;
    const idx = all.findIndex(l => l.id === currentId);
    if (idx === -1 || idx === all.length - 1) return null; // null = sin etiqueta
    return all[idx + 1];
}

// Versión del esquema de exportación (para compatibilidad hacia atrás)
export const EXPORT_VERSION = '2.0-firebase';

// Tiempo máximo (ms) que esperaremos a Firebase antes de reactivar el
// formulario en modo local-only.
export const FIREBASE_LOAD_TIMEOUT_MS = 10000;

// =====================================================================
// APP VERSION
// =====================================================================
// Se incrementa en cada despliegue importante. Si la versión almacenada
// en localStorage no coincide, borramos IndexedDB (caché de Firebase SDK)
// y recargamos para forzar datos frescos desde el servidor.
export const APP_VERSION = '24';
