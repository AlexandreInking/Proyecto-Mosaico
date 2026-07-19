"""Generate deterministic, original PNG fixtures for Mosaico F1 tests."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "fixtures" / "phase1"


def atlas(path: Path, columns: int, rows: int, tile_width: int, tile_height: int) -> None:
    image = Image.new("RGBA", (columns * tile_width, rows * tile_height), "#12171b")
    draw = ImageDraw.Draw(image)
    colors = ["#2a9d8f", "#e9c46a", "#f4a261", "#e76f51", "#5b8def", "#8f6ad8", "#7fb069", "#d16d9e"]
    for tile_id in range(columns * rows):
        column = tile_id % columns
        row = tile_id // columns
        left = column * tile_width
        top = row * tile_height
        color = colors[tile_id % len(colors)]
        draw.rectangle((left, top, left + tile_width - 1, top + tile_height - 1), fill=color)
        draw.line((left, top, left + tile_width - 1, top), fill="#f2f4f5")
        draw.line((left, top, left, top + tile_height - 1), fill="#f2f4f5")
        if tile_width >= 8 and tile_height >= 8:
            inset = max(2, min(tile_width, tile_height) // 4)
            draw.rectangle(
                (left + inset, top + inset, left + tile_width - inset - 1, top + tile_height - inset - 1),
                outline="#172026",
            )
    image.save(path, format="PNG", optimize=False, compress_level=9)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    atlas(OUTPUT / "atlas-8.png", 4, 2, 8, 8)
    atlas(OUTPUT / "atlas-16.png", 2, 2, 16, 16)
    atlas(OUTPUT / "atlas-rectangular.png", 3, 2, 16, 8)
    atlas(OUTPUT / "atlas-large.png", 1, 1, 64, 64)


if __name__ == "__main__":
    main()
