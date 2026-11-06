import { notFound } from "next/navigation";
import { getLearnerDetail } from "@/lib/admin-data";
import LearnerDetailView from "@/components/admin/LearnerDetailView";

export default async function LearnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getLearnerDetail(id);
  if (!d) notFound();
  return <LearnerDetailView d={d} />;
}
