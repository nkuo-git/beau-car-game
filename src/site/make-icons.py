# 改車遊戲的圖示：萬能軟體的橘色車（icon-512）＋右下角的格子旗徽章（蓋掉保桿上的貼紙字：不能有真的品牌字）
# 用法：python3 make-icons.py <carid-pwa 資料夾> <輸出資料夾>
#   → <輸出>/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png（放到 src/site/icons/）
#   → <輸出>/android-res/{ic_launcher,ic_launcher_fg}.png（放到 android/app/src/main/res/mipmap-xxxhdpi/）
import sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
SS = 4
base = Image.open(src + '/icons/icon-512.png').convert('RGB')
W = 512
big = base.resize((W * SS, W * SS), Image.LANCZOS)
d = ImageDraw.Draw(big)
def P(v): return int(round(v * SS))
# 徽章：深色圓（蓋住右下角保桿上的兩個貼紙字）
cx, cy, r = 420, 394, 88
d.ellipse([P(cx - r), P(cy - r), P(cx + r), P(cy + r)], fill=(22, 25, 31), outline=(255, 106, 31), width=P(7))
# 格子旗：旗桿＋5×4 黑白格（往右上斜一點）
import math
pole_x, pole_top, pole_bot = cx - 44, cy - 54, cy + 56
d.rounded_rectangle([P(pole_x - 4), P(pole_top), P(pole_x + 4), P(pole_bot)], radius=P(3), fill=(235, 236, 238))
fx0, fy0, cw, ch, nx, ny = pole_x + 4, pole_top + 4, 18, 16, 5, 4
for i in range(nx):
    for j in range(ny):
        x0, y0 = fx0 + i * cw, fy0 + j * ch
        col = (245, 245, 245) if (i + j) % 2 == 0 else (18, 18, 20)
        d.rectangle([P(x0), P(y0), P(x0 + cw), P(y0 + ch)], fill=col)
d.rectangle([P(fx0), P(fy0), P(fx0 + nx * cw), P(fy0 + ny * ch)], outline=(235, 236, 238), width=P(2))
master = big.resize((W, W), Image.LANCZOS)
import os
os.makedirs(out + '/icons', exist_ok=True)
master.save(out + '/icons/icon-512.png', optimize=True)
master.resize((192, 192), Image.LANCZOS).save(out + '/icons/icon-192.png', optimize=True)
master.resize((180, 180), Image.LANCZOS).save(out + '/icons/apple-touch-icon.png', optimize=True)
# maskable：深色外框（萬能軟體的是橘色框）
DARK = (22, 25, 31)
m = Image.new('RGB', (512, 512), DARK)
m.paste(master.resize((410, 410), Image.LANCZOS), (51, 51))
m.save(out + '/icons/icon-maskable-512.png', optimize=True)
# Android：舊式圖示（512）＋ adaptive 前景（1024 透明，中間 660）
a = out + '/android-res'
os.makedirs(a, exist_ok=True)
master.save(a + '/ic_launcher.png', optimize=True)
fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
fg.paste(master.resize((660, 660), Image.LANCZOS).convert('RGBA'), (182, 182))
fg.save(a + '/ic_launcher_fg.png', optimize=True)
print('ok')
