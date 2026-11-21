import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMonitorSamedayData } from "@/lib/samedayService";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as typeof session.user & {
    isAuthorized?: boolean;
  };
  if (!user.isAuthorized) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "1";

  try {
    const data = await getMonitorSamedayData({ skipCache: refresh });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Monitor Sameday API error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal memuat data Monitor Sameday dari Google Sheets",
      },
      { status: 500 }
    );
  }
}
