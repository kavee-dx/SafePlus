import express from "express";
import cors from "cors";
import pool from "./config/db";
import apiRoutes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

const app = express();

app.use(cors());
// Evidence photos/videos are posted inline as data URLs (UC-02), so the JSON
// body limit is raised well above the 100kb default.
app.use(express.json({ limit: "15mb" }));

app.use("/api", apiRoutes);

app.get("/", (_req, res) => {
  res.json({
    message: "SafePlus API is running",
  });
});

app.get("/db-test", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.json({
      message: "Database connected successfully",
      time: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database connection error:", error);

    res.status(500).json({
      message: "Database connection failed",
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
