import { getSheetData } from "./sheets";
import { UserMapping } from "@/types/closing";

// Kolom index di sheet USER_MAPPING (0-indexed)
// email | nama_hub | nama_user | status
const COL_EMAIL = 0;
const COL_NAMA_HUB = 1;
const COL_NAMA_USER = 2;
const COL_STATUS = 3;

/**
 * Ambil semua user mappings yang aktif
 */
export async function getAllUserMappings(): Promise<UserMapping[]> {
  const data = await getSheetData("USER_MAPPING");

  // Skip header row (index 0)
  return data
    .slice(1)
    .filter((row) => row && row[COL_EMAIL])
    .map((row) => ({
      email: row[COL_EMAIL]?.trim().toLowerCase() || "",
      nama_hub: row[COL_NAMA_HUB]?.trim() || "",
      nama_user: row[COL_NAMA_USER]?.trim() || "",
      status: (row[COL_STATUS]?.trim().toLowerCase() || "active") as
        | "active"
        | "inactive",
    }));
}

/**
 * Lookup email ke nama hub
 * Return nama_hub jika email terdaftar dan active, null jika tidak
 */
export async function getUserHub(email: string): Promise<{
  nama_hub: string;
  nama_user: string;
} | null> {
  if (!email) return null;

  const mappings = await getAllUserMappings();
  const mapping = mappings.find(
    (m) =>
      m.email === email.toLowerCase().trim() && m.status === "active"
  );

  if (!mapping) return null;

  return {
    nama_hub: mapping.nama_hub,
    nama_user: mapping.nama_user,
  };
}

/**
 * Ambil semua nama hub unik dari USER_MAPPING (untuk dashboard)
 */
export async function getAllHubs(): Promise<string[]> {
  const mappings = await getAllUserMappings();
  const hubs = [...new Set(mappings.map((m) => m.nama_hub).filter(Boolean))];
  return hubs.sort();
}
