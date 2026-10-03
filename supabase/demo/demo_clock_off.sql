-- Quita el reloj de demostración: el sistema vuelve a usar el reloj real.
ALTER DATABASE postgres RESET app.fake_now;
ALTER DATABASE postgres RESET app.allow_fake_clock;
