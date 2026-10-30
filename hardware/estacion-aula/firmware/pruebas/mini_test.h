// mini_test.h - Arnés de pruebas mínimo (un solo archivo, sin dependencias).
//
// PRUEBA(nombre) { ... } registra un caso; AFIRMA / AFIRMA_INT / AFIRMA_STR
// cuentan y reportan los fallos sin abortar el caso. ejecutar() corre todos los
// casos; con aislar=true cada caso corre en su propio proceso (fork), útil
// cuando el código bajo prueba tiene estado global (el sketch .ino lo tiene).
#ifndef SUSAN_MINI_TEST_H
#define SUSAN_MINI_TEST_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <string>
#include <vector>
#include <sys/wait.h>
#include <unistd.h>

namespace mt {

struct Caso {
    const char* nombre;
    void (*fn)();
};

inline std::vector<Caso>& casos() {
    static std::vector<Caso> v;
    return v;
}
inline int& fallos() {
    static int f = 0;
    return f;
}
inline int& afirmaciones() {
    static int a = 0;
    return a;
}

struct Registro {
    Registro(const char* n, void (*f)()) { casos().push_back({n, f}); }
};

inline void fallo(const char* archivo, int linea, const std::string& msg) {
    ++fallos();
    printf("    FALLO %s:%d: %s\n", archivo, linea, msg.c_str());
}

inline std::string comillas(const std::string& s) {
    std::string r = "\"";
    for (size_t i = 0; i < s.size(); i++) {
        unsigned char c = (unsigned char)s[i];
        if (c == '\n') r += "\\n";
        else if (c < 0x20 || c >= 0x7F) { char b[8]; snprintf(b, sizeof b, "\\x%02X", c); r += b; }
        else r += (char)c;
    }
    return r + "\"";
}

// Corre los casos. Devuelve el código de salida del proceso (0 = todo bien).
inline int ejecutar(const char* titulo, bool aislar) {
    printf("== %s\n", titulo);
    int casosFallidos = 0;
    int totalAfirmaciones = 0;
    for (size_t i = 0; i < casos().size(); i++) {
        const Caso& c = casos()[i];
        int antes = fallos();
        if (aislar) {
            fflush(stdout);
            pid_t pid = fork();
            if (pid == 0) {
                c.fn();
                fflush(stdout);
                _exit(fallos() == 0 ? 0 : 1);
            }
            int estado = 0;
            waitpid(pid, &estado, 0);
            bool ok = WIFEXITED(estado) && WEXITSTATUS(estado) == 0;
            printf("%s %s\n", ok ? "  ok  " : "  FALLA", c.nombre);
            if (!ok) casosFallidos++;
            continue;
        }
        c.fn();
        bool ok = fallos() == antes;
        printf("%s %s\n", ok ? "  ok  " : "  FALLA", c.nombre);
        if (!ok) casosFallidos++;
    }
    totalAfirmaciones = afirmaciones();
    printf("-- %zu casos, %d fallidos", casos().size(), casosFallidos);
    if (!aislar) printf(", %d afirmaciones", totalAfirmaciones);
    printf("\n");
    return casosFallidos == 0 ? 0 : 1;
}

}  // namespace mt

#define PRUEBA(nombre)                                         \
    static void nombre();                                      \
    static mt::Registro registro_##nombre(#nombre, nombre);    \
    static void nombre()

#define AFIRMA(cond)                                                   \
    do {                                                               \
        ++mt::afirmaciones();                                          \
        if (!(cond)) mt::fallo(__FILE__, __LINE__, "se esperaba: " #cond); \
    } while (0)

// Como AFIRMA, pero aborta el caso si falla (para no indexar datos que no existen).
#define REQUIERE(cond)                                                          \
    do {                                                                        \
        ++mt::afirmaciones();                                                   \
        if (!(cond)) {                                                          \
            mt::fallo(__FILE__, __LINE__, "se requería: " #cond);               \
            return;                                                             \
        }                                                                       \
    } while (0)

#define AFIRMA_INT(esperado, real)                                              \
    do {                                                                        \
        ++mt::afirmaciones();                                                   \
        long long e__ = (long long)(esperado), r__ = (long long)(real);         \
        if (e__ != r__)                                                         \
            mt::fallo(__FILE__, __LINE__,                                       \
                      std::string(#real " = ") + std::to_string(r__) +          \
                          ", se esperaba " + std::to_string(e__));              \
    } while (0)

#define AFIRMA_STR(esperado, real)                                              \
    do {                                                                        \
        ++mt::afirmaciones();                                                   \
        std::string e__ = (esperado), r__ = (real);                             \
        if (e__ != r__)                                                         \
            mt::fallo(__FILE__, __LINE__,                                       \
                      std::string(#real " = ") + mt::comillas(r__) +            \
                          ", se esperaba " + mt::comillas(e__));                \
    } while (0)

#endif  // SUSAN_MINI_TEST_H
