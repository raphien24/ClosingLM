import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveActiveHubForSession } from "@/lib/activeHub";
import { getHubCouriers } from "@/lib/productivityService";

// Endpoint untuk autocomplete kurir yang sudah pernah diinput
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await resolveActiveHubForSession(session);
  if (!access)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const couriers = await getHubCouriers(access.activeHub);
    return NextResponse.json({ success: true, couriers });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
