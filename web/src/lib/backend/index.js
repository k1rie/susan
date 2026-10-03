// Punto unico de acceso al backend (docs/ARCHITECTURE.md §4): un objeto "tipo supabase-js" con
// la superficie permitida { auth, rpc, storage }. El modo (real o local) lo decide IS_LOCAL.
//
// Este archivo lo importan tambien los componentes de cliente, asi que NO importa nada de
// servidor de forma estatica (next/headers, service_role, pg): las dos funciones de servidor
// cargan ./server.js con import() dinamico.
import { createBrowserClient } from '@supabase/ssr';
import { IS_LOCAL, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config';
import { crearBackendNavegadorLocal } from '@/lib/local/client-browser.js';
import { restringir } from './surface.js';

let navegador = null;

/** Cliente del navegador (singleton, sincrono). Solo en componentes 'use client'. */
export function getBrowserBackend() {
    if (typeof window === 'undefined') {
        throw new Error('getBrowserBackend() solo puede usarse en el navegador; en servidor usa getServerBackend().');
    }
    if (!navegador) {
        if (IS_LOCAL) {
            navegador = crearBackendNavegadorLocal();
        } else {
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.');
            }
            navegador = restringir(createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY));
        }
    }
    return navegador;
}

/** Backend con el usuario de la peticion (cookies). RSC y Route Handlers. */
export async function getServerBackend() {
    // NEXT_RUNTIME vale '' en el bundle del navegador: el bundler elimina esta rama y ./server.js
    // (pg, next/headers, service_role) no entra al grafo del cliente. Mismo patron que instrumentation.
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { crearBackendServidor } = await import('./server.js');
        return crearBackendServidor();
    }
    throw new Error('getServerBackend() solo puede usarse en el servidor.');
}

/** Backend service_role (salta RLS, auth.admin, Storage). Solo servidor. */
export async function getAdminBackend() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { crearBackendAdmin } = await import('./server.js');
        return crearBackendAdmin();
    }
    throw new Error('getAdminBackend() solo puede usarse en el servidor.');
}
