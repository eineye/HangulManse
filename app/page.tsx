import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const u = await getCurrentUser();
  redirect(!u ? "/login" : u.role === "admin" ? "/admin" : "/courses");
}
