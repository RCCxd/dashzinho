import type { CookieOptions, Request } from "express";
import { SESSION_DURATION_MS } from "@shared/const";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function transportOptions(req: Request): Pick<CookieOptions, "secure" | "sameSite" | "path"> {
  const hostname = typeof req.hostname === "string" ? req.hostname.replace(/^\[|\]$/g, "").toLowerCase() : "";
  const insecureLocal = process.env.NODE_ENV === "development"
    && process.env.INSECURE_LOCAL_COOKIES === "true"
    && LOCAL_HOSTS.has(hostname);
  return { secure: !insecureLocal, sameSite: insecureLocal ? "lax" : "none", path: "/" };
}

export function getSessionCookieOptions(req: Request): CookieOptions {
  return { ...transportOptions(req), httpOnly: true, maxAge: SESSION_DURATION_MS };
}

export function getCsrfCookieOptions(req: Request): CookieOptions {
  return { ...transportOptions(req), httpOnly: false, maxAge: SESSION_DURATION_MS };
}
