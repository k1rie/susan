// Handler POST /api/_local/rpc/[name]: puente del navegador hacia las RPC api_*.
// svc_* JAMAS se expone por HTTP (son de service_role: los llaman solo Route Handlers y jobs).
import { ejecutarRpc } from '@/lib/local/rpc.js';
import { errorHttp, estatusDeErrorRpc, json, leerJson, manejar } from './comun.js';

const RE_API = /^api_[a-z0-9_]+$/;

export function rpc(request, contexto) {
    return manejar(request, { sesion: false }, async () => {
        const { name } = await contexto.params;
        if (typeof name === 'string' && name.startsWith('svc_')) {
            return errorHttp('Las funciones svc_* no se exponen por HTTP.', '42501', 403, 'NO_AUTORIZADO');
        }
        if (typeof name !== 'string' || !RE_API.test(name)) {
            return errorHttp('Nombre de funcion no permitido.', 'PGRST202', 400);
        }
        return manejar(request, { estado: false }, async ({ usuario }) => {
            const cuerpo = await leerJson(request);
            if (!cuerpo) return errorHttp('Se esperaba un cuerpo JSON { args }.', 'PGRST100', 400);
            const { data, error } = await ejecutarRpc(name, cuerpo.args ?? {}, {
                rol: 'authenticated',
                claims: { sub: usuario.user.id, email: usuario.user.email },
            });
            if (error) return json({ data: null, error }, estatusDeErrorRpc(error));
            return json({ data, error: null });
        });
    });
}
