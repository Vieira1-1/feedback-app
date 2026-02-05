const buttons = Array.from(document.querySelectorAll(".kiosk-btn"));

const overlay = document.getElementById("overlay");
const popupIcon = document.getElementById("popupIcon");
const popupTitle = document.getElementById("popupTitle");
const popupSub = document.getElementById("popupSub");
const popupBar = document.getElementById("popupBar");

let locked = false;
const COOLDOWN_MS = 2000;

function setLocked(state){
  locked = state;
  buttons.forEach(b => {
    b.disabled = state;
    b.classList.toggle("is-locked", state);
  });
}

function showPopup(ok, message){
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");

  if (ok){
    popupIcon.textContent = "✅";
    popupTitle.textContent = "Obrigado!";
    popupSub.textContent = "Feedback registado.";
  } else {
    popupIcon.textContent = "⚠️";
    popupTitle.textContent = "Erro";
    popupSub.textContent = message || "Não foi possível registar.";
  }

  // reinicia barra
  popupBar.style.transition = "none";
  popupBar.style.transform = "scaleX(0)";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      popupBar.style.transition = `transform ${COOLDOWN_MS}ms linear`;
      popupBar.style.transform = "scaleX(1)";
    });
  });
}

function hidePopup(){
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden", "true");
}

// ripple (efeito ondulação)
function addRipple(btn, clientX, clientY){
  const rect = btn.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  btn.appendChild(ripple);

  ripple.addEventListener("animationend", () => ripple.remove());
}

async function sendFeedback(grau, btn, ev){
  if (locked) return;

  // ripple onde clicou
  if (ev && ev.clientX && ev.clientY) addRipple(btn, ev.clientX, ev.clientY);

  // animação de seleção
  buttons.forEach(b => b.classList.remove("is-selected", "is-error"));
  btn.classList.add("is-selected");

  // bloqueio imediato
  setLocked(true);

  // popup imediato (UX)
  showPopup(true);

  let ok = true;
  let msg = "";

  try{
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grau })
    });

    const data = await res.json().catch(() => ({}));
    ok = res.ok && data.ok !== false;
    msg = data.message || "";
  }catch(e){
    ok = false;
    msg = "Sem ligação ao servidor.";
  }

  if (!ok){
    btn.classList.add("is-error");
    showPopup(false, msg);
  }

  setTimeout(() => {
    hidePopup();
    buttons.forEach(b => b.classList.remove("is-selected", "is-error"));
    setLocked(false);
  }, COOLDOWN_MS);
}

buttons.forEach(btn => {
  btn.addEventListener("click", (ev) => sendFeedback(btn.dataset.grau, btn, ev));
});
