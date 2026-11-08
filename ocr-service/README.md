# ClosingLM OCR Service (PaddleOCR)

Layanan PaddleOCR mandiri untuk dipanggil oleh app ClosingLM.

## Jalankan di Mini PC / CasaOS

```bash
cd ocr-service
docker compose up -d --build
curl http://localhost:8001/health
```

Kirim ke Vercel env: `PADDLE_OCR_SERVICE_URL = https://<url-tunnel-kamu>`

## Akses dari internet tanpa buka port (Cloudflare Tunnel)

1. Buat tunnel di Cloudflare Zero Trust -> Networks -> Tunnels -> Create.
2. Tambah public hostname, service: `http://<ip-mini-pc>:8001`.
3. Jalankan connector di Mini PC:

```bash
docker run -d --name cloudflared --restart unless-stopped \
  cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <TOKEN_KAMU>
```

## Catatan

- Mini PC harus nyala terus. Kalau mati, app otomatis fallback ke Tesseract.
- Model PaddleOCR di-cache di volume `paddle_cache` supaya tidak unduh ulang.