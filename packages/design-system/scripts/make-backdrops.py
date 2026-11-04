"""The two backdrops (light and dark) for a rebranded CogniPulse app, from its own tokens.json.

Reads the client's colours from tokens.json (no colour is typed here), so every
prototype runs the same script after `npm run tokens`:

  light: the page colour (color.light.background), a wash in brand.backdrop.light.deep
         and a pale tint of the primary lower right, three hairline arcs in the
         primary, the ink (color.dark.card) and one thread in color.dark.primary
  dark:  color.dark.background, a lift in color.dark.card, the same arcs in
         color.dark.accent, color.light.primary and the thread

  python3 scripts/make-backdrops.py            quiet (default: banks and government)
  python3 scripts/make-backdrops.py --loud     stronger arcs and wash

Writes public/brand/light-backdrop.webp and dark-backdrop.webp beside tokens.json
and prints each file's greyscale spread: quiet targets under ~20 overall and
under ~12 mid-frame, so the glass still reads as glass. Deterministic.
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKENS = json.load(open(os.path.join(ROOT, "tokens.json")))
OUT = os.path.join(ROOT, "public", "brand")
LOUD = "--loud" in sys.argv


def token(path):
    """A colour token's value, following {a.b.c} references."""
    node = TOKENS
    for k in path.split("."):
        node = node[k]
    v = node.get("$value") if isinstance(node, dict) else node
    m = re.fullmatch(r"\{(.+)\}", str(v).strip())
    return token(m.group(1)) if m else str(v).strip()


def rgb(path, fallback=None):
    try:
        h = token(path).lstrip("#")
    except (KeyError, TypeError, AttributeError):
        if fallback is None:
            raise
        return fallback
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


PAPER = rgb("color.light.background")
INK = rgb("color.dark.card")
PRIMARY = rgb("color.light.primary")
THREAD = rgb("color.dark.primary")
MIST = rgb("brand.backdrop.light.deep", PAPER * 0.96)
TINT = PRIMARY * 0.15 + np.array([255, 255, 255], float) * 0.85
NIGHT = rgb("color.dark.background")
LIFT = INK
GLOW = rgb("color.dark.accent", THREAD)

W, H = 2560, 1440
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
NX, NY = XX / W, YY / H
AX = XX / H
CX, CY = 1.92, 1.25
K = 2.0 if LOUD else 1.0


def blur(a, r):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), "L")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255.0


def hairline(R, width=0.0022):
    d = np.abs(np.sqrt((AX - CX) ** 2 + (NY - CY) ** 2) - R)
    return np.exp(-(d / width) ** 2).astype(np.float32)


def soft(cx, cy, sx, sy):
    return np.exp(-(((NX - cx) / sx) ** 2 + ((NY - cy) / sy) ** 2)).astype(np.float32)


def mix(base, col, a):
    a = np.clip(a, 0, 1)[..., None]
    return base * (1 - a) + col * a


def save(img, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").save(path, "WEBP", quality=90, method=6)
    g = np.asarray(Image.open(path).convert("L"), float)
    mid = g[H // 3: 2 * H // 3, W // 4: 3 * W // 4]
    print(f"{name}: spread {np.percentile(g, 99.5) - np.percentile(g, 0.5):.0f}  mid-frame {np.percentile(mid, 99.5) - np.percentile(mid, 0.5):.0f}  mean {g.mean():.0f}")


light = np.broadcast_to(PAPER, (H, W, 3)).copy()
light = mix(light, MIST, blur(soft(0.92, 0.95, 0.5, 0.5), 60) * 0.9)
light = mix(light, TINT, blur(soft(0.85, 1.0, 0.35, 0.3), 40) * 0.55 * K)
for r, a, col in ((0.95, 0.10, PRIMARY), (1.12, 0.07, INK), (1.30, 0.05, THREAD)):
    light = mix(light, col, blur(hairline(r), 1.5) * a * K)
save(light, "light-backdrop.webp")

dark = np.broadcast_to(NIGHT, (H, W, 3)).copy()
dark = mix(dark, LIFT, blur(soft(0.9, 0.95, 0.5, 0.5), 60) * 0.9)
dark = mix(dark, INK, blur(soft(0.85, 1.0, 0.35, 0.3), 40) * 0.35 * K)
for r, a, col in ((0.95, 0.16, GLOW), (1.12, 0.10, PRIMARY), (1.30, 0.07, THREAD)):
    dark = mix(dark, col, blur(hairline(r), 1.5) * a * K)
save(dark, "dark-backdrop.webp")
