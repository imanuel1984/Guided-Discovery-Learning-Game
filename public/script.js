let allQuestions = {};
let currentQuestionIndex = 0;
let score = 0;
let questionPool = [];
let lastQuestion = null;

let aiHistory = [];           // per-question chat history
let lastUserAnswerIndex = null;
let answeredLocked = false;

// ---------- CUSTOM SELECT (topic) ----------
(() => {
  const wrapper = document.getElementById("topicSelect");
  const trigger = wrapper.querySelector(".select-trigger");
  const menu = wrapper.querySelector(".select-menu");
  const label = document.getElementById("topicLabel");
  const hidden = document.getElementById("topic");
  const options = [...wrapper.querySelectorAll(".select-option")];

  function setValue(value) {
    hidden.value = value;
    label.textContent = value;
    options.forEach(o => o.classList.toggle("active", o.dataset.value === value));
  }

  function open() {
    wrapper.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.focus();
  }

  function close() {
    wrapper.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    wrapper.classList.contains("open") ? close() : open();
  });

  options.forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      setValue(opt.dataset.value);
      close();
    });
  });

  document.addEventListener("click", () => close());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  setValue(hidden.value || "Python");
})();

// ---------- GAME ----------
document.getElementById("startGame").onclick = async () => {
  const selectedTopic = document.getElementById("topic").value;

  const res = await fetch("/questions");
  allQuestions = await res.json();

  const topicQuestions = allQuestions[selectedTopic];
  if (!topicQuestions || topicQuestions.length === 0) {
    alert("No questions for this topic.");
    return;
  }

  questionPool = shuffle([...topicQuestions]).slice(0, 10);
  currentQuestionIndex = 0;
  score = 0;

  document.getElementById("gameArea").style.display = "block";
  document.getElementById("startGame").style.display = "none";
  document.getElementById("endScreen").style.display = "none";

  loadQuestion();
};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function loadQuestion() {
  if (currentQuestionIndex >= questionPool.length) {
    endGame();
    return;
  }

  const q = questionPool[currentQuestionIndex];
  lastQuestion = q;

  // reset per-question state
  aiHistory = [];
  lastUserAnswerIndex = null;
  answeredLocked = false;

  document.getElementById("aiChatLog").innerHTML = "";
  document.getElementById("aiInput").value = "";

  document.getElementById("explainBtn").style.display = "none";
  document.getElementById("nextBtn").style.display = "none";

  showQuestion(q);
}

function showQuestion(q) {
  document.getElementById("questionNumber").textContent =
    `Question ${currentQuestionIndex + 1} of ${questionPool.length}`;

  document.getElementById("questionText").textContent = q.question;

  const choicesDiv = document.getElementById("choices");
  choicesDiv.innerHTML = "";

  q.choices.forEach((choice, index) => {
    const btn = document.createElement("button");
    btn.textContent = choice;

    btn.onclick = () => {
      if (answeredLocked) return;
      checkAnswer(index, q.correctIndex);
    };

    choicesDiv.appendChild(btn);
  });

  document.getElementById("score").textContent = `Score: ${score}`;
}

function checkAnswer(selected, correct) {
  answeredLocked = true;
  lastUserAnswerIndex = selected;

  // Update score
  if (selected === correct) score++;

  // Lock choice buttons visually (optional)
  const buttons = document.querySelectorAll("#choices button");
  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === selected) {
      b.style.outline = "3px solid rgba(255,255,255,0.75)";
    }
  });

  document.getElementById("score").textContent = `Score: ${score}`;

  // Show explain + next (but AI still only if user clicks)
  document.getElementById("explainBtn").style.display = "inline-block";
  document.getElementById("nextBtn").style.display = "inline-block";
}

document.getElementById("nextBtn").onclick = () => {
  currentQuestionIndex++;
  loadQuestion();
};

function endGame() {
  document.getElementById("gameArea").style.display = "none";
  document.getElementById("endScreen").style.display = "block";
  document.getElementById("finalScore").textContent =
    `Your score: ${score} / ${questionPool.length}`;
}

// ---------- AI (NO AUTO) ----------

// 🦆 Hint button (no spoilers)
document.getElementById("hintBtn").onclick = async () => {
  if (!lastQuestion) return;

  const userText = "Give me a hint (no spoilers). Ask me 1–2 guiding questions.";

  appendChatMessage("You", "🦆 Hint please (no spoilers).");

  try {
    const res = await fetch("/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: lastQuestion,
        userMessage: userText,
        history: aiHistory
      })
    });

    const data = await res.json();
    aiHistory = data.history || aiHistory;
    appendChatMessage("AI", data.text || "No hint from AI.");
  } catch {
    appendChatMessage("AI", "Hint failed.");
  }
};

// Chat “Send” (still hint-mode, no spoilers)
document.getElementById("sendAI").onclick = async () => {
  if (!lastQuestion) return;

  const inputEl = document.getElementById("aiInput");
  const userText = inputEl.value.trim();
  if (!userText) return;

  appendChatMessage("You", userText);
  inputEl.value = "";

  try {
    const res = await fetch("/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: lastQuestion,
        userMessage: userText,
        history: aiHistory
      })
    });

    const data = await res.json();
    aiHistory = data.history || aiHistory;
    appendChatMessage("AI", data.text || "No response from AI.");
  } catch {
    appendChatMessage("AI", "AI chat failed.");
  }
};

// Explain after answer (only if clicked, only works after selecting)
document.getElementById("explainBtn").onclick = async () => {
  if (!lastQuestion) return;
  if (lastUserAnswerIndex === null) {
    appendChatMessage("AI", "Answer first, then I can explain.");
    return;
  }

  appendChatMessage("You", "Explain my answer.");

  try {
    const res = await fetch("/ai-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: lastQuestion,
        userAnswerIndex: lastUserAnswerIndex
      })
    });

    const data = await res.json();
    appendChatMessage("AI", data.text || "No explanation from AI.");
  } catch {
    appendChatMessage("AI", "Explain failed.");
  }
};

function appendChatMessage(sender, text) {
  const logEl = document.getElementById("aiChatLog");
  const div = document.createElement("div");
  div.classList.add("chat-message", sender === "You" ? "chat-user" : "chat-ai");
  div.innerHTML = `<strong>${sender}:</strong><br>${text}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}
document.getElementById("exitGameBtn").onclick = () => {
  // Reset game state
  currentQuestionIndex = 0;
  score = 0;
  questionPool = [];
  lastQuestion = null;
  aiHistory = [];
  lastUserAnswerIndex = null;
  answeredLocked = false;

  // Reset UI
  document.getElementById("gameArea").style.display = "none";
  document.getElementById("endScreen").style.display = "none";
  document.getElementById("startGame").style.display = "inline-block";

  document.getElementById("choices").innerHTML = "";
  document.getElementById("questionText").textContent = "";
  document.getElementById("questionNumber").textContent = "";
  document.getElementById("score").textContent = "";

  document.getElementById("aiChatLog").innerHTML = "";
  document.getElementById("aiInput").value = "";

  document.getElementById("explainBtn").style.display = "none";
  document.getElementById("nextBtn").style.display = "none";
};
