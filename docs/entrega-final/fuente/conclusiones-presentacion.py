import json, base64
bg = base64.b64encode(open('img-000.png','rb').read()).decode()
P = [
 ('Casanova Pérez Gabriela','Desarrolladora',
  'Antes de este proyecto veía los métodos numéricos como una materia de fórmulas para el examen. Al trabajar en SUSAN me di cuenta de que sirven para algo muy concreto: con las faltas de cada semana podemos ver hacia dónde va un grupo y avisar a tiempo, antes de que un compañero pierda el derecho a examen. Me gustó mucho que lo que aprendimos en clase terminara en una herramienta que de verdad le ahorraría tiempo a un maestro.'),
 ('González Guerrero Diego Enrique','Scrum Master',
  'Como Scrum Master me tocó ver el proyecto completo y entender cómo encajaba cada parte. Lo que más me quedó es que los métodos numéricos no se quedan en el pizarrón: cuando los programas, tienes que pensar qué pasa si faltan datos o si un resultado sale raro. Ver que la computadora podía decirnos en qué semana un grupo llegaría al límite de faltas me hizo entender por qué la ingeniería depende tanto de estas herramientas.'),
 ('Escobar Domínguez Josué Gabriel','Product Owner',
  'Mi papel fue cuidar que el sistema respondiera a lo que de verdad necesita un docente. Al principio solo pensamos en pasar lista más rápido, pero los métodos numéricos nos permitieron ir más allá: convertir una lista de faltas en una señal clara de qué alumnos necesitan atención. Aprendí que un buen software no es solo el que funciona, sino el que ayuda a tomar mejores decisiones, y que las matemáticas son las que le dan ese valor.'),
 ('Peña Morales José Manuel','Desarrollador',
  'Lo que más me sorprendió fue darme cuenta de que los datos reales casi nunca vienen perfectos. Hay semanas sin clase, días con muchas faltas y otros sin ninguna, y aun así queríamos sacar algo útil. Ahí entendí para qué sirve lo que vimos en el semestre: rellenar huecos, suavizar los cambios bruscos y encontrar la tendencia. Trabajar con un problema de nuestra propia escuela hizo que todo tuviera mucho más sentido.'),
 ('Gómez Delgado Ades Yasir','Desarrollador',
  'Este proyecto fue la primera vez que vi los métodos numéricos funcionando dentro de una aplicación de verdad. Programar los cálculos me obligó a entenderlos bien, porque un error pequeño cambiaba todo el resultado. También aprendí a revisar que los números tengan sentido antes de confiar en ellos. Me quedo con la idea de que la ciencia y la ingeniería avanzan gracias a que podemos poner las matemáticas a trabajar en una computadora.'),
 ('Pérez Hernández Alan Eduardo','Desarrollador',
  'Este proyecto me ayudó a ver que los métodos numéricos sirven para anticiparse a los problemas, no solo para resolver ejercicios. Con unas cuantas semanas de asistencia el sistema puede estimar cómo va a cerrar el semestre y avisarle al maestro con tiempo. También me llevo lo aprendido al trabajar en equipo: repartir tareas, apoyarnos y entregar algo que funciona. Creo que es una experiencia que nos va a servir mucho en lo profesional.'),
]
def page(items, n, part):
    cards = ''.join(f'<div class="card"><div class="nom">{a}</div><div class="rol">{r}</div><p>{t}</p></div>' for a,r,t in items)
    return f'''<section class="pg"><div class="cover"></div><div class="num">PÁGINA {n} DE 22</div>
<h1>11. CONCLUSIONES.</h1><h2>11.1 Conclusiones individuales ({part}).</h2>
<p class="intro">Cada integrante del equipo comparte, con sus propias palabras, lo que significó el proyecto y la importancia de los métodos numéricos aplicados a la ciencia y la ingeniería mediante el desarrollo de software.</p>
<div class="cards">{cards}</div></section>'''
html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@page {{ size: 960pt 540pt; margin: 0 }}
* {{ box-sizing: border-box; margin: 0; padding: 0 }}
body {{ font-family: Arial, Helvetica, sans-serif; color: #1a1a1a }}
.pg {{ position: relative; width: 960pt; height: 540pt; overflow: hidden; page-break-after: always;
  background: url(data:image/png;base64,{bg}) 0 0 / 960pt 540pt no-repeat; }}
.cover {{ position: absolute; left: 0; right: 0; top: 66pt; height: 424pt; background: #fff }}
.num {{ position: absolute; right: 64pt; top: 500pt; width: 160pt; height: 18pt; background: #fff; text-align: right;
  font: bold 11.7pt Arial; color: #404040; line-height: 18pt; padding-top: 2.6pt }}
h1 {{ position: absolute; left: 65pt; top: 72pt; font: bold 28.6pt Arial; color: #001f5f; letter-spacing: .1pt }}
h2 {{ position: absolute; left: 65pt; top: 113pt; font: bold 15pt Arial; color: #001f5f }}
.intro {{ position: absolute; left: 65pt; right: 64pt; top: 137pt; font-size: 12pt; line-height: 1.45; text-align: justify }}
.cards {{ position: absolute; left: 65pt; right: 64pt; top: 182pt; display: flex; gap: 11pt }}
.card {{ flex: 1; background: #f2f5fa; border-top: 3.5pt solid #001f5f; padding: 12pt 13pt 14pt; }}
.nom {{ font: bold 13pt Arial; color: #001f5f }}
.rol {{ font-size: 10.5pt; color: #555; font-style: italic; margin: 2pt 0 8pt }}
.card p {{ font-size: 11.6pt; line-height: 1.5; text-align: justify }}
</style></head><body>{page(P[:3],19,'1 de 2')}{page(P[3:],20,'2 de 2')}</body></html>'''
open('nuevas.html','w').write(html)
