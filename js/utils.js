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
