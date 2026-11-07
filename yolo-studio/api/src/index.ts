import "dotenv/config";
import cors from "cors";
import express from "express";
import { initDb } from "./db.js";
import { errorHandler } from "./http.js";
import { router } from "./routes.js";

const app = express();
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] }));
app.use(express.json({ limit: "5mb" }));
app.use("/api", router);
app.use(errorHandler);

const port = Number(process.env.API_PORT ?? 4010);
app.listen(port, "127.0.0.1", () => console.log(`[api] http://127.0.0.1:${port}`));
void initDb();
