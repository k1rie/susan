# Variante con el componente de registro `motion-blur` en la ficha (en lugar del filtro SVG + fantasmas).
import re, os, sys
raiz = sys.argv[1]
s = open(os.path.join(raiz, 'compositions/frames/s99-piloto.html')).read()
comp = open(os.path.join(raiz, 'compositions/components/motion-blur.html')).read()
m = re.search(r'<script>.*?</script>', comp, re.S)
snippet = m.group(0)
i = s.index("conRastro({ el: $('d-ficha')")
j = s.index("} });", i) + len("} });")
s = s[:i] + "tl.fromTo(mov, { y: DESDE }, { y: 0, duration: 0.32, ease: 'power2.in' }, 5.2);" + s[j:]
s = s.replace('<div id="s99-piloto-d-mov" class="s99-ficha-mov">',
              '<div id="s99-piloto-d-mov" class="s99-ficha-mov" data-hf-motion-blur=\'{"shutterAngle":360,"samplesPerFrame":8,"fps":%s}\'>' % sys.argv[2])
s = s.replace('<script src="assets/vendor/gsap.min.js"></script>', '<script src="assets/vendor/gsap.min.js"></script>\n' + snippet)
s = s.replace("window.__timelines[ID] = tl;", "tl.set({}, {}, 6);\n        window.__timelines[ID] = tl;")
open(os.path.join(raiz, 'compositions/frames/s99-piloto-mb.html'), 'w').write(s)
h = open(os.path.join(raiz, 'index.html')).read().replace('compositions/frames/s99-piloto.html', 'compositions/frames/s99-piloto-mb.html')
open(os.path.join(raiz, 'medicion-full-mb.html'), 'w').write(h)
print('ok')
