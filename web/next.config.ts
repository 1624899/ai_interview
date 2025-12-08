import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静态导出模式，用于 Cloudflare Pages 部署
  // 如需使用 Docker/Node.js 部署，改回 'standalone'
  output: 'export',
  reactCompiler: true,
  // 静态导出需要禁用图片优化（或使用外部服务）
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

