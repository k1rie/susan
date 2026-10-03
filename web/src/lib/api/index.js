// Punto de entrada de la capa de datos. Los dominios se exportan como espacios de nombres
// (api.admin.gruposListar, api.sesiones.abrirSesion) para no chocar entre sí (cerrarSesion existe en
// auth y en sesiones).
export { callRpc, toRpcArgs, rpcName, resolverBackend, PAGINA_DEFECTO, PAGINA_MAXIMA } from './client.js';
export * from './errors.js';
export * as auth from './auth.js';
export * as plataforma from './plataforma.js';
export * as sesiones from './sesiones.js';
export * as revision from './revision.js';
export * as reportes from './reportes.js';
export * as admin from './admin.js';
export * as biometria from './biometria.js';
