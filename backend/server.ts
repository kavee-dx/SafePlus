import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

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

app.listen(PORT, () => {
  console.log(`SafePlus server running on port ${PORT}`);
});