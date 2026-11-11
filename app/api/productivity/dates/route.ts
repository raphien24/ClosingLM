import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProductivityDatesCoverage } from "@/lib/productivityService";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as typeof session.user & {
    hubName: string | null;
    isAuthorized: boolean;
  };
  if (!user.isAuthorized || !user.hubName) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const coverage = await getProductivityDatesCoverage(user.hubName);
    return NextResponse.json({ success: true, ...coverage });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
