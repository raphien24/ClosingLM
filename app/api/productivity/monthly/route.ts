import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveActiveHubForSession } from "@/lib/activeHub";
import { getMonthlyMetrics } from "@/lib/productivityService";
import { todayWIB } from "@/lib/dateUtils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await resolveActiveHubForSession(session);
  if (!access)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const [defaultYear, defaultMonth] = todayWIB().split("-").map(Number);
  const year     = parseInt(searchParams.get("year")     || String(defaultYear));
  const month    = parseInt(searchParams.get("month")    || String(defaultMonth));
  const contract   = searchParams.get("contract") || "all";
  const vehicle    = searchParams.get("vehicle")  || "all";
  const excludeNew = searchParams.get("exclude_new") === "true";

  try {
    const data = await getMonthlyMetrics(access.activeHub, year, month, contract, vehicle, { excludeNew });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
