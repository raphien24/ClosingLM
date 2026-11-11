"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import {
  Building2,
  PlusCircle,
  CheckCircle,
  AlertTriangle,
  Search,
  Mail,
  User as UserIcon,
  ShieldAlert,
} from "lucide-react";

interface HubSummary {
  nama_hub: string;
  userCount: number;
  activeCount: number;
}

export default function AddHubPage() {
  const { isLoading: authLoading, isSuperAdmin } = useAuth();

  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [namaHub, setNamaHub] = useState("");
  const [picEmail, setPicEmail] = useState("");
  const [picName, setPicName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const fetchHubs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/hubs");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat daftar hub");
      setHubs(json.hubs || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat daftar hub");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) {
      fetchHubs();
    }
  }, [authLoading, isSuperAdmin, fetchHubs]);

  const filteredHubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hubs;
    return hubs.filter((h) => h.nama_hub.toLowerCase().includes(q));
  }, [hubs, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusBanner(null);

    try {
      const res = await fetch("/api/hubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_hub: namaHub.trim(),
          pic_email: picEmail.trim().toLowerCase(),
          pic_name: picName.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambahkan hub baru");

      setStatusBanner({
        type: "success",
        msg: json.message || "Hub baru berhasil ditambahkan.",
      });
      setNamaHub("");
      setPicEmail("");
      setPicName("");
      await fetchHubs();
    } catch (err) {
      setStatusBanner({
        type: "error",
        msg: err instanceof Error ? err.message : "Gagal menambahkan hub baru",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!authLoading && !isSuperAdmin) {
    return (
      <div className="w-full px-3 sm:px-6 py-12 flex justify-center">
        <div className="max-w-md w-full bg-white rounded-xl border border-red-200 p-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Akses Dibatasi</h1>
          <p className="text-sm text-gray-500">
            Halaman penambahan Hub Baru hanya tersedia untuk akun Super Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-6 py-5 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Building2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Tambahkan Hub Baru</h1>
              <Badge variant="green">Admin</Badge>
            </div>
            <p className="text-sm text-gray-500">
              Daftarkan Hub operasional baru beserta akun PIC awal di{" "}
              <code className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                USER_MAPPING
              </code>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Tambah Hub Baru */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Form Hub & PIC Awal
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Setelah Hub dibuat, PIC Hub dapat masuk dan menambahkan anggota timnya sendiri lewat menu{" "}
              <span className="font-medium text-gray-700">Tambahkan Pengguna</span>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="hub-name"
                className="block text-xs font-semibold text-gray-500 uppercase mb-1.5"
              >
                Nama Hub Baru
              </label>
              <div className="relative">
                <Building2 className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="hub-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={namaHub}
                  onChange={(e) => setNamaHub(e.target.value)}
                  placeholder="contoh: Tuban Hub"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Ikuti format penamaan yang konsisten (mis. &quot;... Hub&quot;) dan hindari karakter{" "}
                <code>\ / * ? : [ ]</code>.
              </p>
            </div>

            <div>
              <label
                htmlFor="pic-email"
                className="block text-xs font-semibold text-gray-500 uppercase mb-1.5"
              >
                Email Google PIC Awal
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="pic-email"
                  type="email"
                  required
                  value={picEmail}
                  onChange={(e) => setPicEmail(e.target.value)}
                  placeholder="contoh: pic.tuban@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="pic-name"
                className="block text-xs font-semibold text-gray-500 uppercase mb-1.5"
              >
                Nama PIC Awal
              </label>
              <div className="relative">
                <UserIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="pic-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  placeholder="contoh: Andi Wijaya"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

            <Button type="submit" loading={isSubmitting} className="w-full">
              <PlusCircle className="h-4 w-4" />
              Simpan Hub Baru
            </Button>
          </form>
        </div>

        {/* Daftar Hub Terdaftar */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                Hub yang Sudah Terdaftar
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Referensi ejaan nama hub agar tidak terjadi duplikasi
              </p>
            </div>
            <Badge variant="blue">{hubs.length} Hub</Badge>
          </div>

          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama hub..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Memuat daftar hub...</div>
          ) : filteredHubs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {search ? `Tidak ada hub yang cocok dengan "${search}".` : "Belum ada hub terdaftar."}
            </div>
          ) : (
            <div className="max-h-[440px] overflow-y-auto divide-y divide-gray-100">
              {filteredHubs.map((h) => (
                <div
                  key={h.nama_hub}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-sm text-gray-900 truncate">
                      {h.nama_hub}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant="green">{h.activeCount} Aktif</Badge>
                    {h.userCount > h.activeCount && (
                      <Badge variant="gray">{h.userCount - h.activeCount} Nonaktif</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
