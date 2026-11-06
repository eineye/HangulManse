"use client";

import AdminShell from "@/components/admin/AdminShell";
import Loading from "@/components/demo/Loading";
import { useDemoUser } from "@/lib/demo/hooks";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = useDemoUser("admin");
  if (!admin) return <Loading />;
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
