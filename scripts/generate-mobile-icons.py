#!/usr/bin/env python3
"""Generate the Driiva mobile icon and splash assets from the canonical brand files.

Before this script the mobile assets were the Expo template's grey concentric
circles. The composition here matches the established Driiva app icon
(design-system/assets/logo-app-artifact.png, shipped on web as
client/public/icons/*): the driiva wordmark, self-lit white, sitting on the
brand amber-to-indigo wash.

One correction to that artefact: it bakes a rounded square into the bitmap, so
iOS and Android round an already-rounded card and the icon reads as a sticker.
Here the wash is full bleed and the platform supplies the only corner radius.

Sources (design-system/assets, authoritative):
  logo-variation-1.png      the crisp black-on-white wordmark, the sharpest master
  gradient-background.png   the brand amber-to-indigo wash used as surface

Outputs (mobile/assets/images):
  icon.png                     1024 opaque, wordmark on the brand wash
  adaptive-icon.png            1024 transparent Android foreground, inside the safe zone
  adaptive-icon-background.png 1024 opaque Android background, the wash alone
  splash-icon.png              1024 transparent, wordmark for `contain` over --app-bg
  favicon.png                  64 opaque, wordmark on the brand wash

Outputs (client/public), the web PWA set, which carried the same nested-card
defect and now shares one composition with mobile:
  icons/icon-{72..512}.png     opaque, wordmark on the brand wash
  apple-touch-icon.png         180 opaque (was a JPEG wearing a .png extension)

Instrument Glass rule applied here: the gradient is the surface beneath the
wordmark, never a fill applied to the letterforms. The mark stays white.

Run: python3 scripts/generate-mobile-icons.py
Requires Pillow. Re-run only when the brand assets change.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "design-system" / "assets"
OUT = ROOT / "mobile" / "assets" / "images"
WEB = ROOT / "client" / "public"

WEB_ICON_SIZES = (72, 96, 128, 144, 152, 180, 192, 384, 512)

# design-system/colors_and_type.css --app-bg
APP_BG = "#0a0a14"

# Android masks the adaptive foreground down to the centre 66%, so the wordmark
# has to sit well inside that or the platform crops the letterforms.
ICON_WORDMARK_WIDTH = 0.72
ADAPTIVE_WORDMARK_WIDTH = 0.56
SPLASH_WORDMARK_WIDTH = 0.68


def white_wordmark() -> Image.Image:
    """The wordmark as white ink on transparency, taken from the crisp master.

    The master is black on white, so luminance inverts straight into alpha and
    the anti-aliased edges survive intact.
    """
    source = Image.open(SRC / "logo-variation-1.png").convert("L")
    lum = np.asarray(source).astype(np.float32)

    mark = np.zeros(lum.shape + (4,), dtype=np.uint8)
    mark[..., :3] = 255
    mark[..., 3] = (255.0 - lum).astype(np.uint8)

    img = Image.fromarray(mark, "RGBA")
    return img.crop(img.getbbox())


def brand_surface(size: int) -> Image.Image:
    """Square crop of the brand wash, amber on the left, indigo on the right."""
    wash = Image.open(SRC / "gradient-background.png").convert("RGB")
    side = min(wash.size)
    left = (wash.width - side) // 2
    top = (wash.height - side) // 2
    return wash.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)


def place_wordmark(canvas: Image.Image, width_ratio: float) -> None:
    """Centre the wordmark on the canvas at a share of the canvas width."""
    mark = white_wordmark()
    width = round(canvas.width * width_ratio)
    height = round(mark.height * width / mark.width)
    sized = mark.resize((width, height), Image.LANCZOS)
    canvas.alpha_composite(sized, ((canvas.width - width) // 2, (canvas.height - height) // 2))


def build_icon(size: int) -> Image.Image:
    canvas = brand_surface(size).convert("RGBA")
    place_wordmark(canvas, ICON_WORDMARK_WIDTH)
    return canvas.convert("RGB")


def build_adaptive_foreground(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    place_wordmark(canvas, ADAPTIVE_WORDMARK_WIDTH)
    return canvas


def build_splash(size: int) -> Image.Image:
    """Splash art: the wordmark alone, for `contain` over the brand dark.

    Restraint over spectacle. The brand dark is the surface and the wordmark is
    the only thing lit, so the first frame of the app already reads as the
    instrument rather than as a poster.
    """
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    place_wordmark(canvas, SPLASH_WORDMARK_WIDTH)
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    written = {
        "icon.png": build_icon(1024),
        "adaptive-icon.png": build_adaptive_foreground(1024),
        "adaptive-icon-background.png": brand_surface(1024),
        "splash-icon.png": build_splash(1024),
        "favicon.png": build_icon(64),
    }
    for name, image in written.items():
        image.save(OUT / name)
        check = Image.open(OUT / name)
        print(f"mobile/{name}: {check.size[0]}x{check.size[1]} {check.mode}")

    (WEB / "icons").mkdir(parents=True, exist_ok=True)
    for size in WEB_ICON_SIZES:
        build_icon(size).save(WEB / "icons" / f"icon-{size}x{size}.png")
    build_icon(180).save(WEB / "apple-touch-icon.png")
    print(f"client/public: {len(WEB_ICON_SIZES)} PWA icons plus apple-touch-icon.png, all real PNG")

    print(f"app.json splash backgroundColor should be {APP_BG}")


if __name__ == "__main__":
    main()
