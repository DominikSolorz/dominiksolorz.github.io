#!/usr/bin/env python3
"""Build lightweight, responsive HOME SECURITY WebP images for GitHub Pages.

The high-resolution PNG originals remain in the repository and are served only
when a visitor explicitly opens a full-size design board. The source-site HTML
keeps PNG/JPEG fallback images for local development and old browsers; the
production site contains these generated WebP <picture> alternatives.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageOps

# Output names and widths are stable API contracts with design/marketing/*.html.
# Keep changes to these names coordinated with <source srcset>.
SOURCES = (
    ("kamera/assets/ds-logo.jpg", (96,), 82),
    ("kamera/assets/home-security-hero.png", (480, 900), 74),
    ("kamera/assets/home-security-how-it-works.png", (480, 900), 73),
    ("docs/ui-193/01-pulpit.png", (480, 960), 73),
    ("docs/ui-193/02-sterowanie.png", (480, 960), 73),
    ("docs/ui-193/03-nagrania.png", (480, 960), 73),
    ("docs/ui-193/04-ustawienia.png", (480, 960), 73),
    ("docs/ui-193/05-diagnostyka.png", (480, 960), 73),
    ("docs/ui-193/06-alarmy.png", (480, 960), 73),
    ("docs/ui-193/07-telefon.png", (480, 960), 73),
    ("docs/ui-193/08-konto-i-przyciski.png", (480, 960), 73),
)


def destination_name(source_name: str, width: int) -> str:
    source = Path(source_name)
    if source.parts[0] == "docs":
        return str(source.parent / "optimized" / f"{source.stem}-{width}.webp")
    return str(source.parent / "optimized" / f"{source.stem}-{width}.webp")


def optimize(source_root: Path, distribution_root: Path) -> None:
    total_original = 0
    total_desktop = 0
    total_mobile = 0
    for name, widths, quality in SOURCES:
        source = source_root / name
        if not source.is_file():
            raise FileNotFoundError(f"Missing original product image: {source}")
        original_size = source.stat().st_size
        total_original += original_size
        with Image.open(source) as original:
            original = ImageOps.exif_transpose(original)
            if original.mode in ("RGBA", "LA") or "transparency" in original.info:
                rgba = original.convert("RGBA")
                background = Image.new("RGBA", rgba.size, (11, 12, 16, 255))
                background.alpha_composite(rgba)
                prepared = background.convert("RGB")
            else:
                prepared = original.convert("RGB")
            sizes = []
            for width in widths:
                # Never upscale an original. Height is derived from the source
                # aspect ratio and exposed in native WebP metadata.
                actual_width = min(width, prepared.width)
                height = round(prepared.height * actual_width / prepared.width)
                resized = prepared.resize((actual_width, height), Image.Resampling.LANCZOS)
                relative = Path(destination_name(name, width))
                output = distribution_root / relative
                output.parent.mkdir(parents=True, exist_ok=True)
                resized.save(output, "WEBP", quality=quality, method=6)
                with Image.open(output) as result:
                    if result.format != "WEBP" or result.width != actual_width:
                        raise ValueError(f"Invalid WebP output: {output}")
                bytes_used = output.stat().st_size
                if bytes_used >= original_size:
                    raise ValueError(f"Optimized image larger than the original: {output}")
                sizes.append(bytes_used)
                print(f"{relative}: {actual_width}x{height}, {bytes_used/1024:.0f} KiB "
                      f"(source {original_size/1024:.0f} KiB)")
            total_mobile += sizes[0]
            total_desktop += sizes[-1]
    print(f"Mobile responsive image set: {total_mobile/1024:.0f} KiB, "
          f"versus {total_original/1024:.0f} KiB source PNG/JPEG")
    print(f"Desktop responsive image set: {total_desktop/1024:.0f} KiB, "
          f"versus {total_original/1024:.0f} KiB source PNG/JPEG")
    print(f"Mobile image bytes reduced by {100 * (1 - total_mobile/total_original):.1f}%")
    print(f"Desktop image bytes reduced by {100 * (1 - total_desktop/total_original):.1f}%")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("."))
    parser.add_argument("--dest", type=Path, default=Path("_site"))
    args = parser.parse_args()
    optimize(args.source.resolve(), args.dest.resolve())
