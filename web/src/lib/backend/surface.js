// Recorta un cliente de supabase-js a la superficie PERMITIDA (docs/ARCHITECTURE.md §4).
// Asi el codigo de la app no puede usar nada (p. ej. .from('tabla')) que el modo local no imite:
// lo que funciona en un modo funciona en el otro.
export function restringir(cliente, { admin = false } = {}) {
    const auth = {
        getUser: (...a) => cliente.auth.getUser(...a),
        getSession: () => cliente.auth.getSession(),
        signInWithPassword: (c) => cliente.auth.signInWithPassword(c),
        signOut: (...a) => cliente.auth.signOut(...a),
        resetPasswordForEmail: (email, opciones) => cliente.auth.resetPasswordForEmail(email, opciones),
        updateUser: (attrs) => cliente.auth.updateUser(attrs),
        onAuthStateChange: (cb) => cliente.auth.onAuthStateChange(cb),
    };
    if (admin) {
        auth.admin = {
            createUser: (attrs) => cliente.auth.admin.createUser(attrs),
            updateUserById: (id, attrs) => cliente.auth.admin.updateUserById(id, attrs),
            deleteUser: (id) => cliente.auth.admin.deleteUser(id),
            listUsers: (params) => cliente.auth.admin.listUsers(params),
        };
    }
    return {
        auth,
        // rpc() de supabase-js devuelve un builder "thenable": el async lo convierte en Promise real.
        rpc: async (nombre, args) => cliente.rpc(nombre, args ?? {}),
        storage: {
            from(bucket) {
                const s = cliente.storage.from(bucket);
                return {
                    upload: (ruta, cuerpo, opciones) => s.upload(ruta, cuerpo, opciones),
                    download: (ruta) => s.download(ruta),
                    remove: (rutas) => s.remove(rutas),
                    createSignedUrl: (ruta, segundos) => s.createSignedUrl(ruta, segundos),
                };
            },
        },
    };
}
