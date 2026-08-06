"""Generate three short, notification-style incoming-call ringtones.

These are deliberately repeated two-hit chimes instead of melodies or ambient
music.  The notes have soft attacks and natural harmonic tails so the eight-
second files can loop as a continuous incoming-call signal without sounding
like an alarm.
"""

from __future__ import annotations

import math
import struct
import wave
from dataclasses import dataclass
from pathlib import Path


RATE = 44_100
DURATION = 8.0
FRAMES = int(RATE * DURATION)
TARGET_PEAK = 0.22
ASSET_DIR = Path(__file__).resolve().parents[1] / "assets"


@dataclass(frozen=True)
class Chime:
    filename: str
    first_hz: float
    second_hz: float
    second_delay: float
    repeat_every: float
    decay: float
    harmonics: tuple[tuple[float, float], ...]


CHIMES = (
    Chime(
        "incoming-soft-ring-v1.wav",
        first_hz=783.99,
        second_hz=587.33,
        second_delay=0.42,
        repeat_every=1.7,
        decay=3.4,
        harmonics=((1.0, 1.0), (2.01, 0.24), (3.02, 0.08)),
    ),
    Chime(
        "incoming-morning-chime-v1.wav",
        first_hz=987.77,
        second_hz=987.77,
        second_delay=0.27,
        repeat_every=1.45,
        decay=4.2,
        harmonics=((1.0, 1.0), (2.0, 0.16), (2.98, 0.05)),
    ),
    Chime(
        "incoming-warm-night-v1.wav",
        first_hz=523.25,
        second_hz=392.00,
        second_delay=0.48,
        repeat_every=1.65,
        decay=3.6,
        harmonics=((1.0, 1.0), (1.5, 0.18), (2.0, 0.09)),
    ),
)


def note(time_s: float, start_s: float, base_hz: float, decay: float,
         harmonics: tuple[tuple[float, float], ...]) -> float:
    elapsed = time_s - start_s
    if elapsed < 0.0 or elapsed > 1.65:
        return 0.0
    attack = min(1.0, elapsed / 0.012)
    release = math.exp(-decay * elapsed)
    body = sum(
        level * math.sin(2.0 * math.pi * base_hz * multiple * elapsed)
        for multiple, level in harmonics
    )
    return attack * release * body


def generate(chime: Chime) -> None:
    samples: list[float] = []
    starts = []
    group = 0.18
    while group < DURATION:
        starts.append((group, chime.first_hz))
        starts.append((group + chime.second_delay, chime.second_hz))
        group += chime.repeat_every

    for index in range(FRAMES):
        time_s = index / RATE
        value = sum(
            note(time_s, start_s, frequency, chime.decay, chime.harmonics)
            for start_s, frequency in starts
        )
        seam_fade = min(1.0, time_s / 0.025, (DURATION - time_s) / 0.025)
        samples.append(value * max(0.0, seam_fade))

    raw_peak = max(abs(value) for value in samples)
    gain = TARGET_PEAK / raw_peak
    pcm = [max(-32767, min(32767, round(value * gain * 32767))) for value in samples]
    output = ASSET_DIR / chime.filename
    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(b"".join(struct.pack("<h", value) for value in pcm))

    peak = max(abs(value) for value in pcm) / 32767
    rms = math.sqrt(sum(value * value for value in pcm) / len(pcm)) / 32767
    seam_jump = abs(pcm[0] - pcm[-1]) / 32767
    print(
        f"wrote={output.name} duration={DURATION:.1f}s rate={RATE} "
        f"peak_dbfs={20 * math.log10(peak):.2f} "
        f"rms_dbfs={20 * math.log10(rms):.2f} seam_jump={seam_jump:.6f}"
    )


for definition in CHIMES:
    generate(definition)
