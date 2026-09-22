require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const {
  analyzeTranscript,
  analyzeTransaction,
  combineRisk,
  optionalAIAnalysis
} = require("./riskEngine");

const app = express();
const prisma = new PrismaClient();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin not allowed"));
  }
}));

app.use(express.json());

async function audit(type, message, metadata = {}) {
  const item = await prisma.auditEvent.create({
    data: { type, message, metadata: JSON.stringify(metadata) }
  });
  return item;
}

let seedPromise;

async function seed() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await prisma.customer.count();
      if (count === 0) {
        await prisma.customer.create({
          data: {
            name: "Arthur",
            age: 72,
            balance: 24800,
            typicalTransfer: 150,
            trustedContact: "Martha — Daughter",
            trustedPhone: "+256 700 000 000"
          }
        });
      }
    })();
  }
  return seedPromise;
}

function sendSse(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

app.get("/api/health", async (req, res) => {
  try {
    await seed();
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      service: "ClarityPay API",
      database: "connected",
      time: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: "ClarityPay API",
      database: "unavailable",
      error: process.env.NODE_ENV === "production" ? "Database unavailable" : error.message
    });
  }
});

app.get("/api/customer", async (req, res) => {
  await seed();
  const customer = await prisma.customer.findFirst({
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 10 } }
  });
  res.json(customer);
});

app.get("/api/audit", async (req, res) => {
  await seed();
  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 30
  });
  res.json(events);
});

app.get("/api/alerts", async (req, res) => {
  await seed();
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: 20
  });
  res.json(alerts);
});

/*
 * Vercel-friendly streaming simulation.
 * The browser opens this GET endpoint with EventSource, so the stream
 * does not depend on an in-memory server-wide client registry.
 */
app.get("/api/simulate-transcript", async (req, res) => {
  await seed();

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const customer = await prisma.customer.findFirst();

  const lines = [
    "Hello Arthur, this is your bank fraud prevention team.",
    "We detected suspicious activity on your account.",
    "Stay on the line while we secure your money.",
    "Do not call your daughter or tell anyone about this.",
    "You need to move your money to a safe clearinghouse account.",
    "Open online banking right now and start a wire transfer.",
    "Transfer $9,500 immediately.",
    "Do not hang up until the transfer is complete."
  ];

  let transcript = "";

  try {
    sendSse(res, { type: "connected" });

    for (let i = 0; i < lines.length; i++) {
      if (req.destroyed) return;

      transcript += (i ? " " : "") + lines[i];

      const tx = {
        amount: 9500,
        recipient: "Safe Clearinghouse",
        recipientRef: "88392",
        isNewRecipient: true
      };

      const transcriptResult = analyzeTranscript(transcript);
      const transactionResult = analyzeTransaction(tx, customer);
      const combined = combineRisk({
        transcriptScore: transcriptResult.transcriptScore,
        transactionScore: transactionResult.transactionScore
      });

      sendSse(res, {
        type: "transcript",
        line: lines[i],
        transcript,
        result: {
          ...combined,
          signals: [...new Set([
            ...transcriptResult.signals,
            ...transactionResult.signals
          ])],
          source: "rules-only"
        }
      });

      await new Promise(resolve => setTimeout(resolve, 850));
    }

    const event = await audit("SIMULATION", "Scam-call simulation completed", {
      customer: customer?.name
    });

    sendSse(res, { type: "audit", event });
    sendSse(res, { type: "complete" });
  } catch (error) {
    if (!res.writableEnded) {
      sendSse(res, {
        type: "error",
        message: process.env.NODE_ENV === "production"
          ? "Simulation failed"
          : error.message
      });
    }
  } finally {
    res.end();
  }
});

app.post("/api/analyze", async (req, res) => {
  await seed();

  const { transcript = "", transaction } = req.body;
  const customer = await prisma.customer.findFirst();

  const transcriptResult = analyzeTranscript(transcript);
  const transactionResult = analyzeTransaction(transaction, customer);
  const ai = await optionalAIAnalysis(transcript, transaction, customer);

  const combined = combineRisk({
    transcriptScore: transcriptResult.transcriptScore,
    transactionScore: transactionResult.transactionScore,
    aiScore: ai.score
  });

  const signals = [...new Set([
    ...transcriptResult.signals,
    ...transactionResult.signals,
    ...ai.signals
  ])];

  res.json({
    ...combined,
    signals,
    source: ai.source
  });
});

app.post("/api/transactions", async (req, res) => {
  await seed();

  const { amount, recipient, recipientRef, transcript = "" } = req.body;
  const customer = await prisma.customer.findFirst();

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  if (!recipient || !recipientRef) {
    return res.status(400).json({ error: "Recipient and account/reference are required" });
  }

  if (!customer) {
    return res.status(500).json({ error: "Customer profile not found" });
  }

  const transaction = {
    amount: numericAmount,
    recipient: String(recipient),
    recipientRef: String(recipientRef),
    isNewRecipient: true
  };

  const transcriptResult = analyzeTranscript(transcript);
  const transactionResult = analyzeTransaction(transaction, customer);

  const combined = combineRisk({
    transcriptScore: transcriptResult.transcriptScore,
    transactionScore: transactionResult.transactionScore
  });

  const signals = [...new Set([
    ...transcriptResult.signals,
    ...transactionResult.signals
  ])];

  const created = await prisma.transaction.create({
    data: {
      customerId: customer.id,
      amount: transaction.amount,
      recipient: transaction.recipient,
      recipientRef: transaction.recipientRef,
      isNewRecipient: true,
      riskScore: combined.riskScore,
      riskLevel: combined.riskLevel,
      status: combined.riskScore >= 50 ? "INTERCEPTED" : "PENDING"
    }
  });

  const event = await audit(
    combined.riskScore >= 50 ? "INTERCEPT" : "TRANSFER_CREATED",
    combined.riskScore >= 50
      ? "Suspicious transfer intercepted before confirmation"
      : "Transfer created",
    { transactionId: created.id, riskScore: combined.riskScore, signals }
  );

  res.json({
    transaction: created,
    risk: { ...combined, signals },
    audit: event
  });
});

app.post("/api/transactions/:id/hold", async (req, res) => {
  const transaction = await prisma.transaction.update({
    where: { id: req.params.id },
    data: { status: "PAUSED_24H" },
    include: { customer: true }
  });

  const alert = await prisma.alert.create({
    data: {
      customerId: transaction.customerId,
      channel: "TRUSTED_CONTACT",
      message: `${transaction.customer.name}'s $${transaction.amount.toLocaleString()} transfer was paused by ClarityPay. Please verify with them directly.`,
      status: "SIMULATED"
    }
  });

  await audit("SAFE_HOLD", "24-hour safety hold activated", {
    transactionId: transaction.id,
    alertId: alert.id
  });

  res.json({ transaction, alert });
});

app.post("/api/transactions/:id/release", async (req, res) => {
  const transaction = await prisma.transaction.update({
    where: { id: req.params.id },
    data: { status: "RELEASED" }
  });

  await audit("RELEASE", "Transaction released from hold", {
    transactionId: transaction.id
  });

  res.json(transaction);
});

module.exports = { app, prisma, seed };
