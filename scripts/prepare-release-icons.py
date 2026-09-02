#!/usr/bin/env python3
"""Derive Expo/Android icon assets from approved assets/icon_gpt.png master."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'assets' / 'icon_gpt.png'
OUT_ICON = ROOT / 'assets' / 'icon.png'
OUT_FG = ROOT / 'assets' / 'android-icon-foreground.png'
OUT_BG = ROOT / 'assets' / 'android-icon-background.png'
OUT_MONO = ROOT / 'assets' / 'android-icon-monochrome.png'
OUT_STORE = ROOT / 'release-artifacts' / 'icon-512.png'

CANVAS = 1024
# Adaptive safe zone ~66%; use 72% scale for squircle/circle mask headroom.
FOREGROUND_SCALE = 0.72
BACKGROUND_COLOR = (232, 240, 245, 255)


def load_master() -> Image.Image:
	if not MASTER.exists():
		raise SystemExit(f'Master icon missing: {MASTER}')
	image = Image.open(MASTER).convert('RGBA')
	return image


def fit_center(image: Image.Image, size: int) -> Image.Image:
	ratio = min(size / image.width, size / image.height)
	new_w = max(1, int(image.width * ratio))
	new_h = max(1, int(image.height * ratio))
	resized = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
	canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
	offset = ((size - new_w) // 2, (size - new_h) // 2)
	canvas.paste(resized, offset)
	return canvas


def solid_background(size: int, color: tuple[int, int, int, int]) -> Image.Image:
	return Image.new('RGBA', (size, size), color)


def to_monochrome(image: Image.Image) -> Image.Image:
	gray = image.convert('L')
	# White glyph on transparent background for Android themed icon slot.
	mono = Image.new('RGBA', gray.size, (0, 0, 0, 0))
	pixels = mono.load()
	gray_pixels = gray.load()
	for y in range(gray.height):
		for x in range(gray.width):
			value = gray_pixels[x, y]
			if value > 240:
				continue
			alpha = max(0, min(255, 255 - value))
			pixels[x, y] = (255, 255, 255, alpha)
	return mono


def main() -> None:
	master = load_master()
	print(f'Master: {MASTER} {master.size} {master.mode}')

	OUT_STORE.parent.mkdir(parents=True, exist_ok=True)

	standard = fit_center(master, CANVAS)
	standard_rgb = standard.convert('RGB')
	standard_rgb.save(OUT_ICON, format='PNG', optimize=True)

	foreground = fit_center(master, int(CANVAS * FOREGROUND_SCALE))
	fg_canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
	offset = (
		(CANVAS - foreground.width) // 2,
		(CANVAS - foreground.height) // 2,
	)
	fg_canvas.paste(foreground, offset, foreground)
	fg_canvas.save(OUT_FG, format='PNG', optimize=True)

	background = solid_background(CANVAS, BACKGROUND_COLOR)
	background.save(OUT_BG, format='PNG', optimize=True)

	mono = to_monochrome(fit_center(master, int(CANVAS * FOREGROUND_SCALE)))
	mono_canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
	mono_offset = (
		(CANVAS - mono.width) // 2,
		(CANVAS - mono.height) // 2,
	)
	mono_canvas.paste(mono, mono_offset, mono)
	mono_canvas.save(OUT_MONO, format='PNG', optimize=True)

	store = fit_center(master, 512).convert('RGB')
	store.save(OUT_STORE, format='PNG', optimize=True)

	print(f'Wrote {OUT_ICON}')
	print(f'Wrote {OUT_FG}')
	print(f'Wrote {OUT_BG}')
	print(f'Wrote {OUT_MONO}')
	print(f'Wrote {OUT_STORE}')


if __name__ == '__main__':
	main()
