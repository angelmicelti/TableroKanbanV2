// =====================================================================
// PWA: INSTALACIÓN Y SERVICE WORKER
// =====================================================================

import { showMessage } from './utils.js';

let deferredPrompt = null;
let installButton = null;

/**
 * Crea el botón flotante de instalación y registra los listeners
 * `beforeinstallprompt` y `appinstalled`. Se llama en cuanto el
 * módulo se importa (no esperamos a DOMContentLoaded para evitar
 * la race condition que reiniciaba `display='none'`).
 */
export function setupInstallButton() {
    installButton = document.createElement('button');
    installButton.textContent = '\ud83d\udcf1 Instalar App';
    installButton.className = 'fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg z-40 flex items-center gap-2 transition-all duration-300';
    installButton.style.display = 'none';
    installButton.addEventListener('click', installPWA);
    document.body.appendChild(installButton);

    window.addEventListener('beforeinstallprompt', e => {
        console.log('beforeinstallprompt event fired');
        e.preventDefault();
        deferredPrompt = e;
        installButton.style.display = 'flex';

        // Auto-ocultar el botón tras 15s si el usuario no interactúa
        setTimeout(() => {
            if (installButton && installButton.style.display !== 'none') {
                installButton.style.display = 'none';
            }
        }, 15000);
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        if (installButton) installButton.style.display = 'none';
        deferredPrompt = null;
    });
}

async function installPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to the install prompt: ${outcome}`);

    if (outcome === 'accepted') {
        if (installButton) installButton.style.display = 'none';
        showMessage('\u2705 App instalada correctamente', 'success');
    }
    deferredPrompt = null;
}

/**
 * Registra el Service Worker. Solo recarga la página cuando ya había
 * un SW controlador (es decir, en actualizaciones), para no recargar
 * en la primera instalación.
 */
export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registrado con \u00e9xito:', registration.scope);

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;
                    console.log('Nueva versi\u00f3n del Service Worker encontrada');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('Nueva versi\u00f3n lista para activar');
                            showMessage('\ud83d\udd04 Nueva versi\u00f3n disponible. Recarga la p\u00e1gina.', 'info');
                        }
                    });
                });
            })
            .catch(error => {
                console.log('Error al registrar ServiceWorker:', error);
            });
    });

    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }
}

/**
 * Detecta si la página se está ejecutando como PWA instalada.
 */
export function isRunningAsPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}
