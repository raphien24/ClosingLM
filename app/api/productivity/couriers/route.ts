import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHubCouriers } from "@/lib/productivityService";

// Endpoint untuk autocomplete kurir yang sudah pernah diinput
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as typeof session.user & { hubName: string | null; isAuthorized: boolean };
  if (!user.isAuthorized || !user.hubName)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const couriers = await getHubCouriers(user.hubName);
    return NextResponse.json({ success: true, couriers });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
