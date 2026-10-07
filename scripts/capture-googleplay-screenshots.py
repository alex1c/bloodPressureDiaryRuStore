# -*- coding: utf-8 -*-
"""
Capture Google Play screenshot masters (1080x1920) for RU/EN/ES/DE.

Uses the physical device + Metro googleplay variant. Prefer a release build
for Console upload (no DEMO AD watermark); this script documents the set.
"""
from __future__ import annotations

import re
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SERIAL = "6af40c5"
DEV_URL = "exp+bp-diary://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "release-artifacts" / "screenshots" / "googleplay"
TMP = Path(r"C:\Users\alex1\AppData\Local\Temp\bp-phase4-qa")
TARGET_W, TARGET_H = 1080, 1920

# 6 key surfaces × 4 locales
SCREENS = [
	("01_diary", "diary"),
	("02_add_measurement", "form"),
	("03_charts", "charts"),
	("04_health", "health"),
	("05_medications", "meds"),
	("06_doctor_report", "report"),
]

LOCALES = {
	"ru": {
		"lang": "Русский",
		"diary": "Дневник",
		"charts": "Графики",
		"health": "Здоровье",
		"meds": "Лекарства",
		"add": "Добавить измерение",
		"report": "Отчёт врачу",
	},
	"en": {
		"lang": "English",
		"diary": "Diary",
		"charts": "Charts",
		"health": "Health",
		"meds": "Medications",
		"add": "Add reading",
		"report": "Doctor report",
	},
	"es": {
		"lang": "Español",
		"diary": "Diario",
		"charts": "Gráficos",
		"health": "Salud",
		"meds": "Medicamentos",
		"add": "Añadir medición",
		"report": "Informe médico",
	},
	"de": {
		"lang": "Deutsch",
		"diary": "Tagebuch",
		"charts": "Diagramme",
		"health": "Gesundheit",
		"meds": "Medikamente",
		"add": "Messung hinzufügen",
		"report": "Arztbericht",
	},
}


def adb(*args: str):
	return subprocess.run(
		["adb", "-s", SERIAL, *args], text=True, errors="ignore", capture_output=True
	)


def dump(name: str) -> str:
	remote = f"/sdcard/{name}.xml"
	local = TMP / f"{name}.xml"
	TMP.mkdir(parents=True, exist_ok=True)
	adb("shell", "uiautomator", "dump", remote)
	adb("pull", remote, str(local))
	return local.read_text(encoding="utf-8", errors="ignore")


def labels(xml: str):
	return [t for t in re.findall(r'text="([^"]+)"', xml) if t.strip()]


def tap_text(xml: str, needle: str, lowest: bool = False) -> bool:
	ms = list(
		re.finditer(
			rf'(?:text|content-desc)="{re.escape(needle)}"'
			rf'[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
			xml,
		)
	)
	if not ms:
		return False
	m = max(ms, key=lambda x: int(x.group(2))) if lowest else min(
		ms, key=lambda x: int(x.group(2))
	)
	x1, y1, x2, y2 = map(int, m.groups())
	ya, yb = sorted((y1, y2))
	cx, cy = (x1 + x2) // 2, ((ya + yb) // 2 if yb > ya else 200)
	adb("shell", "input", "tap", str(cx), str(cy))
	return True


def capture(path: Path) -> None:
	remote = "/sdcard/gp_shot.png"
	tmp = TMP / "gp_shot.png"
	adb("shell", "screencap", "-p", remote)
	adb("pull", remote, str(tmp))
	im = Image.open(tmp).convert("RGB")
	# Center-crop to 9:16 then scale to 1080x1920
	w, h = im.size
	target_ratio = TARGET_W / TARGET_H
	if w / h > target_ratio:
		nw = int(h * target_ratio)
		left = (w - nw) // 2
		im = im.crop((left, 0, left + nw, h))
	else:
		nh = int(w / target_ratio)
		top = (h - nh) // 2
		im = im.crop((0, top, w, top + nh))
	im = im.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
	path.parent.mkdir(parents=True, exist_ok=True)
	im.save(path, "PNG")
	print("SAVED", path.relative_to(ROOT), im.size)


def wait_home() -> str:
	adb("reverse", "tcp:8081", "tcp:8081")
	adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", DEV_URL)
	for i in range(8):
		time.sleep(2)
		xml = dump(f"h{i}")
		if any(t in labels(xml) for t in ("Дневник", "Diary", "Diario", "Tagebuch")):
			return xml
	return dump("hfail")


def set_lang(lang: str) -> None:
	adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "bp-diary://settings")
	time.sleep(2)
	xml = dump("set")
	tap_text(xml, lang)
	time.sleep(1.2)
	adb("shell", "input", "keyevent", "4")
	time.sleep(1)


def main() -> None:
	for loc, L in LOCALES.items():
		print("====", loc)
		set_lang(L["lang"])
		xml = wait_home()
		tap_text(xml, L["diary"], lowest=True)
		time.sleep(1.5)
		capture(OUT / loc / "01_diary.png")

		xml = dump("d")
		if tap_text(xml, L["add"]):
			time.sleep(1.5)
			capture(OUT / loc / "02_add_measurement.png")
			adb("shell", "input", "keyevent", "4")
			time.sleep(1)

		xml = dump("d2")
		tap_text(xml, L["charts"], lowest=True)
		time.sleep(1.5)
		capture(OUT / loc / "03_charts.png")

		xml = dump("c")
		if tap_text(xml, L["report"]):
			time.sleep(1.5)
			capture(OUT / loc / "06_doctor_report.png")
			adb("shell", "input", "keyevent", "4")
			time.sleep(1)

		xml = dump("c2")
		tap_text(xml, L["health"], lowest=True)
		time.sleep(1.5)
		capture(OUT / loc / "04_health.png")

		xml = dump("he")
		tap_text(xml, L["meds"], lowest=True)
		time.sleep(1.5)
		capture(OUT / loc / "05_medications.png")

	print("DONE — screenshots under", OUT)


if __name__ == "__main__":
	main()
