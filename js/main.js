// =====================================================================
// PUNTO DE ENTRADA DE LA APLICACIÓN
// =====================================================================
// Conecta los módulos, configura el formulario, drag&drop, PWA y
// aplica event delegation para los botones dinámicos de las tareas.

import { state }                  from './state.js';
import { VALID_STATUSES, FIREBASE_LOAD_TIMEOUT_MS } from './config.js';
import { showMessage, toggleSection, showConfirm } from './utils.js';
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
    clearAllTasksLocal,
    renderTask,
    saveTasksToFirebase,
    updateCounts,
    reorderColumn,
    cycleTaskLabel
} from './tasks.js';
import { getAllLabels, addCustomLabel, deleteCustomLabel, COLOR_PALETTE } from './config.js';
import { exportTasks, importTasks } from './import-export.js';
import {
    getCurrentUser,
    registerUser,
    loginUser,
    logoutUser,
    isCurrentUserAdmin,
    getAllUsers,
    deleteUser,
    renderAuthUI
} from './auth.js';
import {
    setupInstallButton,
    registerServiceWorker,
    isRunningAsPWA
} from './pwa.js';
import {
    updateCurrentBoardDisplay,
    showSaveBoardDialog,
    showOpenBoardDialog,
    saveBoard,
    loadBoardById,
    deleteBoard,
    getCurrentBoardInfo,
    setCurrentBoardInfo,
    markClean,
    getIsDirty
} from './boards.js';

// ---------------------------------------------------------------------
// Filtro por etiquetas
// ---------------------------------------------------------------------

let activeLabelFilter = null;

/** Renderiza los botones del filtro por etiquetas. */
function renderLabelFilter() {
    const container = document.getElementById('labelFilter');
    if (!container) return;
    container.innerHTML = '';

    // Botón "Todas"
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `px-3 py-1 rounded-full text-xs font-medium transition-all duration-150
        ${activeLabelFilter === null
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`;
    allBtn.textContent = 'Todas';
    allBtn.addEventListener('click', () => applyLabelFilter(null));
    container.appendChild(allBtn);

    // Botón "Sin etiqueta"
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = `px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 inline-flex items-center gap-1
        ${activeLabelFilter === '__none__'
            ? 'bg-gray-600 text-white shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`;
    noneBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg> Sin';
    noneBtn.title = 'Tareas sin etiqueta';
    noneBtn.addEventListener('click', () => applyLabelFilter('__none__'));
    container.appendChild(noneBtn);

    getAllLabels().forEach(label => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isActive = activeLabelFilter === label.id;
        btn.className = `px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 inline-flex items-center gap-1.5
            ${isActive
                ? `${label.bg} ${label.text} shadow-sm ring-1 ${label.border}`
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`;
        btn.innerHTML = `<span class="w-2 h-2 ${label.dot} rounded-full"></span>${label.name}`;
        btn.addEventListener('click', () => applyLabelFilter(label.id));
        container.appendChild(btn);
    });
}

/** Aplica el filtro de etiquetas en las tarjetas del tablero. */
function applyLabelFilter(labelId) {
    activeLabelFilter = labelId;
    renderLabelFilter();

    document.querySelectorAll('[data-task-id]').forEach(el => {
        const taskLabel = el.dataset.label || '';
        let visible = false;
        if (labelId === null) {
            visible = true; // Todas
        } else if (labelId === '__none__') {
            visible = taskLabel === ''; // Sin etiqueta
        } else {
            visible = taskLabel === labelId;
        }
        el.classList.toggle('hidden', !visible);
        // También quitamos el draggable de las ocultas para evitar arrastres
        el.draggable = visible;
    });
}

// ---------------------------------------------------------------------
// Gestión de etiquetas personalizadas
// ---------------------------------------------------------------------

function showManageLabelsDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'app-modal';
    modal.style.maxWidth = '32rem';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4';
    title.textContent = 'Gestionar Etiquetas';

    // --- Lista de etiquetas existentes ---
    const list = document.createElement('div');
    list.className = 'space-y-2 mb-4 max-h-48 overflow-y-auto';

    function renderLabelList() {
        list.innerHTML = '';
        const all = getAllLabels();
        if (all.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-gray-400 text-sm text-center py-4';
            empty.textContent = 'No hay etiquetas disponibles.';
            list.appendChild(empty);
            return;
        }
        all.forEach(label => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 dark:border-gray-600';

            const left = document.createElement('div');
            left.className = 'flex items-center gap-2';
            const dot = document.createElement('span');
            dot.className = `w-3 h-3 ${label.dot} rounded-full flex-shrink-0`;
            const nameSpan = document.createElement('span');
            nameSpan.className = 'text-sm font-medium text-gray-700 dark:text-gray-300';
            nameSpan.textContent = label.name;
            left.appendChild(dot);
            left.appendChild(nameSpan);

            const right = document.createElement('div');
            if (label.predefined) {
                const badge = document.createElement('span');
                badge.className = 'text-xs text-gray-400 dark:text-gray-500 italic';
                badge.textContent = 'predefinida';
                right.appendChild(badge);
            } else {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors';
                delBtn.textContent = 'Eliminar';
                delBtn.addEventListener('click', () => {
                    deleteCustomLabel(label.id);
                    if (activeLabelFilter === label.id) activeLabelFilter = null;
                    renderLabelList();
                    refreshAllLabelUI();
                    showMessage(`🗑️ Etiqueta "${label.name}" eliminada`, 'success');
                });
                right.appendChild(delBtn);
            }

            item.appendChild(left);
            item.appendChild(right);
            list.appendChild(item);
        });
    }
    renderLabelList();

    // --- Formulario para añadir nueva etiqueta ---
    const formDiv = document.createElement('div');
    formDiv.className = 'border-t border-gray-100 dark:border-gray-600 pt-4';

    const formTitle = document.createElement('p');
    formTitle.className = 'text-sm font-medium text-gray-700 dark:text-gray-300 mb-3';
    formTitle.textContent = 'Añadir nueva etiqueta:';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Nombre de la etiqueta';
    nameInput.className = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3';

    // Selector de color
    const colorLabel = document.createElement('p');
    colorLabel.className = 'text-xs text-gray-500 dark:text-gray-400 mb-2';
    colorLabel.textContent = 'Color:';

    const colorPicker = document.createElement('div');
    colorPicker.className = 'flex gap-1.5 mb-3 flex-wrap';

    let selectedColorId = COLOR_PALETTE[0].id;

    COLOR_PALETTE.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isSelected = selectedColorId === color.id;
        btn.className = `w-7 h-7 rounded-full transition-all duration-150
            ${isSelected ? `${color.dot} ring-2 ring-offset-1 ring-gray-400 scale-110` : `${color.dot} hover:scale-110 opacity-60 hover:opacity-100`}`;
        btn.title = color.id;
        btn.addEventListener('click', () => {
            selectedColorId = color.id;
            // Actualizar highlighting
            colorPicker.querySelectorAll('button').forEach(b => {
                const cid = b.dataset.colorId;
                if (cid === selectedColorId) {
                    b.className = `w-7 h-7 rounded-full transition-all duration-150 ${color.dot} ring-2 ring-offset-1 ring-gray-400 scale-110`;
                } else {
                    const c = COLOR_PALETTE.find(p => p.id === cid);
                    if (c) {
                        b.className = `w-7 h-7 rounded-full transition-all duration-150 ${c.dot} hover:scale-110 opacity-60 hover:opacity-100`;
                    }
                }
            });
        });
        btn.dataset.colorId = color.id;
        colorPicker.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors';
    addBtn.textContent = 'Añadir etiqueta';

    function handleAdd() {
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.classList.add('border-red-400');
            nameInput.focus();
            return;
        }
        addCustomLabel(name, selectedColorId);
        nameInput.value = '';
        renderLabelList();
        refreshAllLabelUI();
        showMessage(`✅ Etiqueta "${name}" creada`, 'success');
    }

    addBtn.addEventListener('click', handleAdd);
    nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    });

    formDiv.appendChild(formTitle);
    formDiv.appendChild(nameInput);
    formDiv.appendChild(colorLabel);
    formDiv.appendChild(colorPicker);
    formDiv.appendChild(addBtn);

    // --- Botón cerrar ---
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'mt-4 w-full px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors';
    closeBtn.textContent = 'Cerrar';
    closeBtn.addEventListener('click', () => overlay.remove());

    modal.appendChild(title);
    modal.appendChild(list);
    modal.appendChild(formDiv);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    closeBtn.focus();

    function closeManageDialog() {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeManageDialog();
        }
    }
    document.addEventListener('keydown', onKeyDown);

    closeBtn.addEventListener('click', closeManageDialog);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeManageDialog();
    });
}

/** Refresca todos los UI que dependen de las etiquetas (picker, filtro). */
function refreshAllLabelUI() {
    renderLabelPicker();
    renderLabelFilter();
    applyLabelFilter(activeLabelFilter);
}

// ---------------------------------------------------------------------
// Estado del label seleccionado en el formulario
// ---------------------------------------------------------------------

let selectedLabelId = null;

/** Renderiza los círculos de colores del selector de etiquetas. */
function renderLabelPicker() {
    const container = document.getElementById('labelPicker');
    if (!container) return;

    container.innerHTML = '';

    // Botón "sin etiqueta" (si hay una seleccionada, permite deseleccionar)
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = `w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 text-xs font-bold
        ${selectedLabelId === null ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 ring-2 ring-gray-400 dark:ring-gray-500 ring-offset-1' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`;
    noneBtn.title = 'Sin etiqueta';
    noneBtn.textContent = '×';
    noneBtn.dataset.labelId = '';
    noneBtn.addEventListener('click', () => {
        selectedLabelId = null;
        renderLabelPicker();
    });
    container.appendChild(noneBtn);

    getAllLabels().forEach(label => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isSelected = selectedLabelId === label.id;
        btn.className = `w-6 h-6 rounded-full transition-all duration-150
            ${isSelected ? `${label.dot} ring-2 ring-offset-1 ring-gray-400 scale-110` : `${label.dot} hover:scale-110 opacity-60 hover:opacity-100`}`;
        btn.title = label.name;
        btn.dataset.labelId = label.id;
        btn.addEventListener('click', () => {
            selectedLabelId = selectedLabelId === label.id ? null : label.id;
            renderLabelPicker();
        });
        container.appendChild(btn);
    });
}

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
                applyLabelFilter(activeLabelFilter);
                break;
            case 'cycle-label':
                cycleTaskLabel(parseInt(target.dataset.taskId, 10));
                applyLabelFilter(activeLabelFilter);
                break;
            case 'move-task':
                moveTask(parseInt(target.dataset.taskId, 10), target.dataset.targetStatus);
                applyLabelFilter(activeLabelFilter);
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
            case 'save-board':
                handleSaveBoard();
                break;
            case 'open-board':
                handleOpenBoard();
                break;
            case 'new-board':
                handleNewBoard();
                break;
            case 'manage-labels':
                showManageLabelsDialog();
                break;
            case 'manage-users':
                showManageUsersDialog();
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
                addTask(text, selectedLabelId);
                applyLabelFilter(activeLabelFilter);
                input.value = '';
                selectedLabelId = null;
                renderLabelPicker();
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
// Drag & Drop (con reordenamiento dentro de la misma columna)
// ---------------------------------------------------------------------

function setupDragAndDrop() {
    let draggedTaskId = null;

    const board = document.getElementById('kanban-board');
    if (board) {
        board.addEventListener('dragstart', e => {
            const el = e.target.closest('[data-task-id]');
            if (el) {
                draggedTaskId = el.dataset.taskId;
                e.dataTransfer.setData('text/plain', draggedTaskId);
                e.dataTransfer.effectAllowed = 'move';
                // Feedback visual: semitransparente mientras se arrastra
                setTimeout(() => el.classList.add('opacity-30'), 0);
            }
        });

        board.addEventListener('dragend', () => {
            if (draggedTaskId) {
                const el = document.querySelector(`[data-task-id="${draggedTaskId}"]`);
                if (el) el.classList.remove('opacity-30');
            }
            document.querySelectorAll('.drag-indicator').forEach(el => el.remove());
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            draggedTaskId = null;
        });
    }

    document.querySelectorAll('[data-drop-zone]').forEach(column => {
        // --- dragover: mostrar indicador visual ---
        column.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            column.classList.add('drag-over');

            // Limpiar indicadores anteriores en esta columna
            column.querySelectorAll('.drag-indicator').forEach(el => el.remove());

            // Encontrar la tarjeta sobre la que estamos (mitad superior = antes, inferior = después)
            const cards = column.querySelectorAll('[data-task-id]:not(.opacity-30)');
            let insertBefore = null;
            for (const card of cards) {
                const rect = card.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    insertBefore = card;
                    break;
                }
            }

            const indicator = document.createElement('div');
            indicator.className = 'drag-indicator h-0.5 bg-blue-500 rounded-full my-1 transition-all';
            if (insertBefore) {
                column.insertBefore(indicator, insertBefore);
            } else {
                column.appendChild(indicator);
            }
        });

        // --- drop: mover la tarea ---
        column.addEventListener('drop', e => {
            e.preventDefault();
            column.classList.remove('drag-over');
            column.querySelectorAll('.drag-indicator').forEach(el => el.remove());

            const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const newStatus = column.dataset.dropZone;
            if (!taskId || !newStatus || !VALID_STATUSES.includes(newStatus)) return;

            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;

            const oldStatus = task.status;

            // Encontrar dónde insertar según la posición del cursor en el momento del drop
            const cards = column.querySelectorAll('[data-task-id]');
            let insertBeforeNode = null;
            for (const card of cards) {
                if (parseInt(card.dataset.taskId, 10) === taskId) continue;
                const rect = card.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    insertBeforeNode = card;
                    break;
                }
            }

            // --- Mover el elemento en el DOM ---
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskElement) {
                taskElement.remove();
                taskElement.classList.remove('opacity-30');
                if (insertBeforeNode && column.contains(insertBeforeNode)) {
                    column.insertBefore(taskElement, insertBeforeNode);
                } else {
                    column.appendChild(taskElement);
                }
                task.status = newStatus;
                reorderColumn(newStatus);
            } else {
                // Fallback: usar moveTask tradicional
                moveTask(taskId, newStatus);
            }

            updateCounts();
            markDirty();
            saveTasksToFirebase();
            draggedTaskId = null;
        });

        // --- dragleave: limpiar indicador al salir de la columna ---
        column.addEventListener('dragleave', e => {
            if (!column.contains(e.relatedTarget)) {
                column.querySelectorAll('.drag-indicator').forEach(el => el.remove());
                column.classList.remove('drag-over');
            }
        });
    });
}

// ---------------------------------------------------------------------
// Board management handlers
// ---------------------------------------------------------------------

async function handleSaveBoard() {
    const current = getCurrentBoardInfo();
    const currentName = current ? current.name : '';
    showSaveBoardDialog(currentName, (name) => {
        saveBoard(name, state.tasks, state.taskCounter);
        showMessage(`\u2705 Tablero "${name}" guardado correctamente`, 'success');
    });
}

async function handleOpenBoard() {
    showOpenBoardDialog(
        (boardId) => {
            const data = loadBoardById(boardId);
            if (data) {
                clearAllTasksLocal();
                state.tasks = data.tasks;
                state.taskCounter = data.taskCounter;
                data.tasks.forEach(renderTask);
                updateCounts();
                markClean();
                saveTasksToFirebase();
                applyLabelFilter(activeLabelFilter);
                const info = getCurrentBoardInfo();
                showMessage(`\ud83d\udcc2 Tablero "${info ? info.name : ''}" cargado`, 'success');
            }
        },
        (boardId) => {
            deleteBoard(boardId);
        }
    );
}

async function handleNewBoard() {
    if (state.tasks.length > 0) {
        const confirmed = await showConfirm({
            title:       'Nuevo tablero',
            message:     'Las tareas actuales se perder\u00e1n si no las has guardado. \u00bfCrear un nuevo tablero?',
            confirmText: 'Crear nuevo',
            cancelText:  'Cancelar',
            danger:      false
        });
        if (!confirmed) return;
    }
    clearAllTasksLocal();
    setCurrentBoardInfo(null);
    updateCurrentBoardDisplay();
    markClean();
    saveTasksToFirebase();
    showMessage('\ud83d\udccb Nuevo tablero creado', 'success');
}

// ---------------------------------------------------------------------
// Auth: login, register, logout
// ---------------------------------------------------------------------

function setupAuth() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const showRegisterLink = document.getElementById('showRegisterLink');
    const showLoginLink = document.getElementById('showLoginLink');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const manageUsersBtn = document.getElementById('manageUsersBtn');

    renderAuthUI();

    // Mostrar/ocultar el botón de gestión de usuarios si es admin
    if (manageUsersBtn) {
        manageUsersBtn.classList.toggle('hidden', !isCurrentUserAdmin());
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Enter para enviar en login
    const loginPass = document.getElementById('loginPassword');
    if (loginPass) {
        loginPass.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });
    }
    // Enter para enviar en registro
    const registerPass = document.getElementById('registerPassword');
    if (registerPass) {
        registerPass.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Si es Enter en el primer password, saltar al confirm
                document.getElementById('registerPasswordConfirm')?.focus();
            }
        });
    }
    const registerPassConfirm = document.getElementById('registerPasswordConfirm');
    if (registerPassConfirm) {
        registerPassConfirm.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleRegister();
            }
        });
    }

    // Toggle entre login y register
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', e => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            document.getElementById('registerUsername')?.focus();
        });
    }
    if (showLoginLink) {
        showLoginLink.addEventListener('click', e => {
            e.preventDefault();
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            document.getElementById('loginUsername')?.focus();
        });
    }
}

// ---------------------------------------------------------------------
// Loading spinner for auth operations
// ---------------------------------------------------------------------

/**
 * Muestra/oculta el spinner de carga para login o registro.
 * @param {'login'|'register'} type
 * @param {boolean} loading
 */
function setAuthLoading(type, loading) {
    const normalBtn = document.getElementById(type === 'login' ? 'loginBtn' : 'registerBtn');
    const loadingBtn = document.getElementById(type === 'login' ? 'loginBtnLoading' : 'registerBtnLoading');
    const inputs = type === 'login'
        ? ['loginUsername', 'loginPassword']
        : ['registerUsername', 'registerPassword', 'registerPasswordConfirm'];

    normalBtn.classList.toggle('hidden', loading);
    loadingBtn.classList.toggle('hidden', !loading);

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = loading;
    });
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    setAuthLoading('login', true);

    const result = await loginUser(username, password);

    setAuthLoading('login', false);

    if (result.success) {
        showMessage(`✅ Bienvenido, ${result.user.username}`, 'success');
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        const manageUsersBtn = document.getElementById('manageUsersBtn');
        if (manageUsersBtn) {
            manageUsersBtn.classList.toggle('hidden', !result.user.isAdmin);
        }
        renderAuthUI();
    } else {
        showMessage(`❌ ${result.error}`, 'error');
    }
}

async function handleRegister() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    // Validar que las contraseñas coincidan
    if (password !== passwordConfirm) {
        showMessage('❌ Las contraseñas no coinciden', 'error');
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerPasswordConfirm').value = '';
        document.getElementById('registerPassword').focus();
        return;
    }

    setAuthLoading('register', true);

    const result = await registerUser(username, password);

    setAuthLoading('register', false);

    if (result.success) {
        showMessage(`✅ Cuenta creada. ¡Bienvenido, ${result.user.username}!`, 'success');
        document.getElementById('registerUsername').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerPasswordConfirm').value = '';
        const manageUsersBtn = document.getElementById('manageUsersBtn');
        if (manageUsersBtn) {
            manageUsersBtn.classList.toggle('hidden', !result.user.isAdmin);
        }
        renderAuthUI();
    } else {
        showMessage(`❌ ${result.error}`, 'error');
    }
}

function handleLogout() {
    logoutUser();
    const manageUsersBtn = document.getElementById('manageUsersBtn');
    if (manageUsersBtn) manageUsersBtn.classList.add('hidden');
    renderAuthUI();
    showMessage('👋 Sesión cerrada', 'info');
}

// ---------------------------------------------------------------------
// User management dialog (admin only)
// ---------------------------------------------------------------------

async function showManageUsersDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'app-modal';
    modal.style.maxWidth = '32rem';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4';
    title.textContent = '👥 Gestionar Usuarios';

    const list = document.createElement('div');
    list.className = 'space-y-2 mb-4 max-h-64 overflow-y-auto';

    async function renderUserList() {
        list.innerHTML = '';
        const users = await getAllUsers();

        if (users.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-gray-400 text-sm text-center py-4';
            empty.textContent = 'No hay usuarios.';
            list.appendChild(empty);
            return;
        }

        users.forEach(u => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 dark:border-gray-600';

            const left = document.createElement('div');
            left.className = 'flex items-center gap-2';
            const dot = document.createElement('span');
            dot.className = `w-2.5 h-2.5 rounded-full ${u.isAdmin ? 'bg-yellow-500' : 'bg-green-400'}`;
            const nameSpan = document.createElement('span');
            nameSpan.className = 'text-sm font-medium text-gray-700 dark:text-gray-300';
            nameSpan.textContent = u.username;
            left.appendChild(dot);
            left.appendChild(nameSpan);

            if (u.isAdmin) {
                const badge = document.createElement('span');
                badge.className = 'text-xs text-yellow-600 dark:text-yellow-400 font-medium ml-1';
                badge.textContent = 'Admin';
                left.appendChild(badge);
            }

            const right = document.createElement('div');
            if (!u.isAdmin) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors';
                delBtn.textContent = 'Eliminar';
                delBtn.addEventListener('click', async () => {
                    const confirmed = await showConfirm({
                        title: 'Eliminar usuario',
                        message: `¿Eliminar al usuario "${u.username}"? No se podrá deshacer.`,
                        confirmText: 'Eliminar',
                        cancelText: 'Cancelar',
                        danger: true
                    });
                    if (confirmed) {
                        const result = await deleteUser(u.username);
                        if (result.success) {
                            renderUserList();
                            showMessage(`🗑️ Usuario "${u.username}" eliminado`, 'success');
                        } else {
                            showMessage(`❌ ${result.error}`, 'error');
                        }
                    }
                });
                right.appendChild(delBtn);
            }

            item.appendChild(left);
            item.appendChild(right);
            list.appendChild(item);
        });
    }

    await renderUserList();

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'mt-2 w-full px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors';
    closeBtn.textContent = 'Cerrar';

    modal.appendChild(title);
    modal.appendChild(list);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    closeBtn.focus();

    function closeDialog() {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeDialog();
        }
    }
    document.addEventListener('keydown', onKeyDown);

    closeBtn.addEventListener('click', closeDialog);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeDialog();
    });
}

// ---------------------------------------------------------------------
// Dark mode
// ---------------------------------------------------------------------

const DARK_MODE_KEY = 'kanban-dark-mode';

/**
 * Inicializa el modo oscuro:
 * 1. Respeta la preferencia del usuario guardada en localStorage.
 * 2. Si no hay preferencia, usa la preferencia del sistema (prefers-color-scheme).
 * 3. Conecta los botones de toggle en el header y la barra de usuario.
 */
function initDarkMode() {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    let isDark;
    if (stored !== null) {
        isDark = stored === 'true';
    } else {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
        document.documentElement.classList.add('dark');
    }

    // Sincronizar ambos botones de toggle
    function updateToggleButtons() {
        const isDark = document.documentElement.classList.contains('dark');
        const toggle1 = document.getElementById('darkModeToggle');
        const toggle2 = document.getElementById('darkModeToggle2');
        const icon = isDark ? '☀️' : '🌙';
        const title = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
        if (toggle1) { toggle1.textContent = icon; toggle1.title = title; }
        if (toggle2) { toggle2.textContent = icon; toggle2.title = title; }
    }

    function toggleDarkMode() {
        const willBeDark = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', willBeDark);
        localStorage.setItem(DARK_MODE_KEY, willBeDark);
        // Actualizar theme-color meta tag
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.content = willBeDark ? '#111827' : '#3b82f6';
        }
        updateToggleButtons();
    }

    const toggle1 = document.getElementById('darkModeToggle');
    const toggle2 = document.getElementById('darkModeToggle2');

    updateToggleButtons();

    if (toggle1) toggle1.addEventListener('click', toggleDarkMode);
    if (toggle2) toggle2.addEventListener('click', toggleDarkMode);

    // Escuchar cambios en la preferencia del sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (localStorage.getItem(DARK_MODE_KEY) === null) {
            // Solo cambia automáticamente si el usuario no ha elegido explícitamente
            document.documentElement.classList.toggle('dark', e.matches);
        }
    });
}

// ---------------------------------------------------------------------
// Atajos de teclado
// ---------------------------------------------------------------------

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        // Ctrl+S o Cmd+S (macOS): guardar tablero
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSaveBoard();
        }
    });
}

// ---------------------------------------------------------------------
// Confirmación al salir
// ---------------------------------------------------------------------

function setupBeforeUnload() {
    window.addEventListener('beforeunload', e => {
        if (getIsDirty()) {
            // El navegador muestra su propio mensaje genérico;
            // la string se ignora en navegadores modernos.
            e.preventDefault();
            e.returnValue = '';
        }
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
    renderLabelPicker();
    renderLabelFilter();

    // 5. Dark mode (temprano para evitar flicker)
    initDarkMode();

    // 6. Auth: login, register y UI de usuario
    setupAuth();

    // 7. Atajos de teclado
    setupKeyboardShortcuts();

    // 7. Confirmación al salir si hay cambios sin guardar
    setupBeforeUnload();

    // 9. PWA
    setupInstallButton();
    registerServiceWorker();

    // 10. Detectar modo PWA
    if (isRunningAsPWA()) {
        document.documentElement.classList.add('pwa-mode');
        console.log('Ejecutando como PWA');
    }

    // 11. Mostrar el nombre del tablero activo (si hay uno guardado)
    updateCurrentBoardDisplay();

    // 12. Pintar contadores iniciales (todo a 0 hasta que llegue Firebase)
    updateCounts();
}

// Iniciar la app
initApp();
