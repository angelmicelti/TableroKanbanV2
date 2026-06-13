// =====================================================================
// IMPORTAR / EXPORTAR / LIMPIAR
// =====================================================================

import { state } from './state.js';
import { VALID_STATUSES, EXPORT_VERSION } from './config.js';
import { showMessage } from './utils.js';
import { renderTask, clearAllTasksLocal, updateCounts, saveTasksToFirebase } from './tasks.js';

/**
 * Genera un Blob con las tareas y dispara la descarga.
 */
export function exportTasks() {
    if (state.tasks.length === 0) {
        showMessage('No hay tareas para exportar', 'info');
        return;
    }

    const exportData = {
        tasks: state.tasks,
        exportDate: new Date().toISOString(),
        version: EXPORT_VERSION
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `kanban-tareas-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showMessage('\u2705 Tareas descargadas correctamente', 'success');
}

/**
 * Lee un archivo JSON seleccionado por el usuario, valida su contenido
 * y reemplaza las tareas actuales por las importadas.
 */
export function importTasks(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const importData = JSON.parse(e.target.result);

            if (!importData.tasks || !Array.isArray(importData.tasks)) {
                throw new Error('Formato de archivo inv\u00e1lido');
            }

            // Limpiar tareas existentes (local + DOM, sin Firebase todavía)
            clearAllTasksLocal();

            let importedCount = 0;
            importData.tasks.forEach(taskData => {
                // Validar texto, status y que el status sea uno válido
                if (taskData.text && taskData.status && VALID_STATUSES.includes(taskData.status)) {
                    state.taskCounter++;
                    const task = {
                        id: state.taskCounter,
                        text: String(taskData.text),
                        status: taskData.status,
                        createdAt: taskData.createdAt || new Date().toLocaleString('es-ES')
                    };
                    state.tasks.push(task);
                    renderTask(task);
                    importedCount++;
                }
            });

            updateCounts();
            saveTasksToFirebase();
            showMessage(`\u2705 ${importedCount} tareas importadas correctamente`, 'success');

        } catch (error) {
            showMessage('\u274c Error al importar el archivo. Verifica que sea un archivo v\u00e1lido.', 'error');
            console.error('Import error:', error);
        }
    };

    reader.readAsText(file);
    // Resetear el input para permitir re-importar el mismo archivo
    event.target.value = '';
}
