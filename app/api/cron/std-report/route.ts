import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronOrOwner } from "@/lib/seatalkReportService";
import { runStdMonitorReportJob } from "@/lib/seatalkStdReportService";

async function handle(req: NextRequest) {
  const authorized = await isAuthorizedCronOrOwner(req);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const result = await runStdMonitorReportJob({ force, dryRun });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Cron std-report error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menjalankan laporan Monitor STD" },
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
