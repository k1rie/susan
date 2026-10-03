// Acceso a las cookies de la peticion (await cookies()) para los backends de servidor.
//
// Por que NO `import { cookies } from 'next/headers'`: index.js lo importan tambien componentes
// de cliente y, aunque ./server.js se carga con import() dinamico solo en el servidor, el grafo
// de la capa "Client Component SSR" (que si corre en Node) lo recorre y Next prohibe 'next/headers'
// ahi. next/headers solo reexporta este mismo modulo (`next/headers.js` -> dist/server/request/
// cookies), asi que es la misma funcion y comparte el contexto de la peticion. La version de Next
// esta fijada (16.3.8); si cambiara, esta es la unica linea a revisar.
import { cookies } from 'next/dist/server/request/cookies';

export const cookiesDePeticion = () => cookies();
