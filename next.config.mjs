import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @param {string} phase @returns {import('next').NextConfig} */
const nextConfig = (phase) => ({
  // Keep production builds from overwriting an active development server's files.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  images: {
    remotePatterns: [],
  },
});

export default nextConfig;
