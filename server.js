const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
const requestLog = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000, RATE_MAX = 5, MIN_FILL_MS = 1800;
function rateLimited(ip) {
  const now = Date.now();
  const recent = (requestLog.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) { requestLog.set(ip, recent); return true; }
  recent.push(now); requestLog.set(ip, recent); return false;
}
app.use(express.static(__dirname));

const required = ["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASS","SMTP_FROM"];
for (const key of required) {
  if (!process.env[key]) console.warn(`Missing environment variable: ${key}`);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

app.post("/api/preview-request", async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 120);
  const email = String(req.body?.email || "").trim().slice(0, 254);
  const website = String(req.body?.website || "").trim();
  const startedAt = Number(req.body?.startedAt || 0);
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (website || !startedAt || Date.now() - startedAt < MIN_FILL_MS) return res.json({ ok: true });
  if (rateLimited(ip)) return res.status(429).json({ error: "Too many requests. Please try again later." });
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter your name and a valid email address." });
  }
  try {
    await transporter.sendMail({
      from: `"Kathryn Korb" <${process.env.SMTP_FROM}>`,
      to: "studio@kathrynkorb.com",
      replyTo: email,
      subject: `New preview request — ${name}`,
      text: `A new private preview request was submitted.\n\nName: ${name}\nEmail: ${email}\n\nReply to this email to contact ${name}.`
    });

    await transporter.sendMail({
      from: `"Kathryn Korb" <${process.env.SMTP_FROM}>`,
      to: email,
      replyTo: "studio@kathrynkorb.com",
      subject: "Your Kathryn Korb preview request",
      text: `Hello ${name.split(/\\s+/)[0]},\n\nThank you for your interest in Kathryn Korb. Your request for private collection access has been received.\n\nKathryn will be in touch soon with preview details.\n\nWarmly,\nKathryn Korb`
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Preview request email failed:", err);
    res.status(500).json({ error: "We couldn't send your request. Please try again." });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(process.env.PORT || 10000, "0.0.0.0", () => console.log("Kathryn Korb web service running"));
