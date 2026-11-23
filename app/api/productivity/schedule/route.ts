import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveActiveHubForSession } from "@/lib/activeHub";
import { getCourierSchedule } from "@/lib/productivityService";
import { getWIBMondayYMD } from "@/lib/dateUtils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await resolveActiveHubForSession(session);
  if (!access)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get("week_start") || getWIBMondayYMD();
  const contract   = searchParams.get("contract")   || "all";
  const vehicle    = searchParams.get("vehicle")    || "all";
  const zone       = searchParams.get("zone")       || "all";
  const excludeNew = searchParams.get("exclude_new") === "true";

  try {
    const [y, m, d] = weekStartParam.split("-").map(Number);
    const weekStartDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const weekEndDate   = new Date(Date.UTC(y, m - 1, d + 6, 23, 59, 59, 999));

    const schedule = await getCourierSchedule(
      access.activeHub,
      { start: weekStartDate, end: weekEndDate },
      weekStartParam,
      { contract, vehicle, zone, excludeNew }
    );

    return NextResponse.json({ success: true, schedule, week_start: weekStartParam });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
