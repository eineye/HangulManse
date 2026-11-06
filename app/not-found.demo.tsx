import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="text-xl font-bold">페이지를 찾을 수 없어요</h1>
      <p className="sub">Page not found</p>
      <Link href="/" className="btn-primary">처음으로 / Home</Link>
    </main>
  );
}
