// =====================================================================
// UTILIDADES GENERALES
// =====================================================================

/**
 * Escapa HTML para prevenir ataques XSS al insertar texto controlado
 * por el usuario en el DOM mediante `innerHTML`.
 * Usa textContent/innerHTML del navegador (la forma más segura).
 */
export function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Muestra un toast temporal en la esquina superior derecha.
 * Construye el DOM con `createElement` + `textContent` para que sea
 * seguro aunque algún caller pase contenido controlado por el usuario.
 */
export function showMessage(message, type = 'info') {
    const colors = {
        success: 'bg-green-100 border-green-400 text-green-700',
        error:   'bg-red-100 border-red-400 text-red-700',
        info:    'bg-blue-100 border-blue-400 text-blue-700'
    };

    const messageDiv = document.createElement('div');
    messageDiv.className =
        `fixed top-4 right-4 px-4 py-3 rounded border-l-4 ${colors[type] || colors.info} shadow-lg z-50 max-w-sm`;

    const row = document.createElement('div');
    row.className = 'flex justify-between items-center';

    const span = document.createElement('span');
    span.textContent = String(message);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ml-4 text-lg font-bold';
    closeBtn.textContent = '\u00d7'; // ×
    closeBtn.addEventListener('click', () => messageDiv.remove());

    row.appendChild(span);
    row.appendChild(closeBtn);
    messageDiv.appendChild(row);

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        if (messageDiv.parentElement) {
            messageDiv.remove();
        }
    }, 5000);
}

/**
 * Alterna la clase `collapsed` en el contenedor `.collapsible-section`
 * padre del elemento con id `sectionId`.
 */
export function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const parent = section.closest('.collapsible-section');
    if (parent) parent.classList.toggle('collapsed');
}

// Contador para IDs únicos (evita colisiones si se abren varios modales)
let modalIdCounter = 0;

/**
 * Muestra un modal de confirmación consistente con el sistema de toasts.
 * Devuelve una Promise<boolean> que se resuelve a `true` si el usuario
 * confirma, o `false` si cancela (botón, Escape o click fuera del modal).
 *
 * Características:
 * - Focus trap (Tab/Shift+Tab cicla entre los dos botones)
 * - Devuelve el foco al elemento que disparó el modal al cerrarse
 * - Cierra con Escape, click fuera del modal, o botón Cancelar
 * - Confirma con Enter (salvo si el foco está explícitamente en Cancelar)
 *   o botón Confirmar
 * - Limpia listeners al cerrarse (sin memory leak)
 * - Construye el DOM con createElement + textContent (sin XSS)
 *
 * @param {Object}  options
 * @param {string}  options.title        - Título del modal
 * @param {string}  options.message      - Mensaje/cuerpo del modal
 * @param {string}  [options.confirmText='Confirmar']
 * @param {string}  [options.cancelText='Cancelar']
 * @param {boolean} [options.danger=false] - Si true, usa rojo en el botón de confirmar
 * @returns {Promise<boolean>}
 */
export function showConfirm({
    title,
    message,
    confirmText = 'Confirmar',
    cancelText  = 'Cancelar',
    danger      = false
} = {}) {
    return new Promise(resolve => {
        const modalId = ++modalIdCounter;
        const titleId = `app-modal-title-${modalId}`;
        const messageId = `app-modal-message-${modalId}`;

        // Guardar el elemento con foco para devolvérselo al cerrar
        const previouslyFocused = document.activeElement;

        // ---- Construcción del DOM (seguro con createElement + textContent) ----
        const overlay = document.createElement('div');
        overlay.className = 'app-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'app-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        if (title)   modal.setAttribute('aria-labelledby', titleId);
        if (message) modal.setAttribute('aria-describedby', messageId);

        if (title) {
            const titleEl = document.createElement('h3');
            titleEl.id = titleId;
            titleEl.className = 'text-lg font-semibold text-gray-800 mb-2';
            titleEl.textContent = title;
            modal.appendChild(titleEl);
        }

        if (message) {
            const messageEl = document.createElement('p');
            messageEl.id = messageId;
            messageEl.className = 'text-gray-600 mb-6';
            messageEl.textContent = message;
            modal.appendChild(messageEl);
        }

        const buttonsRow = document.createElement('div');
        buttonsRow.className = 'flex justify-end gap-3';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'px-4 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400';
        cancelBtn.textContent = cancelText;

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = danger
            ? 'px-4 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500'
            : 'px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
        confirmBtn.textContent = confirmText;

        buttonsRow.appendChild(cancelBtn);
        buttonsRow.appendChild(confirmBtn);
        modal.appendChild(buttonsRow);
        overlay.appendChild(modal);

        // ---- Focus trap entre los dos botones ----
        const focusableButtons = [cancelBtn, confirmBtn];
        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close(false);
            } else if (e.key === 'Tab') {
                // Ciclar foco entre los dos botones
                const idx = focusableButtons.indexOf(document.activeElement);
                e.preventDefault();
                const next = e.shiftKey
                    ? (idx <= 0 ? focusableButtons.length - 1 : idx - 1)
                    : (idx === focusableButtons.length - 1 ? 0 : idx + 1);
                focusableButtons[next].focus();
            } else if (e.key === 'Enter' && document.activeElement !== cancelBtn) {
                e.preventDefault();
                close(true);
            }
        };

        const onOverlayMouseDown = (e) => {
            // Solo cerramos si el mousedown empezó en el overlay (no si
            // el usuario está seleccionando texto dentro del modal y
            // suelta el ratón fuera)
            if (e.target === overlay) {
                overlay.dataset.mouseDownOnOverlay = '1';
            } else {
                overlay.dataset.mouseDownOnOverlay = '';
            }
        };
        const onOverlayClick = (e) => {
            if (e.target === overlay && overlay.dataset.mouseDownOnOverlay === '1') {
                close(false);
            }
        };

        // ---- Cierre centralizado: cleanup garantizado en TODAS las rutas ----
        let closed = false;
        const close = (result) => {
            if (closed) return;
            closed = true;
            document.removeEventListener('keydown', onKeydown, true);
            overlay.removeEventListener('mousedown', onOverlayMouseDown);
            overlay.removeEventListener('click', onOverlayClick);
            if (overlay.parentElement) overlay.remove();
            // Devolver el foco al elemento que disparó el modal
            if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                previouslyFocused.focus();
            }
            resolve(result);
        };

        cancelBtn.addEventListener('click', () => close(false));
        confirmBtn.addEventListener('click', () => close(true));
        overlay.addEventListener('mousedown', onOverlayMouseDown);
        overlay.addEventListener('click', onOverlayClick);
        // Usar capture para que Escape se intercepte aunque otro listener
        // haga stopPropagation
        document.addEventListener('keydown', onKeydown, true);

        document.body.appendChild(overlay);
        // Foco inicial en el botón de confirmar
        confirmBtn.focus();
    });
}
