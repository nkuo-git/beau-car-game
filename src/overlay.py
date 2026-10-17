# 把車的圖（shot.mjs 加 bg=none 拍的，透明背景）疊到照片上：python3 overlay.py photo.jpg render.png out.png [透明度 0.55]
# 另外寫 out-side.png：照片和圖左右並排
import sys
from PIL import Image
photo, render, out = sys.argv[1:4]
a = float(sys.argv[4]) if len(sys.argv) > 4 else 0.55
P = Image.open(photo).convert('RGBA')
R = Image.open(render).convert('RGBA').resize(P.size)
r, g, b, al = R.split()
R.putalpha(al.point(lambda v: int(v * a)))
Image.alpha_composite(P, R).convert('RGB').save(out)
S = Image.new('RGB', (P.width * 2, P.height), 'white')
S.paste(P.convert('RGB'), (0, 0)); bg = Image.new('RGBA', P.size, (217, 220, 225, 255)); S.paste(Image.alpha_composite(bg, Image.open(render).convert('RGBA').resize(P.size)).convert('RGB'), (P.width, 0))
S.save(out.rsplit('.', 1)[0] + '-side.png')
print(out)
