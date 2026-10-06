// GitHub Pages has no server-side routing. Copying index.html to 404.html makes
// deep links such as /gpa or /courses/aerodynamics load the app instead of a 404 page.
import { copyFileSync, existsSync } from "node:fs";

const source = "dist/index.html";
if (!existsSync(source)) {
  console.error("spa-fallback: dist/index.html not found. Run vite build first.");
  process.exit(1);
}
copyFileSync(source, "dist/404.html");
console.log("spa-fallback: dist/404.html created");
