"""Generate the extension's transparent waveform icons using only Python stdlib."""

from pathlib import Path
import struct
import zlib

ICON_DIR = Path(__file__).resolve().parent.parent / "extension" / "icons"
OFFSETS = (0.125, 0.375, 0.625, 0.875)
BARS = ((0.29, 0.37, 0.63), (0.46, 0.24, 0.76), (0.63, 0.31, 0.69))


def inside_rounded_rect(x, y, left, top, right, bottom, radius):
    if not (left <= x <= right and top <= y <= bottom):
        return False
    nearest_x = max(left + radius, min(right - radius, x))
    nearest_y = max(top + radius, min(bottom - radius, y))
    return (x - nearest_x) ** 2 + (y - nearest_y) ** 2 <= radius ** 2


def color_at(x, y):
    color = (41, 37, 54, 255) if inside_rounded_rect(x, y, 0.04, 0.04, 0.96, 0.96, 0.24) else (0, 0, 0, 0)
    for left, top, bottom in BARS:
        if inside_rounded_rect(x, y, left, top, left + 0.08, bottom, 0.04):
            color = (201, 187, 255, 255)
    return color


def png_chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))


def make_icon(size):
    pixels = bytearray()
    for y in range(size):
        pixels.append(0)
        for x in range(size):
            rgba = [0, 0, 0, 0]
            for dy in OFFSETS:
                for dx in OFFSETS:
                    for channel, value in enumerate(color_at((x + dx) / size, (y + dy) / size)):
                        rgba[channel] += value
            pixels.extend(round(value / 16) for value in rgba)
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header)
            + png_chunk(b"IDAT", zlib.compress(pixels)) + png_chunk(b"IEND", b""))


if __name__ == "__main__":
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 64, 128):
        (ICON_DIR / f"icon-{size}.png").write_bytes(make_icon(size))
