"use client";

import { useCallback, useRef } from "react";
import { ClipboardPaste, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScreenshotZoneProps {
  screenshots: string[];
  onAdd: (base64: string) => void;
  onRemove: (index: number) => void;
}

/**
 * Resize gambar di browser jika terlalu besar (maks lebar 1920px)
 * agar tidak melewati batas 4.5MB Vercel serverless payload.
 */
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        // Skala optimal untuk OCR: maksimum lebar 1600px
        const MAX_W = 1600;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Menggunakan JPEG quality 0.90: ukuran ~150-250KB (menghemat 90% bandwidth & waktu upload)
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function ScreenshotZone({
  screenshots,
  onAdd,
  onRemove,
}: ScreenshotZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        compressImageFile(file).then(onAdd).catch(() => {});
      });
      // Reset input agar bisa upload file yang sama lagi
      e.target.value = "";
    },
    [onAdd]
  );

  return (
    <div className="space-y-4">
      {/* Paste Area */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-red-400 hover:bg-red-50/30 transition-colors cursor-default"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files);
          files.forEach((file) => {
            if (!file.type.startsWith("image/")) return;
            compressImageFile(file).then(onAdd).catch(() => {});
          });
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
            <ClipboardPaste className="h-7 w-7 text-gray-400" />
          </div>
          <div>
            <p className="text-base font-medium text-gray-700">
              Tekan{" "}
              <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-sm font-mono">
                Ctrl+V
              </kbd>{" "}
              untuk paste screenshot
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Atau drag & drop gambar ke sini
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-px bg-gray-200 w-16" />
            <span className="text-xs text-gray-400">atau</span>
            <div className="h-px bg-gray-200 w-16" />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            Upload File Gambar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Screenshot thumbnails */}
      {screenshots.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            {screenshots.length} screenshot siap diproses
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {screenshots.map((src, idx) => (
              <div
                key={idx}
                className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
              >
                <img
                  src={src}
                  alt={`Screenshot ${idx + 1}`}
                  className="w-full h-28 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                <button
                  onClick={() => onRemove(idx)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="absolute bottom-1.5 left-1.5">
                  <span className="text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
