"""Renderiza cada página do PDF de fundo da ficha como public/ficha/pagina-<n>.webp (144 dpi).

Ferramenta só de desenvolvimento (chamada por scripts/gerar-layout-ficha.mts): pip install pymupdf pillow
"""
import io
import sys

import pymupdf
from PIL import Image

pdf, destino = sys.argv[1], sys.argv[2]
doc = pymupdf.open(pdf)
for i, pagina in enumerate(doc):
    pix = pagina.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)  # 72 dpi × 2 = 144 dpi
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    caminho = f"{destino}/pagina-{i + 1}.webp"
    img.save(caminho, "WEBP", quality=82, method=6)
    print(f"{caminho}: {img.width}x{img.height}")
