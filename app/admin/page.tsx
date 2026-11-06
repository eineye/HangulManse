import { getDashboard } from "@/lib/admin-data";
import DashboardView from "@/components/admin/DashboardView";

export default async function AdminDashboard() {
  return <DashboardView d={await getDashboard()} />;
}
