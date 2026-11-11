"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import {
  UserCog,
  Camera,
  Trash2,
  Save,
  CheckCircle,
  AlertTriangle,
  Mail,
  Building2,
  User as UserIcon,
} from "lucide-react";

const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB
const AVATAR_SIZE = 128;
const MAX_DATA_URI_CHARS = 42_000;

/**
 * Crop gambar ke tengah berbentuk persegi 128x128 lalu kompres ke WebP/JPEG
 * agar ringan dan aman disimpan pada sel Google Sheets.
 */
async function compressAvatarFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar (PNG, JPG, atau WebP).");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Ukuran file gambar maksimal 10 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Gagal membaca file gambar."));
      el.src = objectUrl;
    });

    const minDim = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = Math.max(0, Math.floor(((img.naturalWidth || img.width) - minDim) / 2));
    const sy = Math.max(0, Math.floor(((img.naturalHeight || img.height) - minDim) / 2));

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar.");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    for (const q of [0.82, 0.68, 0.54]) {
      const webp = canvas.toDataURL("image/webp", q);
      if (webp.startsWith("data:image/webp") && webp.length <= MAX_DATA_URI_CHARS) {
        return webp;
      }
    }

    // Fallback JPEG (dengan latar putih jika gambar asli transparan)
    const jpegCanvas = document.createElement("canvas");
    jpegCanvas.width = AVATAR_SIZE;
    jpegCanvas.height = AVATAR_SIZE;
    const jctx = jpegCanvas.getContext("2d");
    if (jctx) {
      jctx.fillStyle = "#ffffff";
      jctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
      jctx.drawImage(canvas, 0, 0);
      for (const q of [0.8, 0.65, 0.5]) {
        const jpeg = jpegCanvas.toDataURL("image/jpeg", q);
        if (jpeg.length <= MAX_DATA_URI_CHARS) {
          return jpeg;
        }
      }
    }

    throw new Error("Gambar terlalu kompleks setelah dikompres. Coba gambar lain.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function EditProfilePage() {
  const { user, hubName, hubUser, refreshSession } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [namaUser, setNamaUser] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/profile");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat profil");
        if (active && json.profile) {
          setNamaUser(json.profile.nama_user || "");
          setAvatarUrl(json.profile.avatar_url || "");
        }
      } catch (err) {
        if (active) {
          setNamaUser(hubUser || user?.name || "");
          toast.error(err instanceof Error ? err.message : "Gagal memuat profil");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, [hubUser, user?.name]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsProcessingImg(true);
    setStatusBanner(null);
    try {
      const compressed = await compressAvatarFile(file);
      setAvatarUrl(compressed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses gambar");
    } finally {
      setIsProcessingImg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusBanner(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_user: namaUser.trim(),
          avatar_url: avatarUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan profil");

      await refreshSession();
      window.dispatchEvent(
        new CustomEvent("jtt08-profile-updated", {
          detail: {
            nama_user: json.profile?.nama_user ?? namaUser.trim(),
            avatar_url: json.profile?.avatar_url ?? avatarUrl,
          },
        })
      );

      setStatusBanner({
        type: "success",
        msg: json.message || "Profil berhasil diperbarui.",
      });
      toast.success("Profil berhasil diperbarui!");
    } catch (err) {
      setStatusBanner({
        type: "error",
        msg: err instanceof Error ? err.message : "Gagal menyimpan profil",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatar = avatarUrl || user?.image || "";
  const initialLetter = (namaUser || hubUser || user?.name || user?.email || "U")[0].toUpperCase();

  return (
    <div className="w-full px-3 sm:px-6 py-5 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <UserCog className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Profil</h1>
          <p className="text-sm text-gray-500">
            Ubah nama tampilan dan foto profil akun Anda sendiri
          </p>
        </div>
      </div>

      <div className="max-w-2xl bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-gray-400">Memuat data profil...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bagian Foto Profil */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-gray-100">
              <div className="relative flex-shrink-0 self-start sm:self-center">
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt="Foto Profil"
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-blue-500/20 shadow-sm"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center ring-4 ring-blue-500/20 shadow-sm">
                    <span className="text-white font-bold text-3xl">{initialLetter}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 flex-1">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Foto Profil</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {avatarUrl
                      ? "Menggunakan foto profil kustom (dioptimalkan otomatis ke 128×128 px)."
                      : user?.image
                      ? "Saat ini menggunakan foto default dari akun Google Anda."
                      : "Belum ada foto — menampilkan inisial nama Anda."}
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={isProcessingImg}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    {avatarUrl ? "Ganti Foto" : "Upload Foto"}
                  </Button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl("")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus Foto Kustom
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Info Read-only Akun */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  Email Google (Akun Login)
                </label>
                <div className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-600 flex items-center gap-2 truncate">
                  <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{user?.email || "-"}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  Hub Operasional
                </label>
                <div className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-800 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="truncate">{hubName || "-"}</span>
                  </span>
                  <Badge variant="green">Active</Badge>
                </div>
              </div>
            </div>

            {/* Nama Pengguna */}
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-semibold text-gray-500 uppercase mb-1.5"
              >
                Nama Pengguna
              </label>
              <div className="relative">
                <UserIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="profile-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={namaUser}
                  onChange={(e) => setNamaUser(e.target.value)}
                  placeholder="Masukkan nama tampilan Anda"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {statusBanner && (
              <div
                className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
                  statusBanner.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {statusBanner.type === "success" ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{statusBanner.msg}</span>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" loading={isSaving}>
                <Save className="h-4 w-4" />
                Simpan Profil
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
