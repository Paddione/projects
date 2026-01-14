import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";

const router = Router();

const PRIORITY_ACCOUNTS_FILE = path.join(
  __dirname,
  "../../data/priority-accounts.json"
);

// Rate limiter: 5 requests per hour per IP
const accountQueueLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: "Too many account queue requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

interface PriorityAccount {
  accountName: string;
  requestedAt: number;
  requestedByIp: string;
}

// Calculate estimated time until account is processed
// Assumes ~3 minutes per account in queue (including the user's account)
function getEstimatedSeconds(queuePosition: number): number {
  const now = new Date();
  const currentSecond = now.getSeconds();
  const secondsUntilNextRun = 60 - currentSecond;

  // 3 minutes per account in queue (fetch account + all chars)
  const secondsForAllAccounts = queuePosition * 3 * 60;

  return secondsForAllAccounts + secondsUntilNextRun;
}

// Read priority accounts from file
function readPriorityAccounts(): PriorityAccount[] {
  try {
    if (fs.existsSync(PRIORITY_ACCOUNTS_FILE)) {
      const data = fs.readFileSync(PRIORITY_ACCOUNTS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading priority accounts file:", error);
  }
  return [];
}

// Write priority accounts to file
function writePriorityAccounts(accounts: PriorityAccount[]): void {
  try {
    const dir = path.dirname(PRIORITY_ACCOUNTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PRIORITY_ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  } catch (error) {
    console.error("Error writing priority accounts file:", error);
    throw error;
  }
}

// POST /api/accounts/queue - Add account to priority scrape queue
router.post("/queue", accountQueueLimiter, (req: Request, res: Response) => {
  const { accountName } = req.body;

  // Validate account name
  if (!accountName || typeof accountName !== "string") {
    return res.status(400).json({ error: "Account name is required" });
  }

  const sanitized = accountName.trim();
  if (sanitized.length === 0 || sanitized.length > 50) {
    return res
      .status(400)
      .json({ error: "Account name must be between 1 and 50 characters" });
  }

  // Allow alphanumeric, underscores, hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    return res.status(400).json({
      error:
        "Account name can only contain letters, numbers, underscores, and hyphens",
    });
  }

  // Read existing queue
  const accounts = readPriorityAccounts();

  // Check if account already in queue
  const existing = accounts.find(
    (a) => a.accountName.toLowerCase() === sanitized.toLowerCase()
  );
  if (existing) {
    const queuePosition = accounts.indexOf(existing) + 1;
    const estimatedSeconds = getEstimatedSeconds(queuePosition);
    return res.json({
      message: "Account already in queue",
      accountName: sanitized,
      estimatedSeconds,
      queuePosition,
    });
  }

  // Global queue limit
  if (accounts.length >= 100) {
    return res.status(429).json({
      error: "Queue is full. Please try again later.",
    });
  }

  // Add to queue
  const newAccount: PriorityAccount = {
    accountName: sanitized,
    requestedAt: Date.now(),
    requestedByIp: req.ip || "unknown",
  };

  accounts.push(newAccount);
  writePriorityAccounts(accounts);

  const queuePosition = accounts.length;
  const estimatedSeconds = getEstimatedSeconds(queuePosition);

  return res.status(201).json({
    message: "Account added to priority queue",
    accountName: sanitized,
    estimatedSeconds,
    queuePosition,
  });
});

export default router;
