// estacion_aula.ino - Estación de aula SUSAN (Arduino UNO R3, 5 V)
//
// Para qué sirve: en SUSAN no se reconoce ningún rostro sin consentimiento
// vigente (RN-13, RNF-06). Al alumno sin consentimiento, o cuando la cámara del
// aula falla, se le pasa lista de otra forma: con una tarjeta RFID personal que
// acerca al lector del escritorio. Esta estación solo LEE el UID de la tarjeta y
// se lo manda al equipo del docente por USB; ahí (puente/puente-serial.mjs) se
// decide si el alumno se registra. La estación NUNCA cierra una sesión: cerrarla
// exige la autenticación del docente en la aplicación web.
//
// Diseño del firmware:
//  - Sin delay() en loop(): una máquina de estados con millis() atiende serie,
//    botón, lector, LED, zumbador y pantalla en cada vuelta.
//  - Toda la lógica que se puede decidir sin hardware está en protocolo.h (y se
//    prueba en el PC, ver ../pruebas). Este archivo solo conecta esa lógica con
//    los pines y las librerías MFRC522 y LiquidCrystal_I2C.
//  - Los búferes tienen tamaño fijo; una línea de más de 64 bytes se descarta
//    completa y nunca se interpreta.
//  - Límite conocido: las llamadas internas de la librería MFRC522 esperan hasta
//    ~25-40 ms cuando no hay tarjeta, y escribir 16 caracteres en el LCD por I2C
//    toma ~40 ms. Por eso el sondeo del lector va a 10 Hz y la pantalla solo se
//    reescribe cuando una fila cambia.
//
// Librerías (Administrador de bibliotecas): "MFRC522" de GithubCommunity
// (miguelbalboa/rfid) y "LiquidCrystal I2C" de Frank de Brabander. Requiere el
// núcleo "Arduino AVR Boards" (probado compilando con la 1.8.6; usa
// Wire.setWireTimeout, que no existe en núcleos muy antiguos).

#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h>

#include "protocolo.h"

// ------------------------------------------------------------------- pines
// SPI de hardware del UNO: SCK=D13, MOSI=D11, MISO=D12 (no se pueden mover).
// SS y RST van al MFRC522 a través de divisores 1k/2k (ver circuito/).
const uint8_t PIN_BOTON = 2;       // al GND; INPUT_PULLUP interno
const uint8_t PIN_LED_VERDE = 5;   // 220 ohm en serie
const uint8_t PIN_LED_AMBAR = 6;
const uint8_t PIN_LED_ROJO = 7;
const uint8_t PIN_ZUMBADOR = 8;    // 100 ohm en serie
const uint8_t PIN_RST = 9;         // MFRC522 RST, por divisor
const uint8_t PIN_SS = 10;         // MFRC522 SDA/SS, por divisor

// 0 = zumbador pasivo (se maneja con tone()); 1 = zumbador activo (nivel fijo).
#define ZUMBADOR_ACTIVO 0

const uint8_t DIR_LCD_1 = 0x27;    // PCF8574
const uint8_t DIR_LCD_2 = 0x3F;    // PCF8574A

// Ritmos del ciclo principal (ms).
const proto::ms_t SONDEO_LECTOR_MS = 100;
const proto::ms_t REDIBUJO_MS = 50;
const proto::ms_t MANTENIMIENTO_MS = 5000;
const proto::ms_t REFRESCO_LCD_MS = 10000;
const uint8_t MAX_BYTES_POR_VUELTA = 64;

// --------------------------------------------------------------- estado
MFRC522 lector(PIN_SS, PIN_RST);
LiquidCrystal_I2C lcdA(DIR_LCD_1, proto::COLS, 2);
LiquidCrystal_I2C lcdB(DIR_LCD_2, proto::COLS, 2);
LiquidCrystal_I2C* lcd = nullptr;  // nullptr = sin pantalla; la estación sigue funcionando

proto::EnsambladorLinea entrada;
proto::Modelo modelo;
proto::FiltroUid filtro;
proto::Pulsador boton;
proto::Secuenciador pitidos;

bool lectorOk = false;
bool huboRx = false;               // ¿ya llegó algún comando válido de la PC?
proto::ms_t ultimoRx = 0;
proto::ms_t arranque = 0;
proto::EstadoEnlace enlace = proto::ENLACE_ESPERANDO;

bool esperandoRes = false;         // se envió un UID y falta la respuesta
proto::ms_t tEnvio = 0;

bool efectoActivo = false;
proto::Evento efectoEv = proto::EV_ARRANQUE;
proto::Efecto efectoDef;
proto::ms_t efectoT0 = 0;
char efectoTexto[proto::COLS + 1];

proto::ms_t tSondeo = 0;
proto::ms_t tRedibujo = 0;
proto::ms_t tMantenimiento = 0;
proto::ms_t tRefresco = 0;
char mostrado[2][proto::COLS + 1];  // lo que hay escrito en el LCD
uint8_t mascaraLeds = 0xFF;         // 0xFF = aún no se ha escrito ninguna salida

// ------------------------------------------------------------ utilidades
void enviarLinea(const char* texto) {
    Serial.print(texto);
    Serial.print('\n');
}

// Apaga o enciende el zumbador sin bloquear. Con el pasivo, tone() usa Timer2
// (no se usa analogWrite en D3/D11, así que no choca con MOSI).
void sonar(uint16_t hz) {
#if ZUMBADOR_ACTIVO
    digitalWrite(PIN_ZUMBADOR, hz ? HIGH : LOW);
#else
    if (hz) {
        tone(PIN_ZUMBADOR, hz);
    } else {
        noTone(PIN_ZUMBADOR);
    }
#endif
}

void escribirLeds(uint8_t mascara) {
    if (mascara == mascaraLeds) {
        return;
    }
    mascaraLeds = mascara;
    digitalWrite(PIN_LED_VERDE, (mascara & proto::LED_VERDE) ? HIGH : LOW);
    digitalWrite(PIN_LED_AMBAR, (mascara & proto::LED_AMBAR) ? HIGH : LOW);
    digitalWrite(PIN_LED_ROJO, (mascara & proto::LED_ROJO) ? HIGH : LOW);
}

// ------------------------------------------------------------- dispositivos
bool dispositivoI2cResponde(uint8_t direccion) {
    Wire.beginTransmission(direccion);
    return Wire.endTransmission() == 0;
}

// Busca el LCD en 0x27 y, si no, en 0x3F (según el chip de la mochila I2C).
void iniciarPantalla() {
    LiquidCrystal_I2C* candidato = nullptr;
    if (dispositivoI2cResponde(DIR_LCD_1)) {
        candidato = &lcdA;
    } else if (dispositivoI2cResponde(DIR_LCD_2)) {
        candidato = &lcdB;
    }
    if (candidato == nullptr) {
        lcd = nullptr;
        return;
    }
    candidato->init();
    candidato->backlight();
    candidato->clear();
    lcd = candidato;
    mostrado[0][0] = '\0';  // fuerza el primer dibujo completo
    mostrado[1][0] = '\0';
}

void iniciarLector() {
    lector.PCD_Init();
    lectorOk = proto::lectorPareceVivo(lector.PCD_ReadRegister(MFRC522::VersionReg));
    modelo.lectorOk = lectorOk;
}

// ------------------------------------------------------------------ efectos
void iniciarEvento(proto::Evento ev, const char* texto, proto::ms_t ahora) {
    proto::Efecto def;
    if (!proto::efectoPara(ev, def)) {
        return;
    }
    efectoActivo = true;
    efectoEv = ev;
    efectoDef = def;
    efectoT0 = ahora;
    proto::ajustar(texto ? texto : "", efectoTexto, proto::COLS);
    // Sin secuencia (nPasos = 0), iniciar() corta el pitido que estuviera sonando.
    pitidos.iniciar(def.pitido, def.nPasos, ahora);
}

void avanzarEfectos(proto::ms_t ahora) {
    uint16_t hz = 0;
    if (pitidos.actualizar(ahora, hz)) {
        sonar(hz);
    }
    if (efectoActivo && (proto::ms_t)(ahora - efectoT0) >= efectoDef.duracionMs) {
        efectoActivo = false;
    }
    uint8_t mascara = 0;
    if (efectoActivo) {
        if (proto::ledEncendido(efectoDef, (proto::ms_t)(ahora - efectoT0))) {
            mascara = efectoDef.leds;
        }
    } else if (enlace == proto::ENLACE_PERDIDO && proto::parpadeoLento(ahora)) {
        mascara = proto::LED_AMBAR;  // "sin conexión": ámbar intermitente lento
    } else if (!lectorOk && proto::parpadeoLento(ahora + proto::PARPADEO_LENTO_MS / 2)) {
        // Lector RFID sin respuesta (cableado, divisores, alimentación): rojo lento,
        // desfasado del ámbar para que ambos fallos se distingan si coinciden.
        mascara = proto::LED_ROJO;
    }
    escribirLeds(mascara);
}

// ----------------------------------------------------------------- pantalla
void dibujar(proto::ms_t ahora) {
    if (lcd == nullptr || (proto::ms_t)(ahora - tRedibujo) < REDIBUJO_MS) {
        return;
    }
    tRedibujo = ahora;
    proto::Pantalla p;
    if (efectoActivo) {
        proto::pantallaEvento(efectoEv, efectoTexto, p);
    } else {
        proto::pantallaPagina(modelo, enlace, p);
    }
    for (uint8_t fila = 0; fila < 2; fila++) {
        if (strcmp(p.fila[fila], mostrado[fila]) != 0) {
            lcd->setCursor(0, fila);
            lcd->print(p.fila[fila]);
            strcpy(mostrado[fila], p.fila[fila]);
        }
    }
}

// ------------------------------------------------------------------- serie
void procesarLinea(const char* linea, proto::ms_t ahora) {
    proto::Comando c;
    if (!proto::analizar(linea, c)) {
        return;  // desconocida o mal formada: se ignora sin efecto alguno
    }
    huboRx = true;
    ultimoRx = ahora;  // solo un comando reconocido cuenta como "la PC sigue ahí"
    switch (c.tipo) {
        case proto::CMD_PING:
            enviarLinea(proto::PONG);
            break;
        case proto::CMD_SES:
            proto::aplicarSes(c, modelo.sesion);
            break;
        default: {
            proto::Evento ev;
            if (proto::eventoDe(c.tipo, ev)) {
                esperandoRes = false;
                iniciarEvento(ev, c.texto1, ahora);
            }
            break;
        }
    }
}

void leerSerie(proto::ms_t ahora) {
    // Tope por vuelta: así una avalancha de bytes no deja sin atender al lector.
    for (uint8_t i = 0; i < MAX_BYTES_POR_VUELTA && Serial.available() > 0; i++) {
        if (entrada.alimentar((uint8_t)Serial.read())) {
            procesarLinea(entrada.buffer(), ahora);
        }
    }
}

// ------------------------------------------------------------------- botón
void atenderBoton(proto::ms_t ahora) {
    if (boton.actualizar(digitalRead(PIN_BOTON) == LOW, ahora)) {
        modelo.pagina = (uint8_t)((modelo.pagina + 1) % proto::PAGINAS);
        enviarLinea(proto::BTN);  // solo informa; el botón no cierra sesiones
    }
}

// ------------------------------------------------------------------ lector
void tratarUid(const uint8_t* bytes, uint8_t n, proto::ms_t ahora) {
    char linea[4 + 2 * proto::MAX_UID_BYTES + 1];
    if (!proto::armarLineaUid(bytes, n, linea, sizeof(linea))) {
        return;
    }
    const char* hex = linea + 4;
    if (!filtro.aceptar(hex, ahora)) {
        return;  // rebote o tarjeta que sigue puesta: no cuenta
    }
    strcpy(modelo.ultimoUid, hex);
    if (modelo.lecturas < 65535) {
        modelo.lecturas++;
    }
    enviarLinea(linea);
    esperandoRes = true;
    tEnvio = ahora;
    iniciarEvento(proto::EV_LEYENDO, "", ahora);
}

void atenderLector(proto::ms_t ahora) {
    if (!lectorOk || (proto::ms_t)(ahora - tSondeo) < SONDEO_LECTOR_MS) {
        return;
    }
    tSondeo = ahora;
    bool presente = false;
    if (lector.PICC_IsNewCardPresent()) {
        presente = true;
        if (lector.PICC_ReadCardSerial()) {
            tratarUid(lector.uid.uidByte, lector.uid.size, ahora);
        }
        // HALT: la tarjeta deja de contestar a REQA hasta que se retire, de modo
        // que una tarjeta olvidada sobre el lector no genera lecturas repetidas.
        lector.PICC_HaltA();
        lector.PCD_StopCrypto1();
    } else if (filtro.esperandoRetiro()) {
        // Una tarjeta en HALT es invisible para REQA. Para saber si SIGUE ahí se
        // usa WUPA (que sí despierta a las detenidas) y se vuelve a detener.
        byte atqa[2];
        byte tam = sizeof(atqa);
        const MFRC522::StatusCode r = lector.PICC_WakeupA(atqa, &tam);
        presente = (r == MFRC522::STATUS_OK || r == MFRC522::STATUS_COLLISION);
        if (presente) {
            lector.PICC_HaltA();
        }
    }
    filtro.sondeo(presente);
}

// --------------------------------------------------------- mantenimiento
// Cada 5 s: reintenta el lector o el LCD si faltaban y comprueba que el lector
// siga contestando por SPI (un cable suelto no debe dejar la estación "muda"
// sin avisar). Cada 10 s se reescribe el LCD por si una descarga lo desordenó.
void mantenimiento(proto::ms_t ahora) {
    if ((proto::ms_t)(ahora - tMantenimiento) >= MANTENIMIENTO_MS) {
        tMantenimiento = ahora;
        if (!lectorOk) {
            iniciarLector();
        } else if (!proto::lectorPareceVivo(lector.PCD_ReadRegister(MFRC522::VersionReg))) {
            lectorOk = false;
            modelo.lectorOk = false;
        }
        if (lcd == nullptr) {
            iniciarPantalla();
        }
    }
    if ((proto::ms_t)(ahora - tRefresco) >= REFRESCO_LCD_MS) {
        tRefresco = ahora;
        mostrado[0][0] = '\0';
        mostrado[1][0] = '\0';
    }
}

// ---------------------------------------------------------------- arduino
void setup() {
    pinMode(PIN_BOTON, INPUT_PULLUP);
    pinMode(PIN_LED_VERDE, OUTPUT);
    pinMode(PIN_LED_AMBAR, OUTPUT);
    pinMode(PIN_LED_ROJO, OUTPUT);
    pinMode(PIN_ZUMBADOR, OUTPUT);
    escribirLeds(0);

    Serial.begin(proto::BAUDIOS);
    SPI.begin();
    Wire.begin();
    Wire.setWireTimeout(25000UL, true);  // un bus I2C bloqueado no cuelga la estación

    proto::modeloInicial(modelo);
    mostrado[0][0] = '\0';
    mostrado[1][0] = '\0';
    efectoTexto[0] = '\0';

    iniciarPantalla();
    iniciarLector();

    const proto::ms_t ahora = millis();
    arranque = ahora;
    ultimoRx = ahora;
    tSondeo = ahora;
    tRedibujo = ahora;
    tMantenimiento = ahora;
    tRefresco = ahora;
    boton.reiniciar(digitalRead(PIN_BOTON) == LOW, ahora);
    iniciarEvento(proto::EV_ARRANQUE, "", ahora);

    // Al final de setup(): al abrir el puerto el UNO se reinicia (DTR) y este
    // HELLO le avisa a la PC que ya puede enviar la sesión.
    enviarLinea(proto::HELLO);
}

void loop() {
    const proto::ms_t ahora = millis();
    enlace = proto::estadoEnlace(huboRx, ahora, ultimoRx, arranque);
    leerSerie(ahora);
    atenderBoton(ahora);
    atenderLector(ahora);
    if (esperandoRes && proto::respuestaVencida(ahora, tEnvio)) {
        esperandoRes = false;  // la PC no contestó: se avisa localmente
        iniciarEvento(proto::EV_ERR, "Sin respuesta", ahora);
    }
    avanzarEfectos(ahora);
    mantenimiento(ahora);
    dibujar(ahora);
}
