import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 모든 화면과 서버 경로의 응답에 붙이는 보안 헤더
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 다른 사이트가 이 앱의 화면을 자기 화면 안에 끼워 넣지 못하게 한다.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // 브라우저가 파일 종류를 제멋대로 짐작하지 않게 한다.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 다른 사이트로 이동할 때 이 앱의 주소를 알려 주지 않는다.
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
