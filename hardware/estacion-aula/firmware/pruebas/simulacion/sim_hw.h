// sim_hw.h - Hardware SIMULADO para correr el sketch .ino real en el PC.
//
// Sustituye Arduino.h, SPI.h, Wire.h, MFRC522.h y LiquidCrystal_I2C.h por
// versiones mínimas que registran lo que el sketch hace con los pines, el
// puerto serie, el LCD y el lector. NO es un emulador del ATmega328P ni de los
// chips reales: valida la lógica del .ino (máquina de estados, tiempos,
// protocolo), no la electrónica ni el comportamiento real de las librerías.
#ifndef SUSAN_SIM_HW_H
#define SUSAN_SIM_HW_H

#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <deque>
#include <map>
#include <set>
#include <string>
#include <utility>
#include <vector>

typedef uint8_t byte;
#define HIGH 0x1
#define LOW 0x0
#define INPUT 0x0
#define OUTPUT 0x1
#define INPUT_PULLUP 0x2

namespace sim {

struct EventoPin {
    uint64_t ms;
    uint8_t pin;
    uint8_t nivel;
};
struct EventoTono {
    uint64_t ms;
    unsigned hz;  // 0 = noTone
};

// Modelo de una tarjeta ISO 14443-A frente al lector (IDLE -> READY -> ACTIVE
// -> HALT). Dos variantes adversas para probar que la lógica no depende de un
// comportamiento fino de la tarjeta:
//  - pesimista: un HLTA recibido en READY devuelve la tarjeta a IDLE;
//  - ignoraHalt: la tarjeta no obedece HLTA (se queda en ACTIVE);
//  - reiniciarCada: la tarjeta vuelve sola a IDLE cada N ms aunque siga en el
//    campo (p. ej. un clon o una fluctuación del campo de RF).
struct Tarjeta {
    enum Estado { IDLE, READY, ACTIVE, HALT };
    bool enCampo = false;
    uint8_t size = 0;
    uint8_t uid[10] = {0};
    Estado estado = IDLE;
    bool pesimista = false;
    bool ignoraHalt = false;
    uint64_t reiniciarCada = 0;  // 0 = nunca
    uint64_t ultimoReinicio = 0;
};

struct Lcd {
    bool inicializado = false;
    bool luz = false;
    char fila[2][17];
    int cx = 0;
    int cy = 0;
    Lcd() {
        memset(fila, ' ', sizeof(fila));
        fila[0][16] = fila[1][16] = '\0';
    }
};

struct Mundo {
    uint64_t ms = 0;
    uint8_t modo[32] = {0};
    uint8_t nivel[32] = {0};
    bool botonPulsado = false;
    bool enLoop = false;
    int delayEnLoop = 0;
    std::deque<uint8_t> rx;
    std::string tx;
    std::vector<EventoPin> pines;
    std::vector<EventoTono> tonos;
    std::map<uint8_t, Lcd> lcd;
    std::set<uint8_t> i2c;
    int initEnDireccionAusente = 0;
    Tarjeta tarjeta;
    uint8_t versionRc522 = 0x92;
    int llamadasPcdInit = 0;
    bool wireTimeout = false;
    Mundo() { i2c.insert(0x27); }
};

inline Mundo& M() {
    static Mundo m;
    return m;
}

inline void reiniciarMundo() { M() = Mundo(); }

inline uint8_t valorHex(char c) {
    if (c >= '0' && c <= '9') return (uint8_t)(c - '0');
    if (c >= 'A' && c <= 'F') return (uint8_t)(c - 'A' + 10);
    return (uint8_t)(c - 'a' + 10);
}

inline void acercarTarjeta(const std::string& hex) {
    Tarjeta& t = M().tarjeta;
    t.size = (uint8_t)(hex.size() / 2);
    for (size_t i = 0; i < t.size; i++) {
        t.uid[i] = (uint8_t)((valorHex(hex[2 * i]) << 4) | valorHex(hex[2 * i + 1]));
    }
    t.enCampo = true;
    t.estado = Tarjeta::IDLE;
}

inline void retirarTarjeta() {
    M().tarjeta.enCampo = false;
    M().tarjeta.estado = Tarjeta::IDLE;  // sin campo la tarjeta se apaga
}

}  // namespace sim

// ------------------------------------------------------------ API Arduino
inline unsigned long millis() { return (unsigned long)sim::M().ms; }
inline void delay(unsigned long) {
    if (sim::M().enLoop) sim::M().delayEnLoop++;
}
inline void delayMicroseconds(unsigned int) {}

inline void pinMode(uint8_t pin, uint8_t modo) { sim::M().modo[pin] = modo; }
inline void digitalWrite(uint8_t pin, uint8_t nivel) {
    sim::Mundo& m = sim::M();
    if (m.nivel[pin] != nivel || m.pines.empty()) {
        m.nivel[pin] = nivel;
        m.pines.push_back({m.ms, pin, nivel});
    }
}
inline int digitalRead(uint8_t pin) {
    sim::Mundo& m = sim::M();
    if (m.modo[pin] == INPUT_PULLUP) return m.botonPulsado ? LOW : HIGH;
    return m.nivel[pin];
}
inline void tone(uint8_t, unsigned int hz) { sim::M().tonos.push_back({sim::M().ms, hz}); }
inline void noTone(uint8_t) { sim::M().tonos.push_back({sim::M().ms, 0}); }

class SerialSim {
public:
    void begin(unsigned long) {}
    int available() { return (int)sim::M().rx.size(); }
    int read() {
        if (sim::M().rx.empty()) return -1;
        int b = sim::M().rx.front();
        sim::M().rx.pop_front();
        return b;
    }
    size_t print(const char* s) {
        sim::M().tx += s;
        return strlen(s);
    }
    size_t print(char c) {
        sim::M().tx += c;
        return 1;
    }
};
static SerialSim Serial;

class SpiSim {
public:
    void begin() {}
};
static SpiSim SPI;

class TwoWireSim {
public:
    void begin() {}
    void setWireTimeout(uint32_t, bool) { sim::M().wireTimeout = true; }
    void beginTransmission(uint8_t dir) { dir_ = dir; }
    uint8_t endTransmission() { return sim::M().i2c.count(dir_) ? 0 : 2; }

private:
    uint8_t dir_ = 0;
};
static TwoWireSim Wire;

class MFRC522 {
public:
    enum StatusCode : byte { STATUS_OK, STATUS_ERROR, STATUS_COLLISION, STATUS_TIMEOUT };
    enum PCD_Register : byte { VersionReg = 0x37 << 1 };
    struct Uid {
        byte size;
        byte uidByte[10];
        byte sak;
    };
    Uid uid;

    MFRC522(byte, byte) { memset(&uid, 0, sizeof(uid)); }
    void PCD_Init() { sim::M().llamadasPcdInit++; }
    byte PCD_ReadRegister(PCD_Register) { return sim::M().versionRc522; }

    bool PICC_IsNewCardPresent() {
        sim::Tarjeta& t = sim::M().tarjeta;
        reinicioPeriodico(t);
        if (t.enCampo && t.estado == sim::Tarjeta::IDLE) {
            t.estado = sim::Tarjeta::READY;
            return true;
        }
        return false;
    }
    bool PICC_ReadCardSerial() {
        sim::Tarjeta& t = sim::M().tarjeta;
        if (t.enCampo && t.estado == sim::Tarjeta::READY) {
            uid.size = t.size;
            memcpy(uid.uidByte, t.uid, sizeof(uid.uidByte));
            t.estado = sim::Tarjeta::ACTIVE;
            return true;
        }
        return false;
    }
    StatusCode PICC_HaltA() {
        sim::Tarjeta& t = sim::M().tarjeta;
        if (!t.enCampo) return STATUS_TIMEOUT;
        if (t.ignoraHalt) return STATUS_OK;
        if (t.estado == sim::Tarjeta::ACTIVE) t.estado = sim::Tarjeta::HALT;
        else if (t.estado == sim::Tarjeta::READY && t.pesimista) t.estado = sim::Tarjeta::IDLE;
        return STATUS_OK;
    }
    StatusCode PICC_WakeupA(byte*, byte*) {
        sim::Tarjeta& t = sim::M().tarjeta;
        reinicioPeriodico(t);
        if (!t.enCampo || t.estado == sim::Tarjeta::ACTIVE) return STATUS_TIMEOUT;
        t.estado = sim::Tarjeta::READY;
        return STATUS_OK;
    }
    void PCD_StopCrypto1() {}

private:
    static void reinicioPeriodico(sim::Tarjeta& t) {
        if (t.reiniciarCada && sim::M().ms - t.ultimoReinicio >= t.reiniciarCada) {
            t.ultimoReinicio = sim::M().ms;
            if (t.enCampo) t.estado = sim::Tarjeta::IDLE;
        }
    }
};

class LiquidCrystal_I2C {
public:
    LiquidCrystal_I2C(uint8_t dir, uint8_t, uint8_t) : dir_(dir) {}
    void init() {
        if (!sim::M().i2c.count(dir_)) sim::M().initEnDireccionAusente++;
        sim::M().lcd[dir_].inicializado = true;
    }
    void backlight() { sim::M().lcd[dir_].luz = true; }
    void clear() {
        sim::Lcd& l = sim::M().lcd[dir_];
        memset(l.fila, ' ', sizeof(l.fila));
        l.fila[0][16] = l.fila[1][16] = '\0';
    }
    void setCursor(uint8_t x, uint8_t y) {
        sim::Lcd& l = sim::M().lcd[dir_];
        l.cx = x;
        l.cy = y;
    }
    size_t print(const char* s) {
        sim::Lcd& l = sim::M().lcd[dir_];
        size_t n = 0;
        for (; *s; ++s, ++n) {
            if (l.cx < 16 && l.cy < 2) l.fila[l.cy][l.cx] = *s;
            l.cx++;
        }
        return n;
    }

private:
    uint8_t dir_;
};

#endif  // SUSAN_SIM_HW_H
