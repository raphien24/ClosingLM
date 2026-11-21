import { NextRequest, NextResponse } from "next/server";
import {
  isAuthorizedCronOrOwner,
  runAutoConfirmSokoJob,
} from "@/lib/seatalkReportService";

async function handle(req: NextRequest) {
  const authorized = await isAuthorizedCronOrOwner(req);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const result = await runAutoConfirmSokoJob({ force, dryRun });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Cron auto-confirm-soko error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal menjalankan Auto Confirm Closing Soko Hub",
      },
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
