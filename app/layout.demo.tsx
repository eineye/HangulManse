import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientInit from "@/components/ClientInit";
import DemoBoot from "@/components/demo/DemoBoot";

// 브라우저 체험판(GitHub Pages·APK) 전용 레이아웃 — `npm run build:demo`에서만 쓰인다.
const B = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "한글만세 체험판 HangulManse",
  description: "다문화 가정 학생과 일반인을 위한 AI 한국어 학습 서비스 (체험판)",
  manifest: `${B}/manifest.webmanifest`,
  icons: { icon: `${B}/icon.svg`, apple: `${B}/apple-touch-icon.png` },
  appleWebApp: { capable: true, title: "한글만세", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0f2e24", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh">
        <DemoBoot />
        <ClientInit />
        {children}
      </body>
    </html>
  );
}
