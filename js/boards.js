// =====================================================================
// BOARD MANAGEMENT (LocalStorage)
// =====================================================================
// Permite guardar, cargar y eliminar múltiples tableros con nombre
// mediante localStorage, independientemente de la persistencia en
// Firebase.

import { escapeHtml, showMessage, showConfirm } from './utils.js';

const BOARDS_STORAGE_KEY = 'kanban-boards';
const CURRENT_BOARD_KEY  = 'kanban-current-board';

// ---------------------------------------------------------------------
// Estado dirty (cambios sin guardar)
// ---------------------------------------------------------------------

let isDirty = false;

/** Marca el tablero como modificado (cambios sin guardar). */
export function markDirty() {
    isDirty = true;
    updateDirtyIndicator();
}

/** Marca el tablero como guardado/limpio. */
export function markClean() {
    isDirty = false;
    updateDirtyIndicator();
}

/** Devuelve si el tablero actual tiene cambios sin guardar. */
export function getIsDirty() {
    return isDirty;
}

/**
 * Actualiza el indicador visual de cambios sin guardar.
 */
function updateDirtyIndicator() {
    const el = document.getElementById('boardDirtyIndicator');
    if (!el) return;
    el.classList.toggle('hidden', !isDirty);
}

// ---------------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------------

/**
 * Devuelve el array de tableros guardados (vacío si no hay).
 */
export function getBoardsList() {
    try {
        return JSON.parse(localStorage.getItem(BOARDS_STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveBoardsList(boards) {
    localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(boards));
}

// ---------------------------------------------------------------------
// Tablero activo
// ---------------------------------------------------------------------

export function getCurrentBoardInfo() {
    try {
        return JSON.parse(localStorage.getItem(CURRENT_BOARD_KEY) || 'null');
    } catch {
        return null;
    }
}

export function setCurrentBoardInfo(info) {
    if (info) {
        localStorage.setItem(CURRENT_BOARD_KEY, JSON.stringify(info));
    } else {
        localStorage.removeItem(CURRENT_BOARD_KEY);
    }
    updateCurrentBoardDisplay();
}

/**
 * Actualiza el indicador visual del nombre del tablero activo en el DOM.
 */
export function updateCurrentBoardDisplay() {
    const el = document.getElementById('currentBoardName');
    if (!el) return;
    const info = getCurrentBoardInfo();
    el.textContent = info ? info.name : 'Sin nombre';
}

// ---------------------------------------------------------------------
// CRUD de tableros
// ---------------------------------------------------------------------

/**
 * Guarda el estado actual como un tablero con nombre.
 * Si ya existe un tablero con ese nombre, lo actualiza.
 */
export function saveBoard(name, tasks, taskCounter) {
    const boards = getBoardsList();
    const existing = boards.find(b => b.name === name);

    const boardEntry = {
        id:   existing ? existing.id : Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
        name,
        tasks:        JSON.parse(JSON.stringify(tasks)),
        taskCounter,
        savedAt:      new Date().toISOString(),
        taskCount:    tasks.length
    };

    if (existing) {
        Object.assign(existing, boardEntry);
    } else {
        boards.push(boardEntry);
    }

    saveBoardsList(boards);
    setCurrentBoardInfo({ id: boardEntry.id, name: boardEntry.name });
    updateCurrentBoardDisplay();
    markClean();
    return boardEntry;
}

/**
 * Renombra un tablero guardado.
 * @param {string} boardId
 * @param {string} newName
 * @returns {boolean} true si se renombró, false si el nombre ya existe
 */
export function renameBoard(boardId, newName) {
    const boards = getBoardsList();
    const board  = boards.find(b => b.id === boardId);
    if (!board) return false;

    // Evitar duplicados de nombre
    if (boards.some(b => b.id !== boardId && b.name === newName)) return false;

    board.name = newName;
    saveBoardsList(boards);

    // Si el tablero renombrado es el activo, actualizar la info
    const current = getCurrentBoardInfo();
    if (current && current.id === boardId) {
        setCurrentBoardInfo({ id: boardId, name: newName });
    }
    return true;
}

/**
 * Elimina un tablero guardado por su ID.
 */
export function deleteBoard(boardId) {
    const boards = getBoardsList().filter(b => b.id !== boardId);
    saveBoardsList(boards);

    const current = getCurrentBoardInfo();
    if (current && current.id === boardId) {
        setCurrentBoardInfo(null);
        updateCurrentBoardDisplay();
    }
}

/**
 * Carga un tablero por ID y devuelve { tasks, taskCounter } o null.
 */
export function loadBoardById(boardId) {
    const boards = getBoardsList();
    const board  = boards.find(b => b.id === boardId);
    if (!board) return null;

    setCurrentBoardInfo({ id: board.id, name: board.name });
    updateCurrentBoardDisplay();
    markClean();
    return {
        tasks:       JSON.parse(JSON.stringify(board.tasks)),
        taskCounter: board.taskCounter
    };
}

// ---------------------------------------------------------------------
// Diálogos UI
// ---------------------------------------------------------------------

/**
 * Muestra un diálogo modal para introducir el nombre del tablero.
 * @param {string} currentName - Nombre actual (para pre-rellenar)
 * @param {(name: string) => void} onSave - Callback con el nombre elegido
 */
export function showSaveBoardDialog(currentName, onSave) {
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'app-modal';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-gray-800 mb-2';
    title.textContent = 'Guardar Tablero';

    const message = document.createElement('p');
    message.className = 'text-gray-600 mb-4';
    message.textContent = 'Introduce un nombre para guardar el tablero actual:';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4';
    input.placeholder = 'Nombre del tablero';
    input.value = currentName || '';

    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'flex justify-end gap-3';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'px-4 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400';
    cancelBtn.textContent = 'Cancelar';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
    saveBtn.textContent = 'Guardar';

    buttonsRow.appendChild(cancelBtn);
    buttonsRow.appendChild(saveBtn);
    modal.appendChild(title);
    modal.appendChild(message);
    modal.appendChild(input);
    modal.appendChild(buttonsRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    input.focus();
    input.select();

    function close() {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
    }

    function handleSave() {
        const name = input.value.trim();
        if (!name) {
            input.classList.add('border-red-400');
            input.focus();
            return;
        }
        close();
        onSave(name);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'Enter' && document.activeElement !== cancelBtn) {
            e.preventDefault();
            handleSave();
        }
    }

    cancelBtn.addEventListener('click', close);
    saveBtn.addEventListener('click', handleSave);
    document.addEventListener('keydown', onKeyDown);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
    });
}

/**
 * Muestra un diálogo modal para renombrar un tablero.
 * @param {string} currentName - Nombre actual
 * @param {(name: string) => void} onRename - Callback con el nuevo nombre
 */
function showRenameBoardDialog(currentName, onRename) {
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'app-modal';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-gray-800 mb-2';
    title.textContent = 'Renombrar Tablero';

    const message = document.createElement('p');
    message.className = 'text-gray-600 mb-4';
    message.textContent = 'Introduce el nuevo nombre para el tablero:';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4';
    input.placeholder = 'Nuevo nombre del tablero';
    input.value = currentName || '';

    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'flex justify-end gap-3';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'px-4 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400';
    cancelBtn.textContent = 'Cancelar';

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
    renameBtn.textContent = 'Renombrar';

    buttonsRow.appendChild(cancelBtn);
    buttonsRow.appendChild(renameBtn);
    modal.appendChild(title);
    modal.appendChild(message);
    modal.appendChild(input);
    modal.appendChild(buttonsRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    input.focus();
    input.select();

    function close() {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
    }

    function handleRename() {
        const name = input.value.trim();
        if (!name) {
            input.classList.add('border-red-400');
            input.focus();
            return;
        }
        close();
        onRename(name);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'Enter' && document.activeElement !== cancelBtn) {
            e.preventDefault();
            handleRename();
        }
    }

    cancelBtn.addEventListener('click', close);
    renameBtn.addEventListener('click', handleRename);
    document.addEventListener('keydown', onKeyDown);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
    });
}

/**
 * Muestra un diálogo modal con la lista de tableros guardados.
 * @param {(boardId: string) => void} onSelect  - Callback al seleccionar un tablero
 * @param {(boardId: string) => void} onDelete  - Callback al eliminar un tablero
 */
export function showOpenBoardDialog(onSelect, onDelete) {
    const boards = getBoardsList();

    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'app-modal';
    modal.style.maxWidth = '32rem';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-gray-800 mb-2';
    title.textContent = 'Abrir Tablero';

    if (boards.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'text-gray-500 text-center py-6';
        emptyMsg.textContent = 'No hay tableros guardados. Guarda un tablero primero.';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'mt-4 px-4 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors w-full focus:outline-none focus:ring-2 focus:ring-gray-400';
        closeBtn.textContent = 'Cerrar';
        closeBtn.addEventListener('click', () => overlay.remove());

        modal.appendChild(title);
        modal.appendChild(emptyMsg);
        modal.appendChild(closeBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        closeBtn.focus();

        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
        });
        return;
    }

    // Lista de tableros
    const list = document.createElement('div');
    list.className = 'space-y-2 my-4 max-h-64 overflow-y-auto';

    // Ordenar del más reciente al más antiguo
    const sorted = [...boards].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    let onKeyDown;

    function removeKeyDown() {
        if (onKeyDown) {
            document.removeEventListener('keydown', onKeyDown);
            onKeyDown = null;
        }
    }

    sorted.forEach(board => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all';

        const info = document.createElement('div');
        info.className = 'flex-1 min-w-0';

        const nameEl = document.createElement('div');
        nameEl.className = 'font-medium text-gray-800 truncate';
        nameEl.textContent = board.name;

        const meta = document.createElement('div');
        meta.className = 'text-xs text-gray-500 mt-1';
        meta.textContent = `${board.taskCount} tareas · ${formatDate(board.savedAt)}`;

        info.appendChild(nameEl);
        info.appendChild(meta);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex items-center gap-1 flex-shrink-0';

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400';
        renameBtn.title = 'Renombrar tablero';
        renameBtn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>';

        renameBtn.addEventListener('click', e => {
            e.stopPropagation();
            showRenameBoardDialog(board.name, newName => {
                const renamed = renameBoard(board.id, newName);
                if (renamed) {
                    removeKeyDown();
                    overlay.remove();
                    showOpenBoardDialog(onSelect, onDelete);
                    showMessage(`\u270f\ufe0f Tablero renombrado a "${newName}"`, 'success');
                } else {
                    showMessage(`\u274c Ya existe un tablero con el nombre "${newName}"`, 'error');
                }
            });
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-400';
        deleteBtn.title = 'Eliminar tablero';
        deleteBtn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';

        deleteBtn.addEventListener('click', async e => {
            e.stopPropagation();
            const confirmed = await showConfirm({
                title:       'Eliminar tablero',
                message:     `¿Estás seguro de que quieres eliminar "${board.name}"? Esta acción no se puede deshacer.`,
                confirmText: 'Eliminar',
                cancelText:  'Cancelar',
                danger:      true
            });
            if (confirmed) {
                onDelete(board.id);
                removeKeyDown();
                overlay.remove();
                // Re-abrir el diálogo actualizado
                showOpenBoardDialog(onSelect, onDelete);
                showMessage(`🗑️ Tablero "${board.name}" eliminado`, 'success');
            }
        });

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);
        item.appendChild(info);
        item.appendChild(actionsDiv);

        item.addEventListener('click', () => {
            removeKeyDown();
            overlay.remove();
            onSelect(board.id);
        });

        list.appendChild(item);
    });

    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'flex justify-end gap-3 mt-2';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'px-4 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400';
    closeBtn.textContent = 'Cancelar';
    closeBtn.addEventListener('click', () => {
        removeKeyDown();
        overlay.remove();
    });

    buttonsRow.appendChild(closeBtn);

    modal.appendChild(title);
    modal.appendChild(list);
    modal.appendChild(buttonsRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    closeBtn.focus();

    onKeyDown = function(e) {
        if (e.key === 'Escape') {
            removeKeyDown();
            overlay.remove();
        }
    };
    document.addEventListener('keydown', onKeyDown);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            removeKeyDown();
            overlay.remove();
        }
    });
}

/**
 * Formatea una fecha ISO para mostrar.
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
