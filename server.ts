import path from "node:path";
import app from "./server/_core/app";

const applicationPages = new Set([
  "/",
  "/login",
  "/activities",
  "/subjects",
  "/focus",
  "/achievements",
  "/planner",
  "/settings",
  "/404",
]);
const indexHtml = path.resolve(process.cwd(), "public", "index.html");

// Vercel serves files in /public through its CDN. This fallback serves the SPA shell
// for declared client routes that do not correspond to a physical static file.
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  const routePath = req.path.replace(/\/$/, "") || "/";
  if (!applicationPages.has(routePath)) return next();
  res.sendFile(indexHtml, error => {
    if (error) next(error);
  });
});

export default app;
