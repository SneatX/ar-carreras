# Genera los íconos PNG de la app (se ejecuta una vez: python3 scripts/make-icons.py)
import sys
from PIL import Image, ImageDraw, ImageFilter

def icon(size, maskable=False):
    s = 4  # supersampling
    S = size * s
    img = Image.new('RGBA', (S, S), (11, 13, 18, 255))
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    for (cx, cy, col) in [(0.2, 0.15, (76, 201, 240)), (0.9, 0.35, (239, 71, 111)), (0.5, 1.0, (255, 183, 3))]:
        r = S * 0.45
        g.ellipse([cx * S - r, cy * S - r, cx * S + r, cy * S + r], fill=col + (120,))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.12))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    # Cubo isométrico (símbolo de 3D/AR)
    k = 0.62 if maskable else 0.78
    c = S / 2
    r = S * 0.3 * k / 0.78
    import math
    pts = [(c + r * math.cos(math.radians(a)), c + r * math.sin(math.radians(a))) for a in (-90, -30, 30, 90, 150, 210)]
    top = [pts[0], pts[1], (c, c), pts[5]]
    left = [pts[5], (c, c), pts[3], pts[4]]
    right = [(c, c), pts[1], pts[2], pts[3]]
    d.polygon(top, fill=(76, 201, 240, 255))
    d.polygon(left, fill=(239, 71, 111, 255))
    d.polygon(right, fill=(255, 183, 3, 255))
    w = int(S * 0.012)
    for poly in (top, left, right):
        d.line(poly + [poly[0]], fill=(11, 13, 18, 255), width=w, joint='curve')
    # Esquinas de "visor" de cámara
    m = S * (0.2 if maskable else 0.12)
    L = S * 0.12
    lw = int(S * 0.03)
    col = (244, 246, 251, 255)
    for (x, y, dx, dy) in [(m, m, 1, 1), (S - m, m, -1, 1), (m, S - m, 1, -1), (S - m, S - m, -1, -1)]:
        d.line([(x, y + dy * L), (x, y), (x + dx * L, y)], fill=col, width=lw, joint='curve')
    return img.resize((size, size), Image.LANCZOS)

out = sys.argv[1] if len(sys.argv) > 1 else 'public/icons'
icon(192).save(f'{out}/icon-192.png')
icon(512).save(f'{out}/icon-512.png')
icon(512, maskable=True).save(f'{out}/icon-maskable-512.png')
icon(180).convert('RGB').save(f'{out}/apple-touch-icon.png')
print('ok')
