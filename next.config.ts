import type { NextConfig } from "next";

// Rotas do cliente (link com token): nunca em cache, nunca indexadas, sem vazar o token no Referer.
const CABECALHOS_CLIENTE = [
  { key: "Cache-Control", value: "no-store" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  // Fontes e logo do PDF são lidos do disco em runtime (lib/ficha/pdf/recursos.ts): incluir no deploy.
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/fonts/**/*", "./assets/templates/**/*"],
  },
  async headers() {
    return [
      { source: "/f/:path*", headers: CABECALHOS_CLIENTE },
      { source: "/api/f/:path*", headers: CABECALHOS_CLIENTE },
      { source: "/convite/:path*", headers: CABECALHOS_CLIENTE },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
