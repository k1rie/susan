#!/usr/bin/env bash
# Pruebas SQL de SUSAN contra PostgreSQL 16 local.
#   1. crea una BD TEMPORAL unica (susan_test_<pid>_<n>): puede correr en paralelo con otras ejecuciones;
#   2. aplica stubs de Supabase + migraciones + supabase/tests/_harness.sql y _fixtures.sql;
#   3. ejecuta supabase/tests/*.sql en orden lexicografico (los que empiezan con _ son de soporte);
#   4. imprime un resumen corto y sale distinto de 0 si algo falla; al final elimina la BD.
#
# Uso:  scripts/test-sql.sh [filtro ...]     filtro = subcadena del nombre (p. ej. schema_, api_a)
#       KEEP_DB=1 scripts/test-sql.sh        conserva la BD temporal para inspeccionarla
#       VERBOSE=1 scripts/test-sql.sh        muestra tambien las salidas de los archivos que pasan
set -uo pipefail
# shellcheck source=db-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/db-common.sh"

TESTS_DIR="$SUSAN_ROOT/supabase/tests"
TEST_DB="susan_test_$$_${RANDOM}"
SALIDA="$(mktemp -d "${TMPDIR:-/tmp}/susan-test-sql.XXXXXX")"

limpiar() {
    if [ "${KEEP_DB:-0}" = "1" ]; then
        db_log "BD conservada: $TEST_DB"
    else
        db_drop "$TEST_DB"
    fi
    rm -rf "$SALIDA"
}
trap limpiar EXIT

db_ensure_cluster
db_create "$TEST_DB" || db_die "No se pudo crear la BD temporal $TEST_DB."
db_apply_migrations "$TEST_DB" >/dev/null
db_psql -d "$TEST_DB" -f "$TESTS_DIR/_harness.sql" || db_die "Fallo _harness.sql."
db_psql -d "$TEST_DB" -f "$TESTS_DIR/_fixtures.sql" || db_die "Fallo _fixtures.sql."

total_pos=0; total_neg=0; total_fail=0; archivos=0; archivos_mal=0

for f in "$TESTS_DIR"/*.sql; do
    nombre="$(basename "$f")"
    case "$nombre" in _*) continue ;; esac
    if [ "$#" -gt 0 ]; then
        coincide=0
        for filtro in "$@"; do
            case "$nombre" in *"$filtro"*) coincide=1 ;; esac
        done
        [ "$coincide" = "1" ] || continue
    fi
    archivos=$((archivos + 1))
    out="$SALIDA/$nombre.out"
    PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 -d "$TEST_DB" -f "$f" >"$out" 2>&1
    rc=$?
    resumen="$(grep -o 'SUMMARY file=[^ ]* pos=[0-9]* neg=[0-9]* fail=[0-9]*' "$out" | tail -n 1)"
    if [ -n "$resumen" ]; then
        pos="$(sed -E 's/.* pos=([0-9]+) .*/\1/' <<<"$resumen")"
        neg="$(sed -E 's/.* neg=([0-9]+) .*/\1/' <<<"$resumen")"
        fail="$(sed -E 's/.* fail=([0-9]+)$/\1/' <<<"$resumen")"
    else
        pos=0; neg=0; fail=0
    fi
    if [ "$rc" -ne 0 ] || [ -z "$resumen" ] || [ "$fail" -ne 0 ]; then
        archivos_mal=$((archivos_mal + 1))
        [ "$rc" -ne 0 ] && fail=$((fail + 1))
        [ -z "$resumen" ] && fail=$((fail + 1))
        printf 'FALLA %-40s pos=%s neg=%s fallos=%s\n' "$nombre" "$pos" "$neg" "$fail"
        grep -E 'not ok|ERROR|FATAL|DETAIL|LINE|CONTEXT' "$out" | sed 's/^psql:[^ ]* //' | head -n 25 | sed 's/^/    /'
        [ -z "$resumen" ] && [ "$rc" -eq 0 ] && echo "    (el archivo no llamo a t.summary())"
    else
        printf 'ok    %-40s pos=%s neg=%s\n' "$nombre" "$pos" "$neg"
        [ "${VERBOSE:-0}" = "1" ] && sed 's/^/    /' "$out"
    fi
    total_pos=$((total_pos + pos)); total_neg=$((total_neg + neg)); total_fail=$((total_fail + fail))
done

echo "----"
echo "archivos=$archivos con_fallas=$archivos_mal | pruebas positivas=$total_pos negativas=$total_neg fallos=$total_fail"
[ "$archivos" -gt 0 ] || { echo "No se encontro ningun archivo de prueba."; exit 1; }
[ "$total_fail" -eq 0 ] && [ "$archivos_mal" -eq 0 ]
