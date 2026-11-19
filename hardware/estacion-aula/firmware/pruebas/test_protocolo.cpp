// test_protocolo.cpp - Pruebas en el PC de la lógica pura (protocolo.h).
// Cubre cada comando, entrada mal formada o demasiado larga, truncado y
// transliteración, formato de UID, antirrebote, tiempos de espera, pulsador,
// secuenciador de pitidos y armado de pantallas.
#include "mini_test.h"
#include "../estacion_aula/protocolo.h"

using namespace proto;

// ------------------------------------------------------------------ utilidades
static void alimentarTexto(EnsambladorLinea& e, const std::string& s, std::vector<std::string>& lineas) {
    for (size_t i = 0; i < s.size(); i++) {
        if (e.alimentar((uint8_t)s[i])) {
            lineas.push_back(e.buffer());
        }
    }
}

static Comando cmd(const char* linea, bool& ok) {
    Comando c;
    ok = analizar(linea, c);
    return c;
}

// ---------------------------------------------------- EnsambladorLinea
PRUEBA(linea_completa_y_crlf) {
    EnsambladorLinea e;
    std::vector<std::string> l;
    alimentarTexto(e, "PING\nPING\r\nSES a|b|1/2\n", l);
    AFIRMA_INT(3, l.size());
    AFIRMA_STR("PING", l[0]);
    AFIRMA_STR("PING", l[1]);
    AFIRMA_STR("SES a|b|1/2", l[2]);
}

PRUEBA(lineas_vacias_se_ignoran) {
    EnsambladorLinea e;
    std::vector<std::string> l;
    alimentarTexto(e, "\n\n\r\n\nPING\n\n", l);
    AFIRMA_INT(1, l.size());
    AFIRMA_STR("PING", l[0]);
}

PRUEBA(linea_de_64_bytes_es_valida_y_65_se_descarta_entera) {
    EnsambladorLinea e;
    std::vector<std::string> l;
    std::string de64(64, 'A');
    std::string de65(65, 'B');
    alimentarTexto(e, de64 + "\n", l);
    AFIRMA_INT(1, l.size());
    AFIRMA_INT(64, l[0].size());
    alimentarTexto(e, de65 + "\n", l);
    AFIRMA_INT(1, l.size());          // la de 65 no produjo nada, ni un trozo
    AFIRMA_INT(1, e.desbordes());
    alimentarTexto(e, "PING\n", l);   // y el ensamblador se recupera
    AFIRMA_INT(2, l.size());
    AFIRMA_STR("PING", l[1]);
}

PRUEBA(flujo_sin_salto_de_linea_no_desborda_ni_bloquea) {
    EnsambladorLinea e;
    std::vector<std::string> l;
    std::string basura(100000, 'x');
    alimentarTexto(e, basura, l);
    AFIRMA_INT(0, l.size());
    alimentarTexto(e, "\nPING\n", l);  // el primer '\n' cierra el descarte
    AFIRMA_INT(1, l.size());
    AFIRMA_STR("PING", l[0]);
    AFIRMA_INT(1, e.desbordes());
}

PRUEBA(caracteres_de_control_descartan_la_linea) {
    EnsambladorLinea e;
    std::vector<std::string> l;
    alimentarTexto(e, std::string("PI\x01NG\nPING\n"), l);
    AFIRMA_INT(1, l.size());
    alimentarTexto(e, std::string("PING\t\nPING\n"), l);       // tabulador
    alimentarTexto(e, std::string("PING\x7F\nPING\n"), l);     // DEL
    alimentarTexto(e, std::string("PIN", 3) + std::string(1, '\0') + "G\nPING\n", l);  // NUL
    AFIRMA_INT(4, l.size());
    AFIRMA_INT(4, e.invalidas());
}

PRUEBA(bytes_altos_utf8_pasan_al_analizador) {
    EnsambladorLinea e;
    std::vector<std::string> l;
    alimentarTexto(e, "RES OK Jos\xC3\xA9\n", l);
    AFIRMA_INT(1, l.size());
}

PRUEBA(linea_valida_queda_disponible_hasta_el_siguiente_byte) {
    EnsambladorLinea e;
    AFIRMA(!e.alimentar('P'));
    AFIRMA(!e.alimentar('I'));
    AFIRMA(!e.alimentar('N'));
    AFIRMA(!e.alimentar('G'));
    AFIRMA(e.alimentar('\n'));
    AFIRMA_STR("PING", e.buffer());
    AFIRMA(!e.alimentar('X'));
    AFIRMA_STR("X", e.buffer());
}

// ---------------------------------------------------------- comandos
PRUEBA(ping) {
    bool ok;
    Comando c = cmd("PING", ok);
    AFIRMA(ok);
    AFIRMA_INT(CMD_PING, c.tipo);
    c = cmd("PING   ", ok);  // espacios finales tolerados
    AFIRMA(ok);
    AFIRMA_INT(CMD_PING, c.tipo);
}

PRUEBA(ping_mal_formado_se_ignora) {
    bool ok;
    const char* malos[] = {"PING x", "PINGX", "ping", "Ping", " PING", "PIN", "PONG", "PING|", "PINGPING"};
    for (size_t i = 0; i < sizeof(malos) / sizeof(malos[0]); i++) {
        cmd(malos[i], ok);
        AFIRMA(!ok);
    }
}

PRUEBA(ses_valido) {
    bool ok;
    Comando c = cmd("SES 3N-A|Prog. Avanzada|12/30", ok);
    AFIRMA(ok);
    AFIRMA_INT(CMD_SES, c.tipo);
    AFIRMA_STR("3N-A", c.texto1);
    AFIRMA_STR("Prog. Avanzada", c.texto2);
    AFIRMA_INT(12, c.presentes);
    AFIRMA_INT(30, c.total);
}

PRUEBA(ses_extremos_y_vacio) {
    bool ok;
    Comando c = cmd("SES ||0/0", ok);   // sin sesión abierta
    AFIRMA(ok);
    AFIRMA_STR("", c.texto1);
    AFIRMA_STR("", c.texto2);
    c = cmd("SES a|b|65535/65535", ok);
    AFIRMA(ok);
    AFIRMA_INT(65535, c.presentes);
    c = cmd("SES a|b|00012/00030", ok);  // ceros a la izquierda, 5 dígitos
    AFIRMA(ok);
    AFIRMA_INT(12, c.presentes);
}

PRUEBA(ses_mal_formado_se_ignora) {
    bool ok;
    const char* malos[] = {
        "SES", "SES ", "SES a", "SES a|b", "SES a|b|", "SES a|b|1", "SES a|b|1/", "SES a|b|/2",
        "SES a|b|x/y", "SES a|b|1/2/3", "SES a|b|c|1/2", "SES a|b|65536/1", "SES a|b|1/65536",
        "SES a|b|123456/1", "SES a|b|-1/2", "SES a|b|1 /2", "SES a|b|1/ 2", "SES a|b|1.5/2",
        "SES|a|b|1/2", "SESa|b|1/2", "ses a|b|1/2",
    };
    for (size_t i = 0; i < sizeof(malos) / sizeof(malos[0]); i++) {
        cmd(malos[i], ok);
        if (ok) printf("    (aceptó indebidamente: %s)\n", malos[i]);
        AFIRMA(!ok);
    }
}

PRUEBA(ses_textos_se_truncan_a_16_y_se_translitera) {
    bool ok;
    Comando c = cmd("SES Grupo muy largo de|Programaci\xC3\xB3n Avanzada|1/2", ok);
    AFIRMA(ok);
    AFIRMA_STR("Grupo muy largo", c.texto1);   // 16 columnas y sin el espacio final
    AFIRMA_STR("Programacion Ava", c.texto2);
}

PRUEBA(res_ok_con_y_sin_nombre) {
    bool ok;
    Comando c = cmd("RES OK Ana L.", ok);
    AFIRMA(ok);
    AFIRMA_INT(CMD_RES_OK, c.tipo);
    AFIRMA_STR("Ana L.", c.texto1);
    c = cmd("RES OK", ok);
    AFIRMA(ok);
    AFIRMA_INT(CMD_RES_OK, c.tipo);
    AFIRMA_STR("", c.texto1);
    c = cmd("RES OK    Luis", ok);  // espacios de más
    AFIRMA(ok);
    AFIRMA_STR("Luis", c.texto1);
}

PRUEBA(res_dup_noreg_err) {
    bool ok;
    Comando c = cmd("RES DUP", ok);
    AFIRMA(ok);
    AFIRMA_INT(CMD_RES_DUP, c.tipo);
    c = cmd("RES DUP Ana L.", ok);
    AFIRMA(ok);
    AFIRMA_STR("Ana L.", c.texto1);
    c = cmd("RES NOREG", ok);
    AFIRMA(ok);
    AFIRMA_INT(CMD_RES_NOREG, c.tipo);
    c = cmd("RES ERR", ok);
    AFIRMA(ok);
    AFIRMA_INT(CMD_RES_ERR, c.tipo);
    AFIRMA_STR("", c.texto1);
    c = cmd("RES ERR Sin sesion abierta", ok);
    AFIRMA(ok);
    AFIRMA_STR("Sin sesion abier", c.texto1);  // 16 columnas
}

PRUEBA(res_desconocido_o_mal_formado_se_ignora) {
    bool ok;
    const char* malos[] = {"RES", "RES ", "RES XX", "RES OKAY", "RES OKI x", "RES DUPE", "RES NOREGX",
                           "res ok", "RES ok", "RESOK", "RES  ", "RES|OK", "RES ERRX"};
    for (size_t i = 0; i < sizeof(malos) / sizeof(malos[0]); i++) {
        cmd(malos[i], ok);
        if (ok) printf("    (aceptó indebidamente: %s)\n", malos[i]);
        AFIRMA(!ok);
    }
}

PRUEBA(comandos_desconocidos_y_basura_se_ignoran) {
    bool ok;
    const char* malos[] = {"", " ", "HELLO", "HELLO estacion-aula 1.0", "UID 04A1B2C3", "BTN", "PONG", "GET /",
                           "AT+RST", "\xFF\xFE", "?????", "SES=a|b|1/2", "REBOOT", "CLOSE", "CERRAR SESION"};
    for (size_t i = 0; i < sizeof(malos) / sizeof(malos[0]); i++) {
        cmd(malos[i], ok);
        AFIRMA(!ok);
    }
    Comando c;
    AFIRMA(!analizar(0, c));
    AFIRMA_INT(CMD_NINGUNO, c.tipo);
}

PRUEBA(linea_de_mas_de_64_no_se_analiza) {
    std::string larga = "SES " + std::string(70, 'A') + "|b|1/2";
    Comando c;
    AFIRMA(!analizar(larga.c_str(), c));
}

// ------------------------------------------------------ texto y acentos
PRUEBA(ajustar_trunca_a_16_columnas) {
    char d[17];
    AFIRMA_INT(16, ajustar("0123456789ABCDEFGHIJ", d, 16));
    AFIRMA_STR("0123456789ABCDEF", d);
    AFIRMA_INT(16, ajustar("0123456789ABCDEF", d, 16));
    AFIRMA_INT(15, ajustar("0123456789ABCDE", d, 16));
    AFIRMA_INT(0, ajustar("", d, 16));
    AFIRMA_INT(3, ajustar("abcdef", d, 3));
    AFIRMA_STR("abc", d);
}

PRUEBA(ajustar_quita_espacios_de_los_extremos_tambien_tras_truncar) {
    char d[17];
    AFIRMA_INT(3, ajustar("   abc   ", d, 16));
    AFIRMA_STR("abc", d);
    AFIRMA_INT(0, ajustar("      ", d, 16));
    AFIRMA_INT(2, ajustar("ab cdef", d, 3));   // "ab " -> "ab"
    AFIRMA_STR("ab", d);
}

PRUEBA(ajustar_transliterara_todo_el_bloque_latin1) {
    // Para cada letra latina U+00C0..U+00FF se verifica la sustitución esperada.
    const char* esperado =
        "AAAAAAACEEEEIIII" "DNOOOOOxOUUUUYTs" "aaaaaaaceeeeiiii" "dnooooo/ouuuuyty";
    AFIRMA_INT(64, strlen(esperado));
    for (int i = 0; i < 64; i++) {
        char s[3] = {(char)0xC3, (char)(0x80 + i), 0};
        char d[17];
        ajustar(s, d, 16);
        if (d[0] != esperado[i] || d[1] != '\0') {
            mt::fallo(__FILE__, __LINE__, "U+00" + std::to_string(0xC0 + i) + " dio " + mt::comillas(d));
        }
    }
}

PRUEBA(ajustar_casos_del_proyecto) {
    char d[17];
    ajustar("\xC3\x81lvaro N\xC3\xBA\xC3\xB1" "ez", d, 16);
    AFIRMA_STR("Alvaro Nunez", d);
    ajustar("Educaci\xC3\xB3n F\xC3\xADsica", d, 16);
    AFIRMA_STR("Educacion Fisica", d);
    ajustar("\xC2\xBFListo? \xC2\xA1Sí!", d, 16);  // "í" sin escapar: 0xC3 0xAD en UTF-8
    AFIRMA_STR("?Listo? !Si!", d);
    ajustar("3\xC2\xB0 N", d, 16);
    AFIRMA_STR("3o N", d);
    ajustar("PE\xC3\x91" "A \xC3\x9C" "BER", d, 16);
    AFIRMA_STR("PENA UBER", d);
}

PRUEBA(ajustar_secuencias_no_representables_dan_un_solo_signo) {
    char d[17];
    ajustar("a\xE2\x82\xAC" "b", d, 16);          // euro (3 bytes)
    AFIRMA_STR("a?b", d);
    ajustar("a\xF0\x9F\x98\x80" "b", d, 16);      // emoji (4 bytes)
    AFIRMA_STR("a?b", d);
    ajustar("a\x80" "b", d, 16);                  // continuación suelta
    AFIRMA_STR("a?b", d);
    ajustar("a\xC3", d, 16);                      // secuencia cortada al final
    AFIRMA_STR("a?", d);
    ajustar("a\xC3z", d, 16);                     // guía sin continuación válida
    AFIRMA_STR("a?z", d);
    ajustar("a\xE9" "b", d, 16);                  // Latin-1 crudo (no es UTF-8)
    AFIRMA_STR("a?b", d);
    ajustar("a\xFF" "b", d, 16);
    AFIRMA_STR("a?b", d);
}

PRUEBA(ajustar_multibyte_en_el_limite_de_16) {
    char d[17];
    ajustar("123456789012345\xC3\xA9", d, 16);    // la é cae en la columna 16
    AFIRMA_STR("123456789012345e", d);
    ajustar("1234567890123456\xC3\xA9", d, 16);   // la é no cabe: se corta limpio
    AFIRMA_STR("1234567890123456", d);
}

PRUEBA(ajustar_controles_se_vuelven_espacio) {
    char d[17];
    ajustar("a\tb", d, 16);
    AFIRMA_STR("a b", d);
}

PRUEBA(ajustarN_usa_exactamente_n_bytes) {
    char d[17];
    const char texto[] = {'a', 'b', 'c', 'd'};  // sin NUL
    AFIRMA_INT(2, ajustarN(texto, 2, d, 16));
    AFIRMA_STR("ab", d);
}

// ---------------------------------------------------------------- UID
PRUEBA(uid_hex_mayusculas_sin_separadores) {
    const uint8_t u4[] = {0x04, 0xA1, 0xB2, 0xC3};
    char h[21];
    AFIRMA_INT(8, uidAHex(u4, 4, h));
    AFIRMA_STR("04A1B2C3", h);
    const uint8_t u7[] = {0x04, 0x0a, 0x0B, 0xff, 0x00, 0x1c, 0xD2};
    uidAHex(u7, 7, h);
    AFIRMA_STR("040A0BFF001CD2", h);
    const uint8_t u10[] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 0xAB};
    uidAHex(u10, 10, h);
    AFIRMA_STR("010203040506070809AB", h);
}

PRUEBA(linea_uid) {
    const uint8_t u4[] = {0x04, 0xA1, 0xB2, 0xC3};
    char l[25];
    AFIRMA(armarLineaUid(u4, 4, l, sizeof l));
    AFIRMA_STR("UID 04A1B2C3", l);
    AFIRMA(strlen(l) <= MAX_LINEA);
    const uint8_t u10[10] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
    AFIRMA(armarLineaUid(u10, 10, l, sizeof l));
    AFIRMA_INT(24, strlen(l));
}

PRUEBA(linea_uid_rechaza_tamanos_invalidos_y_buferes_chicos) {
    const uint8_t u[11] = {0};
    char l[25];
    AFIRMA(!armarLineaUid(u, 0, l, sizeof l));
    AFIRMA(!armarLineaUid(u, 11, l, sizeof l));
    AFIRMA(!armarLineaUid(u, 4, l, 12));   // necesita 13
    AFIRMA(armarLineaUid(u, 4, l, 13));
}

PRUEBA(lector_vivo_segun_version) {
    AFIRMA(lectorPareceVivo(0x91));
    AFIRMA(lectorPareceVivo(0x92));
    AFIRMA(lectorPareceVivo(0x88));   // clon
    AFIRMA(!lectorPareceVivo(0x00));
    AFIRMA(!lectorPareceVivo(0xFF));
}

PRUEBA(uint_a_texto) {
    char b[12];
    AFIRMA_INT(1, uintATexto(0, b));
    AFIRMA_STR("0", b);
    AFIRMA_INT(5, uintATexto(65535, b));
    AFIRMA_STR("65535", b);
    AFIRMA_INT(10, uintATexto(4294967295UL, b));
    AFIRMA_STR("4294967295", b);
}

// -------------------------------------------------------- antirrebote UID
PRUEBA(primer_uid_se_acepta) {
    FiltroUid f;
    AFIRMA(f.aceptar("04A1B2C3", 0));
}

PRUEBA(mismo_uid_dentro_de_2s_se_ignora_aunque_se_haya_retirado) {
    FiltroUid f;
    AFIRMA(f.aceptar("04A1B2C3", 1000));
    for (int i = 0; i < 5; i++) f.sondeo(false);        // retirada confirmada
    AFIRMA(!f.aceptar("04A1B2C3", 1000 + 1999));
    AFIRMA(f.aceptar("04A1B2C3", 1000 + 2000));          // límite inclusivo: a los 2000 ms ya cuenta
}

PRUEBA(mismo_uid_sin_retirar_la_tarjeta_nunca_cuenta) {
    FiltroUid f;
    AFIRMA(f.aceptar("04A1B2C3", 0));
    for (int i = 0; i < 100; i++) f.sondeo(true);        // la tarjeta sigue ahí
    AFIRMA(!f.aceptar("04A1B2C3", 60000));
    AFIRMA(f.esperandoRetiro());
}

PRUEBA(la_retirada_exige_sondeos_consecutivos_sin_tarjeta) {
    FiltroUid f;
    AFIRMA(f.aceptar("AA", 0));
    f.sondeo(false);
    f.sondeo(false);
    AFIRMA(f.esperandoRetiro());        // solo 2 ausencias seguidas
    f.sondeo(true);                      // reaparece: se reinicia la cuenta
    f.sondeo(false);
    f.sondeo(false);
    AFIRMA(f.esperandoRetiro());
    f.sondeo(false);                     // tercera seguida
    AFIRMA(!f.esperandoRetiro());
    AFIRMA(f.aceptar("AA", 5000));
}

PRUEBA(uid_distinto_se_acepta_de_inmediato) {
    FiltroUid f;
    AFIRMA(f.aceptar("AA", 0));
    AFIRMA(f.aceptar("BB", 10));          // sin retirar y sin esperar
    AFIRMA(!f.aceptar("BB", 20));
    AFIRMA(f.aceptar("AA", 30));          // volver a la anterior también es un UID distinto del último
}

PRUEBA(antirrebote_correcto_al_dar_la_vuelta_millis) {
    FiltroUid f;
    const ms_t t0 = 0xFFFFFF00UL;
    AFIRMA(f.aceptar("AA", t0));
    for (int i = 0; i < 5; i++) f.sondeo(false);
    AFIRMA(!f.aceptar("AA", t0 + 1000));             // 0xFFFFFF00+1000 cruza el cero
    AFIRMA(f.aceptar("AA", (ms_t)(t0 + 2000)));
}

// ------------------------------------------------------------- enlace
PRUEBA(enlace_con_trafico_vence_a_los_30s_exactos) {
    AFIRMA_INT(ENLACE_OK, estadoEnlace(true, 29999, 0, 0));
    AFIRMA_INT(ENLACE_PERDIDO, estadoEnlace(true, 30000, 0, 0));
    AFIRMA_INT(ENLACE_OK, estadoEnlace(true, 100000 + 29999, 100000, 0));
    AFIRMA_INT(ENLACE_PERDIDO, estadoEnlace(true, 100000 + 30000, 100000, 0));
}

PRUEBA(enlace_sin_trafico_desde_el_arranque) {
    AFIRMA_INT(ENLACE_ESPERANDO, estadoEnlace(false, 5000, 0, 0));
    AFIRMA_INT(ENLACE_ESPERANDO, estadoEnlace(false, 29999, 0, 0));
    AFIRMA_INT(ENLACE_PERDIDO, estadoEnlace(false, 30000, 0, 0));
    AFIRMA_INT(ENLACE_ESPERANDO, estadoEnlace(false, 777 + 29999, 0, 777));
}

PRUEBA(enlace_correcto_al_dar_la_vuelta_millis) {
    const ms_t rx = 0xFFFFFF00UL;
    AFIRMA_INT(ENLACE_OK, estadoEnlace(true, (ms_t)(rx + 29999), rx, 0));
    AFIRMA_INT(ENLACE_PERDIDO, estadoEnlace(true, (ms_t)(rx + 30000), rx, 0));
}

PRUEBA(espera_de_respuesta_vence_a_los_3s) {
    AFIRMA(!respuestaVencida(2999, 0));
    AFIRMA(respuestaVencida(3000, 0));
    AFIRMA(!respuestaVencida((ms_t)(0xFFFFFFF0UL + 2999), 0xFFFFFFF0UL));
    AFIRMA(respuestaVencida((ms_t)(0xFFFFFFF0UL + 3000), 0xFFFFFFF0UL));
}

PRUEBA(parpadeo_lento_500_de_cada_2000) {
    AFIRMA(parpadeoLento(0));
    AFIRMA(parpadeoLento(499));
    AFIRMA(!parpadeoLento(500));
    AFIRMA(!parpadeoLento(1999));
    AFIRMA(parpadeoLento(2000));
}

// ------------------------------------------------------------ pulsador
PRUEBA(pulsador_una_pulsacion_estable_cuenta_una_vez) {
    Pulsador p;
    p.reiniciar(false, 0);
    int eventos = 0;
    for (ms_t t = 1; t < 500; t++) {
        const bool presionado = t >= 100 && t < 300;
        if (p.actualizar(presionado, t)) eventos++;
    }
    AFIRMA_INT(1, eventos);    // y mantenerlo pulsado no repite
}

PRUEBA(pulsador_rebotes_cortos_no_cuentan) {
    Pulsador p;
    p.reiniciar(false, 0);
    int eventos = 0;
    // 20 ms de rebote alternando cada 5 ms y luego suelta: nunca llega a 30 ms estable.
    for (ms_t t = 1; t < 20; t++) {
        if (p.actualizar(((t / 5) % 2) == 1, t)) eventos++;
    }
    for (ms_t t = 20; t < 200; t++) {
        if (p.actualizar(false, t)) eventos++;
    }
    AFIRMA_INT(0, eventos);
}

PRUEBA(pulsador_limite_de_30ms) {
    Pulsador p;
    p.reiniciar(false, 0);
    AFIRMA(!p.actualizar(true, 100));     // detecta el cambio
    AFIRMA(!p.actualizar(true, 129));
    AFIRMA(p.actualizar(true, 130));      // 30 ms estable
    AFIRMA(!p.actualizar(true, 131));
}

PRUEBA(pulsador_ya_pulsado_al_encender_no_cuenta_y_dos_pulsaciones_son_dos) {
    Pulsador p;
    p.reiniciar(true, 0);                 // botón mantenido al arrancar
    int eventos = 0;
    for (ms_t t = 1; t < 200; t++) {
        if (p.actualizar(true, t)) eventos++;
    }
    AFIRMA_INT(0, eventos);
    for (ms_t t = 200; t < 300; t++) {
        if (p.actualizar(false, t)) eventos++;
    }
    for (ms_t t = 300; t < 400; t++) {
        if (p.actualizar(true, t)) eventos++;
    }
    for (ms_t t = 400; t < 500; t++) {
        if (p.actualizar(false, t)) eventos++;
    }
    for (ms_t t = 500; t < 600; t++) {
        if (p.actualizar(true, t)) eventos++;
    }
    AFIRMA_INT(2, eventos);
}

// ----------------------------------------------------- efectos y pitidos
static std::vector<std::pair<ms_t, uint16_t> > cronograma(const Paso* pasos, uint8_t n, ms_t hasta) {
    Secuenciador s;
    s.iniciar(pasos, n, 0);
    std::vector<std::pair<ms_t, uint16_t> > cambios;
    for (ms_t t = 0; t <= hasta; t++) {
        uint16_t hz;
        if (s.actualizar(t, hz)) cambios.push_back(std::make_pair(t, hz));
    }
    return cambios;
}

PRUEBA(pitido_ok_un_tono_corto) {
    std::vector<std::pair<ms_t, uint16_t> > c = cronograma(PIT_OK, 1, 1000);
    AFIRMA_INT(2, c.size());
    AFIRMA_INT(0, c[0].first);
    AFIRMA_INT(2200, c[0].second);
    AFIRMA_INT(120, c[1].first);
    AFIRMA_INT(0, c[1].second);
}

PRUEBA(pitido_dup_dos_tonos_cortos) {
    std::vector<std::pair<ms_t, uint16_t> > c = cronograma(PIT_DUP, 3, 1000);
    AFIRMA_INT(4, c.size());
    AFIRMA_INT(0, c[0].first);   AFIRMA_INT(1800, c[0].second);
    AFIRMA_INT(80, c[1].first);  AFIRMA_INT(0, c[1].second);
    AFIRMA_INT(160, c[2].first); AFIRMA_INT(1800, c[2].second);
    AFIRMA_INT(240, c[3].first); AFIRMA_INT(0, c[3].second);
}

PRUEBA(pitido_noreg_un_tono_largo_grave) {
    std::vector<std::pair<ms_t, uint16_t> > c = cronograma(PIT_NOREG, 1, 1000);
    AFIRMA_INT(2, c.size());
    AFIRMA_INT(500, c[0].second);
    AFIRMA_INT(600, c[1].first);
    // Más largo y más grave que el de OK.
    AFIRMA(PIT_NOREG[0].ms > PIT_OK[0].ms && PIT_NOREG[0].hz < PIT_OK[0].hz);
}

PRUEBA(secuenciador_detener_apaga_y_no_deja_tono_colgado) {
    Secuenciador s;
    uint16_t hz;
    s.iniciar(PIT_NOREG, 1, 0);
    AFIRMA(s.actualizar(0, hz) && hz == 500);
    s.detener();
    AFIRMA(s.actualizar(10, hz) && hz == 0);
    AFIRMA(!s.actualizar(20, hz));
    AFIRMA(!s.activo());
}

PRUEBA(secuenciador_reiniciar_reemplaza_la_secuencia_y_sin_secuencia_apaga) {
    Secuenciador s;
    uint16_t hz;
    s.iniciar(PIT_DUP, 3, 0);
    s.actualizar(0, hz);
    s.iniciar(PIT_OK, 1, 50);
    AFIRMA(s.actualizar(50, hz) && hz == 2200);
    s.iniciar(0, 0, 60);                       // evento sin pitido
    AFIRMA(s.actualizar(60, hz) && hz == 0);
}

PRUEBA(secuenciador_no_acumula_error_si_el_ciclo_se_atrasa) {
    Secuenciador s;
    uint16_t hz;
    s.iniciar(PIT_DUP, 3, 0);
    s.actualizar(0, hz);
    AFIRMA(s.actualizar(100, hz) && hz == 0);       // el paso 0 duraba 80: se atrasó 20 ms
    AFIRMA(!s.actualizar(159, hz));
    AFIRMA(s.actualizar(160, hz) && hz == 1800);    // conserva el calendario original (80+80)
    AFIRMA(!s.actualizar(239, hz));
    AFIRMA(s.actualizar(240, hz) && hz == 0);
    AFIRMA(!s.activo());
}

PRUEBA(secuenciador_correcto_al_dar_la_vuelta_millis) {
    Secuenciador s;
    uint16_t hz;
    const ms_t t0 = 0xFFFFFFB0UL;
    s.iniciar(PIT_NOREG, 1, t0);
    AFIRMA(s.actualizar(t0, hz) && hz == 500);
    AFIRMA(!s.actualizar((ms_t)(t0 + 599), hz));
    AFIRMA(s.actualizar((ms_t)(t0 + 600), hz) && hz == 0);
}

PRUEBA(efectos_por_resultado) {
    Efecto e;
    AFIRMA(efectoPara(EV_OK, e));
    AFIRMA_INT(LED_VERDE, e.leds);   AFIRMA(!e.parpadeo);  AFIRMA(e.pitido == PIT_OK);
    AFIRMA(efectoPara(EV_DUP, e));
    AFIRMA_INT(LED_AMBAR, e.leds);   AFIRMA(!e.parpadeo);  AFIRMA_INT(3, e.nPasos);
    AFIRMA(efectoPara(EV_NOREG, e));
    AFIRMA_INT(LED_ROJO, e.leds);    AFIRMA(!e.parpadeo);  AFIRMA(e.pitido == PIT_NOREG);
    AFIRMA(efectoPara(EV_ERR, e));
    AFIRMA_INT(LED_ROJO, e.leds);    AFIRMA(e.parpadeo);   AFIRMA_INT(0, e.nPasos);
    AFIRMA(efectoPara(EV_ARRANQUE, e));
    AFIRMA_INT(7, e.leds);
    AFIRMA(efectoPara(EV_LEYENDO, e));
    AFIRMA_INT(0, e.leds);
    AFIRMA_INT(ESPERA_RES_MS, e.duracionMs);
}

PRUEBA(evento_de_cada_comando) {
    Evento ev;
    AFIRMA(eventoDe(CMD_RES_OK, ev) && ev == EV_OK);
    AFIRMA(eventoDe(CMD_RES_DUP, ev) && ev == EV_DUP);
    AFIRMA(eventoDe(CMD_RES_NOREG, ev) && ev == EV_NOREG);
    AFIRMA(eventoDe(CMD_RES_ERR, ev) && ev == EV_ERR);
    AFIRMA(!eventoDe(CMD_PING, ev));
    AFIRMA(!eventoDe(CMD_SES, ev));
    AFIRMA(!eventoDe(CMD_NINGUNO, ev));
}

PRUEBA(led_parpadeo_rapido_alterna_cada_200ms) {
    Efecto e;
    efectoPara(EV_ERR, e);
    AFIRMA(ledEncendido(e, 0));
    AFIRMA(ledEncendido(e, 199));
    AFIRMA(!ledEncendido(e, 200));
    AFIRMA(!ledEncendido(e, 399));
    AFIRMA(ledEncendido(e, 400));
    efectoPara(EV_OK, e);
    AFIRMA(ledEncendido(e, 250));   // sin parpadeo siempre encendido
}

// ------------------------------------------------------------- pantallas
// Las filas del LCD siempre miden 16; para comparar se quitan los espacios finales
// (el ancho exacto de 16 lo verifica ninguna_pantalla_excede_16_columnas).
static std::string fila(const Pantalla& p, int r) {
    std::string f = p.fila[r];
    while (!f.empty() && f.back() == ' ') f.pop_back();
    return f;
}

PRUEBA(pagina_sesion_materia_arriba_grupo_y_cuenta_abajo) {
    Comando c;
    AFIRMA(analizar("SES 3N-A|Prog. Avanzada|12/30", c));
    Modelo m;
    modeloInicial(m);
    aplicarSes(c, m.sesion);
    Pantalla p;
    pantallaPagina(m, ENLACE_OK, p);
    AFIRMA_STR("Prog. Avanzada", fila(p, 0));
    AFIRMA_STR("3N-A       12/30", fila(p, 1));
}

PRUEBA(pagina_sesion_grupo_largo_se_recorta_y_deja_una_columna) {
    Comando c;
    AFIRMA(analizar("SES Grupo de nombre larguisimo|Mat|123/456", c));
    Modelo m;
    modeloInicial(m);
    aplicarSes(c, m.sesion);
    Pantalla p;
    pantallaPagina(m, ENLACE_OK, p);
    AFIRMA_STR("Mat", fila(p, 0));
    AFIRMA_STR("Grupo de 123/456", fila(p, 1));
}

PRUEBA(pagina_sesion_sin_sesion_enlace_perdido_y_esperando) {
    Modelo m;
    modeloInicial(m);
    Pantalla p;
    pantallaPagina(m, ENLACE_OK, p);
    AFIRMA_STR("Sin sesion", fila(p, 0));
    AFIRMA_STR("abierta", fila(p, 1));
    pantallaPagina(m, ENLACE_PERDIDO, p);
    AFIRMA_STR("Sin conexion", fila(p, 0));
    AFIRMA_STR("con la PC", fila(p, 1));
    pantallaPagina(m, ENLACE_ESPERANDO, p);
    AFIRMA_STR("Esperando PC...", fila(p, 0));
}

PRUEBA(sesion_con_campos_vacios_cierra_la_sesion) {
    Comando c;
    Modelo m;
    modeloInicial(m);
    AFIRMA(analizar("SES 3N|Redes|1/2", c));
    aplicarSes(c, m.sesion);
    AFIRMA(m.sesion.abierta);
    AFIRMA(analizar("SES ||0/0", c));
    aplicarSes(c, m.sesion);
    AFIRMA(!m.sesion.abierta);
}

PRUEBA(paginas_ultima_y_estacion) {
    Modelo m;
    modeloInicial(m);
    Pantalla p;
    m.pagina = 1;
    pantallaPagina(m, ENLACE_OK, p);
    AFIRMA_STR("Ultima lectura", fila(p, 0));
    AFIRMA_STR("(ninguna)", fila(p, 1));
    strcpy(m.ultimoUid, "04A1B2C3");
    pantallaPagina(m, ENLACE_OK, p);
    AFIRMA_STR("UID 04A1B2C3", fila(p, 1));
    strcpy(m.ultimoUid, "04A1B2C3D4E5F6");     // 7 bytes
    pantallaPagina(m, ENLACE_OK, p);
    AFIRMA_STR("04A1B2C3D4E5F6", fila(p, 1));
    strcpy(m.ultimoUid, "0102030405060708090A");   // 10 bytes: 16 primeros
    pantallaPagina(m, ENLACE_OK, p);
    AFIRMA_STR("0102030405060708", fila(p, 1));

    m.pagina = 2;
    m.lectorOk = true;
    m.lecturas = 12;
    pantallaPagina(m, ENLACE_OK, p);
    AFIRMA_STR("PC:OK RC522:OK", fila(p, 0));
    AFIRMA_STR("Lecturas: 12", fila(p, 1));
    m.lectorOk = false;
    m.lecturas = 65000;
    pantallaPagina(m, ENLACE_PERDIDO, p);
    AFIRMA_STR("PC:NO RC522:ERR", fila(p, 0));
    AFIRMA_STR("Lecturas: 9999", fila(p, 1));
}

PRUEBA(pantallas_de_eventos) {
    Pantalla p;
    pantallaEvento(EV_OK, "Ana L.", p);
    AFIRMA_STR("Registrado", fila(p, 0));
    AFIRMA_STR("Ana L.", fila(p, 1));
    pantallaEvento(EV_DUP, "Ana L.", p);
    AFIRMA_STR("Ya registrado", fila(p, 0));
    AFIRMA_STR("Ana L.", fila(p, 1));
    pantallaEvento(EV_NOREG, "", p);
    AFIRMA_STR("Tarjeta no", fila(p, 0));
    AFIRMA_STR("registrada", fila(p, 1));
    pantallaEvento(EV_ERR, "", p);
    AFIRMA_STR("Error", fila(p, 0));
    AFIRMA_STR("del sistema", fila(p, 1));
    pantallaEvento(EV_ERR, "Sin respuesta", p);
    AFIRMA_STR("Sin respuesta", fila(p, 1));
    pantallaEvento(EV_LEYENDO, "", p);
    AFIRMA_STR("Tarjeta leida", fila(p, 0));
    pantallaEvento(EV_ARRANQUE, "", p);
    AFIRMA_STR("SUSAN Estacion", fila(p, 0));
}

// Ninguna pantalla, con ningún texto, debe pasar de 16 columnas ni de NUL.
PRUEBA(ninguna_pantalla_excede_16_columnas) {
    const char* textos[] = {"", "a", "0123456789ABCDEF", "0123456789ABCDEFGHIJKLMNOP", "\xC3\xA1\xC3\xA9\xC3\xAD\xC3\xB3\xC3\xBA\xC3\xB1\xC3\xBC\xC3\x81\xC3\x89\xC3\x8D\xC3\x93\xC3\x9A\xC3\x91\xC3\x9C!!!"};
    for (size_t i = 0; i < sizeof(textos) / sizeof(textos[0]); i++) {
        char fit[COLS + 1];
        ajustar(textos[i], fit, COLS);
        AFIRMA(strlen(fit) <= COLS);
        Modelo m;
        modeloInicial(m);
        m.sesion.abierta = true;
        strcpy(m.sesion.grupo, fit);
        strcpy(m.sesion.materia, fit);
        m.sesion.presentes = 65535;
        m.sesion.total = 65535;
        strcpy(m.ultimoUid, "0102030405060708090A");
        m.lecturas = 65535;
        for (uint8_t pag = 0; pag < PAGINAS; pag++) {
            for (uint8_t en = 0; en < 3; en++) {
                m.pagina = pag;
                Pantalla p;
                pantallaPagina(m, (EstadoEnlace)en, p);
                for (int r = 0; r < 2; r++) {
                    AFIRMA_INT(16, strlen(p.fila[r]));
                    for (int k = 0; k < 16; k++) AFIRMA(p.fila[r][k] >= 0x20 && p.fila[r][k] < 0x7F);
                }
            }
        }
        for (int ev = EV_ARRANQUE; ev <= EV_ERR; ev++) {
            Pantalla p;
            pantallaEvento((Evento)ev, fit, p);
            for (int r = 0; r < 2; r++) AFIRMA_INT(16, strlen(p.fila[r]));
        }
    }
}

// ------------------------------------------------- robustez (aleatoria)
// Generador congruencial: determinista, sin depender de rand() del sistema.
static uint32_t semilla = 12345;
static uint8_t azar() {
    semilla = semilla * 1664525UL + 1013904223UL;
    return (uint8_t)(semilla >> 24);
}

PRUEBA(un_millon_de_bytes_aleatorios_no_rompen_el_ensamblador_ni_el_analizador) {
    EnsambladorLinea e;
    Comando c;
    int lineas = 0;
    for (int i = 0; i < 1000000; i++) {
        uint8_t b = azar();
        if (i % 37 == 0) b = '\n';       // asegura que haya líneas cortas
        if (e.alimentar(b)) {
            lineas++;
            AFIRMA(strlen(e.buffer()) <= MAX_LINEA);
            if (analizar(e.buffer(), c)) {
                AFIRMA(strlen(c.texto1) <= COLS && strlen(c.texto2) <= COLS);
            }
        }
    }
    AFIRMA(lineas > 0);
}

PRUEBA(lineas_aleatorias_con_forma_de_comando_no_producen_textos_largos) {
    const char* piezas[] = {"SES ", "RES ", "OK", "DUP", "NOREG", "ERR", "|", "/", " ", "12", "99999", "a", "\xC3\xA9", "\xE2\x82\xAC", "PING"};
    Comando c;
    for (int i = 0; i < 200000; i++) {
        std::string l;
        int n = 1 + azar() % 8;
        for (int k = 0; k < n; k++) l += piezas[azar() % (sizeof(piezas) / sizeof(piezas[0]))];
        if (l.size() > MAX_LINEA) l.resize(MAX_LINEA);
        if (analizar(l.c_str(), c)) {
            AFIRMA(strlen(c.texto1) <= COLS && strlen(c.texto2) <= COLS);
        }
    }
}

int main() {
    // Comprobación de que la tabla Latin-1 mide justo 64 caracteres.
    return mt::ejecutar("Pruebas de protocolo.h (lógica pura)", false);
}
