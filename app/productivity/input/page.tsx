import { redirect } from "next/navigation";

export default function InputDataRedirectPage() {
  redirect("/input?tab=productivity");
}
