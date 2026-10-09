from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
MASCOT_PATH = ROOT / "assets/images/waylog-label/waylog-logo-mark-trimmed.png"
LABEL_DIR = ROOT / "assets/images/waylog-label"

SIZE = 1024
APP_ICON_SIZE = 512
FAVICON_SIZE = 48
MASCOT_WIDTH = 640
MASCOT_POSITION = (192, 202)
ANDROID_FOREGROUND_SIZE = 512
ANDROID_FOREGROUND_MASCOT_WIDTH = 300
ANDROID_FOREGROUND_MASCOT_Y = 114
WARM_MAIN = (242, 205, 104)
WARM_SOFT = (255, 240, 184)


def draw_sunburst() -> Image.Image:
    image = Image.new("RGB", (SIZE, SIZE), WARM_SOFT)
    draw = ImageDraw.Draw(image)
    center = (SIZE // 2, SIZE // 2 + 26)
    radius = int(SIZE * 0.82)
    ray_count = 18

    for index in range(0, ray_count, 2):
        start = (index / ray_count) * math.tau - math.pi / 2
        end = ((index + 1) / ray_count) * math.tau - math.pi / 2
        draw.polygon(
            [
                center,
                (
                    center[0] + math.cos(start) * radius,
                    center[1] + math.sin(start) * radius,
                ),
                (
                    center[0] + math.cos(end) * radius,
                    center[1] + math.sin(end) * radius,
                ),
            ],
            fill=WARM_MAIN,
        )

    return image


def optimize_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    quantized = image.convert("RGB").quantize(
        colors=256,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.FLOYDSTEINBERG,
    )
    quantized.save(path, optimize=True)


def create_primary_icon(source_mascot: Image.Image) -> Image.Image:
    mascot_height = round(source_mascot.height * MASCOT_WIDTH / source_mascot.width)
    mascot = source_mascot.resize(
        (MASCOT_WIDTH, mascot_height),
        Image.Resampling.LANCZOS,
    )
    icon = draw_sunburst().convert("RGBA")
    icon.alpha_composite(mascot, MASCOT_POSITION)
    return icon.convert("RGB")


def save_android_foreground(source_mascot: Image.Image) -> None:
    bbox = source_mascot.getbbox()
    if not bbox:
        return

    trimmed = source_mascot.crop(bbox)
    mascot_height = round(
        trimmed.height * ANDROID_FOREGROUND_MASCOT_WIDTH / trimmed.width,
    )
    resized = trimmed.resize(
        (ANDROID_FOREGROUND_MASCOT_WIDTH, mascot_height),
        Image.Resampling.LANCZOS,
    )
    foreground = Image.new(
        "RGBA",
        (ANDROID_FOREGROUND_SIZE, ANDROID_FOREGROUND_SIZE),
        (0, 0, 0, 0),
    )
    foreground.alpha_composite(
        resized,
        (
            (ANDROID_FOREGROUND_SIZE - ANDROID_FOREGROUND_MASCOT_WIDTH) // 2,
            ANDROID_FOREGROUND_MASCOT_Y,
        ),
    )
    foreground.save(
        LABEL_DIR / "android-icon-foreground-waylog-label.png",
        optimize=True,
    )


def main() -> None:
    source_mascot = Image.open(MASCOT_PATH).convert("RGBA")
    primary_icon = create_primary_icon(source_mascot)

    optimize_png(
        primary_icon.resize((APP_ICON_SIZE, APP_ICON_SIZE), Image.Resampling.LANCZOS),
        LABEL_DIR / "app-icon-waylog-label.png",
    )
    optimize_png(
        primary_icon.resize((FAVICON_SIZE, FAVICON_SIZE), Image.Resampling.LANCZOS),
        LABEL_DIR / "favicon-waylog-label.png",
    )
    save_android_foreground(source_mascot)


if __name__ == "__main__":
    main()
