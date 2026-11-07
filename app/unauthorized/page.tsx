"use client";

import { signOut } from "next-auth/react";
import { ShieldX, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Akses Tidak Diizinkan
          </h1>

          <p className="text-gray-500 text-sm mb-6">
            Email Anda belum terdaftar dalam sistem closing JTT08. Hubungi
            admin untuk mendapatkan akses.
          </p>

          {/* Steps */}
          <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Cara mendapatkan akses:
            </p>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Hubungi supervisor atau admin hub Anda</li>
              <li>Berikan email Google yang Anda gunakan</li>
              <li>Tunggu admin menambahkan akses Anda</li>
              <li>Login kembali setelah mendapat konfirmasi</li>
            </ol>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => signOut({ callbackUrl: "/login" })}
              variant="outline"
              className="w-full"
            >
              Kembali ke Halaman Login
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-6">
          <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
            <Package className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-xs text-gray-400">
            SPX Express JTT08 — Sistem Closing Internal
          </p>
        </div>
      </div>
    </div>
  );
}
