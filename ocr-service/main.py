"""
Layanan PaddleOCR untuk ClosingLM.
Jalankan: uvicorn main:app --host 0.0.0.0 --port 8001
Endpoint: POST /ocr  (multipart file)
"""
import io
import numpy as np
from fastapi import FastAPI, UploadFile, File
from PIL import Image
from paddleocr import PaddleOCR

app = FastAPI(title="ClosingLM PaddleOCR")

_ocr = None

def get_ocr():
    global _ocr
    if _ocr is None:
        _ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    return _ocr

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    raw = await file.read()
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    arr = np.array(img)
    res = get_ocr().ocr(arr, cls=True)
    lines = []
    for page in res:
        if not page:
            continue
        for item in page:
            try:
                lines.append(item[1][0])
            except Exception:
                pass
    return {"text": "\n".join(lines), "lines": len(lines)}