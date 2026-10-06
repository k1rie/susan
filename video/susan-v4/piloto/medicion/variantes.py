# Genera variantes por tramo del piloto: el tramo elegido empieza en 0 y los demás quedan ocultos (data-hidden).
# Las variantes «sin-*» apagan solo la técnica cara para aislar su costo frente a la misma escena.
import re, sys, os
raiz = sys.argv[1]
src = open(os.path.join(raiz, 'compositions/frames/s99-piloto.html')).read()
host = open(os.path.join(raiz, 'index.html')).read()
tramos = {'a': (0, 1.4), 'a2': (1.4, 1.0), 'b': (2.4, 1.4), 'c': (3.8, 1.4), 'd': (5.2, 0.8)}
variantes = {
    'vacio': ('vacio', []),
    'a': ('a', []),
    'a-sin-placas': ('a', [('<img id="s99-piloto-a-placa6"', '<img style="display:none" id="s99-piloto-a-placa6"'),
                            ('<img id="s99-piloto-a-placa24"', '<img style="display:none" id="s99-piloto-a-placa24"')]),
    'a2': ('a2', []),
    'a2-sin-blur': ('a2', [("desenfoque($('a2-escena'), 1.42, 0.85, 24, 'power2.out');", '')]),
    'a2-max': ('a2', [("desenfoque($('a2-escena'), 1.42, 0.85, 24, 'power2.out');", "desenfoque($('a2-escena'), 1.42, 50, 24, 'none');")]),
    'a2-max-quieto': ('a2', [("desenfoque($('a2-escena'), 1.42, 0.85, 24, 'power2.out');", "desenfoque($('a2-escena'), 1.42, 50, 24, 'none');"),
                             ("tl.fromTo($('a2-mundo'), { scale: 1.12 }, { scale: 1, duration: 1.0, ease: 'power3.out' }, 1.4);", '')]),
    'a2-quieto': ('a2', [("desenfoque($('a2-escena'), 1.42, 0.85, 24, 'power2.out');", ''),
                         ("tl.fromTo($('a2-mundo'), { scale: 1.12 }, { scale: 1, duration: 1.0, ease: 'power3.out' }, 1.4);", '')]),
    'b': ('b', []),
    'b-plano': ('b', [('{ rotationX: 8, rotationY: -10, z: -160, y: 40 }', '{ rotationX: 0, rotationY: 0, z: 0, y: 40 }')]),
    'c': ('c', []),
    'c-sin-filtro': ('c', [("eje: 'y', max: 16,", "eje: 'y', max: 0,")]),
    'd': ('d', []),
    'd-sin-estela': ('d', [("eje: 'y', max: 26,", "eje: 'y', max: 0,"), ('0.32 * fuerza', '0'), ('0.16 * fuerza', '0')]),
}
os.makedirs(os.path.join(raiz, 'compositions/frames/med'), exist_ok=True)
for nombre, (tramo, reps) in variantes.items():
    ini, dur = tramos.get(tramo, (0, 1.4))
    s = src
    for a, b in reps:
        assert a in s, (nombre, a)
        s = s.replace(a, b)
    for otro in ['a', 'a2', 'b', 'c', 'd']:
        pat = re.compile(r'<div id="s99-piloto-%s" class="clip s99-seg" data-start="[0-9.]+" data-duration="[0-9.]+"' % otro)
        m = pat.search(s)
        assert m, otro
        if otro == tramo:
            rep = '<div id="s99-piloto-%s" class="clip s99-seg" data-start="0" data-duration="%s"' % (otro, dur)
        else:
            rep = m.group(0) + ' data-hidden'
        s = s[:m.start()] + rep + s[m.end():]
    s = s.replace('data-composition-id="s99-piloto" data-start="0" data-duration="6"',
                  'data-composition-id="s99-piloto" data-start="0" data-duration="%s"' % dur)
    s = s.replace('<div id="s99-piloto-bg" class="clip" data-start="0" data-duration="6"',
                  '<div id="s99-piloto-bg" class="clip" data-start="0" data-duration="%s"' % dur)
    if ini > 0:
        s = s.replace("window.__timelines[ID] = tl;",
                      "tl.shiftChildren(-%s, false, %s);\n        window.__timelines[ID] = tl;" % (ini, ini - 0.001))
    open(os.path.join(raiz, 'compositions/frames/med/s99-piloto-%s.html' % nombre), 'w').write(s)
    h = host.replace('data-duration="6"', 'data-duration="%s"' % dur)
    h = h.replace('compositions/frames/s99-piloto.html', 'compositions/frames/med/s99-piloto-%s.html' % nombre)
    open(os.path.join(raiz, 'medicion-%s.html' % nombre), 'w').write(h)
print(' '.join(variantes))
