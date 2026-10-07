import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Installable app ("Add to Home Screen") + offline app shell.
    // App files are precached. Private images (photos, attachment pictures) are kept in a
    // device-only cache keyed by file path (the signed token is stripped), cleared on sign-out.
    // Supabase data (tables, auth) is never cached by the service worker.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "ULPA — ҒТТ оқу платформасы",
        short_name: "ULPA",
        description: "Ғарыштық техника және технология студенттеріне арналған оқу платформасы",
        lang: "kk",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#050a14",
        theme_color: "#050a14",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,webp,png,svg}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        importScripts: ["push-sw.js"], // push + notification click handlers
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              url.pathname.includes("/storage/v1/object/sign/") &&
              !url.searchParams.has("download") &&
              (request.destination === "image" || /\.(jpe?g|png|webp)$/i.test(url.pathname)),
            handler: "CacheFirst",
            options: {
              cacheName: "ulpa-private-images",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  // Same file = same cache entry, whatever the signature token.
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const url = new URL(request.url);
                    url.search = "";
                    return url.href;
                  },
                  // <img> requests are no-cors; fetch with CORS so the response is cacheable and small.
                  requestWillFetch: async ({ request }) => new Request(request.url, { mode: "cors", credentials: "omit" }),
                },
              ],
            },
          },
        ],
      },
    }),
  ],
});
