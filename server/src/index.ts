import "dotenv/config";
import cors from "cors";
import express from "express";
import { createMysqlPool } from "./db.js";
import { translationsRouter } from "./routes/translationsRouter.js";

const app = express();

const port = Number(process.env.PORT ?? "4000");

const configuredOrigins =
  process.env.CORS_ORIGIN?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

app.disable("x-powered-by");

app.use((_, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(
  cors({
    origin:
      configuredOrigins.length > 0
        ? (origin, cb) => {
            if (!origin) return cb(null, true);
            return cb(null, configuredOrigins.includes(origin));
          }
        : true,
  }),
);

let pool: ReturnType<typeof createMysqlPool> | null = null;
try {
  const candidate = createMysqlPool();
  await candidate.query("SELECT 1");
  pool = candidate;
} catch {
  pool = null;
}

app.use("/api", translationsRouter(pool));

app.listen(port, () => {
  console.log(
    `i18n API listening on http://127.0.0.1:${port} (DB: ${pool ? "connected" : "offline"})`,
  );
});
