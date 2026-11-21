import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllHubs } from "@/lib/userMapping";
import { getAllHubsProductivitySummary } from "@/lib/productivityService";
import { format, startOfWeek } from "date-fns";
import { nowWIBDate } from "@/lib/dateUtils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as typeof session.user & {
    hubName: string | null;
    isAuthorized: boolean;
  };
  if (!user.isAuthorized) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const today = nowWIBDate();
  const defaultMonday = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekStart = searchParams.get("week_start") || defaultMonday;
  const year = parseInt(searchParams.get("year") || String(today.getUTCFullYear()), 10);
  const month = parseInt(searchParams.get("month") || String(today.getUTCMonth() + 1), 10);
  const excludeNew = searchParams.get("exclude_new") === "true";

  try {
    const allHubs = await getAllHubs();
    const sortedHubs = [...allHubs].sort((a, b) => a.localeCompare(b, "id"));
    const hubs = await getAllHubsProductivitySummary(
      sortedHubs,
      weekStart,
      year,
      month,
      { excludeNew }
    );

    return NextResponse.json({
      success: true,
      hubs,
      weekStart,
      year,
      month,
    });
  } catch (err) {
    console.error("All Hubs Productivity error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat data All Hub" },
      { status: 500 }
    );
  }
}
