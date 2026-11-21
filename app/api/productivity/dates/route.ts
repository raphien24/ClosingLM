import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveActiveHubForSession } from "@/lib/activeHub";
import { getProductivityDatesCoverage } from "@/lib/productivityService";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await resolveActiveHubForSession(session);
  if (!access) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const coverage = await getProductivityDatesCoverage(access.activeHub);
    return NextResponse.json({ success: true, ...coverage });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
