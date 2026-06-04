/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lean, self-contained server build for Docker/Fly.
  output: "standalone",
  // Enable instrumentation.ts (the world heartbeat starts on server boot).
  experimental: { instrumentationHook: true },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
