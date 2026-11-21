import { NextRequest, NextResponse } from "next/server";
import {
  isAuthorizedCronOrOwner,
  runDailySummaryJob,
} from "@/lib/seatalkReportService";

async function handle(req: NextRequest) {
  const authorized = await isAuthorizedCronOrOwner(req);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetDate = req.nextUrl.searchParams.get("date") || undefined;
  const force = req.nextUrl.searchParams.get("force") === "1";
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const result = await runDailySummaryJob({ targetDate, force, dryRun });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Cron daily-summary error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menjalankan daily summary" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
