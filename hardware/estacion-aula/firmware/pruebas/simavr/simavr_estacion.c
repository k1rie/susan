/* simavr_estacion.c - Ejecuta el BINARIO COMPILADO del sketch (estacion_aula.elf)
 * dentro del simulador de instrucciones simavr (ATmega328P a 16 MHz) y verifica
 * lo que se puede observar sin placa: el puerto serie, los pines de LED y el
 * zumbador, y el pulsador.
 *
 * Alcance honesto:
 *  - SÍ ejecuta el código máquina real (núcleo Arduino + librerías + sketch).
 *  - El lector MFRC522 es un modelo mínimo SPI (solo contesta VersionReg=0x92 y
 *    "sin tarjeta"): no hay tarjetas ni RF.
 *  - NO hay esclavo I2C: el LCD no existe aquí (se prueba que la estación NO se
 *    cuelga sin él gracias al tiempo límite de Wire).
 *  - No modela cargas eléctricas, ruido, USB ni la placa real.
 *
 * Uso: simavr_estacion <estacion_aula.elf>      (código de salida 0 = todo bien)
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "sim_avr.h"
#include "sim_elf.h"
#include "avr_ioport.h"
#include "avr_spi.h"
#include "avr_uart.h"

#define FREC 16000000UL
#define MAX_EV 200000

static avr_t* avr;
static avr_irq_t* uart_in;
static avr_irq_t* spi_in;
static avr_irq_t* pin_boton;

static char rx[8192];
static size_t nrx;
static uint64_t t_primer_byte;

typedef struct {
    uint64_t cyc;
    char puerto;
    int pin;
    int val;
} Ev;
static Ev ev[MAX_EV];
static int nev;

static int fallos;
static int comprobaciones;

static double ms_ahora(void) { return (double)avr->cycle * 1000.0 / (double)FREC; }

static void comprobar(int ok, const char* texto) {
    comprobaciones++;
    printf("  %s %s\n", ok ? "ok   " : "FALLA", texto);
    if (!ok) fallos++;
}

/* ------------------------------------------------------------ UART y pines */
static void cb_uart(avr_irq_t* irq, uint32_t valor, void* p) {
    (void)irq; (void)p;
    if (nrx == 0) t_primer_byte = avr->cycle;
    if (nrx < sizeof(rx) - 1) {
        rx[nrx++] = (char)valor;
        rx[nrx] = 0;
    }
}

static void cb_pin(avr_irq_t* irq, uint32_t valor, void* p) {
    (void)irq;
    if (nev < MAX_EV) {
        uintptr_t codigo = (uintptr_t)p;
        ev[nev].cyc = avr->cycle;
        ev[nev].puerto = (char)(codigo >> 8);
        ev[nev].pin = (int)(codigo & 0xFF);
        ev[nev].val = (int)valor;
        nev++;
    }
}

static int contar_cambios(char puerto, int pin, double desde_ms, double hasta_ms) {
    int n = 0;
    for (int i = 0; i < nev; i++) {
        double t = (double)ev[i].cyc * 1000.0 / (double)FREC;
        if (ev[i].puerto == puerto && ev[i].pin == pin && t >= desde_ms && t < hasta_ms) n++;
    }
    return n;
}

static int nivel_final(char puerto, int pin) {
    int v = -1;
    for (int i = 0; i < nev; i++) {
        if (ev[i].puerto == puerto && ev[i].pin == pin) v = ev[i].val;
    }
    return v;
}

static int hubo_nivel_alto(char puerto, int pin, double desde_ms, double hasta_ms) {
    for (int i = 0; i < nev; i++) {
        double t = (double)ev[i].cyc * 1000.0 / (double)FREC;
        if (ev[i].puerto == puerto && ev[i].pin == pin && ev[i].val == 1 && t >= desde_ms && t < hasta_ms) return 1;
    }
    return 0;
}

static size_t contar(const char* texto) {
    size_t n = 0;
    for (const char* p = rx; (p = strstr(p, texto)) != NULL; p += strlen(texto)) n++;
    return n;
}

/* ------------------------------------------------- modelo mínimo del MFRC522 */
/* Secuencia SPI de la librería: lectura = transfer(0x80|reg<<1), transfer(0);
 * escritura = transfer(reg<<1), transfer(valor)... con SS bajo; al subir SS se
 * reinicia. Todo registro vale 0 salvo VersionReg (0x37) = 0x92 y ComIrqReg
 * (0x04) = 0x01 (TimerIRq: la librería concluye "sin tarjeta" al instante). */
enum { ESPERA, LECTURA, ESCRITURA };
static int estado_spi = ESPERA;
static int reg_pendiente = -1;

static uint8_t valor_registro(int reg) {
    if (reg == 0x37) return 0x92;
    if (reg == 0x04) return 0x01;
    return 0x00;
}

static void cb_spi(avr_irq_t* irq, uint32_t valor, void* p) {
    (void)irq; (void)p;
    uint8_t b = (uint8_t)valor;
    uint8_t respuesta = 0;
    if (estado_spi == ESPERA) {
        estado_spi = (b & 0x80) ? LECTURA : ESCRITURA;
        reg_pendiente = (b >> 1) & 0x3F;
    } else if (estado_spi == LECTURA) {
        respuesta = valor_registro(reg_pendiente);
        if (b & 0x80) reg_pendiente = (b >> 1) & 0x3F;
    }
    avr_raise_irq(spi_in, respuesta);
}

static void cb_ss(avr_irq_t* irq, uint32_t valor, void* p) {
    (void)irq; (void)p;
    if (valor) estado_spi = ESPERA;
}

/* ---------------------------------------------------------------- ejecución */
static void correr_ms(double ms) {
    uint64_t meta = avr->cycle + (uint64_t)(ms * (double)FREC / 1000.0);
    while (avr->cycle < meta) {
        int estado = avr_run(avr);
        if (estado == cpu_Done || estado == cpu_Crashed) {
            printf("  FALLA el procesador simulado se detuvo (estado %d)\n", estado);
            fallos++;
            exit(1);
        }
    }
}

static void enviar(const char* s, size_t n) {
    for (size_t i = 0; i < n; i++) {
        avr_raise_irq(uart_in, (uint8_t)s[i]);
        correr_ms(0.3);  /* ~3,3 kB/s, por debajo de los 11,5 kB/s del enlace */
    }
}

static void enviar_texto(const char* s) { enviar(s, strlen(s)); }

int main(int argc, char** argv) {
    if (argc < 2) {
        fprintf(stderr, "uso: %s estacion_aula.elf\n", argv[0]);
        return 2;
    }
    elf_firmware_t fw;
    memset(&fw, 0, sizeof(fw));
    if (elf_read_firmware(argv[1], &fw) != 0) {
        fprintf(stderr, "no pude leer %s\n", argv[1]);
        return 2;
    }
    strcpy(fw.mmcu, "atmega328p");
    fw.frequency = FREC;
    avr = avr_make_mcu_by_name(fw.mmcu);
    if (!avr) { fprintf(stderr, "mcu desconocido\n"); return 2; }
    avr_init(avr);
    avr->log = 0;  /* sin trazas de simavr */
    avr_load_firmware(avr, &fw);

    uart_in = avr_io_getirq(avr, AVR_IOCTL_UART_GETIRQ('0'), UART_IRQ_INPUT);
    avr_irq_register_notify(avr_io_getirq(avr, AVR_IOCTL_UART_GETIRQ('0'), UART_IRQ_OUTPUT), cb_uart, NULL);
    spi_in = avr_io_getirq(avr, AVR_IOCTL_SPI_GETIRQ(0), SPI_IRQ_INPUT);
    avr_irq_register_notify(avr_io_getirq(avr, AVR_IOCTL_SPI_GETIRQ(0), SPI_IRQ_OUTPUT), cb_spi, NULL);
    avr_irq_register_notify(avr_io_getirq(avr, AVR_IOCTL_IOPORT_GETIRQ('B'), 2), cb_ss, NULL); /* D10 = SS */

    /* LED D5/D6/D7 = PD5..PD7; zumbador D8 = PB0. */
    for (int pin = 5; pin <= 7; pin++) {
        avr_irq_register_notify(avr_io_getirq(avr, AVR_IOCTL_IOPORT_GETIRQ('D'), pin), cb_pin,
                                (void*)(uintptr_t)(('D' << 8) | pin));
    }
    avr_irq_register_notify(avr_io_getirq(avr, AVR_IOCTL_IOPORT_GETIRQ('B'), 0), cb_pin,
                            (void*)(uintptr_t)(('B' << 8) | 0));

    /* Pulsador D2 = PD2 con pull-up externa simulada: reposo = 1. */
    pin_boton = avr_io_getirq(avr, AVR_IOCTL_IOPORT_GETIRQ('D'), 2);
    avr_raise_irq(pin_boton, 1);

    printf("Ejecución del binario en simavr (ATmega328P, %lu MHz)\n", FREC / 1000000UL);

    printf("-- Arranque\n");
    correr_ms(2500);
    comprobar(contar("HELLO estacion-aula 1.0\n") == 1, "un único HELLO tras el arranque");
    printf("     (primer byte por el puerto serie a los %.1f ms de simulación)\n",
           (double)t_primer_byte * 1000.0 / (double)FREC);
    comprobar(hubo_nivel_alto('D', 5, 0, 1500) && hubo_nivel_alto('D', 6, 0, 1500) && hubo_nivel_alto('D', 7, 0, 1500),
              "los tres LED se encienden en la prueba de arranque");
    comprobar(nivel_final('D', 5) == 0 && nivel_final('D', 6) == 0 && nivel_final('D', 7) == 0,
              "y se apagan al terminar (sin LED de falla: el lector simulado contesta)");
    comprobar(contar_cambios('B', 0, 0, 1500) > 200, "el zumbador (D8) recibe el tono de arranque por tone()");

    printf("-- PING/PONG y entradas hostiles\n");
    nrx = 0; rx[0] = 0;
    enviar_texto("PING\n");
    correr_ms(20);
    comprobar(strcmp(rx, "PONG\n") == 0, "PING -> PONG");
    nrx = 0; rx[0] = 0;
    char larga[101];
    memset(larga, 'x', 100);
    larga[100] = 0;
    enviar_texto(larga); enviar_texto("\n"); enviar_texto("PING\n");
    correr_ms(20);
    comprobar(strcmp(rx, "PONG\n") == 0, "línea de 100 bytes ignorada y el PING siguiente sí se atiende");
    nrx = 0; rx[0] = 0;
    enviar_texto("REBOOT\nCLOSE\nSES a|b\nRES OKAY\nping\nSES 3N|Redes|1/2\nRES OK Ana\n");
    correr_ms(50);
    comprobar(nrx == 0, "comandos ajenos, mal formados y SES/RES válidos no generan salida");

    printf("-- Pulsador\n");
    nrx = 0; rx[0] = 0;
    avr_raise_irq(pin_boton, 0);
    correr_ms(3000);
    avr_raise_irq(pin_boton, 1);
    correr_ms(200);
    comprobar(strcmp(rx, "BTN\n") == 0, "una pulsación de 3 s envía un único BTN");
    nrx = 0; rx[0] = 0;
    avr_raise_irq(pin_boton, 0); correr_ms(8);
    avr_raise_irq(pin_boton, 1); correr_ms(200);
    comprobar(nrx == 0, "un rebote de 8 ms no envía nada");

    printf("-- Regla de los 30 s (la PC calla)\n");
    nrx = 0; rx[0] = 0;
    enviar_texto("PING\n");
    correr_ms(10);
    double t_ping = ms_ahora();
    correr_ms(29000);
    comprobar(contar_cambios('D', 6, t_ping, t_ping + 29000) == 0, "a los 29 s de silencio el LED ámbar sigue apagado");
    correr_ms(2000);
    correr_ms(6000);
    int c = contar_cambios('D', 6, t_ping + 31000, t_ping + 37000);
    comprobar(c >= 5 && c <= 7, "después de 30 s el ámbar parpadea lento (3 ciclos de 2 s en 6 s)");
    nrx = 0; rx[0] = 0;
    enviar_texto("PING\n");
    correr_ms(2500);
    comprobar(strcmp(rx, "PONG\n") == 0 && nivel_final('D', 6) == 0, "la PC vuelve: PONG y el ámbar se apaga");

    printf("\nTiempo simulado total: %.1f s; %d comprobaciones, %d fallidas\n", ms_ahora() / 1000.0, comprobaciones, fallos);
    avr_terminate(avr);
    return fallos == 0 ? 0 : 1;
}
