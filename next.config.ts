import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 콘텐츠(content/*.json)와 학습 데이터(data/*.json)는 런타임에 파일시스템에서 읽고 쓰므로
  // Node 서버(`next start` 또는 standalone 컨테이너) 전제로 동작한다.
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
