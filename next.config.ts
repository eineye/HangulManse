import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 콘텐츠(content/*.json)와 학습 데이터(data/*.json)는 런타임에 파일시스템에서 읽으므로
  // 자체 호스팅(Node 서버, `next start`) 전제로 동작한다.
  poweredByHeader: false,
};

export default nextConfig;
