const state = {
  user: null,
  view: "chat",
  conversationId: null,
  conversations: [],
  messages: [],
  streaming: false,
  drill: "listen",
  items: [],
  itemIndex: 0,
  recording: false,
};

const $ = (id) => document.getElementById(id);
const TIBETAN_RUN = /([ༀ-࿿][ༀ-࿿\s]*)/g;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function render(text) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split("\n").map((line) => {
        const hasTibetan = /[ༀ-࿿]/.test(line);
        const html = line
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(TIBETAN_RUN, '<span class="tib">$1</span>');
        TIBETAN_RUN.lastIndex = 0;
        if (hasTibetan && line.includes("—")) {
          return `<div class="phrase-line">${html}</div>`;
        }
        return html;
      });
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");
}

// ------------------------------------------------------------ sign in

async function signIn(name) {
  const resp = await fetch("/api/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) return;

  state.user = await resp.json();
  localStorage.setItem("ttutor_user_id", state.user.id);

  $("signin").hidden = true;
  $("app").hidden = false;
  paintBadge();
  await loadConversations();
  await loadPracticeItems();
}

async function restoreSession() {
  const id = localStorage.getItem("ttutor_user_id");
  if (!id) return false;

  const resp = await fetch(`/api/user/${id}`);
  if (!resp.ok) {
    localStorage.removeItem("ttutor_user_id");
    return false;
  }

  state.user = await resp.json();
  $("signin").hidden = true;
  $("app").hidden = false;
  paintBadge();
  await loadConversations();
  await loadPracticeItems();
  return true;
}

function paintBadge() {
  $("badge-name").textContent = state.user.name;
  $("badge-level").textContent = `Level ${state.user.level}`;
}

// ------------------------------------------------------ conversations

async function loadConversations() {
  const resp = await fetch(`/api/conversations?user_id=${state.user.id}`);
  const data = await resp.json();
  state.conversations = data.conversations;

  const list = $("history-list");
  if (!state.conversations.length) {
    list.innerHTML = '<div class="history-empty">No chats yet.</div>';
    await newConversation();
    return;
  }

  list.innerHTML = "";
  state.conversations.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "history-item" + (c.id === state.conversationId ? " active" : "");
    btn.textContent = c.title;
    btn.addEventListener("click", () => openConversation(c.id));
    list.appendChild(btn);
  });

  if (state.conversationId === null) {
    await openConversation(state.conversations[0].id);
  }
}

async function newConversation() {
  const resp = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: state.user.id }),
  });
  const conv = await resp.json();
  state.conversationId = conv.id;
  state.messages = [];
  showWelcome();
  await loadConversations();
}

async function openConversation(id) {
  state.conversationId = id;
  const resp = await fetch(`/api/conversations/${id}/messages`);
  const data = await resp.json();
  state.messages = data.messages;

  const messagesEl = $("messages");
  if (!state.messages.length) {
    showWelcome();
  } else {
    messagesEl.innerHTML = "";
    state.messages.forEach((m) => addMessage(m.role, m.content));
  }

  document.querySelectorAll(".history-item").forEach((el, i) => {
    el.classList.toggle("active", state.conversations[i] && state.conversations[i].id === id);
  });
}

// --------------------------------------------------------------- chat

function addMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role === "user" ? "user" : "tutor"}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "S";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = role === "user" ? `<p>${escapeHtml(text)}</p>` : render(text);

  wrap.append(avatar, bubble);
  $("messages").appendChild(wrap);
  scrollDown();
  return bubble;
}

function scrollDown() {
  const el = $("messages");
  el.scrollTop = el.scrollHeight;
}

function showWelcome() {
  $("messages").innerHTML = `
    <div class="welcome">
      <div class="big-tib">བཀྲ་ཤིས་བདེ་ལེགས།</div>
      <h3>Hi ${escapeHtml(state.user.name)}, I'm your personal Tibetan tutor.</h3>
      <p>What should we learn today?</p>
      <div class="starters">
        <button class="starter">Teach me the alphabet</button>
        <button class="starter">How do I greet someone?</button>
        <button class="starter">Teach me a useful phrase</button>
        <button class="starter">Quiz me</button>
      </div>
    </div>`;

  $("messages").querySelectorAll(".starter").forEach((btn) => {
    btn.addEventListener("click", () => sendChat(btn.textContent.trim()));
  });
}

async function sendChat(text) {
  if (!text || state.streaming) return;

  if ($("messages").querySelector(".welcome")) $("messages").innerHTML = "";

  const isFirst = state.messages.length === 0;
  addMessage("user", text);
  state.messages.push({ role: "user", content: text });

  $("input").value = "";
  $("input").style.height = "auto";
  setStreaming(true);

  const bubble = addMessage("assistant", "");
  bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';

  let reply = "";

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: state.user.id,
        conversation_id: state.conversationId,
        message: text,
      }),
    });

    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;

        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        if (event.type === "delta") {
          reply += event.content;
          bubble.innerHTML = render(reply);
          scrollDown();
        } else if (event.type === "error") {
          bubble.innerHTML = `<div class="error-msg">${escapeHtml(event.message)}</div>`;
          scrollDown();
        }
      }
    }

    if (reply.trim()) state.messages.push({ role: "assistant", content: reply });
    // The first message becomes the conversation title, so refresh the sidebar.
    if (isFirst) await loadConversations();
  } catch (err) {
    bubble.innerHTML = `<div class="error-msg">Could not reach the tutor: ${escapeHtml(
      err.message
    )}</div>`;
    state.messages.pop();
  } finally {
    setStreaming(false);
  }
}

function setStreaming(on) {
  state.streaming = on;
  $("send-btn").disabled = on;
  if (!on) $("input").focus();
}

// ----------------------------------------------------------- practice

async function loadPracticeItems() {
  const resp = await fetch(`/api/practice/items?level=${state.user.level}`);
  const data = await resp.json();
  state.items = data.items;
  state.itemIndex = 0;
  $("practice-focus").textContent = `${data.title} — ${data.focus}`;
  paintCard();
}

function currentItem() {
  return state.items[state.itemIndex] || null;
}

function paintCard() {
  const item = currentItem();
  if (!item) return;

  const tracing = state.drill === "trace";

  // In Trace the letter appears as the ghost to draw over, not as the heading.
  $("card-glyph").hidden = tracing;
  $("trace-area").hidden = !tracing;
  $("card-glyph").textContent = item.text;
  if (tracing) {
    $("trace-ghost").src = `/api/practice/ghost?text=${encodeURIComponent(item.text)}`;
  }
  $("card-roman").textContent = `${item.roman} — ${item.gloss}`;
  $("card-result").innerHTML = "";
  $("item-count").textContent = `${state.itemIndex + 1} / ${state.items.length}`;

  const action = $("card-action");
  action.innerHTML = "";

  if (state.drill === "listen") {
    const btn = document.createElement("button");
    btn.className = "action-btn";
    btn.textContent = "▶  Play";
    btn.addEventListener("click", () => playCurrent(btn));
    action.appendChild(btn);
  } else if (state.drill === "speak") {
    const btn = document.createElement("button");
    btn.className = "action-btn";
    btn.id = "record-btn";
    btn.textContent = "●  Record";
    btn.addEventListener("click", () => toggleRecording(btn));
    action.appendChild(btn);
  } else if (tracing) {
    clearCanvas();

    const clear = document.createElement("button");
    clear.className = "action-btn secondary";
    clear.textContent = "Clear";
    clear.addEventListener("click", () => {
      clearCanvas();
      $("card-result").innerHTML = "";
    });

    const check = document.createElement("button");
    check.className = "action-btn";
    check.textContent = "Check";
    check.addEventListener("click", () => checkTrace(check));

    action.append(clear, check);
  }
}

// ------------------------------------------------------- trace canvas

let drawing = false;

function canvasCtx() {
  const canvas = $("trace-canvas");
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";
  return ctx;
}

function clearCanvas() {
  const canvas = $("trace-canvas");
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  state.hasDrawn = false;
}

function canvasPoint(e) {
  const canvas = $("trace-canvas");
  const rect = canvas.getBoundingClientRect();
  // The canvas is displayed at CSS size but drawn at its bitmap size.
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function initCanvas() {
  const canvas = $("trace-canvas");

  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    state.hasDrawn = true;
    canvas.setPointerCapture(e.pointerId);
    const p = canvasPoint(e);
    const ctx = canvasCtx();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // A single tap should still leave a mark.
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = canvasPoint(e);
    const ctx = canvasCtx();
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });

  const stop = () => (drawing = false);
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointerleave", stop);
  canvas.addEventListener("pointercancel", stop);
}

async function checkTrace(btn) {
  const item = currentItem();

  if (!state.hasDrawn) {
    $("card-result").innerHTML =
      '<span class="result-bad">Draw the letter first.</span>';
    return;
  }

  btn.disabled = true;
  btn.textContent = "Checking…";

  try {
    const blob = await new Promise((resolve) =>
      $("trace-canvas").toBlob(resolve, "image/png")
    );

    const form = new FormData();
    form.append("user_id", state.user.id);
    form.append("target", item.text);
    form.append("image", blob, "trace.png");

    const resp = await fetch("/api/practice/trace", { method: "POST", body: form });
    if (!resp.ok) throw new Error((await resp.json()).detail || "Could not check that");

    const data = await resp.json();
    if (data.correct && data.judged_by === "ocr") {
      $("card-result").innerHTML =
        '<span class="result-ok">Correct — that reads as ' +
        `<span class="tib">${escapeHtml(item.text)}</span></span>`;
    } else if (data.correct) {
      // Shape matching cannot tell near-identical letters apart, so it claims
      // less than OCR does.
      $("card-result").innerHTML =
        `<span class="result-ok">Looks right — ${Math.round(
          data.score * 100
        )}% match to the shape</span>`;
    } else {
      $("card-result").innerHTML =
        `<span class="result-bad">Not quite — ${Math.round(
          data.score * 100
        )}% match. Follow the faint letter and try again.</span>`;
    }
  } catch (err) {
    $("card-result").innerHTML = `<span class="result-bad">${escapeHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Check";
  }
}

async function playCurrent(btn) {
  const item = currentItem();
  btn.disabled = true;
  btn.textContent = "Loading…";
  try {
    const resp = await fetch("/api/practice/listen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: item.text }),
    });
    if (!resp.ok) throw new Error((await resp.json()).detail || "Could not load audio");

    const { audio_url } = await resp.json();
    const audio = new Audio(audio_url);
    await audio.play();
    $("card-result").innerHTML = `<span class="result-ok">Listen and repeat: <b>${escapeHtml(
      item.roman
    )}</b></span>`;
  } catch (err) {
    $("card-result").innerHTML = `<span class="result-bad">${escapeHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "▶  Play";
  }
}

// ------------------------------------------------- recording (WAV out)
//
// MediaRecorder produces webm/Opus, which is not what the speech endpoint was
// verified against. Capturing raw PCM and encoding WAV here keeps the upload in
// the format known to work.

let audioCtx = null;
let mediaStream = null;
let processor = null;
let chunks = [];

function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

async function startRecording() {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(mediaStream);
  processor = audioCtx.createScriptProcessor(4096, 1, 1);
  chunks = [];

  processor.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);
}

function stopRecording() {
  if (processor) processor.disconnect();
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());

  const length = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  const rate = audioCtx ? audioCtx.sampleRate : 44100;
  if (audioCtx) audioCtx.close();
  audioCtx = null;
  return encodeWAV(merged, rate);
}

async function toggleRecording(btn) {
  const item = currentItem();

  if (!state.recording) {
    try {
      await startRecording();
    } catch {
      $("card-result").innerHTML =
        '<span class="result-bad">Could not access the microphone.</span>';
      return;
    }
    state.recording = true;
    btn.classList.add("recording");
    btn.textContent = "■  Stop";
    $("card-result").innerHTML = `<span class="result-ok">Listening… say <b>${escapeHtml(
      item.roman
    )}</b></span>`;
    return;
  }

  state.recording = false;
  btn.classList.remove("recording");
  btn.disabled = true;
  btn.textContent = "Checking…";

  const wav = stopRecording();

  try {
    const form = new FormData();
    form.append("user_id", state.user.id);
    form.append("target", item.text);
    form.append("audio", wav, "recording.wav");

    const resp = await fetch("/api/practice/speak", { method: "POST", body: form });
    if (!resp.ok) throw new Error((await resp.json()).detail || "Could not check that");

    const data = await resp.json();
    $("card-result").innerHTML = data.correct
      ? `<span class="result-ok">Correct — I heard <span class="tib">${escapeHtml(
          data.transcript
        )}</span></span>`
      : `<span class="result-bad">I heard <span class="tib">${escapeHtml(
          data.transcript || "nothing"
        )}</span> — try again</span>`;
  } catch (err) {
    $("card-result").innerHTML = `<span class="result-bad">${escapeHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "●  Record";
  }
}

// ------------------------------------------------------------- wiring

$("signin-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("signin-name").value.trim();
  if (name) signIn(name);
});

$("view-toggle").addEventListener("click", (e) => {
  const btn = e.target.closest(".toggle-btn");
  if (!btn) return;
  document.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.view = btn.dataset.view;
  $("view-chat").hidden = state.view !== "chat";
  $("view-practice").hidden = state.view !== "practice";
});

$("drill-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".drill");
  if (!btn || btn.disabled) return;
  document.querySelectorAll(".drill").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.drill = btn.dataset.drill;
  paintCard();
});

$("prev-item").addEventListener("click", () => {
  if (!state.items.length) return;
  state.itemIndex = (state.itemIndex - 1 + state.items.length) % state.items.length;
  paintCard();
});

$("next-item").addEventListener("click", () => {
  if (!state.items.length) return;
  state.itemIndex = (state.itemIndex + 1) % state.items.length;
  paintCard();
});

$("new-chat").addEventListener("click", () => newConversation());

$("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  sendChat($("input").value.trim());
});

$("input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat($("input").value.trim());
  }
});

$("input").addEventListener("input", () => {
  const el = $("input");
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 150) + "px";
});

initCanvas();

restoreSession().then((ok) => {
  if (!ok) $("signin-name").focus();
});
