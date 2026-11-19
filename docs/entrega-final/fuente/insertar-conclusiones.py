import io, sys
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.pdfbase.ttfonts import TTFont
registerFont(TTFont('AB','/System/Library/Fonts/Supplemental/Arial Bold.ttf'))
src, nuevas, out = sys.argv[1:4]
from PIL import Image
def bgc(i):
    im=Image.open(f'bg/b-{i+1:02d}.png').convert('RGB'); return [v/255 for v in im.getpixel((700,532))]
def stamp(n, i):
    b = io.BytesIO(); c = canvas.Canvas(b, pagesize=(960,540))
    c.setFillColorRGB(*bgc(i)); c.rect(760, 20, 140, 22, stroke=0, fill=1)
    c.setFillColorRGB(64/255,64/255,64/255); c.setFont('AB', 11.75)
    c.drawRightString(895.4, 540-515.6, f'PÁGINA {n} DE 22'); c.save()
    return PdfReader(b).pages[0]
r = PdfReader(src); nv = PdfReader(nuevas); w = PdfWriter()
for i in range(18):
    p = w.add_page(r.pages[i])
    if i > 0: p.merge_page(stamp(i+1, i))
for p in nv.pages: w.add_page(p)
p = w.add_page(r.pages[18]); p.merge_page(stamp(21, 18))
w.add_page(r.pages[19])
w.add_metadata({'/Title': r.metadata.get('/Title','SUSAN')})
w.compress_identical_objects(); w.write(out)
