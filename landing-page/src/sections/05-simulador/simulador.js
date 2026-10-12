// Estado dos 10 assentos (1 a 10)
// 'A' = Horta Comunitária, 'B' = Espaço Pet
const seatVotes = {
  1: "A",
  2: "A",
  3: "A",
  4: "A",
  5: "A",
  6: "A",
  7: "B",
  8: "B",
  9: "B",
  10: "B",
};

// Elementos da UI
const seatButtons = document.querySelectorAll(".seat-btn");
const votesCountA = document.getElementById("votes-count-a");
const votesCountB = document.getElementById("votes-count-b");
const cardA = document.getElementById("prop-card-a");
const cardB = document.getElementById("prop-card-b");

const timerBadge = document.getElementById("timer-badge");
const timerBar = document.getElementById("timer-bar");
const timerDisplay = document.getElementById("timer-display");
const timerExplanation = document.getElementById("timer-explanation");

const btnUnanimidade = document.getElementById("btn-unanimidade");
const btnReset = document.getElementById("btn-reset");

// Função para recalcular o estado do consenso
function updateSimulationState() {
  let countA = 0;
  let countB = 0;

  // Atualiza visual dos assentos
  seatButtons.forEach((btn) => {
    const seatId = btn.getAttribute("data-seat");
    const vote = seatVotes[seatId];
    const voteDot = btn.querySelector(".seat-vote-dot");

    if (vote === "A") {
      countA++;
      btn.classList.add("seat-a");
      btn.classList.remove("seat-b");
      voteDot.classList.add("vote-a");
      voteDot.classList.remove("vote-b");
      voteDot.textContent = "A";
      btn.setAttribute(
        "aria-label",
        `Vizinho ${seatId}: votou na Proposta A`,
      );
    } else {
      countB++;
      btn.classList.add("seat-b");
      btn.classList.remove("seat-a");
      voteDot.classList.add("vote-b");
      voteDot.classList.remove("vote-a");
      voteDot.textContent = "B";
      btn.setAttribute(
        "aria-label",
        `Vizinho ${seatId}: votou na Proposta B`,
      );
    }
  });

  // Atualiza contadores
  if (votesCountA) votesCountA.textContent = `${countA} ${countA === 1 ? "voto" : "votos"}`;
  if (votesCountB) votesCountB.textContent = `${countB} ${countB === 1 ? "voto" : "votos"}`;

  // Identifica líder
  let leader = null;
  let leaderVotes = 0;
  let leaderName = "";

  if (countA > countB) {
    leader = "A";
    leaderVotes = countA;
    leaderName = "Horta Comunitária (Proposta A)";
    if (cardA) cardA.classList.add("active");
    if (cardB) cardB.classList.remove("active");
  } else if (countB > countA) {
    leader = "B";
    leaderVotes = countB;
    leaderName = "Espaço Pet (Proposta B)";
    if (cardB) cardB.classList.add("active");
    if (cardA) cardA.classList.remove("active");
  } else {
    leader = "EMPATE";
    leaderVotes = countA; // 5
    if (cardA) cardA.classList.remove("active");
    if (cardB) cardB.classList.remove("active");
  }

  if (!timerBadge || !timerBar || !timerDisplay || !timerExplanation) return;

  if (leaderVotes === 10) {
    timerBadge.textContent = "Consenso Pleno!";
    timerBadge.style.backgroundColor = "#D3E8DD";
    timerBadge.style.color = "#184E38";
    timerBar.style.width = "100%";
    timerBar.style.backgroundColor = "#184E38";
    timerDisplay.innerHTML = '<span class="material-symbols-rounded timer-icon">celebration</span> Aprovado Imediatamente!';
    timerExplanation.textContent = `Todos os 10 membros apoiaram a ${leaderName}. O consenso foi unânime e o plano já está pronto para execução no mundo real!`;
  } else if (leaderVotes === 9) {
    timerBadge.textContent = "Aprovação Iminente";
    timerBadge.style.backgroundColor = "#D3E8DD";
    timerBadge.style.color = "#184E38";
    timerBar.style.width = "85%";
    timerBar.style.backgroundColor = "#246B4E";
    timerDisplay.innerHTML = '<span class="material-symbols-rounded timer-icon">hourglass_top</span> 2 dias restantes (Carência)';
    timerExplanation.textContent = `Adesão quase total (9 de 10 votos). O relógio contraiu para a janela de carência de segurança. Se ninguém apresentar nova contestação, aprova em 48 horas!`;
  } else if (leaderVotes >= 7) {
    timerBadge.textContent = "Aceleração Forte";
    timerBadge.style.backgroundColor = "#EBF4EF";
    timerBadge.style.color = "#184E38";
    timerBar.style.width = "65%";
    timerBar.style.backgroundColor = "#246B4E";
    timerDisplay.innerHTML = '<span class="material-symbols-rounded timer-icon">hourglass_top</span> 3 a 4 dias restantes';
    timerExplanation.textContent = `Com ${leaderVotes} votos a favor da ${leaderName}, a proposta ganhou velocidade. O prazo encurtou bastante em relação aos 10 dias originais.`;
  } else if (leaderVotes >= 5 && leader !== "EMPATE") {
    timerBadge.textContent = "Debate Ativo";
    timerBadge.style.backgroundColor = "#E2DBD0";
    timerBadge.style.color = "#1C1E21";
    timerBar.style.width = "45%";
    timerBar.style.backgroundColor = "#B4621A";
    timerDisplay.innerHTML = '<span class="material-symbols-rounded timer-icon">hourglass_top</span> 6 a 8 dias restantes';
    timerExplanation.textContent = `Atingiu o quórum mínimo (5 votos). O relógio começou a contagem regressiva, mas ainda dá tempo suficiente para contrapropostas e ajustes de emenda.`;
  } else if (leader === "EMPATE") {
    timerBadge.textContent = "Mesa Dividida (5x5)";
    timerBadge.style.backgroundColor = "#FCEBD8";
    timerBadge.style.color = "#B4621A";
    timerBar.style.width = "35%";
    timerBar.style.backgroundColor = "#B4621A";
    timerDisplay.innerHTML = '<span class="material-symbols-rounded timer-icon">hourglass_top</span> 10 dias (Prazo Máximo)';
    timerExplanation.textContent = `A mesa está exatamente dividida: 5 votos para cada lado. O relógio esticou ao máximo para dar tempo do grupo conversar e unir as duas ideias numa só!`;
  }
}

// Interação ao clicar nos assentos
seatButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const seatId = btn.getAttribute("data-seat");
    seatVotes[seatId] = seatVotes[seatId] === "A" ? "B" : "A";
    updateSimulationState();
  });
});

// Botões de ação rápida
if (btnUnanimidade) {
  btnUnanimidade.addEventListener("click", () => {
    for (let i = 1; i <= 10; i++) {
      seatVotes[i] = "A";
    }
    updateSimulationState();
  });
}

if (btnReset) {
  btnReset.addEventListener("click", () => {
    for (let i = 1; i <= 6; i++) seatVotes[i] = "A";
    for (let i = 7; i <= 10; i++) seatVotes[i] = "B";
    updateSimulationState();
  });
}

// Inicializa o estado visual da Mesa dos 10
updateSimulationState();

/* ==========================================================================
   SIMULADOR DE ATIVAÇÃO & ESCALA
   ========================================================================== */
const step1 = document.getElementById("act-step-1");
const step2 = document.getElementById("act-step-2");
const step3 = document.getElementById("act-step-3");
const step4 = document.getElementById("act-step-4");

const btnDrawCitizen = document.getElementById("btn-draw-citizen");
const btnEnterTable = document.getElementById("btn-enter-table");
const btnConfirmSynthesis = document.getElementById("btn-confirm-synthesis");
const btnRestartAct = document.getElementById("btn-restart-act");

function showActStep(targetStep) {
  [step1, step2, step3, step4].forEach((s) => {
    if (s) {
      s.style.display = "none";
      s.classList.remove("active");
    }
  });
  if (targetStep) {
    targetStep.style.display = "flex";
    targetStep.classList.add("active");
  }
}

if (btnDrawCitizen) {
  btnDrawCitizen.addEventListener("click", () => {
    btnDrawCitizen.innerHTML = '<span class="material-symbols-rounded btn-icon">casino</span> Sorteando por VRF...';
    btnDrawCitizen.disabled = true;

    setTimeout(() => {
      btnDrawCitizen.innerHTML = '<span class="material-symbols-rounded btn-icon">casino</span> Realizar Sorteio Justo';
      btnDrawCitizen.disabled = false;
      showActStep(step2);
    }, 700);
  });
}

if (btnEnterTable) {
  btnEnterTable.addEventListener("click", () => {
    showActStep(step3);
  });
}

if (btnConfirmSynthesis) {
  btnConfirmSynthesis.addEventListener("click", () => {
    btnConfirmSynthesis.innerHTML = '<span class="material-symbols-rounded btn-icon">check_circle</span> Assinado com Biometria!';
    btnConfirmSynthesis.disabled = true;

    setTimeout(() => {
      btnConfirmSynthesis.innerHTML = '<span class="material-symbols-rounded btn-icon">fingerprint</span> Assinar com Biometria & Apoiar';
      btnConfirmSynthesis.disabled = false;
      showActStep(step4);
    }, 800);
  });
}

if (btnRestartAct) {
  btnRestartAct.addEventListener("click", () => {
    showActStep(step1);
  });
}
