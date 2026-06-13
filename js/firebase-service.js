// =====================================================================
// SERVICIO DE FIREBASE
// =====================================================================
// Encapsula la inicialización del SDK compat, las referencias a la
// Realtime Database, el monitor de conexión y la carga inicial del
// contador de IDs.

import { FIREBASE_CONFIG } from './config.js';
import { state } from './state.js';

let db = null;
let tasksRef = null;
let counterRef = null;

/**
 * Inicializa Firebase y guarda referencias internas.
 * Idempotente: si ya está inicializado, no hace nada.
 */
export function initFirebase() {
    if (db) return;
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    tasksRef = db.ref('kanban/tasks');
    counterRef = db.ref('kanban/taskCounter');
}

export function getTasksRef() {
    return tasksRef;
}

export function getCounterRef() {
    return counterRef;
}

export function getDB() {
    return db;
}

/**
 * Suscribe un callback al estado de conexión de Firebase.
 * @param {(connected: boolean) => void} callback
 */
export function monitorConnection(callback) {
    if (!db) return;
    db.ref('.info/connected').on('value', snapshot => {
        callback(snapshot.val() === true);
    });
}

/**
 * Lee el contador de IDs remoto una sola vez y lo guarda en `state`.
 * Es una optimización: el listener de tareas también recalcula este
 * valor, pero tenerlo listo antes evita asignar IDs duplicados al
 * crear tareas en los primeros milisegundos tras cargar la página.
 */
export function loadCounterFromFirebase() {
    if (!counterRef) return Promise.resolve();
    return counterRef.once('value').then(snapshot => {
        state.taskCounter = snapshot.val() || 0;
    });
}

/**
 * Actualiza el indicador visual de estado de Firebase en el header.
 * Separado del monitor para que `monitorConnection` no dependa de
 * elementos del DOM concretos.
 */
export function renderConnectionStatus(connected) {
    const statusEl = document.getElementById('firebaseStatus');
    if (!statusEl) return;
    if (connected) {
        statusEl.className = 'firebase-status connected';
        statusEl.textContent = '\ud83d\udfe2 Conectado a Firebase';
    } else {
        statusEl.className = 'firebase-status disconnected';
        statusEl.textContent = '\ud83d\udd34 Desconectado de Firebase';
    }
}
