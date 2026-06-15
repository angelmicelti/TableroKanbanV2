// =====================================================================
// USER AUTHENTICATION & MANAGEMENT
// =====================================================================
// Gestiona usuarios mediante Firebase Realtime Database.
// Las contraseñas se almacenan con hash SHA-256 (via SubtleCrypto API).
// El primer usuario registrado se convierte automáticamente en admin.
// La sesión persiste en localStorage.

import { getDB } from './firebase-service.js';
import { APP_NAMESPACE } from './config.js';
import { showMessage, escapeHtml } from './utils.js';

const SESSION_KEY = 'kanban-current-user';

// ---------------------------------------------------------------------
// Password hashing (SHA-256 via Web Crypto API)
// ---------------------------------------------------------------------

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'kanban-salt-v1');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------

/**
 * Devuelve el usuario de la sesión actual o null.
 * @returns {{ username: string, isAdmin: boolean } | null}
 */
export function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
        return null;
    }
}

function saveSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// ---------------------------------------------------------------------
// User CRUD en Firebase
// ---------------------------------------------------------------------

function getUsersRef() {
    const db = getDB();
    if (!db) return null;
    return db.ref(APP_NAMESPACE + '/users');
}

/**
 * Obtiene todos los usuarios desde Firebase.
 * @returns {Promise<Object>} Objeto con username -> userData
 */
async function fetchAllUsers() {
    const ref = getUsersRef();
    if (!ref) return {};
    const snapshot = await ref.once('value');
    return snapshot.val() || {};
}

/**
 * Registra un nuevo usuario.
 * @param {string} username - Nombre de usuario
 * @param {string} password - Contraseña
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function registerUser(username, password) {
    if (!username || !password) {
        return { success: false, error: 'Usuario y contraseña son obligatorios.' };
    }
    if (username.length < 3) {
        return { success: false, error: 'El usuario debe tener al menos 3 caracteres.' };
    }
    if (password.length < 4) {
        return { success: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
    }

    const ref = getUsersRef();
    if (!ref) {
        return { success: false, error: 'Firebase no está conectado.' };
    }

    try {
        const allUsers = await fetchAllUsers();

        // Comprobar si el usuario ya existe
        if (allUsers[username]) {
            return { success: false, error: `El usuario "${username}" ya existe.` };
        }

        // El primer usuario es admin
        const isFirstUser = Object.keys(allUsers).length === 0;
        const hashedPw = await hashPassword(password);

        await ref.child(username).set({
            username,
            password: hashedPw,
            isAdmin: isFirstUser,
            createdAt: new Date().toISOString()
        });

        // Iniciar sesión automáticamente
        const userData = { username, isAdmin: isFirstUser };
        saveSession(userData);

        return { success: true, user: userData };
    } catch (err) {
        console.error('Error al registrar usuario:', err);
        return { success: false, error: 'Error de conexión con Firebase.' };
    }
}

/**
 * Inicia sesión con usuario y contraseña.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function loginUser(username, password) {
    if (!username || !password) {
        return { success: false, error: 'Usuario y contraseña son obligatorios.' };
    }

    const ref = getUsersRef();
    if (!ref) {
        return { success: false, error: 'Firebase no está conectado.' };
    }

    try {
        const allUsers = await fetchAllUsers();
        const userRecord = allUsers[username];

        if (!userRecord) {
            return { success: false, error: 'Usuario o contraseña incorrectos.' };
        }

        const hashedPw = await hashPassword(password);
        if (userRecord.password !== hashedPw) {
            return { success: false, error: 'Usuario o contraseña incorrectos.' };
        }

        const userData = { username, isAdmin: userRecord.isAdmin || false };
        saveSession(userData);

        return { success: true, user: userData };
    } catch (err) {
        console.error('Error al iniciar sesión:', err);
        return { success: false, error: 'Error de conexión con Firebase.' };
    }
}

/**
 * Cierra la sesión del usuario actual.
 */
export function logoutUser() {
    clearSession();
}

/**
 * Comprueba si el usuario actual es administrador.
 * @returns {boolean}
 */
export function isCurrentUserAdmin() {
    const user = getCurrentUser();
    return user ? user.isAdmin : false;
}

/**
 * Devuelve todos los usuarios registrados (solo admin).
 * @returns {Promise<Array<{username: string, isAdmin: boolean, createdAt: string}>>}
 */
export async function getAllUsers() {
    if (!isCurrentUserAdmin()) {
        return [];
    }

    try {
        const allUsers = await fetchAllUsers();
        return Object.values(allUsers).map(u => ({
            username: u.username,
            isAdmin: u.isAdmin || false,
            createdAt: u.createdAt
        }));
    } catch {
        return [];
    }
}

/**
 * Cambia la contraseña del usuario actual verificando la contraseña actual.
 * @param {string} username
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function changePassword(username, currentPassword, newPassword) {
    if (!username || !currentPassword || !newPassword) {
        return { success: false, error: 'Todos los campos son obligatorios.' };
    }
    if (newPassword.length < 4) {
        return { success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
    }

    const ref = getUsersRef();
    if (!ref) return { success: false, error: 'Firebase no está conectado.' };

    try {
        const allUsers = await fetchAllUsers();
        const userRecord = allUsers[username];

        if (!userRecord) {
            return { success: false, error: 'Usuario no encontrado.' };
        }

        // Verificar contraseña actual
        const currentHash = await hashPassword(currentPassword);
        if (userRecord.password !== currentHash) {
            return { success: false, error: 'La contraseña actual no es correcta.' };
        }

        // Hashear y guardar nueva contraseña
        const newHash = await hashPassword(newPassword);
        await ref.child(username).child('password').set(newHash);

        return { success: true };
    } catch (err) {
        console.error('Error al cambiar contraseña:', err);
        return { success: false, error: 'Error de conexión con Firebase.' };
    }
}

/**
 * Cambia la contraseña de cualquier usuario (solo administradores).
 * No requiere la contraseña actual.
 * @param {string} username
 * @param {string} newPassword
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function adminSetPassword(username, newPassword) {
    const current = getCurrentUser();
    if (!current || !current.isAdmin) {
        return { success: false, error: 'Solo los administradores pueden cambiar contraseñas de otros usuarios.' };
    }
    if (!newPassword || newPassword.length < 4) {
        return { success: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
    }

    const ref = getUsersRef();
    if (!ref) return { success: false, error: 'Firebase no está conectado.' };

    try {
        const allUsers = await fetchAllUsers();
        if (!allUsers[username]) {
            return { success: false, error: 'Usuario no encontrado.' };
        }

        const newHash = await hashPassword(newPassword);
        await ref.child(username).child('password').set(newHash);

        return { success: true };
    } catch (err) {
        console.error('Error al cambiar contraseña:', err);
        return { success: false, error: 'Error de conexión con Firebase.' };
    }
}

/**
 * Elimina un usuario (solo admin, no se puede eliminar a sí mismo).
 * @param {string} username
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteUser(username) {
    const current = getCurrentUser();
    if (!current || !current.isAdmin) {
        return { success: false, error: 'Solo los administradores pueden eliminar usuarios.' };
    }
    if (current.username === username) {
        return { success: false, error: 'No puedes eliminarte a ti mismo.' };
    }

    const ref = getUsersRef();
    if (!ref) return { success: false, error: 'Firebase no está conectado.' };

    try {
        await ref.child(username).remove();
        return { success: true };
    } catch {
        return { success: false, error: 'Error al eliminar usuario.' };
    }
}

/**
 * Actualiza la UI para reflejar el estado de autenticación.
 * Muestra/oculta el panel de login y la info del usuario.
 */
export function renderAuthUI() {
    const user = getCurrentUser();
    const authOverlay = document.getElementById('authOverlay');
    const appContainer = document.getElementById('appContainer');
    const userInfo = document.getElementById('userInfo');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const userBadge = document.getElementById('userBadge');

    if (!authOverlay) return;

    if (user) {
        // Fade out: ocultar overlay, mostrar app
        authOverlay.classList.add('auth-overlay--hidden');
        if (appContainer) {
            appContainer.classList.remove('app-container--dimmed');
        }
        userInfo.classList.remove('hidden');
        if (userBadge) {
            userBadge.innerHTML = '';
            const dot = document.createElement('span');
            dot.className = 'w-2 h-2 bg-green-500 rounded-full';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'font-medium dark:text-gray-200';
            nameSpan.textContent = user.username;
            userBadge.appendChild(dot);
            userBadge.appendChild(nameSpan);
            if (user.isAdmin) {
                const adminBadge = document.createElement('span');
                adminBadge.className = 'text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded-full font-medium';
                adminBadge.textContent = 'Admin';
                userBadge.appendChild(adminBadge);
            }
        }
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.add('hidden');
    } else {
        // Fade in: mostrar overlay, ocultar app
        authOverlay.classList.remove('auth-overlay--hidden');
        if (appContainer) {
            appContainer.classList.add('app-container--dimmed');
        }
        userInfo.classList.add('hidden');
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
    }
}
