import sys, os, json, time

def run_paddle(path):
    try:
        from paddleocr import PaddleOCR
    except Exception as e:
        return {"error": f"PaddleOCR belum terpasang: {e}"}
    try:
        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    except TypeError:
        ocr = PaddleOCR(lang="en")
    t0 = time.time()
    try:
        res = ocr.ocr(path, cls=True)
        style = "v2"
    except Exception:
        res = ocr.predict(path)
        style = "v3"
    ms = int((time.time() - t0) * 1000)
    lines = []
    if style == "v2":
        for page in res:
            if not page:
                continue
            for item in page:
                try:
                    lines.append(item[1][0])
                except Exception:
                    pass
    else:
        for page in res:
            if hasattr(page, "get"):
                lines.extend(page.get("rec_texts") or [])
    return {"text": "\n".join(lines), "ms": ms, "lines": len(lines)}

def run_tesseract(path):
    try:
        import pytesseract
        from PIL import Image
    except Exception as e:
        return {"error": f"pytesseract/PIL belum terpasang: {e}"}
    img = Image.open(path).convert("L")
    t0 = time.time()
    txt = pytesseract.image_to_string(img, config="--psm 6")
    ms = int((time.time() - t0) * 1000)
    return {"text": txt, "ms": ms, "lines": len(txt.splitlines())}

if __name__ == "__main__":
    files = sys.argv[1:] or [
        os.path.expanduser(r"C:/Users/rafia/Downloads/Screenshot_10.png"),
        os.path.expanduser(r"C:/Users/rafia/Downloads/Screenshot_11.png"),
    ]
    out = []
    for f in files:
        if not os.path.exists(f):
            out.append({"file": f, "error": "tidak ditemukan"})
            continue
        row = {"file": os.path.basename(f)}
        row["paddle"] = run_paddle(f)
        row["tesseract"] = run_tesseract(f)
        out.append(row)
    print(json.dumps(out, ensure_ascii=False, indent=2))