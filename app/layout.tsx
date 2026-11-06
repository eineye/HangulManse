import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientInit from "@/components/ClientInit";

export const metadata: Metadata = {
  title: "한글만세 HangulManse",
  description: "다문화 가정 학생과 일반인을 위한 AI 한국어 학습 서비스",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0f2e24", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh">
        <ClientInit />
        {children}
      </body>
    </html>
  );
}
