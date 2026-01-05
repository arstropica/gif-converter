import { Router } from "express";
import type { Request, Response } from "express";

import { conversionQueue } from "../services/queue.js";

const router = Router();
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || "10", 10);

// Get queue configuration and status
router.get("/config", (_req: Request, res: Response) => {
  try {
    const status = conversionQueue.getStatus();
    res.json(status);
  } catch (err) {
    console.error("[Queue] Config error:", err);
    res.status(500).json({ error: "Failed to get queue config" });
  }
});

// Update queue concurrency
router.put("/config", (req: Request, res: Response) => {
  try {
    const { concurrency } = req.body;

    if (typeof concurrency !== "number") {
      return res.status(400).json({ error: "Concurrency must be a number" });
    }

    if (concurrency < 1 || concurrency > MAX_CONCURRENCY) {
      return res.status(400).json({
        error: `Concurrency must be between 1 and ${MAX_CONCURRENCY}`,
      });
    }

    conversionQueue.setConcurrency(concurrency);

    const status = conversionQueue.getStatus();
    res.json(status);
  } catch (err) {
    console.error("[Queue] Update config error:", err);
    res.status(500).json({ error: "Failed to update queue config" });
  }
});

// Get queue status
router.get("/status", (_req: Request, res: Response) => {
  try {
    const status = conversionQueue.getStatus();
    res.json(status);
  } catch (err) {
    console.error("[Queue] Status error:", err);
    res.status(500).json({ error: "Failed to get queue status" });
  }
});

export default router;
