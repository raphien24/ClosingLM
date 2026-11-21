"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle,
  Edit3,
  Mail,
  Power,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  UserPlus,
  X,
} from "lucide-react";

interface AdminItem {
  email: string;
  nama: string;
  status: "active" | "inactive";
  updated_at: string;
  updated_by: string;
  isOwner: boolean;
}

export default function ManageAdminPage() {
  const { isLoading: authLoading, isOwnerAdmin } = useAuth();

  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingTargetEmail, setEditingTargetEmail] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const fetchAdmins = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat daftar admin");
      setAdmins(json.admins || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat daftar admin");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isOwnerAdmin) {
      fetchAdmins();
    }
  }, [authLoading, isOwnerAdmin, fetchAdmins]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusBanner(null);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          nama: newName.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambahkan admin");

      setStatusBanner({
        type: "success",
        msg: json.message || "Admin baru berhasil ditambahkan.",
      });
      setNewEmail("");
      setNewName("");
      await fetchAdmins();
    } catch (err) {
      setStatusBanner({
        type: "error",
        msg: err instanceof Error ? err.message : "Gagal menambahkan admin",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (item: AdminItem) => {
    setEditingTargetEmail(item.email);
    setEditEmail(item.email);
    setEditName(item.nama);
    setEditStatus(item.status);
  };

  const cancelEdit = () => {
    setEditingTargetEmail(null);
    setEditEmail("");
    setEditName("");
  };

  const handleSaveEdit = async (target: AdminItem) => {
    setBusyEmail(target.email);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_email: target.email,
          new_email: target.isOwner ? target.email : editEmail.trim().toLowerCase(),
          nama: editName.trim(),
          status: target.isOwner ? "active" : editStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memperbarui admin");

      toast.success(json.message || "Data admin diperbarui");
      cancelEdit();
      await fetchAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui admin");
    } finally {
      setBusyEmail(null);
    }
  };

  const handleToggleStatus = async (target: AdminItem) => {
    if (target.isOwner) return;
    const nextStatus = target.status === "active" ? "inactive" : "active";
    setBusyEmail(target.email);
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_email: target.email,
          status: nextStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah status admin");
      toast.success(json.message || "Status admin diperbarui");
      await fetchAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status admin");
    } finally {
      setBusyEmail(null);
    }
  };

  const handleDeleteAdmin = async (target: AdminItem) => {
    if (target.isOwner) return;
    if (!window.confirm(`Hapus akses admin untuk "${target.email}"?`)) return;
    setBusyEmail(target.email);
    try {
      const res = await fetch(`/api/admin?email=${encodeURIComponent(target.email)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus admin");
      toast.success(json.message || "Admin dihapus");
      if (editingTargetEmail === target.email) cancelEdit();
      await fetchAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus admin");
    } finally {
      setBusyEmail(null);
    }
  };

  if (!authLoading && !isOwnerAdmin) {
    return (
      <div className="w-full px-3 sm:px-6 py-12 flex justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 dark:border-rose-500/35 p-6 text-center space-y-3 shadow-sm">
          <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Akses Dibatasi</h1>
          <p className="text-sm text-gray-500">
            Halaman Manage Admin hanya dapat diakses oleh akun{" "}
            <code className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
              rafi.alvian@spxexpress.com
            </code>
            .
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
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Manage Admin</h1>
              <Badge variant="green">Owner Access</Badge>
            </div>
            <p className="text-sm text-gray-500">
              Tambah, edit email/nama, dan kelola hak akses Admin untuk menu{" "}
              <strong>Productivity All Hub</strong> &amp; manajemen Hub.
            </p>
          </div>
        </div>
      </div>

      {/* Form Tambah Admin */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-emerald-600" />
          Tambah Email Admin Baru
        </h2>

        {statusBanner && (
          <div
            className={`mb-4 px-4 py-3 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 ${
              statusBanner.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
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

        <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
          <div>
            <label htmlFor="admin-email-input" className="block text-xs font-semibold text-gray-600 mb-1">
              Email Google Admin *
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-email-input"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nama@spxexpress.com"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-name-input" className="block text-xs font-semibold text-gray-600 mb-1">
              Nama Admin *
            </label>
            <div className="relative">
              <UserIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-name-input"
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-2.5 cursor-pointer"
          >
            {isSubmitting ? "Menyimpan..." : "+ Tambah Admin"}
          </Button>
        </form>
      </div>

      {/* Daftar Admin & Edit */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">
            Daftar Email Admin ({admins.length})
          </h2>
          <span className="text-xs text-gray-500">
            Klik <strong>Edit</strong> untuk mengubah email, nama, atau status Admin
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600 font-bold uppercase text-[11px]">
                <th className="py-3 px-4">Email Google</th>
                <th className="py-3 px-4">Nama Admin</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Terakhir Diubah</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">
                    Memuat daftar admin...
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">
                    Belum ada data admin.
                  </td>
                </tr>
              ) : (
                admins.map((item) => {
                  const isEditing = editingTargetEmail === item.email;
                  const isBusy = busyEmail === item.email;
                  return (
                    <tr key={item.email} className="hover:bg-gray-50/60">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {isEditing && !item.isOwner ? (
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full min-w-[200px] px-2.5 py-1.5 text-xs border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{item.email}</span>
                            {item.isOwner && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/35">
                                Owner
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-gray-700">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full min-w-[150px] px-2.5 py-1.5 text-xs border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          item.nama
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {isEditing && !item.isOwner ? (
                          <select
                            value={editStatus}
                            onChange={(e) =>
                              setEditStatus(e.target.value as "active" | "inactive")
                            }
                            className="px-2.5 py-1 text-xs border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        ) : item.status === "active" ? (
                          <Badge variant="green">Aktif</Badge>
                        ) : (
                          <Badge variant="red">Nonaktif</Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {item.updated_at || "-"}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleSaveEdit(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
                            >
                              <Save className="h-3.5 w-3.5" />
                              Simpan
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => startEdit(item)}
                              title="Edit email / nama admin"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-blue-50 hover:text-blue-700 text-slate-700 cursor-pointer transition-colors"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            {!item.isOwner && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleToggleStatus(item)}
                                  title={
                                    item.status === "active"
                                      ? "Nonaktifkan akses admin"
                                      : "Aktifkan akses admin"
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-amber-50 hover:text-amber-700 text-slate-600 cursor-pointer transition-colors"
                                >
                                  <Power className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleDeleteAdmin(item)}
                                  title="Hapus admin"
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-rose-600 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
