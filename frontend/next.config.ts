import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@/components/ui",
      "@/components/templates/inbox-page",
      "@/hooks",
    ],
  },

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eu.chat-img.sintra.ai",
        pathname: "/**",
      },
    ],
  },

  output: "export",
  trailingSlash: true,
};

export default nextConfig;
