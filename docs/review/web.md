# Revision de seguridad de la capa web

Alcance: web/src/app/api/**, lib/server, lib/backend, lib/local, proxy.js. Servidor real :3000 (modo local).

## Hallazgos

### H1 (major) Sin cabeceras de seguridad (CSP, X-Frame-Options/frame-ancestors, HSTS, Referrer-Policy, Permissions-Policy)
- web/next.config.mjs no define `headers()`; proxy.js tampoco las agrega. `curl -si http://localhost:3000/login` solo devuelve
  `Cache-Control`, `X-Powered-By: Next.js`, `Content-Type`; ninguna cabecera anti-clickjacking ni CSP. La app maneja consentimientos
  biometricos y acciones administrativas (restablecer contrasenas, reconstruir indice): es enmarcable desde otro origen.
- Correccion: `async headers()` en next.config con X-Frame-Options DENY / frame-ancestors 'none', nosniff, Referrer-Policy, HSTS
  (solo prod), Permissions-Policy (camera=(self) por la captura), CSP; `poweredByHeader:false`.

### H2 (minor, solo modo local) El cierre de sesion no invalida el token: la cookie robada sigue valida 8 h
- lib/local/session.js: token HMAC sin estado {sub,exp}. Prueba: login admin -> POST /api/_local/auth/logout (200) ->
  GET /api/_local/auth/session con la MISMA cookie devuelve el usuario. Tampoco hay revocacion al cambiar contrasena.
- Correccion: version de sesion por usuario (columna/ contador) incluida en el token, o lista de revocacion; documentar que solo es dev.

### H3 (major) El limitador de captura no limita si el cliente repite `marca_tiempo` (DoS del servicio de reconocimiento)
- web/src/lib/server/rateLimit.js:34-40: si `marcaTiempo === previa.marca` devuelve `permitido:true` SIN consumir cupo ni
  actualizar `ultimo`. captura.js (`ejecutarCaptura`) no cachea el resultado por (camara, marca): cada peticion repetida ejecuta
  de nuevo `reconocer()` (carga FAISS/InsightFace). Un docente (o un cliente defectuoso) que fije una marca constante envia
  capturas ilimitadas. Prueba: web/src/review/web_seguridad.test.js ("la misma marca_tiempo nunca consume cupo, 200 pasan").
  Ademas el cupo se consume ANTES de autorizar la sesion (api_sesion_monitor), asi que un docente puede inflar el Map (tope 5000, con
  expulsion por orden de insercion) con pares (sesion, camara) arbitrarios y expulsar entradas legitimas.
- Correccion: permitir el reintento idempotente solo UNA vez por marca (contador) o devolver el resultado cacheado; aplicar el cupo
  despues de api_sesion_monitor; y un tope por usuario ademas del por camara.

### H4 (minor) SSRF: la lista de bloqueo del servicio de reconocimiento deja pasar 100.64.0.0/10 (incl. 100.100.100.200, metadatos de Alibaba Cloud)
- recognition-service/app/camera.py `_blocked`: solo bloquea link_local/unspecified/multicast/reserved y, con allow_private=False,
  loopback/private. Evidencia (venv del servicio): `_blocked(ip_address('100.100.100.200'), False)` -> False y
  `_blocked(ip_address('100.64.0.1'), False)` -> False (is_private=False, is_global=False). El resto (169.254.169.254, ::ffff:169.254.169.254,
  64:ff9b::a9fe:a9fe, 2002:a9fe:a9fe::, fd00:ec2::254, 127.0.0.1 mapeada) SI se bloquea. Un admin/tecnico que registre una camara con IP
  100.100.100.200 y pulse "probar" hace que el servicio pida http://100.100.100.200/snapshot.jpg (y la respuesta de error revela el
  codigo HTTP: oraculo de puertos/hosts, ruta fija /snapshot.jpg limita el dano).
- Correccion: bloquear `not ip.is_global` cuando allow_private=False (cubre CGNAT, 100.64/10, 192.0.0.0/24...) y mantener la lista fija
  de metadatos aun con allow_private=True (anadir 100.100.100.200).

### H5 (minor) IP de la bitacora RF-19 falsificable: se usa el primer elemento de X-Forwarded-For
- web/src/lib/server/ip.js:30-37 recorre `x-forwarded-for` de izquierda a derecha y toma la primera IP valida. Los proxies
  estandar (nginx $proxy_add_x_forwarded_for, ALB) ANADEN la IP real al final, por lo que la izquierda es lo que mande el cliente.
  Prueba: `ipDeOrigen({x-forwarded-for:'10.9.9.9, 203.0.113.50'}) === '10.9.9.9'`. Un docente puede asentar IPs falsas en la bitacora
  de consultas de recortes/justificantes. El comentario del archivo admite que depende de que el proxy reescriba la cabecera.
- Correccion: configuracion de N proxies de confianza y tomar el elemento N desde la derecha (o preferir cabecera propia de la plataforma);
  documentarlo como requisito de despliegue y validarlo en /api/salud.

### H6 (minor, solo modo local) Login local: sin limite de intentos y enumeracion de cuentas por tiempo
- lib/local/auth.js `verificarCredenciales`: una sola consulta; si el correo no existe no se evalua crypt() (bcrypt). Medicion en :3000:
  mediana 204 ms (cuenta existente, clave mala) vs 14 ms (inexistente). 25 intentos seguidos -> 25 x 400, nunca 429.
  Contradice el comentario "no revela cuentas". Prueba: "HALLAZGO: el login local no limita intentos...".
- Correccion: ejecutar crypt contra un hash fijo cuando no hay fila; limitador por IP/correo (aunque sea dev).

## Resistio (checkedOk)
- Todas las rutas /api/* usan handle() (jobs via handleJob); roles correctos: docente1/e260001/tecnico reciben 403 en POST /api/admin/usuarios; tecnico 403 en restablecer.
- IDOR: docente2 recibe 404 en /api/casos/{1,2,3,5,10}/detecciones y /api/justificantes/{1,2}/documento (docente1 si); sin sesion 401.
- SQL fuerza que objeto_documento de justificantes/consentimientos coincida con `^justificantes/{id_alumno}/...` (0121:170), sin rutas del cliente.
- Rutas de objeto: validarRutaObjeto rechaza `..`, `//`, NUL, `\`, absolutas, prefijos/extensiones fuera de patron; subidas por firma binaria (SVG/HTML renombrado -> rechazado), ext derivada del tipo detectado.
- /api/_local: svc_* 403; Origin ausente/ajeno 403; storage/object sin sesion 401; 404 en production (soloLocal).
- Jobs: sin CRON_SECRET -> 503, Bearer vacio/erroneo -> 401, comparacion SHA-256 + timingSafeEqual; bloqueos con TTL para reconstruccion.
- Bitacora asentada ANTES de firmar con fallo cerrado (revision.js); TTL de URL firmada limitado a 300 s en storage.js y local/storage.js.
- Errores 500 sin detalles (respuestaDeError); cuerpo con tope real por conteo de bytes; multipart acotado; zod .strict() en esquemas.
- ?next= (rutaSegura y requerirSesion) bloquea //, \, esquemas y control; CSV con prefijo anti formula; ningun componente 'use client' importa serverEnv/lib/server (grep).
- Cookie local: HttpOnly, SameSite=Lax, Secure en production. SSRF: redirecciones desactivadas, IP literal unica desde Node, sin credenciales en URL.
