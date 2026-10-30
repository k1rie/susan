# Notas de citas (uso interno de los redactores; no entra al reporte)

Formato de cita en el texto: APA 7 en español, autor y año entre paréntesis, con «y» entre autores (igual que el primer avance). Cuando hay dos obras del mismo autor sin fecha se distinguen con letras (`s. f.-a`, `s. f.-b`). Solo se cita lo que está en `13-referencias.md`; si una sección necesita otra fuente, avisar para agregarla ahí.

| Referencia | Cita en el texto | Dónde citarla |
|---|---|---|
| Arduino (s. f.-a), Arduino Uno Rev3 | (Arduino, s. f.-a) | Diseño del circuito: descripción de la placa, pines, 5 V y salida de 3.3 V. Ya citada en 12-viabilidad (nota de la tabla 1) |
| Arduino (s. f.-b), Serial | (Arduino, s. f.-b) | Protocolo serie y firmware: comunicación UART, 115200 baudios 8N1, lectura de bytes de entrada |
| Arduino (s. f.-c), SPI | (Arduino, s. f.-c) | Conexión del MFRC522 por SPI (SCK, MOSI, MISO, SS). Ya citada en 12-viabilidad |
| Arduino (s. f.-d), Wire | (Arduino, s. f.-d) | Conexión de la pantalla LCD por I2C. Ya citada en 12-viabilidad |
| Deng et al. (2019), ArcFace | (Deng et al., 2019) | Planteamiento o arquitectura: modelo de vectorización facial de 512 dimensiones (InsightFace). No citada en 12-viabilidad |
| INAI (2018), datos biométricos | (Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales [INAI], 2018); luego (INAI, 2018) | Justificación y alcance: rostro como dato personal sensible. Ya citada en 12-viabilidad (riesgo de privacidad) |
| Johnson et al. (2021), FAISS | (Johnson et al., 2021) | Arquitectura y base de datos: índice de similitud, búsqueda exhaustiva sobre hasta 20 000 vectores. No citada en 12-viabilidad |
| LPDPPSOCH (2025), ley estatal | (Ley de Protección de Datos Personales en Posesión de Sujetos Obligados del Estado de Chiapas [LPDPPSOCH], 2025); luego (LPDPPSOCH, 2025) | Consentimiento y revisión jurídica. Ya citada en 12-viabilidad |
| LGPDPPSO (2025), ley general | (Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados [LGPDPPSO], 2025); luego (LGPDPPSO, 2025) | Consentimiento y revisión jurídica. Ya citada en 12-viabilidad |
| NXP Semiconductors (2016), MFRC522 | (NXP Semiconductors, 2016) | Diseño del circuito: lógica de 3.3 V del lector, interfaz SPI, lectura del UID. Ya citada en 12-viabilidad (nota y riesgo de 3.3 V) |
| PostgreSQL Global Development Group (s. f.), PostgreSQL 16 | (PostgreSQL Global Development Group, s. f.) | Estructura de la base de datos: triggers, restricciones, funciones. No citada en 12-viabilidad |
| Supabase (s. f.-a), Row Level Security | (Supabase, s. f.-a) | Estructura de la base de datos y arquitectura: RLS por rol (docente solo ve sus grupos). No citada en 12-viabilidad |
| Supabase (s. f.-b), Serving assets from Storage | (Supabase, s. f.-b) | URL firmadas de vigencia limitada (RNF-04). Ya citada en 12-viabilidad (riesgo de privacidad) |
| Vercel (s. f.), Next.js | (Vercel, s. f.) | Arquitectura y software: aplicación web con App Router y Route Handlers. No citada en 12-viabilidad |

Referencias que quedan sin cita hasta que alguna sección las use: Deng et al. (2019), Johnson et al. (2021), PostgreSQL (s. f.), Supabase (s. f.-a) y Vercel (s. f.). Una referencia que ninguna sección cite debe quitarse de `13-referencias.md`.

## Puntos que el integrador debe decidir o verificar

1. **Versión de PostgreSQL.** El código del proyecto (CLAUDE.md, README, scripts de pruebas) usa PostgreSQL 16, y `supabase/config.toml` declara `major_version = 17`. El primer avance cita «PostgreSQL 17 documentation» (PostgreSQL Global Development Group, 2024, https://www.postgresql.org/docs/17/). Se dejó la documentación de PostgreSQL 16 porque es la versión con la que se prueban las 20 tablas. Si el reporte afirma PostgreSQL 17, cambiar la referencia por la del primer avance.
2. **ArcFace, páginas.** Se copió la entrada del primer avance (pp. 4685–4694, la paginación de IEEE Xplore). Otras fuentes citan pp. 4690–4699 (versión de la CVF); si se prefiere esa, cambiar en la referencia, pero mantener el mismo criterio que el primer avance.
3. **Letras `-a`/`-b` de Supabase.** En el primer avance Supabase aparece sin letra porque era una sola obra; ahora hay dos y se distinguen. La fecha de recuperación del 14 de septiembre de 2026 es la del primer avance.
4. **Fechas de recuperación.** Las páginas web sin fecha (Arduino, PostgreSQL, Supabase RLS, Next.js) van sin «Recuperado el»; APA lo pide para contenido que cambia. Agregar la fecha en que el equipo revise cada enlace.
5. **URLs.** Ninguna URL pudo abrirse desde el entorno de redacción (sin acceso a Internet); se escribieron las direcciones canónicas conocidas de cada fuente. Abrirlas antes de entregar.
6. **Títulos de páginas.** Los títulos «Arduino Uno Rev3» y «Next.js documentation» siguen el nombre común de la fuente; el sitio puede rotularlos distinto («UNO R3», «Next.js Docs»).
