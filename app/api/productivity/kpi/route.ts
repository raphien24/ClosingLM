import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getKpiMetrics } from "@/lib/productivityService";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { nowWIBDate } from "@/lib/dateUtils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as typeof session.user & { hubName: string | null; isAuthorized: boolean };
  if (!user.isAuthorized || !user.hubName)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  // week_start: YYYY-MM-DD (Senin), default minggu ini (WIB)
  const today = nowWIBDate();
  const defaultMonday = startOfWeek(today, { weekStartsOn: 1 });
  const weekStartParam = searchParams.get("week_start") || format(defaultMonday, "yyyy-MM-dd");
  const contract       = searchParams.get("contract")   || "all";
  const vehicle        = searchParams.get("vehicle")    || "all";

  try {
    const [y, m, d] = weekStartParam.split("-").map(Number);
    const weekStartDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const weekEndDate   = new Date(Date.UTC(y, m - 1, d + 6, 23, 59, 59, 999));

    const kpi = await getKpiMetrics(
      user.hubName,
      { start: weekStartDate, end: weekEndDate },
      weekStartParam,
      { contract, vehicle }
    );

    return NextResponse.json({ success: true, kpi, week_start: weekStartParam });
  } catch (err) {
    console.error("KPI error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
