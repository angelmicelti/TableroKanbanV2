// =====================================================================
// LÓGICA DE TAREAS
// =====================================================================
// CRUD, renderizado, edición inline, contadores y limpieza.

import { state } from './state.js';
import { VALID_STATUSES } from './config.js';
import { escapeHtml, showMessage } from './utils.js';
import { getTasksRef, getCounterRef } from './firebase-service.js';

// ---------------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------------

/**
 * Persiste el estado actual en Firebase.
 * Es un no-op hasta que `isFirebaseLoaded` es `true` para no machacar
 * datos remotos con el estado local vacío.
 */
export function saveTasksToFirebase() {
    if (!state.isFirebaseLoaded) return;
    getTasksRef().set(state.tasks);
    getCounterRef().set(state.taskCounter);
}

// ---------------------------------------------------------------------
// Contadores y estadísticas
// ---------------------------------------------------------------------

export function updateCounts() {
    const counts = {
        'no-iniciado': 0,
        'en-proceso':  0,
        'finalizado':  0
    };

    state.tasks.forEach(task => {
        if (counts[task.status] !== undefined) counts[task.status]++;
    });

    document.getElementById('count-no-iniciado').textContent = counts['no-iniciado'];
    document.getElementById('count-en-proceso').textContent  = counts['en-proceso'];
    document.getElementById('count-finalizado').textContent  = counts['finalizado'];

    document.getElementById('total-tasks').textContent     = state.tasks.length;
    document.getElementById('pending-tasks').textContent   = counts['no-iniciado'];
    document.getElementById('progress-tasks').textContent  = counts['en-proceso'];
    document.getElementById('completed-tasks').textContent = counts['finalizado'];
}

// ---------------------------------------------------------------------
// Listener de tareas (Firebase -> estado local -> DOM)
// ---------------------------------------------------------------------

/**
 * Suscribe un listener al nodo `kanban/tasks` de Firebase.
 * Cada vez que cambian los datos, sincroniza `state.tasks` y re-pinta
 * las tres columnas. Invoca `onLoaded` la primera vez que se reciben
 * datos (o se confirma que no hay), para que `main.js` pueda
 * reactivar el formulario en ese momento.
 */
export function setupTasksListener(onLoaded) {
    getTasksRef().on('value', snapshot => {
        const data = snapshot.val();

        // Limpiar DOM de las tres columnas
        document.getElementById('no-iniciado').innerHTML = '';
        document.getElementById('en-proceso').innerHTML  = '';
        document.getElementById('finalizado').innerHTML  = '';

        if (data) {
            state.tasks = data;
            if (state.tasks.length > 0) {
                state.taskCounter = Math.max(...state.tasks.map(t => t.id), state.taskCounter);
            }
            state.tasks.forEach(renderTask);
        } else {
            state.tasks = [];
        }

        updateCounts();
        state.isFirebaseLoaded = true;
        if (onLoaded) onLoaded();
    });
}

// ---------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------

export function addTask(text) {
    // Recalcular el contador a partir de las tareas existentes para
    // evitar colisiones de IDs si Firebase aún no había terminado de
    // cargar el contador remoto.
    if (state.tasks.length > 0) {
        state.taskCounter = Math.max(...state.tasks.map(t => t.id), state.taskCounter);
    }
    state.taskCounter++;
    const task = {
        id: state.taskCounter,
        text,
        status: 'no-iniciado',
        createdAt: new Date().toLocaleString('es-ES')
    };

    state.tasks.push(task);
    renderTask(task);
    updateCounts();
    saveTasksToFirebase();
}

export function deleteTask(taskId) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    const el = document.querySelector(`[data-task-id="${taskId}"]`);
    if (el) el.remove();
    updateCounts();
    saveTasksToFirebase();
}

export function moveTask(taskId, newStatus) {
    if (!VALID_STATUSES.includes(newStatus)) return;
    const task = state.tasks.find(t => t.id == taskId);
    if (!task) return;

    task.status = newStatus;
    const el = document.querySelector(`[data-task-id="${taskId}"]`);
    if (el) el.remove();
    renderTask(task);
    updateCounts();
    saveTasksToFirebase();
}

// ---------------------------------------------------------------------
// Edición inline
// ---------------------------------------------------------------------

export function editTask(taskId) {
    const task = state.tasks.find(t => t.id == taskId);
    if (!task) return;

    const taskTextElement = document.getElementById(`task-text-${taskId}`);
    if (!taskTextElement) return;
    const currentText = task.text;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'w-full px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500';

    // Usar textContent para limpiar de forma segura
    taskTextElement.textContent = '';
    taskTextElement.appendChild(input);
    input.focus();
    input.select();

    function saveEdit() {
        const newText = input.value.trim();
        if (newText && newText !== currentText) {
            task.text = newText;
            // textContent para evitar XSS al re-renderizar
            taskTextElement.textContent = newText;
            saveTasksToFirebase();
            showMessage('\u270f\ufe0f Tarea editada correctamente', 'success');
        } else {
            taskTextElement.textContent = currentText;
        }
    }

    function cancelEdit() {
        taskTextElement.textContent = currentText;
    }

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}

// ---------------------------------------------------------------------
// Limpieza total
// ---------------------------------------------------------------------

/** Limpia el estado local y el DOM. NO guarda en Firebase. */
export function clearAllTasksLocal() {
    state.tasks = [];
    state.taskCounter = 0;

    document.getElementById('no-iniciado').innerHTML = '';
    document.getElementById('en-proceso').innerHTML  = '';
    document.getElementById('finalizado').innerHTML  = '';

    updateCounts();
}

/** Limpia todo con confirmación del usuario. */
export function clearAllTasks() {
    if (state.tasks.length === 0) {
        showMessage('No hay tareas para eliminar', 'info');
        return;
    }

    if (window.confirm('\u00bfEst\u00e1s seguro de que quieres eliminar todas las tareas? Esta acci\u00f3n no se puede deshacer.')) {
        clearAllTasksLocal();
        saveTasksToFirebase();
        showMessage('\ud83d\uddd1\ufe0f Todas las tareas han sido eliminadas', 'success');
    }
}

// ---------------------------------------------------------------------
// Renderizado
// ---------------------------------------------------------------------

const STATUS_COLORS = {
    'no-iniciado': 'border-l-gray-400',
    'en-proceso':  'border-l-yellow-400',
    'finalizado':  'border-l-green-400'
};

/**
 * Crea el elemento DOM de una tarea y lo añade a la columna
 * correspondiente. Usa data-attributes en los botones para que
 * `main.js` aplique event delegation en lugar de onclick inline.
 */
export function renderTask(task) {
    if (!VALID_STATUSES.includes(task.status)) {
        console.warn('Estado de tarea inv\u00e1lido:', task.status);
        return;
    }

    const taskElement = document.createElement('div');
    taskElement.className = 'task-card bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-move';
    taskElement.draggable = true;
    taskElement.dataset.taskId = task.id;
    taskElement.className += ` border-l-4 ${STATUS_COLORS[task.status]}`;

    // Escapar texto controlado por el usuario antes de inyectarlo
    // en innerHTML para prevenir XSS
    const safeText       = escapeHtml(task.text);
    const safeCreatedAt  = escapeHtml(task.createdAt || '');

    taskElement.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h4 class="font-medium text-gray-800 flex-1 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                data-action="edit-task"
                data-task-id="${task.id}"
                title="Doble clic para editar"
                id="task-text-${task.id}">${safeText}</h4>
            <div class="flex gap-1">
                <button data-action="edit-task" data-task-id="${task.id}"
                        class="text-blue-500 hover:text-blue-700" title="Editar tarea">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
                    </svg>
                </button>
                <button data-action="delete-task" data-task-id="${task.id}"
                        class="text-red-500 hover:text-red-700" title="Eliminar tarea">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        </div>
        <div class="text-xs text-gray-500 mb-2">Creado: ${safeCreatedAt}</div>
        <div class="move-buttons gap-1 justify-center">
            ${task.status !== 'no-iniciado' ? `<button data-action="move-task" data-task-id="${task.id}" data-target-status="no-iniciado" class="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs">\u2190 Enviar a <b><i>No Iniciado</b></i></button>` : ''}
            ${task.status !== 'en-proceso'  ? `<button data-action="move-task" data-task-id="${task.id}" data-target-status="en-proceso"  class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs">Enviar a <b><i>En Proceso</b></i></button>` : ''}
            ${task.status !== 'finalizado'  ? `<button data-action="move-task" data-task-id="${task.id}" data-target-status="finalizado"  class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs">Enviar a <b><i>Finalizado</b></i> \u2192</button>` : ''}
        </div>
    `;

    const column = document.getElementById(task.status);
    if (column) column.appendChild(taskElement);
}
