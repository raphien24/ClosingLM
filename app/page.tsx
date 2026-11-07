import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function RootPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const user = session.user as typeof session.user & { isAuthorized: boolean };
  if (!user.isAuthorized) {
    redirect("/unauthorized");
  }

  redirect("/dashboard");
}
