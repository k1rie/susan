#!/usr/bin/env node
// puente-serial.mjs - Puente entre la Estación de aula SUSAN (Arduino, USB serie)
// y el equipo del docente. Unidad «Manejo de puertos».
//
// Qué hace: abre el puerto serie (115200 8N1), recibe las líneas de la estación
// (HELLO / UID / BTN / PONG), decide a qué alumno corresponde cada tarjeta con una
// tabla UID -> alumno cargada de un CSV, y responde con RES ... y SES ... para que
// la estación muestre el resultado (LED, zumbador, LCD).
//
// LO QUE NO HACE TODAVÍA: registrar la asistencia de verdad. La función
// registrarPresencia() de este archivo es un STUB que solo escribe en pantalla.
// La integración real (tabla `credencial` + RPC del pase manual) es el SIGUIENTE
// PASO documentado en README.md; hasta entonces nada llega a la base de datos.
//
// Uso:
//   node puente-serial.mjs --listar
//   node puente-serial.mjs --puerto /dev/ttyACM0 [--baud 115200]
//   node puente-serial.mjs --simulado --guion      (sin hardware: dispositivo en memoria)
//   node puente-serial.mjs --simulado              (interactivo: tap <UID>, btn, ...)
//
// Privacidad (CLAUDE.md: no registrar PII en logs): por omisión los UID y las
// matrículas salen enmascarados y no se escriben nombres. --verboso lo desactiva
// y solo debe usarse con los datos ficticios de credenciales-demo.csv.

import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const AYUDA = `Puente serie de la Estación de aula SUSAN

  node puente-serial.mjs --listar
  node puente-serial.mjs --puerto /dev/ttyACM0 [--baud 115200]
  node puente-serial.mjs --simulado --guion     recorrido automático sin hardware
  node puente-serial.mjs --simulado             interactivo: tap <UID|1|2|3>, btn, silencio, voz, abrir, cerrar, estado, salir

Opciones: --credenciales <csv>  --sesion <json>  --sin-sesion  --verboso (solo con datos ficticios)`;

// ---------------------------------------------------------------- constantes
export const BAUDIOS = 115200;
export const MAX_LINEA = 64;               // bytes por línea del protocolo
export const COLS = 16;                    // columnas del LCD
export const ANTIREBOTE_UID_MS = 2000;     // misma tarjeta: se ignora este tiempo
export const SILENCIO_ESTACION_MS = 30000; // sin nada de la estación: enlace perdido
export const LATIDO_MS = 10000;            // PING + SES periódicos (< 30 s del lado Arduino)
export const ESPERA_HELLO_MS = 3000;       // si no llega HELLO, se sincroniza igual
const VIGILANCIA_MS = 1000;

// ---------------------------------------------------------------------- texto
// El LCD solo garantiza ASCII: se quitan acentos (NFD) y lo no representable pasa
// a '?' (un signo por carácter, igual que el firmware). '|' es el separador de
// SES, así que nunca puede ir dentro de un campo.
export function transliterar(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/gu, '')
        .replace(/¿/gu, '?')
        .replace(/¡/gu, '!')
        .replace(/[°º]/gu, 'o')
        .replace(/ª/gu, 'a')
        .replace(/\|/gu, '/')
        .replace(/[^\x20-\x7e]/gu, '?');
}

export function ajustar(texto, cols = COLS) {
    return transliterar(texto).trim().slice(0, cols).trimEnd();
}

export function enmascararUid(uid) {
    return `****${String(uid).slice(-4)}`;
}

export function enmascararMatricula(matricula) {
    return `***${String(matricula).slice(-3)}`;
}

// --------------------------------------------------------- líneas del protocolo
// Estación -> PC. Solo se aceptan formas exactas; lo demás es 'DESCONOCIDA'.
export function analizarLinea(linea) {
    let m = /^HELLO estacion-aula (\d+\.\d+)$/.exec(linea);
    if (m) return { tipo: 'HELLO', version: m[1] };
    m = /^UID ((?:[0-9A-F]{2}){4}|(?:[0-9A-F]{2}){7}|(?:[0-9A-F]{2}){10})$/.exec(linea);
    if (m) return { tipo: 'UID', uid: m[1] };
    if (linea === 'BTN') return { tipo: 'BTN' };
    if (linea === 'PONG') return { tipo: 'PONG' };
    return { tipo: 'DESCONOCIDA' };
}

// Une trozos de bytes en líneas. Una línea de más de MAX_LINEA bytes se descarta
// ENTERA hasta el siguiente '\n' (nunca se interpreta un fragmento) y el búfer
// nunca crece sin límite.
export class EnsambladorLineas {
    constructor() {
        this.actual = [];
        this.descartando = false;
        this.descartadas = 0;
    }

    push(trozo) {
        const bytes = typeof trozo === 'string' ? Buffer.from(trozo, 'latin1') : trozo;
        const lineas = [];
        for (const b of bytes) {
            if (b === 0x0a) {
                if (!this.descartando && this.actual.length > 0) {
                    lineas.push(Buffer.from(this.actual).toString('latin1'));
                }
                this.actual = [];
                this.descartando = false;
            } else if (b === 0x0d || this.descartando) {
                continue; // CR se ignora; en descarte no se acumula nada
            } else if (b < 0x20 || b > 0x7e) {
                this.descartando = true;
                this.descartadas++;
                this.actual = [];
            } else if (this.actual.length >= MAX_LINEA) {
                this.descartando = true;
                this.descartadas++;
                this.actual = [];
            } else {
                this.actual.push(b);
            }
        }
        return lineas;
    }
}

// PC -> estación.
export function armarSes(sesion) {
    if (!sesion || !sesion.abierta) return 'SES ||0/0';
    const grupo = ajustar(sesion.grupo);
    const materia = ajustar(sesion.materia);
    // Si ambos quedaran vacíos la estación lo leería como "sin sesión".
    const g = grupo === '' && materia === '' ? '-' : grupo;
    const presentes = Math.min(65535, sesion.presentes instanceof Set ? sesion.presentes.size : Number(sesion.presentes) || 0);
    const total = Math.min(65535, Number(sesion.total) || 0);
    return `SES ${g}|${materia}|${presentes}/${total}`;
}

export function armarRes(tipo, texto = '') {
    const t = ajustar(texto);
    return t === '' ? `RES ${tipo}` : `RES ${tipo} ${t}`;
}

// Comprueba que una línea PC -> estación cumple la gramática del protocolo.
// La usa el dispositivo simulado para detectar infracciones del puente.
export function lineaValidaParaEstacion(linea) {
    if (Buffer.byteLength(linea, 'latin1') > MAX_LINEA || !/^[\x20-\x7e]+$/.test(linea)) return false;
    if (linea === 'PING') return true;
    if (/^SES [^|]*\|[^|]*\|\d{1,5}\/\d{1,5}$/.test(linea)) return true;
    return /^RES (OK|DUP|NOREG|ERR)( [\x20-\x7e]*)?$/.test(linea);
}

// ---------------------------------------------------------------- credenciales
const UID_VALIDO = /^(?:[0-9A-F]{2}){4}$|^(?:[0-9A-F]{2}){7}$|^(?:[0-9A-F]{2}){10}$/;

// CSV con encabezado `UID,matricula,nombre_corto`. Sin comillas ni comas dentro de
// los campos; las líneas vacías y las que empiezan con '#' se ignoran. Un UID
// repetido NO sobrescribe al primero (dos alumnos con la misma tarjeta es un error
// de captura que no debe resolverse en silencio).
export function cargarCredenciales(texto) {
    const mapa = new Map();
    const avisos = [];
    let encabezado = false;
    texto.split(/\r?\n/).forEach((cruda, i) => {
        const linea = cruda.trim();
        if (linea === '' || linea.startsWith('#')) return;
        const campos = linea.split(',').map((c) => c.trim());
        if (!encabezado) {
            encabezado = true;
            if (campos[0].toLowerCase() === 'uid') return;
        }
        if (campos.length !== 3 || campos.some((c) => c === '')) {
            avisos.push(`línea ${i + 1}: se esperaban 3 campos no vacíos (UID,matricula,nombre_corto)`);
            return;
        }
        const uid = campos[0].toUpperCase();
        if (!UID_VALIDO.test(uid)) {
            avisos.push(`línea ${i + 1}: UID inválido (hexadecimal de 4, 7 o 10 bytes)`);
            return;
        }
        if (mapa.has(uid)) {
            avisos.push(`línea ${i + 1}: UID repetido, se conserva la primera fila`);
            return;
        }
        mapa.set(uid, { matricula: campos[1], nombreCorto: campos[2] });
    });
    return { mapa, avisos };
}

export function cargarCredencialesDeArchivo(ruta) {
    return cargarCredenciales(readFileSync(ruta, 'utf8'));
}

// ------------------------------------------------------- registro de presencia
// STUB. Aquí irá la integración real con SUSAN: buscar el alumno por la tabla
// `credencial` (UID -> alumno) y registrar la asistencia con la RPC del pase
// manual de lista (origen manual, ver docs/API.md). NO está implementado: esta
// función solo informa y devuelve éxito para poder probar el flujo de extremo a
// extremo de la estación. Contrato: Promise<{ ok: boolean }>.
export async function registrarPresencia(matricula, contexto = {}) {
    const registro = contexto.log ?? (() => {});
    registro('aviso', `[STUB] registrarPresencia(${contexto.verboso ? matricula : enmascararMatricula(matricula)}): `
        + 'solo se registra en pantalla, NO se escribe en la base de datos');
    return { ok: true, simulado: true };
}

// ----------------------------------------------------------------------- puente
function logConsola(nivel, mensaje) {
    const etiqueta = nivel === 'info' ? '' : `${nivel}: `;
    console.log(`[puente] ${etiqueta}${mensaje}`);
}

export class Puente extends EventEmitter {
    constructor({
        credenciales = new Map(),
        sesion = { abierta: false },
        registrar = registrarPresencia,
        log = logConsola,
        verboso = false,
        reloj = () => Date.now(),
    } = {}) {
        super();
        this.credenciales = credenciales;
        this.sesion = {
            abierta: Boolean(sesion.abierta),
            grupo: sesion.grupo ?? '',
            materia: sesion.materia ?? '',
            total: Number(sesion.total) || 0,
            presentes: new Set(sesion.presentes ?? []),
        };
        this.registrar = registrar;
        this.log = log;
        this.verboso = verboso;
        this.reloj = reloj;
        this.ensamblador = new EnsambladorLineas();
        this.puerto = null;
        this.enlace = 'esperando'; // esperando | ok | perdido
        this.huboHello = false;
        this.ultimoRx = this.reloj();
        this.ultimoUid = null;
        this.ultimoUidT = 0;
        this.enCurso = new Set();
        this.detenido = false;
        this.temporizadores = [];
    }

    uid(uid) {
        return this.verboso ? uid : enmascararUid(uid);
    }

    // ------------------------------------------------------------ conexión
    adjuntar(puerto) {
        this.puerto = puerto;
        puerto.on('data', (trozo) => this.recibir(trozo));
        puerto.on('error', (e) => this.log('error', `puerto: ${e.message}`));
        puerto.on('close', () => {
            this.log('aviso', 'el puerto se cerró');
            this.emit('cierre');
        });
    }

    iniciar() {
        this.detenido = false;
        this.ultimoRx = this.reloj();
        this.temporizadores.push(setTimeout(() => {
            // `isOpen` solo existe en el puerto real; el simulado cuenta como abierto.
            if (!this.huboHello && this.puerto && this.puerto.isOpen !== false) {
                this.log('aviso', 'no llegó HELLO; se sincroniza de todos modos (el puerto pudo abrirse sin reiniciar la placa)');
                this.enviarSeguro('PING');
                this.sincronizar();
            }
        }, ESPERA_HELLO_MS));
        this.temporizadores.push(setInterval(() => {
            this.enviarSeguro('PING');
            this.sincronizar(); // refresca la LCD y evita el "Sin conexion" de la estación
        }, LATIDO_MS));
        this.temporizadores.push(setInterval(() => this.vigilar(), VIGILANCIA_MS));
    }

    detener() {
        this.detenido = true;
        for (const t of this.temporizadores) {
            clearTimeout(t);
            clearInterval(t);
        }
        this.temporizadores = [];
    }

    // Regla de los 30 s del lado de la PC: si la estación no manda NADA reconocible
    // (ni PONG a los PING) en 30 s, el enlace se da por perdido.
    vigilar() {
        if (this.enlace !== 'perdido' && this.reloj() - this.ultimoRx >= SILENCIO_ESTACION_MS) {
            this.enlace = 'perdido';
            this.log('aviso', `la estación no responde desde hace ${SILENCIO_ESTACION_MS / 1000} s (¿cable USB? ¿placa reiniciándose?)`);
            this.emit('enlace', 'perdido');
        }
    }

    marcarVida() {
        this.ultimoRx = this.reloj();
        if (this.enlace !== 'ok') {
            const antes = this.enlace;
            this.enlace = 'ok';
            if (antes === 'perdido') {
                this.log('info', 'la estación volvió a responder');
                this.sincronizar();
            }
            this.emit('enlace', 'ok');
        }
    }

    // ------------------------------------------------------------- envío
    enviar(linea) {
        if (!lineaValidaParaEstacion(linea)) {
            throw new Error(`línea fuera de protocolo: ${JSON.stringify(linea)}`);
        }
        this.puerto.write(`${linea}\n`);
    }

    enviarSeguro(linea) {
        try {
            this.enviar(linea);
        } catch (e) {
            this.log('error', `no se pudo enviar: ${e.message}`);
        }
    }

    sincronizar() {
        this.enviarSeguro(armarSes(this.sesion));
    }

    // ----------------------------------------------------------- recepción
    recibir(trozo) {
        const antes = this.ensamblador.descartadas;
        for (const linea of this.ensamblador.push(trozo)) {
            this.procesarLinea(linea);
        }
        if (this.ensamblador.descartadas > antes) {
            this.log('aviso', 'línea demasiado larga o con caracteres no válidos: descartada');
        }
    }

    procesarLinea(linea) {
        const l = analizarLinea(linea);
        if (l.tipo === 'DESCONOCIDA') {
            this.log('depurar', `línea desconocida ignorada (${linea.length} bytes)`);
            return;
        }
        this.marcarVida();
        switch (l.tipo) {
            case 'HELLO':
                this.huboHello = true;
                this.log('info', `estación conectada (firmware ${l.version}); se envía la sesión`);
                this.sincronizar();
                break;
            case 'PONG':
                break;
            case 'BTN':
                this.log('info', 'BTN: la estación cambió de página en su LCD (el botón nunca cierra sesiones)');
                break;
            case 'UID':
                this.manejarUid(l.uid).catch((e) => {
                    this.log('error', `fallo al atender la tarjeta: ${e.message}`);
                    this.enviarSeguro('RES ERR');
                });
                break;
            default:
                break;
        }
    }

    // Decisión por tarjeta. El orden importa: rebote -> sesión -> registrada ->
    // duplicado -> registro.
    async manejarUid(uid) {
        const ahora = this.reloj();
        if (this.ultimoUid === uid && ahora - this.ultimoUidT < ANTIREBOTE_UID_MS) {
            this.log('depurar', `UID ${this.uid(uid)} repetido en menos de ${ANTIREBOTE_UID_MS / 1000} s: ignorado`);
            return;
        }
        this.ultimoUid = uid;
        this.ultimoUidT = ahora;

        if (!this.sesion.abierta) {
            this.log('info', `UID ${this.uid(uid)}: no hay sesión abierta`);
            this.enviar(armarRes('ERR', 'Sin sesion abierta'));
            return;
        }
        const cred = this.credenciales.get(uid);
        if (!cred) {
            this.log('info', `UID ${this.uid(uid)}: tarjeta no registrada`);
            this.enviar(armarRes('NOREG'));
            return;
        }
        const alumno = this.verboso ? `${cred.nombreCorto} (${cred.matricula})` : `alumno ${enmascararMatricula(cred.matricula)}`;
        if (this.sesion.presentes.has(cred.matricula) || this.enCurso.has(cred.matricula)) {
            this.log('info', `UID ${this.uid(uid)} (${alumno}): ya estaba presente`);
            this.enviar(armarRes('DUP', cred.nombreCorto));
            return;
        }
        this.enCurso.add(cred.matricula);
        try {
            const r = await this.registrar(cred.matricula, { log: this.log, verboso: this.verboso, uid });
            if (!r || r.ok !== true) throw new Error('el registro de presencia no se confirmó');
            this.sesion.presentes.add(cred.matricula);
        } catch (e) {
            this.log('error', `UID ${this.uid(uid)} (${alumno}): no se pudo registrar: ${e.message}`);
            this.enviar(armarRes('ERR'));
            return;
        } finally {
            this.enCurso.delete(cred.matricula);
        }
        this.log('info', `UID ${this.uid(uid)} (${alumno}): presente (${this.sesion.presentes.size}/${this.sesion.total})`);
        this.enviar(armarRes('OK', cred.nombreCorto));
        this.sincronizar(); // actualiza presentes/total en la LCD
    }

    // La sesión la abre y la cierra el docente en la aplicación web. El puente solo
    // refleja su estado (en la demo, desde un JSON o con comandos).
    fijarSesionAbierta(abierta) {
        this.sesion.abierta = Boolean(abierta);
        this.sincronizar();
    }
}

// ------------------------------------------------------ dispositivo simulado
// Sustituye al puerto serie: emite y recibe líneas como lo haría la estación. Es
// un doble de pruebas hecho aparte del firmware (no ejecuta su código). Además
// valida que TODO lo que el puente le escribe cumpla el protocolo.
export class DispositivoSimulado extends EventEmitter {
    constructor() {
        super();
        this.recibido = [];       // líneas PC -> estación, en orden
        this.violaciones = [];    // líneas que no cumplen el protocolo
        this.silencioso = false;  // true: no contesta PING (cable "desconectado")
        this.abierto = true;
        this.sesionLcd = null;
        this.pendiente = '';
    }

    write(datos) {
        if (!this.abierto) throw new Error('puerto cerrado');
        this.pendiente += Buffer.isBuffer(datos) ? datos.toString('latin1') : String(datos);
        let i;
        while ((i = this.pendiente.indexOf('\n')) >= 0) {
            const linea = this.pendiente.slice(0, i);
            this.pendiente = this.pendiente.slice(i + 1);
            this.recibido.push(linea);
            if (!lineaValidaParaEstacion(linea)) this.violaciones.push(linea);
            this.atender(linea);
        }
        return true;
    }

    atender(linea) {
        if (this.silencioso) return;
        if (linea === 'PING') {
            this.emitir('PONG');
        } else if (linea.startsWith('SES ')) {
            const [grupo, materia, cuenta] = linea.slice(4).split('|');
            this.sesionLcd = grupo === '' && materia === '' ? null : { grupo, materia, cuenta };
            this.emit('sesion', this.sesionLcd);
        } else if (linea.startsWith('RES ')) {
            const [, tipo, ...resto] = linea.split(' ');
            const texto = resto.join(' ');
            const efectos = {
                OK: { led: 'verde', sonido: '1 pitido corto', lcd: ['Registrado', texto] },
                DUP: { led: 'ambar', sonido: '2 pitidos cortos', lcd: ['Ya registrado', texto] },
                NOREG: { led: 'rojo', sonido: '1 pitido largo', lcd: ['Tarjeta no', 'registrada'] },
                ERR: { led: 'rojo parpadeando', sonido: 'sin sonido', lcd: ['Error', texto || 'del sistema'] },
            };
            this.emit('efecto', { tipo, ...efectos[tipo] });
        }
    }

    emitir(linea) {
        if (this.abierto) this.emit('data', Buffer.from(`${linea}\n`, 'latin1'));
    }

    // Lo que haría la placa al encender (o al abrirse el puerto, por el reinicio DTR).
    arrancar() { this.emitir('HELLO estacion-aula 1.0'); }
    tocarTarjeta(uid) { this.emitir(`UID ${uid}`); }
    pulsarBoton() { this.emitir('BTN'); }
    silenciar(si = true) { this.silencioso = si; }
    close() {
        this.abierto = false;
        this.emit('close');
    }
}

// ----------------------------------------------------------------- puerto real
async function cargarSerialport() {
    const require = createRequire(import.meta.url);
    for (const candidato of ['serialport', path.join(AQUI, 'tools', 'node_modules', 'serialport')]) {
        try {
            return require(candidato);
        } catch {
            // se prueba el siguiente
        }
    }
    throw new Error('Falta el paquete "serialport". Instálelo SIN tocar package.json con:\n'
        + '  npm install --no-save --prefix puente/tools serialport@13');
}

async function listarPuertos() {
    try {
        const { SerialPort } = await cargarSerialport();
        const lista = await SerialPort.list();
        if (lista.length === 0) console.log('No se detectaron puertos serie.');
        for (const p of lista) {
            console.log(`${p.path}\t${p.manufacturer ?? ''}\t${p.vendorId ?? ''}:${p.productId ?? ''}`);
        }
    } catch (e) {
        // SerialPort.list() usa `udevadm` en Linux; si falta, se listan los nodos de dispositivo.
        console.log(`(no se pudo consultar el detalle: ${e.code ?? e.message}; se listan los nodos /dev)`);
        let hay = false;
        for (const nombre of readdirSync('/dev').filter((n) => /^(ttyACM|ttyUSB|cu\.usb)/.test(n))) {
            console.log(`/dev/${nombre}`);
            hay = true;
        }
        if (!hay) console.log('No se encontró ningún /dev/ttyACM* ni /dev/ttyUSB*.');
    }
    console.log('En Windows use "COM3", "COM4"...; en macOS "/dev/cu.usbmodem*".');
}

// --------------------------------------------------------------------- CLI
function leerSesion(ruta) {
    const s = JSON.parse(readFileSync(ruta, 'utf8'));
    if (typeof s !== 'object' || s === null) throw new Error('el JSON de sesión debe ser un objeto');
    return s;
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function conectarVistaSimulada(dispositivo, salida) {
    dispositivo.on('efecto', (e) => {
        salida(`[estacion] LED ${e.led}, ${e.sonido} | LCD: "${e.lcd[0]}" / "${e.lcd[1]}"`);
    });
    dispositivo.on('sesion', (s) => {
        salida(s
            ? `[estacion] LCD pagina 1: "${s.materia}" / "${s.grupo}" ... ${s.cuenta}`
            : '[estacion] LCD pagina 1: "Sin sesion" / "abierta"');
    });
}

// Recorrido automático de la demostración (tarda unos 5 s reales).
async function correrGuion(puente, dispositivo, uids, salida) {
    const [uidA, uidB] = uids;
    const paso = async (texto, accion, { antes = 0, despues = 400 } = {}) => {
        await esperar(antes);
        salida(`\n> ${texto}`);
        accion();
        await esperar(despues);
    };
    await paso('Se enciende la estación (la placa manda HELLO)', () => dispositivo.arrancar());
    await paso('Alumno 1 acerca su tarjeta', () => dispositivo.tocarTarjeta(uidA), { despues: 150 });
    await paso('La misma tarjeta rebota 150 ms después (se ignora, sin respuesta)', () => dispositivo.tocarTarjeta(uidA));
    await paso('2,2 s después la misma tarjeta vuelve a acercarse (ya estaba presente)', () => dispositivo.tocarTarjeta(uidA), { antes: 2200 });
    await paso('Alumno 2 acerca su tarjeta', () => dispositivo.tocarTarjeta(uidB));
    await paso('Tarjeta que no está en la tabla', () => dispositivo.tocarTarjeta('0BADC0DE'));
    await paso('El docente pulsa el botón de la estación (solo cambia la página del LCD)', () => dispositivo.pulsarBoton());
    await paso('El docente CIERRA la sesión en la aplicación web (la estación no puede hacerlo)', () => puente.fijarSesionAbierta(false));
    await paso('Una tarjeta llega con la sesión cerrada', () => dispositivo.tocarTarjeta(uidB));
    await paso('Se desconecta el cable: la estación deja de contestar PING', () => dispositivo.silenciar(true), { despues: 0 });
    salida(`\nResumen: ${puente.sesion.presentes.size} presente(s) en la sesión simulada; `
        + `líneas enviadas a la estación: ${dispositivo.recibido.length}; `
        + `infracciones del protocolo: ${dispositivo.violaciones.length}`);
}

function interactivo(puente, dispositivo, credenciales, salida) {
    salida('Comandos: tap <UID|1|2|3>, btn, silencio, voz, abrir, cerrar, estado, salir');
    const uids = [...credenciales.keys()];
    const rl = readline.createInterface({ input: process.stdin });
    return new Promise((resolver) => {
        rl.on('line', (entrada) => {
            const [orden, arg] = entrada.trim().split(/\s+/);
            if (orden === 'tap') {
                const uid = /^\d$/.test(arg ?? '') ? uids[Number(arg) - 1] : (arg ?? '').toUpperCase();
                if (uid) dispositivo.tocarTarjeta(uid);
                else salida('uso: tap <UID|número de la tabla>');
            } else if (orden === 'btn') dispositivo.pulsarBoton();
            else if (orden === 'silencio') dispositivo.silenciar(true);
            else if (orden === 'voz') dispositivo.silenciar(false);
            else if (orden === 'abrir') puente.fijarSesionAbierta(true);
            else if (orden === 'cerrar') puente.fijarSesionAbierta(false);
            else if (orden === 'estado') salida(`enlace=${puente.enlace} presentes=${puente.sesion.presentes.size}/${puente.sesion.total}`);
            else if (orden === 'salir') rl.close();
        });
        rl.on('close', resolver);
    });
}

export async function main(argv = process.argv.slice(2)) {
    let args;
    try {
        args = parseArgs({
            args: argv,
            options: {
                puerto: { type: 'string' },
                baud: { type: 'string', default: String(BAUDIOS) },
                listar: { type: 'boolean', default: false },
                simulado: { type: 'boolean', default: false },
                guion: { type: 'boolean', default: false },
                credenciales: { type: 'string', default: path.join(AQUI, 'credenciales-demo.csv') },
                sesion: { type: 'string', default: path.join(AQUI, 'sesion-demo.json') },
                'sin-sesion': { type: 'boolean', default: false },
                verboso: { type: 'boolean', default: false },
                ayuda: { type: 'boolean', short: 'h', default: false },
            },
        }).values;
    } catch (e) {
        console.error(`Argumentos no válidos: ${e.message}\nUse --ayuda.`);
        return 2;
    }
    if (args.ayuda) {
        console.log(AYUDA);
        return 0;
    }
    if (args.listar) {
        await listarPuertos();
        return 0;
    }
    if (!args.simulado && !args.puerto) {
        console.error('Indique --puerto <ruta> (use --listar para verlos) o --simulado.');
        return 2;
    }
    const baud = Number(args.baud);
    if (!Number.isInteger(baud) || baud <= 0) {
        console.error('--baud debe ser un entero positivo.');
        return 2;
    }

    let credenciales;
    let sesion;
    try {
        const c = cargarCredencialesDeArchivo(args.credenciales);
        for (const aviso of c.avisos) console.log(`[puente] aviso: ${args.credenciales}: ${aviso}`);
        credenciales = c.mapa;
        sesion = leerSesion(args.sesion);
        if (args['sin-sesion']) sesion.abierta = false;
    } catch (e) {
        console.error(`No se pudo cargar la configuración: ${e.message}`);
        return 2;
    }
    console.log(`[puente] ${credenciales.size} tarjeta(s) en la tabla; sesión ${sesion.abierta ? 'ABIERTA' : 'cerrada'} (simulada por JSON/bandera)`);
    console.log('[puente] aviso: registrarPresencia() es un STUB; no se escribe nada en la base de datos');

    // Los mensajes de nivel "depurar" (rebotes ignorados, líneas desconocidas) solo
    // se muestran con --verboso o en el recorrido de demostración.
    const verDepuracion = args.verboso || args.guion;
    const log = (nivel, mensaje) => {
        if (nivel !== 'depurar' || verDepuracion) logConsola(nivel, mensaje);
    };
    const puente = new Puente({ credenciales, sesion, verboso: args.verboso, log });

    if (args.simulado) {
        const dispositivo = new DispositivoSimulado();
        conectarVistaSimulada(dispositivo, console.log);
        puente.adjuntar(dispositivo);
        puente.iniciar();
        if (args.guion) {
            await correrGuion(puente, dispositivo, [...credenciales.keys()], console.log);
        } else {
            dispositivo.arrancar();
            await interactivo(puente, dispositivo, credenciales, console.log);
        }
        puente.detener();
        return 0;
    }

    const { SerialPort } = await cargarSerialport();
    let salir = false;
    let puertoActual = null;
    process.once('SIGINT', () => {
        salir = true;
        puente.detener();
        console.log('\n[puente] cerrando...');
        if (puertoActual && puertoActual.isOpen) puertoActual.close();
    });
    puente.iniciar();
    while (!salir) {
        const puerto = new SerialPort({ path: args.puerto, baudRate: baud, autoOpen: false });
        puertoActual = puerto;
        puente.adjuntar(puerto);
        const cerrado = new Promise((resolver) => puerto.once('close', resolver));
        try {
            await new Promise((resolver, rechazar) => puerto.open((e) => (e ? rechazar(e) : resolver())));
            console.log(`[puente] puerto ${args.puerto} abierto a ${baud} baudios (8N1)`);
            await cerrado; // al abrirse, el UNO se reinicia y manda HELLO
        } catch (e) {
            console.log(`[puente] no se pudo abrir ${args.puerto}: ${e.message}`);
        }
        if (!salir) {
            console.log('[puente] reintento en 3 s...');
            await esperar(3000);
        }
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().then((codigo) => process.exit(codigo)).catch((e) => {
        console.error(e.message);
        process.exit(1);
    });
}
