// =====================================================================
// ESTADO COMPARTIDO DE LA APLICACIÓN
// =====================================================================
// Objeto mutable exportado para que todos los módulos lean/escriban
// sobre la misma referencia. Se prefiere un objeto único a múltiples
// `let` re-exportados para evitar confusiones con bindings vivos.

export const state = {
    /** @type {Array<{id:number, text:string, status:string, createdAt:string}>} */
    tasks: [],
    /** @type {number} Próximo ID a asignar a una tarea nueva */
    taskCounter: 0,
    /** @type {boolean} `true` cuando Firebase ya envió su primer snapshot */
    isFirebaseLoaded: false
};
