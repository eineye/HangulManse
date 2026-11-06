"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loading from "@/components/demo/Loading";
import { currentUser } from "@/lib/demo/backend";
import { useDemo } from "@/lib/demo/hooks";

export default function Home() {
  const router = useRouter();
  const box = useDemo(() => ({ u: currentUser() }));
  useEffect(() => {
    if (box) router.replace(!box.u ? "/login/" : box.u.role === "admin" ? "/admin/" : "/courses/");
  }, [box, router]);
  return <Loading />;
}
