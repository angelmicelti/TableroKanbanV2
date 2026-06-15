// =====================================================================
// LÓGICA DE TAREAS
// =====================================================================
// CRUD, renderizado, edición inline, contadores y limpieza.

import { state } from './state.js';
import { VALID_STATUSES, getLabelById, getNextLabel } from './config.js';
import { escapeHtml, showMessage, showConfirm } from './utils.js';
import { getTasksRef, getCounterRef } from './firebase-service.js';
import { markDirty } from './boards.js';

// ---------------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------------

/**
 * Deduplica el array de tareas por ID, manteniendo la primera ocurrencia.
 */
export function deduplicateTasks(tasks) {
    const seen = new Set();
    return tasks.filter(t => {
        if (!t || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
    });
}

/**
 * Persiste el estado actual en Firebase.
 * Es un no-op hasta que `isFirebaseLoaded` es `true` para no machacar
 * datos remotos con el estado local vacío.
 * Deduplica las tareas antes de guardar para evitar duplicados.
 */
export function saveTasksToFirebase() {
    if (!state.isFirebaseLoaded) return;
    state.tasks = deduplicateTasks(state.tasks);
    getTasksRef().set(state.tasks);
    getCounterRef().set(state.taskCounter);
}

// ---------------------------------------------------------------------
// Contadores y estadísticas
// ---------------------------------------------------------------------

/**
 * Elimina elementos DOM duplicados (mismo data-task-id) de todas las
 * columnas y asegura que cada tarea tenga su elemento en la columna
 * correcta según `state.tasks`. Se ejecuta en cada `updateCounts()`
 * para garantizar que el DOM siempre refleje fielmente el estado.
 */
function cleanupDomDuplicates() {
    // 1. Eliminar duplicados exactos (mismo ID en cualquier columna,
    //    mantener solo el primero encontrado en orden de documento).
    //    NOTA: Usamos .task-card[data-task-id] para seleccionar SOLO las
    //    tarjetas, no los elementos hijos (como el span de la etiqueta)
    //    que también llevan data-task-id.
    const seen = new Map();
    document.querySelectorAll('.task-card[data-task-id]').forEach(el => {
        const id = el.dataset.taskId;
        if (seen.has(id)) {
            el.remove();
        } else {
            seen.set(id, el);
        }
    });

    // 2. Verificar que cada elemento superviviente esté en la columna
    //    correcta según state.tasks. Si no, re-renderizar.
    state.tasks.forEach(task => {
        const el = seen.get(String(task.id));
        if (!el) {
            // No hay elemento en el DOM — renderizarlo
            renderTask(task);
            return;
        }
        const correctCol = document.getElementById(task.status);
        if (!correctCol || !correctCol.contains(el)) {
            // Elemento en columna incorrecta — eliminarlo y re-renderizar
            el.remove();
            renderTask(task);
        }
    });

    // 3. Eliminar elementos huérfanos (task ID que ya no existe en state)
    const activeIds = new Set(state.tasks.map(t => String(t.id)));
    document.querySelectorAll('.task-card[data-task-id]').forEach(el => {
        if (!activeIds.has(el.dataset.taskId)) {
            el.remove();
        }
    });
}

export function updateCounts() {
    // Limpiar duplicados del DOM antes de contar
    cleanupDomDuplicates();

    const counts = {
        'no-iniciado': 0,
        'en-proceso':  0,
        'finalizado':  0
    };

    state.tasks.forEach(task => {
        if (counts[task.status] !== undefined) counts[task.status]++;
    });

    // Debug: si los contadores se disparan, guardamos el estado para diagnóstico
    if (state.tasks.length > 0 && (counts['en-proceso'] > state.tasks.length || counts['finalizado'] > state.tasks.length)) {
        console.warn('⚠️ Contadores inconsistentes:', { total: state.tasks.length, ...counts });
        window.__debugState = JSON.parse(JSON.stringify(state.tasks));
    }

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

// Guard a nivel de módulo: solo permitimos UNA carga de datos desde
// Firebase en toda la vida de la página. Firebase Realtime Database
// puede re-disparar eventos tras `set()` incluso con `once('value')`
// (comportamiento observado en el SDK compat). Este guard, combinado
// con la forma Promise de `once('value')`, asegura que solo la primera
// resolución se procese.
let _dataLoaded = false;

/**
 * Carga inicial de tareas desde Firebase (una sola vez).
 * Usa la forma Promise de `once('value')` que resuelve UNA SOLA
 * PROMESA, a diferencia de la forma callback que Firebase podría
 * re-disparar internamente. El guard `_dataLoaded` impide cualquier
 * procesamiento duplicado incluso si la Promise resolviera más de una vez.
 *
 * Invoca `onLoaded` cuando los datos están listos, para que
 * `main.js` pueda reactivar el formulario en ese momento.
 */
export function setupTasksListener(onLoaded) {
    if (_dataLoaded) {
        console.warn('setupTasksListener: ya ejecutado, ignorando');
        return;
    }

    getTasksRef().once('value').then(snapshot => {
        // Si ya se procesaron datos, salir inmediatamente
        if (_dataLoaded) {
            console.warn('setupTasksListener: datos ya cargados, ignorando snapshot duplicado');
            return;
        }
        _dataLoaded = true;

        console.log('setupTasksListener: cargando datos desde Firebase');
        const data = snapshot.val();

        // Limpiar DOM de las tres columnas
        document.getElementById('no-iniciado').innerHTML = '';
        document.getElementById('en-proceso').innerHTML  = '';
        document.getElementById('finalizado').innerHTML  = '';

        if (data) {
            state.tasks = deduplicateTasks(data);
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
    }).catch(err => {
        console.error('Error al cargar tareas desde Firebase:', err);
        // Aún si hay error, marcamos como cargado para no bloquear
        _dataLoaded = true;
        state.isFirebaseLoaded = true;
        if (onLoaded) onLoaded();
    });
}

// ---------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------

export function addTask(text, labelId) {
    // Limpiar posibles duplicados antes de operar
    state.tasks = deduplicateTasks(state.tasks);

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
        createdAt: new Date().toLocaleString('es-ES'),
        label: labelId || null
    };

    state.tasks.push(task);
    renderTask(task);
    updateCounts();
    markDirty();
    saveTasksToFirebase();
}

/**
 * Cambia la etiqueta de una tarea a la siguiente del ciclo.
 */
// Guard para evitar que cycleTaskLabel se ejecute múltiples veces
// para la misma tarea si el clic se propaga a varios elementos
// (por ejemplo, si hay elementos `.task-card` duplicados en el DOM).
let _cycleInProgress = false;
let _lastCycledTaskId = null;

export function cycleTaskLabel(taskId) {
    // Si ya estamos procesando UN ciclo de etiqueta, ignorar llamadas
    // adicionales. Esto evita que el event handler se dispare múltiples
    // veces para el mismo clic cuando hay elementos duplicados en el DOM.
    if (_cycleInProgress && _lastCycledTaskId === taskId) {
        console.warn('cycleTaskLabel: ciclo en progreso para tarea', taskId, 'ignorando llamada duplicada');
        return;
    }
    _cycleInProgress = true;
    _lastCycledTaskId = taskId;

    console.log('=== cycleTaskLabel INICIO ===', { taskId, tasksBefore: JSON.parse(JSON.stringify(state.tasks.map(t => ({id:t.id, text:t.text, label:t.label, status:t.status})))) });

    // Limpiar posibles duplicados antes de operar
    state.tasks = deduplicateTasks(state.tasks);

    const task = state.tasks.find(t => t.id === taskId);
    if (!task) {
        console.warn('cycleTaskLabel: tarea no encontrada', taskId);
        _cycleInProgress = false;
        return;
    }
    const next = getNextLabel(task.label);
    console.log('cycleTaskLabel: tarea encontrada', { id: task.id, text: task.text, oldLabel: task.label, newLabel: next?.id || null, nextLabelName: next?.name || null });
    task.label = next ? next.id : null;
    // Usar .task-card cualificado para eliminar SOLO la tarjeta, no hijos
    const el = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    console.log('cycleTaskLabel: elemento encontrado para eliminar', el ? el.className : 'null');
    if (el) el.remove();
    renderTask(task);
    markDirty();
    saveTasksToFirebase();
    // Ejecutar updateCounts() para que cleanupDomDuplicates() elimine
    // cualquier elemento fantasma duplicado que haya quedado en el DOM
    // de sesiones anteriores (el famoso bug del "7").
    updateCounts();
    console.log('=== cycleTaskLabel FIN ===', { tasksAfter: JSON.parse(JSON.stringify(state.tasks.map(t => ({id:t.id, text:t.text, label:t.label, status:t.status})))) });

    _cycleInProgress = false;
}

export function deleteTask(taskId) {
    // Limpiar posibles duplicados antes de operar
    state.tasks = deduplicateTasks(state.tasks);

    state.tasks = state.tasks.filter(t => t.id !== taskId);
    const el = document.querySelector(`[data-task-id="${taskId}"]`);
    if (el) el.remove();
    updateCounts();
    markDirty();
    saveTasksToFirebase();
}

export function moveTask(taskId, newStatus) {
    if (!VALID_STATUSES.includes(newStatus)) return;
    // Limpiar posibles duplicados antes de operar
    state.tasks = deduplicateTasks(state.tasks);

    const task = state.tasks.find(t => t.id == taskId);
    if (!task) return;

    task.status = newStatus;
    const el = document.querySelector(`[data-task-id="${taskId}"]`);
    if (el) el.remove();
    renderTask(task);
    updateCounts();
    markDirty();
    saveTasksToFirebase();
}

// ---------------------------------------------------------------------
// Reordenar columna (sincronizar state.tasks con el orden del DOM)
// ---------------------------------------------------------------------

/**
 * Reordena las tareas de una columna en `state.tasks` para que coincidan
 * con el orden actual del DOM. Se llama después de un drag & drop que ya
 * movió el elemento en el DOM.
 * @param {string} status - Estado de la columna a reordenar
 */
export function reorderColumn(status) {
    const column = document.getElementById(status);
    if (!column) return;

    const taskElements = column.querySelectorAll('.task-card[data-task-id]');
    const domOrder = Array.from(taskElements).map(el => parseInt(el.dataset.taskId, 10));

    // Separar tareas de esta columna y del resto
    const otherTasks = state.tasks.filter(t => t.status !== status);
    const columnTasks = state.tasks.filter(t => t.status === status);

    // Mapa para búsqueda rápida por ID
    const taskMap = {};
    columnTasks.forEach(t => { taskMap[t.id] = t; });

    // Reordenar según el DOM
    const reordered = [];
    const seen = new Set();
    for (const id of domOrder) {
        if (taskMap[id]) {
            reordered.push(taskMap[id]);
            seen.add(id);
        }
    }
    // Añadir las que pudieran faltar en el DOM (seguridad)
    for (const t of columnTasks) {
        if (!seen.has(t.id)) {
            reordered.push(t);
        }
    }

    state.tasks = [...otherTasks, ...reordered];
    updateCounts();
}

// ---------------------------------------------------------------------
// Edición inline
// ---------------------------------------------------------------------

export function editTask(taskId) {
    // Limpiar posibles duplicados antes de operar
    state.tasks = deduplicateTasks(state.tasks);

    const task = state.tasks.find(t => t.id == taskId);
    if (!task) return;

    const taskTextElement = document.getElementById(`task-text-${taskId}`);
    if (!taskTextElement) return;
    const currentText = task.text;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'w-full px-2 py-1 border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500';

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
            markDirty();
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

/**
 * Limpia todas las tareas pidiendo confirmación con un modal custom
 * (consistente con el sistema de toasts `showMessage`) en vez del
 * antiestético `window.confirm` del navegador.
 *
 * Guard contra doble-click: si ya hay un modal de confirmación
 * abierto, las llamadas adicionales se ignoran para evitar abrir
 * modales concurrentes.
 */
let isClearing = false;
export async function clearAllTasks() {
    if (isClearing) return;
    if (state.tasks.length === 0) {
        showMessage('No hay tareas para eliminar', 'info');
        return;
    }

    isClearing = true;
    try {
        const confirmed = await showConfirm({
            title: 'Eliminar todas las tareas',
            message: '¿Estás seguro de que quieres eliminar todas las tareas? Esta acción no se puede deshacer.',
            confirmText: 'Eliminar todo',
            cancelText: 'Cancelar',
            danger: true
        });

        if (confirmed) {
            clearAllTasksLocal();
            markDirty();
            saveTasksToFirebase();
            showMessage('\ud83d\uddd1\ufe0f Todas las tareas han sido eliminadas', 'success');
        }
    } finally {
        isClearing = false;
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
    taskElement.className = 'task-card bg-gray-50 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-lg p-4 cursor-move';
    taskElement.draggable = true;
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.label = task.label || '';
    taskElement.className += ` border-l-4 ${STATUS_COLORS[task.status]}`;

    // Escapar texto controlado por el usuario antes de inyectarlo
    // en innerHTML para prevenir XSS
    const safeText       = escapeHtml(task.text);
    const safeCreatedAt  = escapeHtml(task.createdAt || '');

    // Etiqueta
    const label = task.label ? getLabelById(task.label) : null;
    const labelHtml = label
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${label.bg} ${label.text} cursor-pointer hover:opacity-80 transition-opacity"
                  data-action="cycle-label" data-task-id="${task.id}" title="Cambiar etiqueta">
               <span class="w-1.5 h-1.5 ${label.dot} rounded-full"></span>
               ${escapeHtml(label.name)}
           </span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-gray-400 border border-dashed border-gray-300 cursor-pointer hover:border-gray-400 hover:text-gray-500 transition-colors"
                  data-action="cycle-label" data-task-id="${task.id}" title="Añadir etiqueta">
               <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
               Etiqueta
           </span>`;

    taskElement.innerHTML = `
        <div class="flex items-start gap-2 mb-2">
            <div class="flex-1 min-w-0">
                ${labelHtml}
                <h4 class="font-medium text-gray-800 dark:text-gray-200 mt-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 px-2 py-1 rounded"
                    data-dblclick-edit
                    data-task-id="${task.id}"
                    title="Doble clic para editar"
                    id="task-text-${task.id}">${safeText}</h4>
            </div>
            <div class="flex gap-1 flex-shrink-0">
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
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">Creado: ${safeCreatedAt}</div>
        <div class="move-buttons gap-1 justify-center">
            ${task.status !== 'no-iniciado' ? `<button data-action="move-task" data-task-id="${task.id}" data-target-status="no-iniciado" class="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs">\u2190 Enviar a <b><i>No Iniciado</b></i></button>` : ''}
            ${task.status !== 'en-proceso'  ? `<button data-action="move-task" data-task-id="${task.id}" data-target-status="en-proceso"  class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs">Enviar a <b><i>En Proceso</b></i></button>` : ''}
            ${task.status !== 'finalizado'  ? `<button data-action="move-task" data-task-id="${task.id}" data-target-status="finalizado"  class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs">Enviar a <b><i>Finalizado</b></i> \u2192</button>` : ''}
        </div>
    `;

    const column = document.getElementById(task.status);
    if (column) {
        // Eliminar cualquier tarjeta existente con el mismo data-task-id
        // (prevenir duplicados en el DOM si renderTask se llama múltiples veces).
        // NOTA: Buscamos .task-card, no cualquier hijo con data-task-id, para
        // no eliminar elementos como el span de la etiqueta.
        const existing = column.querySelector(`.task-card[data-task-id="${task.id}"]`);
        if (existing) existing.remove();
        column.appendChild(taskElement);
    }
}
