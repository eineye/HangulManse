"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

export default function LogoutButton({ className = "btn-ghost" }: { className?: string }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <button
      className={className}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      {t("logout")}
    </button>
  );
}
