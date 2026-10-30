// test_sketch.cpp - Escenarios sobre el sketch REAL (estacion_aula.ino) con
// hardware simulado (ver simulacion/sim_hw.h). El .ino se incluye tal cual y se
// maneja con setup()/loop() y un reloj falso que avanza 1 ms por vuelta.
//
// Qué demuestra: que la máquina de estados del sketch cumple el protocolo y las
// reglas de diseño (antirrebote, 30 s, entradas hostiles, botón, LED, pitidos).
// Qué NO demuestra: nada del comportamiento eléctrico ni de las librerías reales.
#include <Arduino.h>
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <Wire.h>

#include "mini_test.h"
#include "../estacion_aula/estacion_aula.ino"

using sim::M;

// ------------------------------------------------------------- utilidades
static void arrancar(uint64_t ms0 = 1000) {
    sim::reiniciarMundo();
    M().ms = ms0;
    setup();
}

static void avanzar(uint32_t n) {
    for (uint32_t i = 0; i < n; i++) {
        M().ms++;
        M().enLoop = true;
        loop();
        M().enLoop = false;
    }
}

static void pc(const std::string& s) {
    for (size_t i = 0; i < s.size(); i++) M().rx.push_back((uint8_t)s[i]);
}

static bool lineaValidaDeLaEstacion(const std::string& l) {
    if (l.size() > 64) return false;
    if (l == "HELLO estacion-aula 1.0" || l == "PONG" || l == "BTN") return true;
    if (l.compare(0, 4, "UID ") == 0 && l.size() >= 12 && l.size() <= 24 && (l.size() - 4) % 2 == 0) {
        for (size_t i = 4; i < l.size(); i++) {
            if (!((l[i] >= '0' && l[i] <= '9') || (l[i] >= 'A' && l[i] <= 'F'))) return false;
        }
        return true;
    }
    return false;
}

// Vacía lo que la estación mandó a la PC; cada línea debe cumplir la gramática.
static std::vector<std::string> tx() {
    std::vector<std::string> lineas;
    std::string& b = M().tx;
    size_t ini = 0;
    for (size_t i = 0; i < b.size(); i++) {
        if (b[i] == '\n') {
            lineas.push_back(b.substr(ini, i - ini));
            ini = i + 1;
        }
    }
    AFIRMA(ini == b.size());  // nunca queda una línea a medias
    b.erase(0, ini);
    for (size_t i = 0; i < lineas.size(); i++) {
        if (!lineaValidaDeLaEstacion(lineas[i])) {
            mt::fallo(__FILE__, __LINE__, "línea fuera de protocolo: " + mt::comillas(lineas[i]));
        }
    }
    return lineas;
}

static std::string fila(int r, uint8_t dir = 0x27) {
    std::string f = M().lcd[dir].fila[r];
    while (!f.empty() && f.back() == ' ') f.pop_back();
    return f;
}

static bool encendido(uint8_t pin) { return M().nivel[pin] == HIGH; }
static const uint8_t P_VERDE = 5, P_AMBAR = 6, P_ROJO = 7;

// Cambios de un pin en [desde, hasta).
static int cambios(uint8_t pin, uint64_t desde, uint64_t hasta) {
    int n = 0;
    for (size_t i = 0; i < M().pines.size(); i++) {
        const sim::EventoPin& e = M().pines[i];
        if (e.pin == pin && e.ms >= desde && e.ms < hasta) n++;
    }
    return n;
}

// Secuencia de tonos (hz) emitida desde `desde`, con su instante.
static std::vector<std::pair<uint64_t, unsigned> > tonosDesde(uint64_t desde) {
    std::vector<std::pair<uint64_t, unsigned> > r;
    for (size_t i = 0; i < M().tonos.size(); i++) {
        if (M().tonos[i].ms >= desde) r.push_back(std::make_pair(M().tonos[i].ms, M().tonos[i].hz));
    }
    return r;
}

static void pulsar(uint32_t ms) {
    M().botonPulsado = true;
    avanzar(ms);
    M().botonPulsado = false;
    avanzar(100);
}

// Deja la estación lista: arrancó, terminó el efecto de arranque y la PC ya habló.
static void estacionConectada() {
    arrancar();
    avanzar(1200);
    pc("PING\n");
    avanzar(100);  // da tiempo al siguiente redibujo de la pantalla (cada 50 ms)
    tx();          // HELLO y PONG
}

static void pasarTarjeta(const char* hex) {
    sim::acercarTarjeta(hex);
    avanzar(150);
}

// ---------------------------------------------------------------- arranque
PRUEBA(arranque_hello_leds_pitido_y_pantalla) {
    arrancar();
    std::vector<std::string> t = tx();
    AFIRMA_INT(1, t.size());
    AFIRMA_STR("HELLO estacion-aula 1.0", t[0]);
    AFIRMA(M().wireTimeout);                       // tiempo límite del bus I2C activado
    avanzar(100);
    AFIRMA(encendido(P_VERDE) && encendido(P_AMBAR) && encendido(P_ROJO));
    AFIRMA_STR("SUSAN Estacion", fila(0));
    AFIRMA_STR("v1.0 iniciando", fila(1));
    avanzar(1000);
    AFIRMA(!encendido(P_VERDE) && !encendido(P_AMBAR) && !encendido(P_ROJO));
    AFIRMA_STR("Esperando PC...", fila(0));
    std::vector<std::pair<uint64_t, unsigned> > ton = tonosDesde(0);
    REQUIERE(ton.size() == 4);                     // 1200, silencio, 1800, silencio
    AFIRMA_INT(1200, ton[0].second);
    AFIRMA_INT(1800, ton[2].second);
    AFIRMA_INT(0, M().delayEnLoop);                // ningún delay() dentro de loop()
}

PRUEBA(ping_responde_pong) {
    arrancar();
    avanzar(1200);
    tx();
    pc("PING\n");
    avanzar(3);
    std::vector<std::string> t = tx();
    AFIRMA_INT(1, t.size());
    AFIRMA_STR("PONG", t[0]);
    pc("PING\r\nPING\n");  // CRLF y dos seguidos
    avanzar(3);
    AFIRMA_INT(2, tx().size());
}

PRUEBA(sesion_se_muestra_en_el_lcd) {
    estacionConectada();
    AFIRMA_STR("Sin sesion", fila(0));
    pc("SES 3N-A|Prog. Avanzada|12/30\n");
    avanzar(100);
    AFIRMA_STR("Prog. Avanzada", fila(0));
    AFIRMA_STR("3N-A       12/30", fila(1));
    pc("SES 3N-A|Prog. Avanzada|13/30\n");
    avanzar(100);
    AFIRMA_STR("3N-A       13/30", fila(1));
    pc("SES ||0/0\n");
    avanzar(100);
    AFIRMA_STR("Sin sesion", fila(0));
}

PRUEBA(sesion_con_acentos_se_translitera) {
    estacionConectada();
    pc("SES 3\xC2\xB0 N|Programaci\xC3\xB3n|1/2\n");
    avanzar(100);
    AFIRMA_STR("Programacion", fila(0));
    AFIRMA_STR("3o N         1/2", fila(1));
}

// ------------------------------------------------------- lectura de tarjetas
PRUEBA(tarjeta_envia_uid_y_res_ok_enciende_verde_con_un_pitido) {
    estacionConectada();
    pasarTarjeta("04A1B2C3");
    std::vector<std::string> t = tx();
    AFIRMA_INT(1, t.size());
    AFIRMA_STR("UID 04A1B2C3", t[0]);
    AFIRMA_STR("Tarjeta leida", fila(0));
    const uint64_t t0 = M().ms;
    pc("RES OK Ana L.\n");
    avanzar(60);
    AFIRMA(encendido(P_VERDE) && !encendido(P_AMBAR) && !encendido(P_ROJO));
    AFIRMA_STR("Registrado", fila(0));
    AFIRMA_STR("Ana L.", fila(1));
    avanzar(100);
    std::vector<std::pair<uint64_t, unsigned> > ton = tonosDesde(t0);
    REQUIERE(ton.size() == 2);
    AFIRMA_INT(2200, ton[0].second);
    AFIRMA_INT(0, ton[1].second);
    AFIRMA_INT(120, ton[1].first - ton[0].first);   // pitido corto
    avanzar(1950);                                   // 60+100+1950 ms desde el RES
    AFIRMA(!encendido(P_VERDE));                     // dura ~2 s
    AFIRMA_STR("Sin sesion", fila(0));               // y la pantalla vuelve a la página
    AFIRMA_INT(0, M().delayEnLoop);
}

PRUEBA(res_dup_enciende_ambar_con_dos_pitidos_cortos) {
    estacionConectada();
    pasarTarjeta("04A1B2C3");
    tx();
    const uint64_t t0 = M().ms;
    pc("RES DUP Ana L.\n");
    avanzar(60);
    AFIRMA(encendido(P_AMBAR) && !encendido(P_VERDE) && !encendido(P_ROJO));
    AFIRMA_STR("Ya registrado", fila(0));
    avanzar(300);
    std::vector<std::pair<uint64_t, unsigned> > ton = tonosDesde(t0);
    REQUIERE(ton.size() == 4);
    AFIRMA_INT(1800, ton[0].second);
    AFIRMA_INT(0, ton[1].second);
    AFIRMA_INT(1800, ton[2].second);
    AFIRMA_INT(0, ton[3].second);
    AFIRMA_INT(80, ton[1].first - ton[0].first);
    AFIRMA_INT(240, ton[3].first - ton[0].first);
}

PRUEBA(res_noreg_enciende_rojo_con_pitido_largo) {
    estacionConectada();
    pasarTarjeta("DEADBEEF");
    tx();
    const uint64_t t0 = M().ms;
    pc("RES NOREG\n");
    avanzar(60);
    AFIRMA(encendido(P_ROJO) && !encendido(P_VERDE) && !encendido(P_AMBAR));
    AFIRMA_STR("Tarjeta no", fila(0));
    AFIRMA_STR("registrada", fila(1));
    avanzar(700);
    std::vector<std::pair<uint64_t, unsigned> > ton = tonosDesde(t0);
    REQUIERE(ton.size() == 2);
    AFIRMA_INT(500, ton[0].second);
    AFIRMA_INT(600, ton[1].first - ton[0].first);
    AFIRMA(encendido(P_ROJO));                       // el LED sigue (dura 2 s)
}

PRUEBA(res_err_parpadea_rojo_sin_pitido) {
    estacionConectada();
    pasarTarjeta("04A1B2C3");
    tx();
    const uint64_t t0 = M().ms;
    pc("RES ERR Sin sesion abierta\n");
    avanzar(2100);
    AFIRMA_INT(0, tonosDesde(t0).size());
    AFIRMA(cambios(P_ROJO, t0, t0 + 2100) >= 9);     // ~5 ciclos de 400 ms
    AFIRMA(!encendido(P_ROJO));
    avanzar(1);
}

PRUEBA(res_err_muestra_el_motivo) {
    estacionConectada();
    pc("RES ERR Sin sesion abierta\n");
    avanzar(100);
    AFIRMA_STR("Error", fila(0));
    AFIRMA_STR("Sin sesion abier", fila(1));
}

PRUEBA(si_la_pc_no_responde_a_los_3s_avisa_error_local) {
    estacionConectada();
    pasarTarjeta("04A1B2C3");
    tx();
    avanzar(2800);
    AFIRMA_STR("Tarjeta leida", fila(0));
    avanzar(400);
    AFIRMA_STR("Error", fila(0));
    AFIRMA_STR("Sin respuesta", fila(1));
    AFIRMA(cambios(P_ROJO, M().ms - 400, M().ms + 1) >= 1);
}

PRUEBA(res_sin_haber_leido_tarjeta_tambien_se_muestra) {
    estacionConectada();
    pc("RES NOREG\n");
    avanzar(60);
    AFIRMA(encendido(P_ROJO));
}

PRUEBA(nombre_utf8_se_translitera_en_res) {
    estacionConectada();
    pc("RES OK Jos\xC3\xA9 \xC3\x91\n");
    avanzar(60);
    AFIRMA_STR("Jose N", fila(1));
}

// ---------------------------------------------------- antirrebote de tarjeta
PRUEBA(tarjeta_olvidada_sobre_el_lector_genera_una_sola_lectura) {
    estacionConectada();
    pasarTarjeta("04A1B2C3");
    avanzar(10000);
    AFIRMA_INT(1, tx().size());
}

PRUEBA(tarjeta_que_vuelve_a_idle_tras_el_wupa_tampoco_repite) {
    estacionConectada();
    M().tarjeta.pesimista = true;     // peor caso: HLTA desde READY devuelve a IDLE
    pasarTarjeta("04A1B2C3");
    avanzar(10000);
    AFIRMA_INT(1, tx().size());
}

PRUEBA(tarjeta_que_no_obedece_halt_tampoco_repite) {
    estacionConectada();
    M().tarjeta.ignoraHalt = true;
    pasarTarjeta("04A1B2C3");
    avanzar(10000);
    AFIRMA_INT(1, tx().size());
}

PRUEBA(tarjeta_que_reaparece_sola_en_idle_cada_700ms_no_repite_lecturas) {
    estacionConectada();
    M().tarjeta.reiniciarCada = 700;   // el lector la "ve como nueva" una y otra vez
    pasarTarjeta("04A1B2C3");
    avanzar(20000);
    AFIRMA_INT(1, tx().size());        // solo cuenta la primera: nunca se retiró
}

PRUEBA(mismo_uid_retirado_y_vuelto_a_pasar_antes_de_2s_se_ignora) {
    estacionConectada();
    pasarTarjeta("04A1B2C3");
    AFIRMA_INT(1, tx().size());
    sim::retirarTarjeta();
    avanzar(400);
    pasarTarjeta("04A1B2C3");          // ~0,7 s después de la primera
    avanzar(300);
    AFIRMA_INT(0, tx().size());
    sim::retirarTarjeta();
    avanzar(2200);
    pasarTarjeta("04A1B2C3");          // ya pasaron más de 2 s y se retiró
    std::vector<std::string> t = tx();
    AFIRMA_INT(1, t.size());
    AFIRMA_STR("UID 04A1B2C3", t[0]);
}

PRUEBA(uid_distinto_se_acepta_de_inmediato) {
    estacionConectada();
    pasarTarjeta("04A1B2C3");
    sim::retirarTarjeta();
    avanzar(400);
    pasarTarjeta("0BADF00D");
    std::vector<std::string> t = tx();
    AFIRMA_INT(2, t.size());
    AFIRMA_STR("UID 0BADF00D", t[1]);
}

PRUEBA(uid_de_7_bytes) {
    estacionConectada();
    pasarTarjeta("04A1B2C3D4E5F6");
    std::vector<std::string> t = tx();
    AFIRMA_INT(1, t.size());
    AFIRMA_STR("UID 04A1B2C3D4E5F6", t[0]);
}

// ------------------------------------------------------------ regla de 30 s
PRUEBA(a_los_30s_de_silencio_muestra_sin_conexion_y_ambar_lento_y_se_recupera) {
    estacionConectada();
    pc("SES 3N|Redes|1/2\n");
    avanzar(100);
    AFIRMA_STR("Redes", fila(0));
    const uint64_t tConectada = M().ms;
    avanzar(29000);
    AFIRMA_STR("Redes", fila(0));                    // aún conectada
    AFIRMA_INT(0, cambios(P_AMBAR, tConectada, M().ms + 1));
    avanzar(1100);                                   // ya pasaron ~30,2 s del último PING
    AFIRMA_STR("Sin conexion", fila(0));
    const uint64_t t0 = M().ms;
    avanzar(6000);
    const int c = cambios(P_AMBAR, t0, M().ms);
    AFIRMA(c >= 5 && c <= 7);                        // 3 ciclos de 2 s = 6 cambios
    // La PC vuelve.
    pc("PING\n");
    avanzar(150);
    AFIRMA_STR("Redes", fila(0));
    AFIRMA(!encendido(P_AMBAR));
    std::vector<std::string> t = tx();
    AFIRMA_STR("PONG", t.back());
}

PRUEBA(sin_conexion_aparece_en_la_pagina_de_sesion_aunque_se_hayan_llegado_ses) {
    estacionConectada();
    avanzar(31000);
    AFIRMA_STR("Sin conexion", fila(0));
    AFIRMA_STR("con la PC", fila(1));
}

PRUEBA(si_la_pc_nunca_habla_pasa_de_esperando_a_sin_conexion_a_los_30s) {
    arrancar();
    avanzar(29000);
    AFIRMA_STR("Esperando PC...", fila(0));
    avanzar(1500);
    AFIRMA_STR("Sin conexion", fila(0));
}

PRUEBA(un_comando_desconocido_no_cuenta_como_vida_de_la_pc) {
    estacionConectada();
    for (int i = 0; i < 40; i++) {                   // 40 s de basura "amigable"
        pc("HOLA\n");
        avanzar(1000);
    }
    AFIRMA_STR("Sin conexion", fila(0));
}

PRUEBA(ses_y_res_validos_tambien_cuentan_como_vida_de_la_pc) {
    estacionConectada();
    for (int i = 0; i < 40; i++) {
        pc("SES 3N|Redes|1/2\n");
        avanzar(1000);
    }
    AFIRMA_STR("Redes", fila(0));
}

// ------------------------------------------------------ entradas hostiles
PRUEBA(linea_de_100_bytes_se_ignora_y_la_siguiente_funciona) {
    estacionConectada();
    pc(std::string(100, 'x') + "\nPING\n");
    avanzar(10);
    std::vector<std::string> t = tx();
    AFIRMA_INT(1, t.size());
    AFIRMA_STR("PONG", t[0]);
}

PRUEBA(ses_de_64_bytes_se_acepta_y_de_65_se_ignora) {
    estacionConectada();
    std::string ses64 = "SES " + std::string(27, 'G') + "|" + std::string(28, 'M') + "|1/2";
    AFIRMA_INT(64, ses64.size());
    pc(ses64 + "\n");
    avanzar(100);
    AFIRMA_STR("MMMMMMMMMMMMMMMM", fila(0));
    std::string ses65 = "SES " + std::string(27, 'G') + "|" + std::string(29, 'N') + "|1/2";
    AFIRMA_INT(65, ses65.size());
    pc(ses65 + "\n");
    avanzar(100);
    AFIRMA_STR("MMMMMMMMMMMMMMMM", fila(0));         // la de 65 no cambió nada
}

PRUEBA(basura_y_comandos_ajenos_no_generan_salida_ni_cambian_nada) {
    estacionConectada();
    pc("SES 3N|Redes|1/2\n");
    avanzar(100);
    const char* ajenos[] = {"REBOOT", "CLOSE", "CERRAR SESION", "AT+RST", "GET / HTTP/1.1", "ping", "SES=1", "RES OKAY",
                            "RES", "SES a|b", "SES a|b|x/y", "HELLO estacion-aula 1.0", "UID 04A1B2C3", "BTN", "PONG"};
    for (size_t i = 0; i < sizeof(ajenos) / sizeof(ajenos[0]); i++) {
        pc(std::string(ajenos[i]) + "\n");
        avanzar(20);
    }
    uint32_t semilla = 99;
    for (int i = 0; i < 5000; i++) {                  // ruido con bytes altos y saltos de línea
        semilla = semilla * 1664525UL + 1013904223UL;
        uint8_t b = (uint8_t)(0x80 | (semilla >> 24));
        if (i % 30 == 0) b = '\n';
        M().rx.push_back(b);
        if (i % 64 == 0) avanzar(1);
    }
    avanzar(200);
    AFIRMA_INT(0, tx().size());
    AFIRMA_STR("Redes", fila(0));
    AFIRMA(!encendido(P_VERDE) && !encendido(P_ROJO));
}

PRUEBA(avalancha_de_bytes_no_deja_sin_atender_al_lector) {
    estacionConectada();
    sim::acercarTarjeta("04A1B2C3");
    for (int i = 0; i < 20000; i++) M().rx.push_back('x');   // 20 KB sin salto de línea
    avanzar(400);
    std::vector<std::string> t = tx();
    AFIRMA_INT(1, t.size());                                  // el UID salió pese al ruido
    AFIRMA_STR("UID 04A1B2C3", t[0]);
}

// -------------------------------------------------------------------- botón
PRUEBA(boton_cambia_de_pagina_y_avisa_btn_sin_mas_efectos) {
    estacionConectada();
    pc("SES 3N|Redes|1/2\n");
    avanzar(100);
    AFIRMA_STR("Redes", fila(0));
    pulsar(100);
    AFIRMA_STR("Ultima lectura", fila(0));
    pulsar(100);
    AFIRMA_STR("PC:OK RC522:OK", fila(0));
    pulsar(100);
    AFIRMA_STR("Redes", fila(0));
    std::vector<std::string> t = tx();
    AFIRMA_INT(3, t.size());
    for (size_t i = 0; i < t.size(); i++) AFIRMA_STR("BTN", t[i]);   // y nada más (jamás un "cerrar")
}

PRUEBA(boton_rebotes_y_pulsaciones_muy_cortas_no_cuentan) {
    estacionConectada();
    M().botonPulsado = true;  avanzar(10);           // 10 ms: ruido
    M().botonPulsado = false; avanzar(100);
    for (int i = 0; i < 8; i++) {                    // rebote de 5 ms
        M().botonPulsado = !M().botonPulsado;
        avanzar(5);
    }
    M().botonPulsado = false;
    avanzar(100);
    AFIRMA_INT(0, tx().size());
    pulsar(3000);                                    // mantener pulsado: una sola pulsación
    AFIRMA_INT(1, tx().size());
}

PRUEBA(boton_pulsado_al_encender_no_cuenta) {
    sim::reiniciarMundo();
    M().ms = 1000;
    M().botonPulsado = true;
    setup();
    avanzar(2000);
    std::vector<std::string> t = tx();
    AFIRMA_INT(1, t.size());                         // solo el HELLO
    AFIRMA_STR("HELLO estacion-aula 1.0", t[0]);
}

PRUEBA(pagina_de_ultima_lectura_muestra_el_uid) {
    estacionConectada();
    pasarTarjeta("04A1B2C3");
    tx();
    pc("RES OK Ana\n");
    avanzar(2500);
    pulsar(100);
    AFIRMA_STR("Ultima lectura", fila(0));
    AFIRMA_STR("UID 04A1B2C3", fila(1));
    pulsar(100);
    AFIRMA_STR("Lecturas: 1", fila(1));
}

// ------------------------------------------------- dispositivos ausentes
PRUEBA(lcd_en_la_direccion_0x3F) {
    sim::reiniciarMundo();
    M().i2c.clear();
    M().i2c.insert(0x3F);
    M().ms = 1000;
    setup();
    avanzar(200);
    AFIRMA_STR("SUSAN Estacion", fila(0, 0x3F));
    AFIRMA(!M().lcd[0x27].inicializado);
    AFIRMA_INT(0, M().initEnDireccionAusente);
}

PRUEBA(sin_lcd_la_estacion_sigue_atendiendo_la_pc_y_las_tarjetas) {
    sim::reiniciarMundo();
    M().i2c.clear();
    M().ms = 1000;
    setup();
    avanzar(1200);
    tx();
    pc("PING\n");
    avanzar(5);
    AFIRMA_INT(1, tx().size());
    pasarTarjeta("04A1B2C3");
    std::vector<std::string> t = tx();
    AFIRMA_INT(1, t.size());
    pc("RES OK Ana\n");
    avanzar(60);
    AFIRMA(encendido(P_VERDE));                      // LED y zumbador siguen funcionando
    AFIRMA_INT(0, M().initEnDireccionAusente);
}

PRUEBA(si_el_lcd_aparece_despues_se_inicializa_en_el_mantenimiento) {
    sim::reiniciarMundo();
    M().i2c.clear();
    M().ms = 1000;
    setup();
    avanzar(2000);
    M().i2c.insert(0x27);
    avanzar(6000);
    AFIRMA(M().lcd[0x27].inicializado);
    AFIRMA_STR("Esperando PC...", fila(0));
}

PRUEBA(lector_sin_respuesta_avisa_con_led_rojo_y_pagina_2_y_se_recupera) {
    sim::reiniciarMundo();
    M().versionRc522 = 0x00;                         // el bus SPI no contesta
    M().ms = 1000;
    setup();
    avanzar(1200);
    tx();
    pc("PING\n");
    avanzar(5);
    tx();
    sim::acercarTarjeta("04A1B2C3");
    avanzar(1000);
    AFIRMA_INT(0, tx().size());                      // sin lector no hay lecturas
    const uint64_t t0 = M().ms;
    avanzar(4000);
    pc("PING\n");
    avanzar(5);
    tx();
    AFIRMA(cambios(P_ROJO, t0, M().ms) >= 2);        // rojo lento
    pulsar(100);
    pulsar(100);
    AFIRMA_STR("PC:OK RC522:ERR", fila(0));
    // El cableado se arregla: el mantenimiento (cada 5 s) lo reintenta.
    M().versionRc522 = 0x92;
    avanzar(6000);
    pc("PING\n");
    avanzar(300);
    std::vector<std::string> t = tx();
    bool hayUid = false;
    for (size_t i = 0; i < t.size(); i++) hayUid = hayUid || t[i] == "UID 04A1B2C3";
    AFIRMA(hayUid);
}

PRUEBA(lector_que_se_desconecta_se_detecta_en_el_mantenimiento) {
    estacionConectada();
    pulsar(100);
    pulsar(100);
    AFIRMA_STR("PC:OK RC522:OK", fila(0));
    M().versionRc522 = 0xFF;                         // cable suelto
    for (int i = 0; i < 4; i++) { avanzar(2500); pc("PING\n"); }
    AFIRMA_STR("PC:OK RC522:ERR", fila(0));
}

// ------------------------------------------------------- vuelta de millis()
PRUEBA(todo_funciona_al_cruzar_la_vuelta_de_millis) {
    arrancar(0xFFFFFFFFULL - 3000);                  // el contador de 32 bits da la vuelta a los 3 s
    avanzar(1200);
    tx();
    pc("PING\n");
    avanzar(5);
    AFIRMA_INT(1, tx().size());
    pc("SES 3N|Redes|1/2\n");
    avanzar(2500);                                   // cruza el cero
    pasarTarjeta("04A1B2C3");
    AFIRMA_INT(1, tx().size());
    pc("RES OK Ana\n");
    avanzar(60);
    AFIRMA(encendido(P_VERDE));
    avanzar(2000);
    AFIRMA(!encendido(P_VERDE));
    pc("PING\n");
    avanzar(20000);
    AFIRMA_STR("Redes", fila(0));                    // aún conectada tras 20 s
    avanzar(11000);
    AFIRMA_STR("Sin conexion", fila(0));
}

int main() {
    return mt::ejecutar("Escenarios del sketch estacion_aula.ino con hardware simulado", true);
}
