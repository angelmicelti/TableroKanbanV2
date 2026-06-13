// =====================================================================
// PUNTO DE ENTRADA DE LA APLICACIÓN
// =====================================================================
// Conecta los módulos, configura el formulario, drag&drop, PWA y
// aplica event delegation para los botones dinámicos de las tareas.

import { state }                  from './state.js';
import { VALID_STATUSES, FIREBASE_LOAD_TIMEOUT_MS } from './config.js';
import { showMessage, toggleSection } from './utils.js';
import {
    initFirebase,
    monitorConnection,
    loadCounterFromFirebase,
    renderConnectionStatus
} from './firebase-service.js';
import {
    setupTasksListener,
    addTask,
    deleteTask,
    moveTask,
    editTask,
    clearAllTasks,
    updateCounts
} from './tasks.js';
import { exportTasks, importTasks } from './import-export.js';
import {
    setupInstallButton,
    registerServiceWorker,
    isRunningAsPWA
} from './pwa.js';

// ---------------------------------------------------------------------
// Event delegation
// ---------------------------------------------------------------------
// Un solo listener global para clicks y dblclicks. Cada elemento
// interactivo lleva un data-action y los data-attributes que necesite.

function setupGlobalEventDelegation() {
    document.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;

        switch (action) {
            case 'edit-task':
                editTask(parseInt(target.dataset.taskId, 10));
                break;
            case 'delete-task':
                deleteTask(parseInt(target.dataset.taskId, 10));
                break;
            case 'move-task':
                moveTask(parseInt(target.dataset.taskId, 10), target.dataset.targetStatus);
                break;
            case 'export-tasks':
                exportTasks();
                break;
            case 'clear-tasks':
                clearAllTasks();
                break;
            case 'toggle-section':
                toggleSection(target.dataset.sectionId);
                break;
        }
    });

    document.addEventListener('dblclick', e => {
        const target = e.target.closest('[data-action="edit-task"]');
        if (target) {
            editTask(parseInt(target.dataset.taskId, 10));
        }
    });
}

// ---------------------------------------------------------------------
// Formulario
// ---------------------------------------------------------------------

function setupForm() {
    const form = document.getElementById('taskForm');
    if (form) {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const input = document.getElementById('taskInput');
            const text = input.value.trim();
            if (text) {
                addTask(text);
                input.value = '';
            }
        });
    }

    const fileInput = document.getElementById('importFile');
    if (fileInput) {
        fileInput.addEventListener('change', importTasks);
    }
}

/**
 * Desactiva el formulario hasta que Firebase haya cargado los datos
 * remotos. Esto evita que `saveTasksToFirebase` sobrescriba tareas
 * remotas con el estado local vacío. Incluye un timeout de seguridad
 * para que, si Firebase no responde (offline, reglas restrictivas,
 * etc.), el usuario no quede bloqueado indefinidamente.
 */
function disableFormUntilFirebaseLoads(onLoaded) {
    const taskInput = document.getElementById('taskInput');
    const submitButton = document.querySelector('#taskForm button[type="submit"]');

    if (taskInput)   taskInput.disabled = true;
    if (submitButton) submitButton.disabled = true;

    setTimeout(() => {
        if (!state.isFirebaseLoaded) {
            if (taskInput)   taskInput.disabled = false;
            if (submitButton) submitButton.disabled = false;
            console.warn(`Firebase no carg\u00f3 en ${FIREBASE_LOAD_TIMEOUT_MS}ms; formulario reactivado en modo local.`);
            showMessage('\u26a0\ufe0f Sin conexi\u00f3n a Firebase. Trabajando en modo local.', 'info');
        }
    }, FIREBASE_LOAD_TIMEOUT_MS);

    // Devolvemos una función que main.js invocará cuando Firebase
    // termine de cargar para reactivar el formulario antes del timeout
    return () => {
        if (taskInput)   taskInput.disabled = false;
        if (submitButton) submitButton.disabled = false;
    };
}

// ---------------------------------------------------------------------
// Drag & Drop
// ---------------------------------------------------------------------

function setupDragAndDrop() {
    // Drag start: delegación sobre el tablero kanban
    const board = document.getElementById('kanban-board');
    if (board) {
        board.addEventListener('dragstart', e => {
            const taskElement = e.target.closest('[data-task-id]');
            if (taskElement) {
                e.dataTransfer.setData('text', taskElement.dataset.taskId);
            }
        });
    }

    // Columnas como drop zones
    document.querySelectorAll('[data-drop-zone]').forEach(column => {
        column.addEventListener('dragover', e => {
            e.preventDefault();
            column.classList.add('drag-over');
        });

        column.addEventListener('drop', e => {
            e.preventDefault();
            column.classList.remove('drag-over');

            const taskId    = e.dataTransfer.getData('text');
            const newStatus = column.dataset.dropZone;

            if (taskId && newStatus && VALID_STATUSES.includes(newStatus)) {
                moveTask(parseInt(taskId, 10), newStatus);
            }
        });

        column.addEventListener('dragleave', e => {
            if (!column.contains(e.relatedTarget)) {
                column.classList.remove('drag-over');
            }
        });
    });
}

// ---------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------

function initApp() {
    // 1. Inicializar Firebase y monitorizar conexión
    initFirebase();
    monitorConnection(renderConnectionStatus);

    // 2. Configurar formulario (desactivado hasta que cargue Firebase)
    const enableForm = disableFormUntilFirebaseLoads();

    // 3. Cargar contador remoto y suscribirse al listener de tareas
    loadCounterFromFirebase();
    setupTasksListener(enableForm);

    // 4. Configurar event delegation, formulario, drag&drop
    setupGlobalEventDelegation();
    setupForm();
    setupDragAndDrop();

    // 5. PWA
    setupInstallButton();
    registerServiceWorker();

    // 6. Detectar modo PWA
    if (isRunningAsPWA()) {
        document.documentElement.classList.add('pwa-mode');
        console.log('Ejecutando como PWA');
    }

    // 7. Pintar contadores iniciales (todo a 0 hasta que llegue Firebase)
    updateCounts();
}

// Iniciar la app
initApp();
