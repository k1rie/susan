// Administración de cuentas y prueba de cámaras (service_role). Solo servidor.
import { randomInt } from 'node:crypto';
import { ApiError } from '@/lib/api/errors';
import { reconocer } from './recognition.js';
import { urlSnapshotCamara } from './captura.js';

// ---------------------------------------------------------------------------------------------------------
// Contraseña temporal
// ---------------------------------------------------------------------------------------------------------

const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I/O: se dictan o copian y se confunden con 1/0
const MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz';
const DIGITOS = '23456789';
const SIMBOLOS = '!#$%*+-=?@';

/**
 * Contraseña temporal aleatoria de >= 12 caracteres (def. 16) con CSPRNG (crypto.randomInt, sin sesgo de módulo):
 * al menos una mayúscula, minúscula, dígito y símbolo, en orden barajado.
 */
export function generarContrasenaTemporal(longitud = 16) {
    const largo = Math.max(12, longitud);
    const clases = [MAYUSCULAS, MINUSCULAS, DIGITOS, SIMBOLOS];
    const todo = clases.join('');
    const caracteres = clases.map((c) => c[randomInt(c.length)]);
    while (caracteres.length < largo) caracteres.push(todo[randomInt(todo.length)]);
    for (let i = caracteres.length - 1; i > 0; i -= 1) { // Fisher-Yates
        const j = randomInt(i + 1);
        [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
    }
    return caracteres.join('');
}

/** Error de Auth -> ApiError sin reenviar su texto (podría incluir el correo o detalles internos). */
function errorDeAuth(error) {
    const codigo = String(error?.code ?? '');
    const mensaje = String(error?.message ?? '');
    if (codigo === 'email_exists' || codigo === 'user_already_exists' || /already (been )?registered/i.test(mensaje)) {
        return new ApiError({ code: 'DUPLICADO', message: 'Ya existe una cuenta con ese correo.', status: 409 });
    }
    if (codigo === 'weak_password') {
        return new ApiError({ code: 'CONTRASENA_DEBIL', message: 'La contraseña no cumple los requisitos de seguridad.', status: 422 });
    }
    if (error?.status === 429 || codigo === 'over_request_rate_limit') {
        return new ApiError({ code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos. Espera unos minutos.', status: 429 });
    }
    return new ApiError({
        code: 'AUTH_NO_DISPONIBLE', message: 'No se pudo completar la operación con el servicio de autenticación.', status: 502,
    });
}

/**
 * POST /api/admin/usuarios (admin).
 * 1) cuenta en Auth con contraseña temporal; 2) fila `usuario`. Si el paso 2 falla se BORRA la cuenta de Auth
 * (compensación) para no dejar cuentas sin perfil. La contraseña se devuelve UNA sola vez y nunca se registra.
 */
export async function crearUsuario({ admin, svc, body }) {
    const cliente = await admin();
    const contrasena = generarContrasenaTemporal();
    let creada;
    try {
        creada = await cliente.auth.admin.createUser({ email: body.correo, password: contrasena, email_confirm: true });
    } catch {
        throw errorDeAuth(null);
    }
    const authUid = creada?.data?.user?.id;
    if (creada?.error || !authUid) throw errorDeAuth(creada?.error);

    let idUsuario;
    try {
        idUsuario = await svc('svc_usuario_crear', {
            correo: body.correo,
            rol: body.rol,
            idDocente: body.id_docente,
            idAlumno: body.id_alumno,
            authUid,
        });
    } catch (e) {
        try {
            await cliente.auth.admin.deleteUser(authUid);
        } catch {
            // Cuenta de Auth huérfana: se registra sin correo ni contraseña para que el operador la limpie.
            console.error('[usuarios] no se pudo compensar: quedó una cuenta de Auth sin perfil');
        }
        throw e;
    }
    return { id_usuario: idUsuario, correo: body.correo, rol: body.rol, contrasena_temporal: contrasena };
}

/** Busca la cuenta de `usuario` por id recorriendo api_usuarios_listar (RLS: solo el administrador la ve). */
async function buscarUsuario(rpc, idUsuario) {
    for (let offset = 0; offset < 20_000; offset += 200) {
        const pagina = await rpc('api_usuarios_listar', { limit: 200, offset });
        const items = pagina?.items ?? [];
        const hallado = items.find((u) => u.id_usuario === idUsuario);
        if (hallado) return hallado;
        if (items.length < 200) break;
    }
    throw new ApiError({ code: 'NO_ENCONTRADO', message: 'La cuenta no existe.', status: 404 });
}

/** auth.users.id de un correo (el catálogo SQL no expone auth_uid al administrador). */
async function authUidDeCorreo(cliente, correo) {
    const POR_PAGINA = 200;
    for (let pagina = 1; pagina <= 100; pagina += 1) {
        const { data, error } = await cliente.auth.admin.listUsers({ page: pagina, perPage: POR_PAGINA });
        if (error) throw errorDeAuth(error);
        const usuarios = data?.users ?? [];
        const u = usuarios.find((x) => String(x.email ?? '').toLowerCase() === correo.toLowerCase());
        if (u) return u.id;
        if (usuarios.length < POR_PAGINA) break;
    }
    throw new ApiError({ code: 'NO_ENCONTRADO', message: 'La cuenta no existe en el servicio de autenticación.', status: 404 });
}

/** POST /api/admin/usuarios/{id}/restablecer (admin): nueva contraseña temporal, mostrada una sola vez. */
export async function restablecerUsuario({ rpc, admin, params }) {
    const usuario = await buscarUsuario(rpc, params.id);
    const cliente = await admin();
    const authUid = await authUidDeCorreo(cliente, usuario.correo);
    const contrasena = generarContrasenaTemporal();
    let resultado;
    try {
        resultado = await cliente.auth.admin.updateUserById(authUid, { password: contrasena });
    } catch {
        throw errorDeAuth(null);
    }
    if (resultado?.error) throw errorDeAuth(resultado.error);
    return { id_usuario: usuario.id_usuario, correo: usuario.correo, contrasena_temporal: contrasena };
}

/** Errores que significan "la cámara no respondió bien": se reportan como resultado de la prueba, no como fallo. */
const FALLOS_DE_CAMARA = new Set(['CAMARA_INALCANZABLE', 'CAMARA_URL_BLOQUEADA', 'IMAGEN_INVALIDA', 'CAMARA_SIN_DIRECCION']);

/**
 * POST /api/admin/camaras/{id}/probar (admin/técnico).
 * 'ip': pide un fotograma al servicio con allowed_faiss_ids vacío y reporta rostros y milisegundos.
 * 'navegador': ok sin probar (la webcam solo existe en el equipo del docente).
 */
export async function probarCamara({ rpc, params }) {
    const lista = await rpc('api_camaras_estado', { limit: 200 });
    const camara = lista?.items?.find((c) => c.id_camara === params.id);
    if (!camara) throw new ApiError({ code: 'CAMARA_NO_ENCONTRADA', message: 'La cámara no existe.', status: 404 });
    if (camara.tipo !== 'ip') {
        return { ok: true, tipo: camara.tipo, probada: false, mensaje: 'La cámara del navegador se prueba desde el equipo del docente.' };
    }
    const inicio = Date.now();
    try {
        const r = await reconocer({ cameraUrl: urlSnapshotCamara(camara.direccion_ip), allowedFaissIds: [] });
        return {
            ok: true,
            tipo: 'ip',
            probada: true,
            rostros: r.faces.length,
            ms: Date.now() - inicio,
            servicio_ms: r.elapsed_ms,
            imagen: r.image,
        };
    } catch (e) {
        if (e instanceof ApiError && FALLOS_DE_CAMARA.has(e.code)) {
            return { ok: false, tipo: 'ip', probada: true, codigo: e.code, mensaje: e.message, ms: Date.now() - inicio };
        }
        throw e;
    }
}
