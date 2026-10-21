import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content Security Policy
// - default-src 'self'
// - script-src 'self' 'unsafe-inline' (plus 'unsafe-eval' in dev for hot reload)
// - style-src 'self' 'unsafe-inline' (Tailwind inline styling)
// - img-src 'self' data: blob:
// - font-src 'self' data:
// - connect-src 'self' (Internal API routes /api/chat, /api/memory/extract)
// - frame-ancestors 'none' (Strict anti-clickjacking)
// - base-uri 'self'
// - form-action 'self'
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' ${isProd ? '' : "'unsafe-eval'"};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, ' ').trim();

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: cspHeader,
  },
];

// Apply HSTS strictly in production environments over HTTPS
// Conservative max-age (1 year); preload & includeSubDomains omitted while deployment domain is undecided
if (isProd) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  });
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

