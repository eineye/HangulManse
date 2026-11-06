"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import Loading from "@/components/demo/Loading";
import { currentUser } from "@/lib/demo/backend";
import { useDemo } from "@/lib/demo/hooks";

function Login() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const box = useDemo(() => ({ u: currentUser() }));
  useEffect(() => {
    if (box?.u) router.replace(safeNext ?? (box.u.role === "admin" ? "/admin/" : "/courses/"));
  }, [box, safeNext, router]);
  if (!box || box.u) return <Loading />;
  return <LoginForm next={safeNext} />;
}

export default function LoginPage() {
  return <Suspense fallback={<Loading />}><Login /></Suspense>;
}
