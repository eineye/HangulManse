"use client";

import CoursesView from "@/components/CoursesView";
import Loading from "@/components/demo/Loading";
import { courses, progressOf, statsOf } from "@/lib/demo/backend";
import { useDemo, useDemoUser } from "@/lib/demo/hooks";

export default function CoursesPage() {
  const user = useDemoUser();
  const data = useDemo(() => (user ? { courses: courses(), progress: progressOf(user.id), stats: statsOf(user.id) } : null), [user?.id]);
  if (!user || !data) return <Loading />;
  return <CoursesView user={user} courses={data.courses} progress={data.progress} stats={data.stats} />;
}
