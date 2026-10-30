// protocolo.h - Lógica pura de la Estación de aula SUSAN.
//
// Aquí vive TODO lo que se puede decidir sin tocar hardware: ensamblado de
// líneas, análisis de comandos, ajuste de texto a 16 columnas, formato del UID,
// reglas de antirrebote y de tiempo de espera, y el armado de las pantallas.
// No incluye Arduino.h, no conoce pines ni Serial, de modo que compila igual en
// un PC (g++, para las pruebas del directorio ../pruebas) y en el UNO (avr-g++).
// Así lo importante se prueba en el host y el .ino se queda en pegamento de E/S.
//
// Compatibilidad: C++11 (el estándar que usa avr-gcc 7.3 en el IDE de Arduino),
// sin STL, sin memoria dinámica y con búferes de tamaño fijo.

#ifndef SUSAN_PROTOCOLO_H
#define SUSAN_PROTOCOLO_H

#include <stdint.h>
#include <string.h>

namespace proto {

// El tiempo se compara siempre en 32 bits sin signo: millis() da la vuelta a los
// ~49,7 días y la resta modular sigue siendo correcta. En el host (donde
// unsigned long mide 64 bits) esto fuerza el mismo comportamiento que en el UNO.
typedef uint32_t ms_t;

// ---------------------------------------------------------------- constantes
static const uint32_t BAUDIOS = 115200UL;   // 8N1
static const uint8_t MAX_LINEA = 64;         // bytes de contenido, sin el '\n'
static const uint8_t COLS = 16;              // columnas del LCD 16x2
static const uint8_t MAX_UID_BYTES = 10;     // ISO 14443-A: 4, 7 o 10 bytes
static const uint8_t PAGINAS = 3;            // sesión, última lectura, estación

static const ms_t ANTIREBOTE_UID_MS = 2000;  // mismo UID: se ignora este tiempo
static const ms_t SILENCIO_PC_MS = 30000;    // sin tráfico válido de la PC
static const ms_t ESPERA_RES_MS = 3000;      // tiempo máximo para recibir RES
static const ms_t ANTIREBOTE_BOTON_MS = 30;  // señal estable del pulsador
static const ms_t PARPADEO_MS = 400;         // periodo del parpadeo rápido (ERR)
static const ms_t PARPADEO_LENTO_MS = 2000;  // periodo del ámbar "sin conexión"
static const uint8_t SONDEOS_AUSENCIA = 3;   // sondeos sin tarjeta = "retirada"

static const char HELLO[] = "HELLO estacion-aula 1.0";
static const char PONG[] = "PONG";
static const char BTN[] = "BTN";

// ----------------------------------------------------- texto: UTF-8 -> ASCII

// El LCD HD44780 solo garantiza ASCII (según la ROM trae o no acentos), así que
// todo se translitera. La tabla cubre U+00C0..U+00FF (segundo byte 0x80..0xBF de
// una secuencia que empieza en 0xC3); el índice es (byte - 0x80).
inline char latin1AAscii(uint8_t guia, uint8_t b) {
    static const char TABLA_C3[] =
        "AAAAAAACEEEEIIII"   // U+00C0..U+00CF
        "DNOOOOOxOUUUUYTs"   // U+00D0..U+00DF
        "aaaaaaaceeeeiiii"   // U+00E0..U+00EF
        "dnooooo/ouuuuyty";  // U+00F0..U+00FF
    if (guia == 0xC3 && b >= 0x80 && b <= 0xBF) {
        return TABLA_C3[b - 0x80];
    }
    if (guia == 0xC2) {
        switch (b) {
            case 0xA0: return ' ';   // espacio duro
            case 0xA1: return '!';   // signo de apertura de admiración
            case 0xAA: return 'a';   // ordinal femenino
            case 0xB0: return 'o';   // grado: "3° N" -> "3o N"
            case 0xBA: return 'o';   // ordinal masculino
            case 0xBF: return '?';   // signo de apertura de interrogación
            default: break;
        }
    }
    return '?';
}

// Copia a `dst` como máximo `cols` caracteres ASCII imprimibles (más el NUL),
// transliterando UTF-8 y quitando espacios al inicio y al final. `src` no
// necesita NUL: se usan exactamente `n` bytes. Devuelve la longitud resultante.
// Un solo '?' sustituye a cada carácter que no se puede representar.
inline uint8_t ajustarN(const char* src, uint8_t n, char* dst, uint8_t cols) {
    uint8_t salida = 0;
    uint8_t i = 0;
    while (i < n && salida < cols) {
        const uint8_t b = (uint8_t)src[i];
        char c;
        if (b < 0x80) {
            c = (b >= 0x20 && b < 0x7F) ? (char)b : ' ';
            i++;
        } else if (b >= 0xC2 && b <= 0xDF) {
            // Secuencia de 2 bytes: solo se traduce si el segundo es válido.
            if (i + 1 < n && (((uint8_t)src[i + 1]) & 0xC0) == 0x80) {
                c = latin1AAscii(b, (uint8_t)src[i + 1]);
                i += 2;
            } else {
                c = '?';
                i++;
            }
        } else {
            // 3 o 4 bytes (o byte suelto/ISO-8859-1): un '?' y se saltan las
            // continuaciones para no producir uno por cada byte.
            c = '?';
            i++;
            if (b >= 0xE0 && b <= 0xF7) {
                uint8_t restantes = (b >= 0xF0) ? 3 : 2;
                while (restantes > 0 && i < n && (((uint8_t)src[i]) & 0xC0) == 0x80) {
                    i++;
                    restantes--;
                }
            }
        }
        if (salida == 0 && c == ' ') {
            continue;  // sin espacios al inicio
        }
        dst[salida++] = c;
    }
    while (salida > 0 && dst[salida - 1] == ' ') {
        salida--;  // sin espacios al final (también tras truncar)
    }
    dst[salida] = '\0';
    return salida;
}

inline uint8_t ajustar(const char* src, char* dst, uint8_t cols) {
    size_t n = src ? strlen(src) : 0;
    if (n > 255) {
        n = 255;
    }
    return ajustarN(src, (uint8_t)n, dst, cols);
}

// ----------------------------------------------------------- números y UID

// Escribe v en decimal (con NUL) y devuelve cuántos caracteres escribió.
// Se evita snprintf: en AVR agrega ~1 KB de flash sin necesidad.
inline uint8_t uintATexto(uint32_t v, char* out) {
    char t[11];
    uint8_t n = 0;
    do {
        t[n++] = (char)('0' + (v % 10));
        v /= 10;
    } while (v > 0);
    for (uint8_t i = 0; i < n; i++) {
        out[i] = t[n - 1 - i];
    }
    out[n] = '\0';
    return n;
}

// 1 a 5 dígitos decimales, valor <= 65535.
inline bool leerUint16(const char* s, size_t n, uint16_t& valor) {
    if (n == 0 || n > 5) {
        return false;
    }
    uint32_t v = 0;
    for (size_t i = 0; i < n; i++) {
        if (s[i] < '0' || s[i] > '9') {
            return false;
        }
        v = v * 10 + (uint32_t)(s[i] - '0');
    }
    if (v > 65535UL) {
        return false;
    }
    valor = (uint16_t)v;
    return true;
}

// UID a hexadecimal en mayúsculas y sin separadores. `out` necesita 2n+1 bytes.
inline uint8_t uidAHex(const uint8_t* bytes, uint8_t n, char* out) {
    // No se llama HEX porque Arduino.h define esa macro (base 16 de Print).
    static const char DIGITOS[] = "0123456789ABCDEF";
    for (uint8_t i = 0; i < n; i++) {
        out[2 * i] = DIGITOS[bytes[i] >> 4];
        out[2 * i + 1] = DIGITOS[bytes[i] & 0x0F];
    }
    out[2 * n] = '\0';
    return (uint8_t)(2 * n);
}

// Arma "UID <HEX>". Falla (false) si el tamaño no es 1..10 o no cabe en `cap`.
inline bool armarLineaUid(const uint8_t* bytes, uint8_t n, char* out, uint8_t cap) {
    if (n == 0 || n > MAX_UID_BYTES || cap < (uint8_t)(4 + 2 * n + 1)) {
        return false;
    }
    memcpy(out, "UID ", 4);
    uidAHex(bytes, n, out + 4);
    return true;
}

// El VersionReg del MFRC522 vale 0x91/0x92 en chips genuinos y otros valores en
// clones; 0x00 o 0xFF significan "el bus SPI no contesta" (cableado o divisores).
inline bool lectorPareceVivo(uint8_t version) {
    return version != 0x00 && version != 0xFF;
}

// ---------------------------------------------------- ensamblado de líneas

// Convierte el flujo de bytes del puerto serie en líneas completas. Cualquier
// línea de más de MAX_LINEA bytes, o con caracteres de control, se descarta
// ENTERA hasta el siguiente '\n': nunca se interpreta un trozo.
class EnsambladorLinea {
public:
    EnsambladorLinea() : n_(0), descartar_(false), listo_(false), desbordes_(0), invalidas_(0) {
        buf_[0] = '\0';
    }

    // Procesa un byte. Devuelve true cuando buffer() trae una línea completa y
    // válida; esa línea queda disponible hasta el siguiente byte que se alimente.
    bool alimentar(uint8_t c) {
        if (listo_) {
            reiniciar();
        }
        if (c == '\n') {
            const bool valida = !descartar_ && n_ > 0;
            if (valida) {
                buf_[n_] = '\0';
                listo_ = true;
                return true;
            }
            reiniciar();
            return false;
        }
        if (c == '\r') {
            return false;  // tolera terminadores CRLF
        }
        if (descartar_) {
            return false;
        }
        if (c < 0x20 || c == 0x7F) {
            descartar_ = true;
            if (invalidas_ < 255) {
                invalidas_++;
            }
            return false;
        }
        if (n_ >= MAX_LINEA) {
            descartar_ = true;
            if (desbordes_ < 255) {
                desbordes_++;
            }
            return false;
        }
        buf_[n_++] = (char)c;
        buf_[n_] = '\0';  // siempre terminado: buffer() nunca expone restos de otra línea
        return false;
    }

    const char* buffer() const { return buf_; }
    uint8_t desbordes() const { return desbordes_; }
    uint8_t invalidas() const { return invalidas_; }

private:
    void reiniciar() {
        n_ = 0;
        descartar_ = false;
        listo_ = false;
        buf_[0] = '\0';
    }

    char buf_[MAX_LINEA + 1];
    uint8_t n_;
    bool descartar_;
    bool listo_;
    uint8_t desbordes_;
    uint8_t invalidas_;
};

// ------------------------------------------------------------- comandos

enum Tipo : uint8_t {
    CMD_NINGUNO = 0,
    CMD_PING,
    CMD_SES,
    CMD_RES_OK,
    CMD_RES_DUP,
    CMD_RES_NOREG,
    CMD_RES_ERR
};

// SES: texto1 = grupo, texto2 = materia. RES: texto1 = texto opcional (nombre
// corto en OK/DUP, motivo en ERR). Todos los textos ya salen ajustados a 16 cols.
struct Comando {
    Tipo tipo;
    char texto1[COLS + 1];
    char texto2[COLS + 1];
    uint16_t presentes;
    uint16_t total;
};

inline bool empiezaCon(const char* s, const char* prefijo) {
    return strncmp(s, prefijo, strlen(prefijo)) == 0;
}

// Si `s` empieza con la palabra exacta `p` (seguida de fin o espacio) devuelve
// el puntero al resto sin espacios iniciales; si no, NULL. "RES OKAY" no es OK.
inline const char* despuesDePalabra(const char* s, const char* p) {
    const size_t n = strlen(p);
    if (strncmp(s, p, n) != 0 || (s[n] != '\0' && s[n] != ' ')) {
        return 0;
    }
    s += n;
    while (*s == ' ') {
        s++;
    }
    return s;
}

inline bool analizarSes(const char* r, Comando& c) {
    const char* b1 = strchr(r, '|');
    if (!b1) {
        return false;
    }
    const char* b2 = strchr(b1 + 1, '|');
    if (!b2 || strchr(b2 + 1, '|')) {
        return false;  // exactamente tres campos
    }
    const char* f3 = b2 + 1;
    const char* barra = strchr(f3, '/');
    if (!barra) {
        return false;
    }
    uint16_t pres = 0;
    uint16_t tot = 0;
    if (!leerUint16(f3, (size_t)(barra - f3), pres) ||
        !leerUint16(barra + 1, strlen(barra + 1), tot)) {
        return false;
    }
    ajustarN(r, (uint8_t)(b1 - r), c.texto1, COLS);
    ajustarN(b1 + 1, (uint8_t)(b2 - b1 - 1), c.texto2, COLS);
    c.presentes = pres;
    c.total = tot;
    c.tipo = CMD_SES;
    return true;
}

inline bool analizarRes(const char* r, Comando& c) {
    static const char* const PALABRAS[] = {"OK", "DUP", "NOREG", "ERR"};
    static const Tipo TIPOS[] = {CMD_RES_OK, CMD_RES_DUP, CMD_RES_NOREG, CMD_RES_ERR};
    for (uint8_t i = 0; i < 4; i++) {
        const char* resto = despuesDePalabra(r, PALABRAS[i]);
        if (resto) {
            ajustar(resto, c.texto1, COLS);
            c.tipo = TIPOS[i];
            return true;
        }
    }
    return false;
}

// Interpreta una línea ya ensamblada. Devuelve true si es un comando conocido y
// bien formado; en cualquier otro caso devuelve false y la línea se ignora.
inline bool analizar(const char* linea, Comando& c) {
    c.tipo = CMD_NINGUNO;
    c.texto1[0] = '\0';
    c.texto2[0] = '\0';
    c.presentes = 0;
    c.total = 0;
    if (!linea) {
        return false;
    }
    size_t n = strlen(linea);
    if (n == 0 || n > MAX_LINEA) {
        return false;
    }
    char l[MAX_LINEA + 1];
    memcpy(l, linea, n + 1);
    while (n > 0 && l[n - 1] == ' ') {
        l[--n] = '\0';
    }
    if (n == 0) {
        return false;
    }
    if (strcmp(l, "PING") == 0) {
        c.tipo = CMD_PING;
        return true;
    }
    if (empiezaCon(l, "SES ")) {
        return analizarSes(l + 4, c);
    }
    if (empiezaCon(l, "RES ")) {
        return analizarRes(l + 4, c);
    }
    return false;
}

// ---------------------------------------------------------- sesión y modelo

struct Sesion {
    bool abierta;
    char grupo[COLS + 1];
    char materia[COLS + 1];
    uint16_t presentes;
    uint16_t total;
};

inline void sesionVacia(Sesion& s) {
    s.abierta = false;
    s.grupo[0] = '\0';
    s.materia[0] = '\0';
    s.presentes = 0;
    s.total = 0;
}

// "SES ||0/0" (grupo y materia vacíos) significa que no hay sesión abierta.
inline void aplicarSes(const Comando& c, Sesion& s) {
    strcpy(s.grupo, c.texto1);
    strcpy(s.materia, c.texto2);
    s.presentes = c.presentes;
    s.total = c.total;
    s.abierta = (c.texto1[0] != '\0' || c.texto2[0] != '\0');
}

struct Modelo {
    Sesion sesion;
    char ultimoUid[2 * MAX_UID_BYTES + 1];
    uint16_t lecturas;
    bool lectorOk;
    uint8_t pagina;
};

inline void modeloInicial(Modelo& m) {
    sesionVacia(m.sesion);
    m.ultimoUid[0] = '\0';
    m.lecturas = 0;
    m.lectorOk = false;
    m.pagina = 0;
}

// ------------------------------------------------------------------- enlace

enum EstadoEnlace : uint8_t { ENLACE_ESPERANDO = 0, ENLACE_OK, ENLACE_PERDIDO };

// Regla de los 30 s. `huboRx` es false hasta el primer comando válido de la PC;
// mientras tanto se cuenta desde `arranque`. El límite es inclusivo: a los
// 30 000 ms exactos el enlace ya se considera perdido.
inline EstadoEnlace estadoEnlace(bool huboRx, ms_t ahora, ms_t ultimoRx, ms_t arranque) {
    if (huboRx) {
        return (ms_t)(ahora - ultimoRx) < SILENCIO_PC_MS ? ENLACE_OK : ENLACE_PERDIDO;
    }
    return (ms_t)(ahora - arranque) < SILENCIO_PC_MS ? ENLACE_ESPERANDO : ENLACE_PERDIDO;
}

inline bool respuestaVencida(ms_t ahora, ms_t enviado) {
    return (ms_t)(ahora - enviado) >= ESPERA_RES_MS;
}

// Ámbar lento de "Sin conexion": 500 ms encendido de cada 2 s.
inline bool parpadeoLento(ms_t ahora) {
    return (ahora % PARPADEO_LENTO_MS) < 500;
}

// ---------------------------------------------- antirrebote de tarjetas (UID)

// Dos reglas combinadas, ambas del diseño:
//  1) el mismo UID se ignora si la lectura anterior fue hace menos de 2 s;
//  2) una tarjeta debe retirarse (>= SONDEOS_AUSENCIA sondeos seguidos sin
//     verla) antes de que su siguiente lectura cuente.
// Un UID distinto se acepta de inmediato. El firmware alimenta sondeo() en cada
// ciclo del lector; esta clase no sabe nada de SPI.
class FiltroUid {
public:
    FiltroUid() : hay_(false), retirada_(true), t_(0), ausencias_(0) { ultimo_[0] = '\0'; }

    bool aceptar(const char* uid, ms_t ahora) {
        if (hay_ && strcmp(uid, ultimo_) == 0) {
            if (!retirada_ || (ms_t)(ahora - t_) < ANTIREBOTE_UID_MS) {
                return false;
            }
        }
        strncpy(ultimo_, uid, sizeof(ultimo_) - 1);
        ultimo_[sizeof(ultimo_) - 1] = '\0';
        hay_ = true;
        retirada_ = false;
        ausencias_ = 0;
        t_ = ahora;
        return true;
    }

    // `presente`: el lector vio alguna tarjeta en este sondeo.
    void sondeo(bool presente) {
        if (presente) {
            ausencias_ = 0;
            return;
        }
        if (ausencias_ < 255) {
            ausencias_++;
        }
        if (ausencias_ >= SONDEOS_AUSENCIA) {
            retirada_ = true;
        }
    }

    // Verdadero mientras la última tarjeta aceptada siga sin retirarse: el
    // firmware usa esto para seguir buscándola con WUPA aunque esté en HALT.
    bool esperandoRetiro() const { return hay_ && !retirada_; }

private:
    char ultimo_[2 * MAX_UID_BYTES + 1];
    bool hay_;
    bool retirada_;
    ms_t t_;
    uint8_t ausencias_;
};

// ------------------------------------------------------------- pulsador

// Antirrebote por tiempo: el estado nuevo debe mantenerse ANTIREBOTE_BOTON_MS.
// actualizar() devuelve true UNA vez por pulsación (al confirmar que se pulsó).
class Pulsador {
public:
    Pulsador() : estable_(false), crudo_(false), t_(0) {}

    // Fija el estado de partida para que un botón ya pulsado al encender no
    // cuente como pulsación.
    void reiniciar(bool presionado, ms_t ahora) {
        estable_ = presionado;
        crudo_ = presionado;
        t_ = ahora;
    }

    bool actualizar(bool presionado, ms_t ahora) {
        if (presionado != crudo_) {
            crudo_ = presionado;
            t_ = ahora;
            return false;
        }
        if (crudo_ != estable_ && (ms_t)(ahora - t_) >= ANTIREBOTE_BOTON_MS) {
            estable_ = crudo_;
            return estable_;
        }
        return false;
    }

private:
    bool estable_;
    bool crudo_;
    ms_t t_;
};

// ------------------------------------------------------ efectos (LED+pitido)

enum Evento : uint8_t { EV_ARRANQUE = 0, EV_LEYENDO, EV_OK, EV_DUP, EV_NOREG, EV_ERR };

enum Led : uint8_t { LED_NINGUNO = 0, LED_VERDE = 1, LED_AMBAR = 2, LED_ROJO = 4 };

struct Paso {
    uint16_t hz;  // 0 = silencio
    uint16_t ms;
};

static const Paso PIT_ARRANQUE[] = {{1200, 80}, {0, 40}, {1800, 80}};
static const Paso PIT_OK[] = {{2200, 120}};
static const Paso PIT_DUP[] = {{1800, 80}, {0, 80}, {1800, 80}};
static const Paso PIT_NOREG[] = {{500, 600}};

struct Efecto {
    uint8_t leds;          // máscara de Led
    bool parpadeo;         // LED intermitentes (PARPADEO_MS)
    const Paso* pitido;    // secuencia de tonos o NULL
    uint8_t nPasos;
    ms_t duracionMs;       // cuánto dura el efecto en LED y pantalla
};

inline bool efectoPara(Evento ev, Efecto& e) {
    switch (ev) {
        case EV_ARRANQUE:
            e.leds = LED_VERDE | LED_AMBAR | LED_ROJO;
            e.parpadeo = false;
            e.pitido = PIT_ARRANQUE;
            e.nPasos = 3;
            e.duracionMs = 900;
            return true;
        case EV_LEYENDO:
            e.leds = LED_NINGUNO;
            e.parpadeo = false;
            e.pitido = 0;
            e.nPasos = 0;
            e.duracionMs = ESPERA_RES_MS;
            return true;
        case EV_OK:
            e.leds = LED_VERDE;
            e.parpadeo = false;
            e.pitido = PIT_OK;
            e.nPasos = 1;
            e.duracionMs = 2000;
            return true;
        case EV_DUP:
            e.leds = LED_AMBAR;
            e.parpadeo = false;
            e.pitido = PIT_DUP;
            e.nPasos = 3;
            e.duracionMs = 2000;
            return true;
        case EV_NOREG:
            e.leds = LED_ROJO;
            e.parpadeo = false;
            e.pitido = PIT_NOREG;
            e.nPasos = 1;
            e.duracionMs = 2000;
            return true;
        case EV_ERR:
            e.leds = LED_ROJO;
            e.parpadeo = true;
            e.pitido = 0;
            e.nPasos = 0;
            e.duracionMs = 2000;
            return true;
    }
    return false;
}

inline bool eventoDe(Tipo t, Evento& ev) {
    switch (t) {
        case CMD_RES_OK: ev = EV_OK; return true;
        case CMD_RES_DUP: ev = EV_DUP; return true;
        case CMD_RES_NOREG: ev = EV_NOREG; return true;
        case CMD_RES_ERR: ev = EV_ERR; return true;
        default: return false;
    }
}

// Con parpadeo: encendido durante la primera mitad de cada periodo.
inline bool ledEncendido(const Efecto& e, ms_t transcurrido) {
    if (!e.parpadeo) {
        return true;
    }
    return ((transcurrido / (PARPADEO_MS / 2)) % 2) == 0;
}

// Reproduce una secuencia de Paso sin bloquear: el firmware la consulta en cada
// ciclo y solo llama a tone()/noTone() cuando cambia el tono.
class Secuenciador {
public:
    Secuenciador() : pasos_(0), n_(0), i_(0), t_(0), activo_(false), nuevo_(false), silenciar_(false) {}

    void iniciar(const Paso* pasos, uint8_t n, ms_t ahora) {
        if (!pasos || n == 0) {
            detener();
            return;
        }
        pasos_ = pasos;
        n_ = n;
        i_ = 0;
        t_ = ahora;
        activo_ = true;
        nuevo_ = true;
        silenciar_ = false;
    }

    void detener() {
        if (activo_) {
            activo_ = false;
            silenciar_ = true;  // el siguiente actualizar() apaga el tono
        }
    }

    bool activo() const { return activo_; }

    // Devuelve true cuando hay que cambiar el tono; `hz` trae el nuevo (0 = off).
    bool actualizar(ms_t ahora, uint16_t& hz) {
        if (silenciar_) {
            silenciar_ = false;
            hz = 0;
            return true;
        }
        if (!activo_) {
            return false;
        }
        if (nuevo_) {
            nuevo_ = false;
            hz = pasos_[0].hz;
            return true;
        }
        if ((ms_t)(ahora - t_) < pasos_[i_].ms) {
            return false;
        }
        t_ += pasos_[i_].ms;  // acumula para no arrastrar error si el ciclo se atrasa
        i_++;
        if (i_ >= n_) {
            activo_ = false;
            hz = 0;
            return true;
        }
        hz = pasos_[i_].hz;
        return true;
    }

private:
    const Paso* pasos_;
    uint8_t n_;
    uint8_t i_;
    ms_t t_;
    bool activo_;
    bool nuevo_;
    bool silenciar_;
};

// ----------------------------------------------------------------- pantallas

struct Pantalla {
    char fila[2][COLS + 1];
};

inline void limpiarPantalla(Pantalla& p) {
    for (uint8_t r = 0; r < 2; r++) {
        memset(p.fila[r], ' ', COLS);
        p.fila[r][COLS] = '\0';
    }
}

// Escribe `txt` desde la columna `col`, recortando lo que no quepa.
inline void colocar(char* fila, uint8_t col, const char* txt) {
    for (; *txt && col < COLS; ++txt, ++col) {
        fila[col] = *txt;
    }
}

inline void colocarDerecha(char* fila, const char* txt) {
    const size_t n = strlen(txt);
    colocar(fila, n >= COLS ? 0 : (uint8_t)(COLS - n), txt);
}

// Página 0: sesión. Materia arriba; abajo el grupo a la izquierda y
// presentes/total a la derecha (al grupo se le recorta lo que no quepa).
inline void pantallaSesion(const Sesion& s, EstadoEnlace e, Pantalla& p) {
    limpiarPantalla(p);
    if (e == ENLACE_PERDIDO) {
        colocar(p.fila[0], 0, "Sin conexion");
        colocar(p.fila[1], 0, "con la PC");
        return;
    }
    if (e == ENLACE_ESPERANDO) {
        colocar(p.fila[0], 0, "Esperando PC...");
        colocar(p.fila[1], 0, "Conecte el USB");
        return;
    }
    if (!s.abierta) {
        colocar(p.fila[0], 0, "Sin sesion");
        colocar(p.fila[1], 0, "abierta");
        return;
    }
    char cuenta[12];
    uint8_t n = uintATexto(s.presentes, cuenta);
    cuenta[n++] = '/';
    uintATexto(s.total, cuenta + n);
    colocar(p.fila[0], 0, s.materia);
    colocarDerecha(p.fila[1], cuenta);
    // Reserva una columna de separación entre el grupo y la cuenta.
    const uint8_t anchoGrupo = (uint8_t)(COLS - strlen(cuenta) - 1);
    char grupo[COLS + 1];
    ajustar(s.grupo, grupo, anchoGrupo);
    colocar(p.fila[1], 0, grupo);
}

// Página 1: último UID leído (los primeros 16 caracteres si son más).
inline void pantallaUltima(const Modelo& m, Pantalla& p) {
    limpiarPantalla(p);
    colocar(p.fila[0], 0, "Ultima lectura");
    if (m.ultimoUid[0] == '\0') {
        colocar(p.fila[1], 0, "(ninguna)");
        return;
    }
    if (strlen(m.ultimoUid) <= (size_t)(COLS - 4)) {
        colocar(p.fila[1], 0, "UID ");
        colocar(p.fila[1], 4, m.ultimoUid);
    } else {
        colocar(p.fila[1], 0, m.ultimoUid);
    }
}

// Página 2: diagnóstico de la estación.
inline void pantallaEstacion(const Modelo& m, EstadoEnlace e, Pantalla& p) {
    limpiarPantalla(p);
    colocar(p.fila[0], 0, "PC:");
    colocar(p.fila[0], 3, e == ENLACE_OK ? "OK" : (e == ENLACE_ESPERANDO ? "--" : "NO"));
    colocar(p.fila[0], 6, "RC522:");
    colocar(p.fila[0], 12, m.lectorOk ? "OK" : "ERR");
    char cuenta[8];
    uintATexto(m.lecturas > 9999 ? 9999 : m.lecturas, cuenta);
    colocar(p.fila[1], 0, "Lecturas: ");
    colocar(p.fila[1], 10, cuenta);
}

inline void pantallaPagina(const Modelo& m, EstadoEnlace e, Pantalla& p) {
    switch (m.pagina % PAGINAS) {
        case 0: pantallaSesion(m.sesion, e, p); break;
        case 1: pantallaUltima(m, p); break;
        default: pantallaEstacion(m, e, p); break;
    }
}

// Pantalla de un evento (arranque, lectura en curso o resultado de la PC).
// `texto` ya viene ajustado a 16 columnas (o vacío).
inline void pantallaEvento(Evento ev, const char* texto, Pantalla& p) {
    limpiarPantalla(p);
    switch (ev) {
        case EV_ARRANQUE:
            colocar(p.fila[0], 0, "SUSAN Estacion");
            colocar(p.fila[1], 0, "v1.0 iniciando");
            break;
        case EV_LEYENDO:
            colocar(p.fila[0], 0, "Tarjeta leida");
            colocar(p.fila[1], 0, "Espere...");
            break;
        case EV_OK:
            colocar(p.fila[0], 0, "Registrado");
            colocar(p.fila[1], 0, texto);
            break;
        case EV_DUP:
            colocar(p.fila[0], 0, "Ya registrado");
            colocar(p.fila[1], 0, texto);
            break;
        case EV_NOREG:
            colocar(p.fila[0], 0, "Tarjeta no");
            colocar(p.fila[1], 0, "registrada");
            break;
        case EV_ERR:
            colocar(p.fila[0], 0, "Error");
            colocar(p.fila[1], 0, texto[0] ? texto : "del sistema");
            break;
    }
}

}  // namespace proto

#endif  // SUSAN_PROTOCOLO_H
