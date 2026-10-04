import express from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { checkDatabaseConnection } from "../db";
import { createContext } from "./context";
import { getCsrfCookieOptions } from "./cookies";
import { CSRF_COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  if (req.path !== "/api/health") {
    const existing = parse(req.headers.cookie ?? "")[CSRF_COOKIE_NAME];
    const csrfCookie = typeof existing === "string" && /^[A-Za-z0-9_-]{43}$/.test(existing)
      ? existing
      : randomBytes(32).toString("base64url");
    if (csrfCookie !== existing) {
      res.cookie(CSRF_COOKIE_NAME, csrfCookie, {
        ...getCsrfCookieOptions(req),
        maxAge: SESSION_DURATION_MS,
      });
    }

    if (req.method === "POST" && req.path.startsWith("/api/trpc/")) {
      const submitted = req.get("x-csrf-token") ?? "";
      const expectedBytes = Buffer.from(csrfCookie);
      const submittedBytes = Buffer.from(submitted);
      if (expectedBytes.length !== submittedBytes.length || !timingSafeEqual(expectedBytes, submittedBytes)) {
        res.status(403).json({ error: "Falha na validação CSRF." });
        return;
      }
    }
  }
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

app.get("/api/health", async (_req, res) => {
  if (!(await checkDatabaseConnection())) return res.status(503).json({ status: "unavailable" });
  return res.status(200).json({ status: "ok" });
});

app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

export default app;
