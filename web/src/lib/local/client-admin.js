// Backend local "service_role": salta RLS, auth.admin sobre auth.users y storage sin politicas.
// Solo servidor. No lee cookies: no actua en nombre de un usuario.
import {
    aSesion,
    crearAdminAuth,
    errorSinSesion,
    solicitarRecuperacion,
    verificarCredenciales,
} from './auth.js';
import { ejecutarRpc } from './rpc.js';
import { crearTokenSesion, verificarTokenSesion } from './session.js';
import { crearStorageLocal } from './storage.js';

export function crearBackendAdminLocal() {
    const auth = {
        // Un cliente service_role no tiene sesion propia (como createClient con persistSession:false).
        async getUser() {
            return { data: { user: null }, error: errorSinSesion() };
        },
        async getSession() {
            return { data: { session: null }, error: null };
        },
        // Valida credenciales sin persistir nada (no hay cookie): util para "confirmar contrasena actual".
        async signInWithPassword({ email, password } = {}) {
            const r = await verificarCredenciales(email, password);
            if (r.error) return { data: { user: null, session: null }, error: r.error };
            const s = verificarTokenSesion(crearTokenSesion(r.user.id));
            return { data: { user: r.user, session: aSesion(r.user, s.exp) }, error: null };
        },
        async signOut() {
            return { error: null };
        },
        async resetPasswordForEmail() {
            return solicitarRecuperacion();
        },
        async updateUser() {
            return { data: { user: null }, error: errorSinSesion() };
        },
        onAuthStateChange() {
            return { data: { subscription: { unsubscribe() {} } } };
        },
        admin: crearAdminAuth(),
    };

    return {
        auth,
        rpc: (nombre, args) => ejecutarRpc(nombre, args, { rol: 'service_role' }),
        storage: crearStorageLocal({ privilegios: 'servicio' }),
    };
}
