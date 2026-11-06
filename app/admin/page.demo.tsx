"use client";

import DashboardView from "@/components/admin/DashboardView";
import Loading from "@/components/demo/Loading";
import { dashboard } from "@/lib/demo/backend";
import { useDemo } from "@/lib/demo/hooks";

export default function AdminDashboard() {
  const d = useDemo(dashboard);
  return d ? <DashboardView d={d} /> : <Loading />;
}
