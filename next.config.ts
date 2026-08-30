import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
      { protocol: 'https', hostname: 'yt3.googleusercontent.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'chzzk.naver.com' },
      { protocol: 'https', hostname: 'ssl.pstatic.net' },
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
