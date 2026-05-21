"""
regen_partial_bundles.py

Regenera los bundles JS de partials desde el HTML fuente, garantizando
codificacion UTF-8 correcta. Soluciona mojibake (Mojibake como "ðŸŽ²"
en lugar de "🎲") causado por scripts previos que leyeron los HTML con
codepage Windows-1252 en vez de UTF-8.

Formato del bundle (igual al de los bundles sanos guia-01, guia-05, guia-redes-rap01):

    window.__PAGE_RUNTIME_PARTIALS__ = window.__PAGE_RUNTIME_PARTIALS__ || {};
    window.__PAGE_RUNTIME_PARTIALS__["partials/<archivo>.html"] = "<json-string>";

Donde <json-string> es JSON.stringify(html) + HTML-safe escape de <,>,& a \\u003c, \\u003e, \\u0026.
Acentos y emojis se preservan como bytes literales UTF-8 (no \\u escapes).

Uso:
    python tools/regen_partial_bundles.py            # regenera los 3 con mojibake conocido
    python tools/regen_partial_bundles.py --all      # regenera los 6 bundles (idempotente)
"""

import json
import os
import sys

ALL_PAIRS = [
    ("partials/guia-01-induccion-content.html",  "partials/guia-01-induccion-bundle.js"),
    ("partials/guia-02-herramientas-content.html", "partials/guia-02-herramientas-bundle.js"),
    ("partials/guia-03-planificar-content.html",  "partials/guia-03-planificar-bundle.js"),
    ("partials/guia-05-herramientas-content.html", "partials/guia-05-herramientas-bundle.js"),
    ("partials/guia-06-planificar-content.html",  "partials/guia-06-planificar-bundle.js"),
    ("partials/guia-redes-rap01-content.html",    "partials/guia-redes-rap01-bundle.js"),
]

BROKEN_PAIRS = [
    ("partials/guia-02-herramientas-content.html", "partials/guia-02-herramientas-bundle.js"),
    ("partials/guia-03-planificar-content.html",   "partials/guia-03-planificar-bundle.js"),
    ("partials/guia-06-planificar-content.html",   "partials/guia-06-planificar-bundle.js"),
]


def encode_partial(html_text):
    s = json.dumps(html_text, ensure_ascii=False)
    s = s.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    return s


def regenerate(src, dst):
    with open(src, "rb") as f:
        raw = f.read()
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    html = raw.decode("utf-8")
    encoded = encode_partial(html)
    bundle = (
        "window.__PAGE_RUNTIME_PARTIALS__ = window.__PAGE_RUNTIME_PARTIALS__ || {};\n"
        + 'window.__PAGE_RUNTIME_PARTIALS__["'
        + src.replace("\\", "/")
        + '"] = '
        + encoded
        + ";\n"
    )
    with open(dst, "wb") as f:
        f.write(bundle.encode("utf-8"))
    print("Regenerated:", dst, "(", len(bundle), "bytes )")


def main():
    pairs = ALL_PAIRS if ("--all" in sys.argv) else BROKEN_PAIRS
    for src, dst in pairs:
        if not os.path.exists(src):
            print("MISSING:", src)
            continue
        regenerate(src, dst)


if __name__ == "__main__":
    main()
