import type { NextConfig } from "next";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

// 서버판(기본): 콘텐츠(content/*.json)와 학습 데이터(data/*.json)를 런타임에 파일시스템에서 읽고 쓰므로
// Node 서버(`next start` 또는 standalone 컨테이너) 전제로 동작한다.
const serverConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

// 브라우저 체험판(`npm run build:demo`): 서버 없이 GitHub Pages·APK에서 동작하는 정적 사이트(out/).
// *.demo.tsx 파일만 페이지로 쓰고, 데이터는 브라우저 localStorage에 저장한다(lib/demo/).
const demoConfig: NextConfig = {
  output: "export",
  pageExtensions: ["demo.tsx", "demo.ts"],
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
};

export default DEMO ? demoConfig : serverConfig;
