"""Lossless encoding of bundled PNGs for origin-clean file:// canvas rendering.

No art is edited. HTTP pages keep using the PNGs. WKWebView loads one local
script at a time, releases its global string, and uses a data URL for the image.
"""
from pathlib import Path
import base64

root = Path(__file__).resolve().parents[1]
for base in [root / 'games/pixel-home', root / 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/games/pixel-home']:
    out = base / 'asset-data'
    out.mkdir(exist_ok=True)
    for asset in (base / 'assets').glob('*.png'):
        text = "window.PixelHomeLocalImage='data:image/png;base64," + base64.b64encode(asset.read_bytes()).decode('ascii') + "';\n"
        (out / (asset.name + '.js')).write_text(text, encoding='ascii')
