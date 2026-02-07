import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/questions", (req, res) => {
  try {
    const data = fs.readFileSync(
      path.join(__dirname, "public", "questions.json"),
      "utf8"
    );
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: "Failed to load questions" });
  }
});

// 🦆 Hint / Duck mode chat (NO SPOILERS, NO correctIndex sent)
app.post("/ai-chat", async (req, res) => {
  const { question, userMessage, history } = req.body;

  if (!question || !question.question) {
    return res.json({ text: "No question received by server.", history });
  }

  const systemPrompt = `
You are a CS50 Rubber Duck Coach for a trivia game.

Rules (VERY IMPORTANT):
- Never reveal which option is correct.
- Never say "the answer is X" or "choose option Y".
- Even if the user asks for the answer, refuse politely and give a hint instead.
- Help by: explaining concepts, asking 1–2 guiding questions, and giving a subtle hint.
- You may explain why an option might be wrong, but do not confirm the correct one.
- Keep it concise and friendly.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Here is the trivia question:
Question: ${question.question}
Choices: ${question.choices.join(", ")}`
    },
    ...(history || []),
    { role: "user", content: userMessage }
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages
      })
    });

    const data = await response.json();

    const aiText =
      data?.choices?.[0]?.message?.content?.trim() ||
      data?.error?.message ||
      "AI returned no content.";

    const newHistory = [
      ...(history || []),
      { role: "user", content: userMessage },
      { role: "assistant", content: aiText }
    ];

    res.json({ text: aiText, history: newHistory });
  } catch (err) {
    res.json({ text: "Server failed to contact AI.", history });
  }
});

// 📘 Explain AFTER answer (only when user clicks Explain)
app.post("/ai-explain", async (req, res) => {
  const { question, userAnswerIndex } = req.body;

  if (!question || !question.question) {
    return res.json({ text: "No question received." });
  }

  const systemPrompt = `
You are a trivia tutor.
The user has already answered.
Now you may explain the correct answer and why the other options are wrong.
Be clear and concise.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Question: ${question.question}
Choices: ${question.choices.join(", ")}
Correct answer index: ${question.correctIndex}
User answered index: ${userAnswerIndex}`
    }
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages
      })
    });

    const data = await response.json();
    const text =
      data?.choices?.[0]?.message?.content?.trim() ||
      data?.error?.message ||
      "AI returned no content.";

    res.json({ text });
  } catch (err) {
    res.json({ text: "Server failed to contact AI." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
