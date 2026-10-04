# recognition-service

Servicio de reconocimiento facial de SUSAN: Python 3.12, FastAPI y `faiss-cpu`. Embeddings de 512 dimensiones,
indice persistido como JSON en el bucket (Supabase Storage), autenticacion por API key y sin secretos en el codigo.
Continua el microservicio previo (128-d + Backblaze). Contrato: `docs/ARCHITECTURE.md` secciones 5, 6 y 11.

## Correr en local

```bash
cd recognition-service
./run-local.sh            # embedder fake (sin modelos), API_KEY de desarrollo, almacenamiento en disco
./run-local.sh insightface  # modelo real; descarga buffalo_s (~120 MB) a .models/ la primera vez
```

En el modo local de SUSAN el servicio no se arranca a mano sino con `scripts/dev-all.sh`, y el embedder se conmuta con
`scripts/dev-modo.sh insightface|fake|estado` (reinicia solo este servicio, persiste el modo en `$SUSAN_LOCAL_DIR/run/embedder` y
`dev-all.sh` lo respeta; `RECOGNITION_EMBEDDER` tiene prioridad). Guía de punta a punta: `docs/DEMO.md` §9.

`run-local.sh` crea `.venv`, instala dependencias y arranca uvicorn en `127.0.0.1:8000`. El almacenamiento local usa
`STORAGE_DIR/<BUCKET>/<objeto>` (por defecto `web/.local/storage/susan-private/...`), el mismo arbol que el modo local de Next.
Tests: `.venv/bin/pytest` (embedder fake y FAISS real). Humo real con InsightFace: `MODEL_DIR=$PWD/.models .venv/bin/pytest -m ml` (usa los
modelos ya descargados; sin `MODEL_DIR` toma `.models/`).

## Variables de entorno

| Variable | Defecto | Descripcion |
|---|---|---|
| `APP_ENV` | `development` | `production` exige `API_KEY`; sin ella el servicio NO arranca |
| `API_KEY` | vacia | Se compara con `X-API-Key` en tiempo constante. Vacia en desarrollo: toda ruta salvo `/health` da 401 |
| `EMBEDDER` | `insightface` | `insightface` o `fake` |
| `MODEL_DIR` / `INSIGHTFACE_MODEL` | `.models` / `buffalo_s` | Directorio de modelos y paquete |
| `DIMENSION` | `512` | Debe coincidir con `dimension_vector` de la BD |
| `STORAGE_BACKEND` | `local` | `local` o `supabase` |
| `STORAGE_DIR` | `web/.local/storage` (ruta absoluta del repo) | Raiz del modo local |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BUCKET` | `-`, `-`, `susan-private` | Storage REST con service_role (solo servidor) |
| `INDEX_ACCEPT_MODELS` | vacia (estricto) | Lista separada por comas de modelos de indice AJENOS que se aceptan al **leer** (activar, manifiesto, base de un `build`). Solo para pruebas locales: `scripts/dev-modo.sh` la fija a `fake-hash` en modo insightface y a `buffalo_s` en modo fake. Un `build` siempre escribe el indice nuevo con el modelo propio. Cargar un indice ajeno deja un `WARNING` en el log |
| `INDEX_BOOTSTRAP_VERSION` | vacia | Version a cargar al iniciar. Vacia: con `STORAGE_BACKEND=supabase` se carga la que la base marca en uso (`svc_indice_en_uso`), asi un reinicio o despertar no deja el servicio sin indice; en local o sin indice en uso, 409 `INDEX_NOT_LOADED` hasta `/v1/index/activate` |
| `ALLOW_PRIVATE_CAMERAS` | `0` | `1` permite camaras en IP privadas/loopback (LAN). Link-local/metadatos siempre bloqueados |
| `EMBEDDER_CONCURRENCY` | `2` | Inferencias simultaneas maximas |
| `MIN_FACE_PX`, `MIN_BRIGHTNESS`, `MAX_BRIGHTNESS`, `MIN_SHARPNESS` | 80, 50, 215, 40 | Umbrales de `/v1/photo/check` (y de la calidad por foto de `/v1/photo/check-set`) |
| `TEMPLATE_MIN_PHOTOS`, `TEMPLATE_MAX_PHOTOS` | `3`, `8` | Fotos aceptadas necesarias para una plantilla y maximo por conjunto. Se exige `3 <= min <= max <= 8`: el 8 es un techo duro compartido con SQL y con el proxy de Next |
| `TEMPLATE_OUTLIER_COSINE` | `0.35` | Coseno **medio** minimo de una foto contra las demas (registro, estricto). `0` apaga el descarte (modo calibracion: se siguen informando los cosenos). Es una hipotesis calibrable, ver «Plantilla de varias fotos» |
| `TEMPLATE_LINK_COSINE` | `0.30` | Segundo criterio de consistencia: las fotos que se conservan deben formar UN solo grupo (dos fotos se enlazan si su coseno es >= este valor). Detecta las mezclas balanceadas de dos personas que la media de pares no ve. `0` lo apaga. El constructor del indice usa `min(0.20, este valor)` |
| `TEMPLATE_BUILD_OUTLIER_COSINE` | vacia = `min(0.25, TEMPLATE_OUTLIER_COSINE)` | Umbral del constructor del indice, mas permisivo a proposito. Debe cumplir `0 <= build <= TEMPLATE_OUTLIER_COSINE` |
| `TEMPLATE_MAX_YAW_RATIO` | `0.40` | Razon de giro maxima (compensada por inclinacion) del modo conjunto; 0.15 ~ 15 grados, 0.40 ~ 36. Rango `[0.1, 1]` |
| `TEMPLATE_DUP_COSINE` | `0.97` | Coseno desde el que dos fotos son «casi identicas» (rafaga de fotogramas). Rango `[0.8, 1]` |
| `TEMPLATE_MAX_TOTAL_BYTES` | `31457280` (30 MiB) | Tope de bytes de toda la peticion `/v1/photo/check-set`; no puede ser menor que el tope de una imagen |

Ver `.env.example`. Ningun secreto se versiona.

## Endpoints

Todas las rutas salvo `/health` exigen `X-API-Key`. Errores: `{code, message}` con 401, 409 `INDEX_NOT_LOADED`, 422
(`INVALID_IMAGE`, `VALIDATION_ERROR`, `CAMERA_URL_BLOCKED`, `INDEX_INVALID`), 404 `INDEX_NOT_FOUND`, 504 `CAMERA_UNREACHABLE`.

```bash
H='X-API-Key: dev-local-key'; U=http://127.0.0.1:8000
curl $U/health
curl -H "$H" $U/v1/index
curl -H "$H" -F image=@foto.jpg $U/v1/photo/check
curl -H "$H" -F images=@f1.jpg -F images=@f2.jpg -F images=@f3.jpg $U/v1/photo/check-set
curl -H "$H" -X POST $U/v1/index/build -H 'content-type: application/json' -d '{
  "version":"v001","base_version":null,
  "entries":[{"id_plantilla":1,"faiss_id":1001,"objeto_foto":"registro/3/foto.jpg"},
             {"id_plantilla":2,"faiss_id":1002,"objetos_foto":["registro/4/a.jpg","registro/4/b.jpg","registro/4/c.jpg"]}]}'
curl -H "$H" -X POST $U/v1/index/activate -H 'content-type: application/json' -d '{"version":"v001","preload_only":true}'
curl -H "$H" -X POST $U/v1/index/activate -H 'content-type: application/json' -d '{"version":"v001"}'
curl -H "$H" $U/v1/index/v001/manifest
curl -H "$H" -F image=@aula.jpg -F 'allowed_faiss_ids=[1001,1002]' -F crop_prefix=recortes/ses42/cap1/ $U/v1/recognize
curl -H "$H" -F camera_url=http://192.168.1.50/snapshot.jpg -F 'allowed_faiss_ids=[1001]' $U/v1/recognize
```

Notas de contrato:
- `build` responde 200 siempre que la peticion sea valida; si alguna foto falla (0 o mas de 1 rostro, foto ausente o
  corrupta, `keep` sin vector en la base) devuelve `errores` por `id_plantilla`, `objeto_indice: null` y NO escribe nada.
  No activa. Una version en uso es inmutable (409 `VERSION_IN_USE`).
- `build` acepta por entrada EXACTAMENTE una forma: `{keep:true}`, `{objeto_foto}` (una foto, como siempre) u
  `{objetos_foto:[2 a 8 rutas]}` (plantilla de varias fotos, ver abajo; mezclar formas, 1 o mas de 8 rutas es 422 antes de tomar el lock).
  La respuesta gana `muestras` (solo entradas `objetos_foto`; `[]` si no hay) y cada error puede traer `codigo`.
- `activate` carga y valida, y recien entonces cambia el puntero en memoria (asignacion atomica). Cada peticion de
  `recognize` toma una instantanea del indice al empezar, asi que las busquedas en curso terminan sobre la version anterior.
  `preload_only` deja la version lista sin activarla (la siguiente activacion no vuelve a leer el bucket).
- `recognize`: `candidate` es el mejor vecino SOLO entre `allowed_faiss_ids` (selector `IDSelectorBatch`); un id fuera de la lista
  nunca aparece. `score = clip((coseno+1)/2, 0, 1)` a 3 decimales. Nunca se devuelve el vector. Los recortes se suben como
  `<crop_prefix><n>.jpg` con n desde 1 en orden de `det_score`; si la subida de uno falla, ese rostro devuelve `objeto_recorte: null`
  (se registra el error, sin PII) en vez de tumbar la captura. Sin `crop_prefix` no se suben recortes.
- `camera_url`: solo http/https, sin credenciales incrustadas, sin redirecciones, timeout 3 s, maximo 5 MB, y bloqueo de loopback,
  IPs privadas, link-local (169.254.169.254 y similares) y hosts de metadatos salvo `ALLOW_PRIVATE_CAMERAS=1`.
  Link-local y metadatos se bloquean aun con el flag. Limitacion conocida: hay una ventana minima de DNS-rebinding entre validar y conectar.

## Plantilla de varias fotos

Una plantilla (RN-12: una sola activa por alumno) puede tener de 3 a 8 fotos cuyos embeddings se **promedian en UN vector** (centroide,
re-normalizado) con UN `faiss_id`. El promedio y el descarte de fotos ajenas ocurren aqui (los vectores nunca salen del servicio, RNF-03); la
base de datos solo guarda rutas, medidas de calidad y un coseno escalar por foto. Una plantilla de una foto sigue funcionando igual.

### `POST /v1/photo/check-set` (multipart, campo `images` repetido, 1 a `TEMPLATE_MAX_PHOTOS` archivos)

Verifica un conjunto antes de registrar: calidad por foto + consistencia de identidad. No guarda nada y nunca devuelve vectores.
0 o demasiados archivos, o mas de `TEMPLATE_MAX_TOTAL_BYTES` en total: 422 `VALIDATION_ERROR`; sin clave: 401. Un archivo que supere
`max_image_bytes` o los pixeles permitidos, o que no decodifique, NO tumba la peticion: esa foto sale `ilegible` y las demas se evaluan.

```json
{"total":5,"aceptadas":4,"minimo":3,"maximo":8,"suficiente":true,"consistente":false,"ambiguo":false,
 "umbral_coseno":0.35,"coseno_min":0.512,"coseno_medio":0.744,"coseno_max_par":0.931,"advertencias":[],
 "fotos":[{"indice":0,"estado":"aceptada","rostros":1,"un_solo_rostro":true,
           "calidad":{"brillo":120.5,"nitidez":88.2,"tamano_rostro_px":210,"frontal":true},
           "motivo_rechazo":null,"motivo_codigo":null,"coseno_resto":0.812}]}
```

- `estado` por foto: `aceptada` | `calidad` (no paso brillo/nitidez/tamano/giro/un solo rostro) | `inconsistente` | `ilegible`
  (`calidad: null`, `motivo_codigo: IMAGEN_INVALIDA`). `indice` es la posicion en el envio (desde 0).
- `motivo_codigo` (estable; el texto de `motivo_rechazo` es una frase del servicio y puede cambiar): `SIN_ROSTRO`, `MULTIPLES_ROSTROS`,
  `ROSTRO_PEQUENO`, `NO_FRONTAL`, `POCA_LUZ`, `EXCESO_LUZ`, `BORROSA`, `IMAGEN_INVALIDA`, `NO_COINCIDE`, `CONJUNTO_AMBIGUO`. Tambien es clave
  aditiva de `/v1/photo/check` (que no cambia de contrato).
- `coseno_resto`: coseno medio de la foto contra las demas fotos aceptadas (de las descartadas, contra las aceptadas), truncado a 3
  decimales (nunca se muestra un coseno bajo el umbral como si lo alcanzara). `null` con menos de 2 candidatas.
- `suficiente = aceptadas >= minimo`. `consistente`: `null` con menos de 2 candidatas (pasaron calidad), `false` si alguna salio
  `inconsistente` o el conjunto es ambiguo, `true` en otro caso. `coseno_min`, `coseno_medio` y `coseno_max_par` solo cuentan las aceptadas.
- `advertencias`: `DIVERSIDAD_BAJA` cuando fotos con coseno >= `TEMPLATE_DUP_COSINE` colapsan en menos grupos que el minimo (una rafaga de
  fotogramas casi iguales: el promedio no aporta variedad). No bloquea.
- Giro: en este modo `calidad.frontal` es `razon_de_giro < TEMPLATE_MAX_YAW_RATIO`. El booleano heredado de `/v1/photo/check` no cambia.

### Criterio de consistencia (`app/samples.py`)

Una foto debe parecerse, en **promedio**, al menos `TEMPLATE_OUTLIER_COSINE` a las demas fotos que se conservan. Mientras queden mas de 2 se
calcula la media de cada foto contra las demas, se descarta la peor (empate: menor indice) si esta bajo el umbral (un coseno igual se
conserva) y se repite. El conjunto es **ambiguo** si al final quedan 2 y su coseno mutuo esta bajo el umbral, si se descartaron tantas como
quedan (sin mayoria) o si no hay centroide (suma casi nula): entonces TODAS las candidatas salen `inconsistente` con `CONJUNTO_AMBIGUO`, porque sin
una persona mayoritaria no se sabe cual es la correcta. Aritmetica en float64 y centroide en float32. Es idempotente e independiente del
orden de las fotos. Se usa la media de pares y no el coseno contra el centroide de las demas porque este ultimo se infla cuando las demas
son una mezcla de dos personas: una mezcla balanceada 3+3 pasaba el 17 % de las veces y 4+4 el 25 % (umbral 0.45, nivel medio) frente al 4.7 % y 5.9 %
con la media de pares a 0.35 (0.4 % y 0.5 % a 0.40).

**Segundo criterio: enlace de grupo (`TEMPLATE_LINK_COSINE`, 0.30).** La media de pares tampoco basta cuando las fotos de cada persona se
parecen mucho entre si: con rostros reales (coseno medio intra-persona 0.80, cruzado 0.07) una mezcla 3+3, 4+4 o 5+5 de dos personas daba una
media por foto de 0.35-0.36, justo en el umbral, y se aceptaba como un conjunto valido (el centroide reconocia a AMBAS personas por encima de
0.700). Tras el descarte por media se exige que las fotos conservadas formen UN solo grupo: dos fotos se enlazan si su coseno es >= 0.30 y el
conjunto es ambiguo si queda mas de un grupo (`motivos['desconexo']`). Basta que cada foto tenga un solo companero parecido, asi que una foto
genuina dificil no rompe el conjunto: medido con las 3 simulaciones de calibracion, el enlace 0.30 no agrega ningun rechazo genuino
(0 puntos porcentuales en suave, medio y duro) y deja pasar 0 % de mezclas 2+2 a 5+5 en suave/medio/duro salvo 0.2 % (5+5 medio), frente a
54 % (3+3 suave) y 10 % (3+3 medio) sin el enlace. El cruce entre personas distintas tiene p99.9 = 0.264. El constructor aplica el mismo criterio con
`min(0.20, TEMPLATE_LINK_COSINE)`: un conjunto mezclado que llegue por API directa indexa solo la primera foto utilizable.

### `build` con `objetos_foto` (constructor defensivo)

El registro es el filtro estricto; el constructor solo se defiende de fotos corruptas o ajenas de verdad, para que una plantilla ya
aceptada nunca bloquee el indice ni una revocacion. Por eso usa `TEMPLATE_BUILD_OUTLIER_COSINE` (defecto `min(0.25, TEMPLATE_OUTLIER_COSINE)`)
y **no exige minimo**: se leen y embeben todas las fotos y se **descarta** (no es error) la que no existe (`no_encontrada`), no decodifica
(`ilegible`), no tiene exactamente un rostro (`sin_rostro` | `varios_rostros`) o la elimina el consolidado (`inconsistente`). Un fallo
transitorio del almacenamiento SI tumba la entrada (`No se pudo leer la foto.`, como con una foto). Si NINGUNA foto es utilizable, la
entrada falla con `codigo: SIN_MUESTRAS_UTILIZABLES` (todo o nada: no se escribe el indice). Si el conjunto es ambiguo se indexa la primera
foto utilizable sola y las demas se informan `ambigua`. Las filas `keep` se copian SIN re-normalizar (quedan identicas a la base byte a byte;
solo las filas nuevas se normalizan).

`muestras` (solo escalares; el vector del centroide no sale): `[{"id_plantilla":41,"total":5,"usadas":4,"descartadas":[{"indice":2,"motivo":"inconsistente","coseno_resto":0.21}],"coseno_min":0.512,"coseno_medio":0.744,"degradada":true}]`
(`degradada = usadas < total`; `coseno_resto` es `null` salvo en `inconsistente`/`ambigua`; tambien se informa cuando la entrada falla).
Los logs solo llevan contadores (`plantillas multi: N, fotos descartadas: K`), sin PII ni vectores.

### Razon de giro compensada

`DetectedFace.yaw_ratio = |(nariz - punto medio de los ojos) . u| / distancia interocular`, con `u` el vector unitario del ojo izquierdo al
derecho. La heuristica heredada (solo la coordenada x de la nariz) confunde inclinar la cabeza con girarla: un rostro con yaw +7 y roll -25 grados
daba 0.282 y otro con yaw -36 daba 0.079. La compensada correlaciona 0.91 con |yaw| 3D (modelo 1k3d68) frente a 0.60 de la heredada y se ajusta a
`0.55 * tan(yaw)` (0.15 ~ 15 grados, 0.40 ~ 36; las estimaciones 3D tienen su propio error de 5-10 grados). El embedder `fake` no la mide.

### Calibracion y limitaciones (re-medicion con `buffalo_s`, 8 personas reales)

Medido con los 6 rostros de `insightface.data.get_image('t1')`, `skimage.data.astronaut()` y un rostro adicional; 40 replicas por persona,
cada una una SESION de plantilla de 8 tomas y otra de 6 sondas de aula, en 3 niveles de variacion (suave, medio, duro). Limitaciones: son
variantes de UNA foto por persona (no hay fotos independientes de la misma persona), las homografias no reproducen el relieve 3D y la
muestra efectiva son 8 identidades. Por eso `0.35` es una **hipotesis calibrable** (variable de entorno; `0` apaga el descarte; cada respuesta expone `coseno_resto`).

- Coseno entre personas distintas: media 0.02-0.04, p99 ~0.20, p99.9 0.24-0.26, maximo de un par 0.27-0.35 (**corrige la nota anterior de 0.195**, que
  era plantilla contra plantilla). Misma persona (entre sesiones): 0.85 suave, 0.70 medio, 0.54 duro.
- Rechazo de un conjunto genuino al umbral 0.35 (nivel medio): 0 % con N=3 y 5, 0.3 % con N=8; con 0.40: 0.3 / 0.6 / 1.3 %. En el nivel duro (estres) sube a 5 / 15 / 24 % y
  hay personas dificiles (coseno foto-foto medio 0.50: 40 % de rechazo con N=5): para ellas bajar a 0.30 o registrar con una sola foto.
- Contaminacion con 0.35 (solo media de pares): 1 ajena entre 2-4 propias se detecta el 100 %; 3 propias + 2 ajenas pasa el 0.2 %; 2+2 el 1.8 %, 3+3 el 4.7 %, 4+4 el 5.9 % (medio).
  Con fotos casi identicas la media sola deja pasar mezclas balanceadas (3+3: 53 % en suave, y con rostros reales muy coherentes, 100 %): por eso el segundo
  criterio, el enlace de grupo `TEMPLATE_LINK_COSINE` (0.30), que las reduce a 0-0.5 % en los tres niveles sin agregar rechazos genuinos.
- Ganancia (sondas de aula contra la plantilla, nivel medio): una foto de frente 0.762 de coseno medio y 0.26 % de lecturas bajo 0.40; centroide de
  5 fotos 0.788 y 0.10 %; una foto cualquiera 0.693 y 1.76 %. Con 3 fotos se logra aproximadamente la mitad de la ganancia de 8 y con 5 el 80 %.
  Honestamente: +0.026 de coseno medio frente a una buena foto frontal y +0.095 frente a una foto cualquiera; la mejora se concentra en la cola
  inferior (la mitad de lecturas bajo 0.40) y en la robustez ante una mala foto de registro.
- Rendimiento (CPU, arm64): detectar + embeber 17 ms por foto a 1280x960 (8 fotos ~126 ms). **Una reconstruccion COMPLETA cuesta N veces mas**
  (20 000 plantillas x 5 fotos x 17 ms ~ 28 min, por encima del objetivo de 10 min de RNF-09); la incremental con `keep` no se afecta.
- La plantilla multifoto exige `EMBEDDER=insightface`: con `fake` una foto real de webcam no tiene marco magenta (`SIN_ROSTRO`) y una
  reconstruccion completa con fotos reales falla (misma advertencia que una foto).

## Formato del indice (`indice/<version>.json`)

`susan-faiss-json/1`: `{format, version, dimension, model, metric:"ip", created_at, ntotal, ids:[int], vectors_b64}` con
`vectors_b64` = float32 little-endian N x D en base64, vectores L2-normalizados. Al cargar se valida formato, metrica, dimension
igual a `DIMENSION`, ids enteros >= 0 y unicos, longitud exacta `N*D*4`, vectores finitos y normalizados, y que `model` y `version`
coincidan con el embedder y el nombre del objeto. Extension opcional: `refs: [{id_plantilla, faiss_id}]` (la escribe `build`) para
servir el manifiesto de reversion; el resto del sistema puede ignorarla.

Tamano estimado (D = 512): vectores crudos N x 2048 bytes, JSON ~ x1.34 (base64) + ids.

| Plantillas | Crudo | JSON en el bucket | RAM FAISS |
|---|---|---|---|
| 500 | 1.0 MB | ~1.4 MB | ~1 MB |
| 20 000 | 41 MB | ~55 MB | ~41 MB (pico de carga ~3x) |

Atencion: el limite de objeto por defecto de Supabase Storage es 50 MB; con ~20 000 plantillas hay que subirlo en el panel
(Storage > Settings > Global file size limit) o el bucket rechazara el indice. Una busqueda sobre 20 000 vectores toma ~1 ms (prueba < 50 ms).

## Embedders

- `fake`: determinista y sin modelos. Una "cara" es un cuadrado de marco magenta (255,0,255) de 4 px cuyo interior es un color plano que
  codifica una semilla de 12 bits; el embedding sale de un hash de la semilla (misma semilla = mismo vector; semillas distintas = coseno ~ 0,
  score ~ 0.5). Sobrevive a JPEG. `app.embedders.fake.render_fake_image` fabrica imagenes de prueba.
- `insightface`: `FaceAnalysis` buffalo_s (SCRFD + w600k_mbf, ArcFace 512-d), CPU. Los modelos se descargan al primer uso a `MODEL_DIR`.
  **Licencia:** el codigo de InsightFace es MIT, pero los modelos preentrenados (buffalo_*) son solo para investigacion y uso NO comercial.
  Un uso comercial requiere licencia aparte o modelos propios.
- **Modo local de SUSAN con rostros reales** (`scripts/dev-modo.sh insightface`): modelo `buffalo_s` (detector SCRFD `det_500m.onnx` + reconocedor
  `w600k_mbf.onnx`, 512-d, CPU), 287 MB en `recognition-service/.models/` (la zip de 128 MB queda ahi; el resto son los 5 `.onnx`, de los que solo se cargan 2).
  El indice de la demostracion (`v003`, 75 vectores `fake-hash`) se **acepta bajo insightface** con `INDEX_ACCEPT_MODELS=fake-hash` y la
  reconstruccion incremental (`keep`) lo conserva byte a byte y agrega los vectores reales (el indice nuevo queda etiquetado `buffalo_s`).
  Una reconstruccion COMPLETA con las fotos sinteticas falla (sin rostro real), por diseno todo o nada.
- **Mediciones** (2026-10-03, macOS arm64, CPU, `buffalo_s`, 7 rostros reales de las imagenes de ejemplo de la propia libreria; todas las
  variantes salen de UNA foto por persona, asi que la cifra de «misma persona» es optimista frente a fotos distintas, que en la practica dan 0.4-0.7):
  coseno misma persona (recortes, escala 0.35-0.5, brillo 0.6-1.4, ruido, JPEG 30, rotacion +-10, giro leve/medio, desenfoque, espejo): min 0.80, p5 0.86, mediana 0.96;
  personas distintas: plantilla vs plantilla max 0.195 (solo 7 pares; la re-medicion de «Plantilla de varias fotos» con 8 personas da un maximo de par de 0.27-0.35 y p99.9 de 0.24-0.26), plantilla vs variantes ajenas p99 0.21 y max 0.22; un rostro real contra los 75 vectores falsos: max 0.15
  (score ~0.55). Umbral `umbral_similitud = 0.700` (coseno 0.40): deja ~0.18 de margen sobre el maximo de personas distintas y la demo `fake` (1.000 / ~0.54) intacta.
  Latencia por fotograma (CPU, incluye HTTP): 1 rostro 29-31 ms; 6 rostros 48 ms (1280x886) y ~52 ms (1920x1080); un fotograma cada ~15 s es holgado.
- Humo real (`pytest -m ml`, ~70 s con descarga): verificado el 2026-10-02 en macOS arm64 con `skimage.data.astronaut()`: dos recortes de la misma
  cara dan mayor similitud que contra otra imagen. Si no hay red o la descarga falla, la prueba falla y es opcional (no corre por defecto).

## Despliegue

`Procfile` y `Dockerfile` (`docker build -t susan-recognition .`; `--build-arg ML=0` omite insightface). En produccion defina
`APP_ENV=production`, `API_KEY`, `STORAGE_BACKEND=supabase`, `SUPABASE_*`. Un solo proceso/worker por instancia: el indice vive en memoria
y `build`/`activate` se serializan con un lock de proceso; con varias instancias hay que activar la version en cada una.
