"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserMapping } from "@/types/closing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import {
  UserPlus,
  Users,
  CheckCircle,
  AlertTriangle,
  Power,
  Trash2,
  ShieldCheck,
  Mail,
  User as UserIcon,
} from "lucide-react";

export default function UsersPage() {
  const { user, hubName } = useAuth();
  const currentUserEmail = String(user?.email ?? "").trim().toLowerCase();

  const [users, setUsers] = useState<UserMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [namaUser, setNamaUser] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat data pengguna");
      setUsers(json.users || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat pengguna");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusBanner(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          nama_user: namaUser.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambahkan pengguna");

      setStatusBanner({
        type: "success",
        msg: json.message || "Pengguna berhasil ditambahkan.",
      });
      setEmail("");
      setNamaUser("");
      await fetchUsers();
    } catch (err) {
      setStatusBanner({
        type: "error",
        msg: err instanceof Error ? err.message : "Gagal menambahkan pengguna",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (target: UserMapping) => {
    const nextStatus = target.status === "active" ? "inactive" : "active";
    setBusyEmail(target.email);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target.email, status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memperbarui status");
      toast.success(json.message);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui status");
    } finally {
      setBusyEmail(null);
    }
  };

  const handleDelete = async (target: UserMapping) => {
    if (
      !confirm(
        `Hapus akses pengguna "${target.nama_user}" (${target.email}) dari ${target.nama_hub}?`
      )
    ) {
      return;
    }
    setBusyEmail(target.email);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target.email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus pengguna");
      toast.success(json.message);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus pengguna");
    } finally {
      setBusyEmail(null);
    }
  };

  const activeCount = users.filter((u) => u.status === "active").length;

  return (
    <div className="w-full px-3 sm:px-6 py-5 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tambahkan Pengguna</h1>
            <p className="text-sm text-gray-500">
              Kelola akses anggota tim untuk Hub:{" "}
              <span className="font-semibold text-blue-600">{hubName || "-"}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Tambah Pengguna */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Tambah Anggota Tim Hub
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Akun yang ditambahkan otomatis terhubung ke hub Anda dan langsung berstatus aktif.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Hub Operasional (Terkunci)
              </label>
              <div className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-800 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span>{hubName || "-"}</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="user-email"
                className="block text-xs font-semibold text-gray-500 uppercase mb-1.5"
              >
                Email Google Anggota
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="user-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contoh: pic.tim@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="user-name"
                className="block text-xs font-semibold text-gray-500 uppercase mb-1.5"
              >
                Nama Pengguna / PIC
              </label>
              <div className="relative">
                <UserIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="user-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={namaUser}
                  onChange={(e) => setNamaUser(e.target.value)}
                  placeholder="contoh: Budi Santoso"
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

            <Button type="submit" loading={isSubmitting} className="w-full">
              <UserPlus className="h-4 w-4" />
              Tambahkan Pengguna
            </Button>
          </form>
        </div>

        {/* Daftar Pengguna Hub */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-800">
                Daftar Pengguna — {hubName || "-"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="green">{activeCount} Aktif</Badge>
              <Badge variant="gray">{users.length} Total</Badge>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Memuat daftar pengguna...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Belum ada pengguna terdaftar untuk hub ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                      Nama & Email
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => {
                    const isSelf = u.email === currentUserEmail;
                    const isBusy = busyEmail === u.email;
                    return (
                      <tr key={u.email} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover ring-1 ring-blue-500/20 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold text-xs">
                                  {(u.nama_user || u.email || "U")[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900">
                                  {u.nama_user || "-"}
                                </span>
                                {isSelf && (
                                  <Badge variant="blue">Anda</Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 break-all">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant={u.status === "active" ? "green" : "gray"}>
                            {u.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isSelf || isBusy}
                              onClick={() => handleToggleStatus(u)}
                              title={
                                isSelf
                                  ? "Tidak dapat mengubah status akun Anda sendiri"
                                  : u.status === "active"
                                  ? "Nonaktifkan akses akun ini"
                                  : "Aktifkan kembali akun ini"
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                isSelf
                                  ? "opacity-40 cursor-not-allowed border-gray-200 text-gray-400"
                                  : u.status === "active"
                                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                              {u.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                            </button>

                            <button
                              type="button"
                              disabled={isSelf || isBusy}
                              onClick={() => handleDelete(u)}
                              title={
                                isSelf
                                  ? "Tidak dapat menghapus akun Anda sendiri"
                                  : "Hapus pengguna dari hub"
                              }
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isSelf
                                  ? "opacity-40 cursor-not-allowed border-gray-200 text-gray-300"
                                  : "border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 cursor-pointer"
                              }`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
