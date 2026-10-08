import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        // Libraries change rarely: separate files stay cached across ULPA updates.
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser)[\\/]/ },
            { name: "supabase", test: /node_modules[\\/](@supabase|tslib|iceberg-js)[\\/]/ },
            { name: "icons", test: /node_modules[\\/]lucide-react[\\/]/ },
            // Shared app code and components. Pages import this instead of the entry file, so changing
            // one page no longer renames every other page file. (Layout + prefetch.js name the pages, so they stay out.)
            {
              name: (id) =>
                /[\\/]src[\\/](lib|features|config|components)[\\/]/.test(id) &&
                !/[\\/]components[\\/]layout[\\/]/.test(id) &&
                // Admin-only and rarely opened parts load with their own pages, not at startup.
                !/[\\/]components[\\/](admin|classlife|teachers)[\\/]/.test(id) &&
                !/(PhotoUploadDialog|MaterialUploadDialog|PhotoViewer|ImageLightbox|Markdown)\.jsx$/.test(id) &&
                !/prefetch\.js$/.test(id)
                  ? "core"
                  : null,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    // Installable app ("Add to Home Screen") + offline app shell.
    // App files are precached. Private images (photos, attachment pictures) are kept in a
    // device-only cache keyed by file path (the signed token is stripped), cleared on sign-out.
    // Supabase data (tables, auth) is never cached by the service worker.
    VitePWA({
      // "prompt": a new version waits until a safe moment (see src/lib/pwaUpdate.js)
      // instead of reloading in the middle of typing.
      registerType: "prompt",
      injectRegister: false,
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
        // Login backgrounds are only needed before signing in — don't download them for everyone.
        // The campus picture is fetched only by people who open the campus map.
        globIgnores: ["**/login-bg-*", "**/campus/**"],
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
