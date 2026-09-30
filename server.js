const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
app.use(express.json({ limit: "20kb" }));
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
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter your name and a valid email address." });
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: "kathryn.korb@gmail.com",
      replyTo: email,
      subject: `New Kathryn Korb Preview Request — ${name}`,
      text: `A new private preview request was submitted.\n\nName: ${name}\nEmail: ${email}\n\nReply to this email to contact ${name}.`
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Preview request email failed:", err);
    res.status(500).json({ error: "We couldn't send your request. Please try again." });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(process.env.PORT || 10000, "0.0.0.0", () => console.log("ANYA web service running"));
