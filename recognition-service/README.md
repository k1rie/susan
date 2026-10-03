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

`run-local.sh` crea `.venv`, instala dependencias y arranca uvicorn en `127.0.0.1:8000`. El almacenamiento local usa
`STORAGE_DIR/<BUCKET>/<objeto>` (por defecto `web/.local/storage/susan-private/...`), el mismo arbol que el modo local de Next.
Tests: `.venv/bin/pytest` (embedder fake y FAISS real). Humo real con InsightFace: `.venv/bin/pytest -m ml`.

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
| `INDEX_BOOTSTRAP_VERSION` | vacia | Version a cargar al iniciar; sin ella, 409 `INDEX_NOT_LOADED` hasta `/v1/index/activate` |
| `ALLOW_PRIVATE_CAMERAS` | `0` | `1` permite camaras en IP privadas/loopback (LAN). Link-local/metadatos siempre bloqueados |
| `EMBEDDER_CONCURRENCY` | `2` | Inferencias simultaneas maximas |
| `MIN_FACE_PX`, `MIN_BRIGHTNESS`, `MAX_BRIGHTNESS`, `MIN_SHARPNESS` | 80, 50, 215, 40 | Umbrales de `/v1/photo/check` |

Ver `.env.example`. Ningun secreto se versiona.

## Endpoints

Todas las rutas salvo `/health` exigen `X-API-Key`. Errores: `{code, message}` con 401, 409 `INDEX_NOT_LOADED`, 422
(`INVALID_IMAGE`, `VALIDATION_ERROR`, `CAMERA_URL_BLOCKED`, `INDEX_INVALID`), 404 `INDEX_NOT_FOUND`, 504 `CAMERA_UNREACHABLE`.

```bash
H='X-API-Key: dev-local-key'; U=http://127.0.0.1:8000
curl $U/health
curl -H "$H" $U/v1/index
curl -H "$H" -F image=@foto.jpg $U/v1/photo/check
curl -H "$H" -X POST $U/v1/index/build -H 'content-type: application/json' -d '{
  "version":"v001","base_version":null,
  "entries":[{"id_plantilla":1,"faiss_id":1001,"objeto_foto":"registro/3/foto.jpg"}]}'
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
- Humo real (`pytest -m ml`, ~70 s con descarga): verificado el 2026-10-02 en macOS arm64 con `skimage.data.astronaut()`: dos recortes de la misma
  cara dan mayor similitud que contra otra imagen. Si no hay red o la descarga falla, la prueba falla y es opcional (no corre por defecto).

## Despliegue

`Procfile` y `Dockerfile` (`docker build -t susan-recognition .`; `--build-arg ML=0` omite insightface). En produccion defina
`APP_ENV=production`, `API_KEY`, `STORAGE_BACKEND=supabase`, `SUPABASE_*`. Un solo proceso/worker por instancia: el indice vive en memoria
y `build`/`activate` se serializan con un lock de proceso; con varias instancias hay que activar la version en cada una.
