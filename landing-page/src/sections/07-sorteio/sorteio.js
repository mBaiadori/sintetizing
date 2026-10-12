/* ==========================================================================
   SORTEIO ROTATIVO: 100 pessoas na comunidade, 10 pessoas por mesa
   ========================================================================== */
const drawPeopleEl = document.getElementById("draw-people");
const drawProgressEl = document.getElementById("draw-progress");
const drawPhaseTag = document.getElementById("draw-phase-tag");
const drawTableState = document.getElementById("draw-table-state");
const drawSeatsContainer = document.getElementById("draw-seats-container");
const lotMsg = document.getElementById("draw-msg");
const lotBtn = document.getElementById("btn-draw");
const lotReset = document.getElementById("btn-draw-reset");

const TOTAL_PEOPLE = 100;
const TABLE_SIZE = 10;
let pastParticipants = new Set();
let currentTable = [];
let roundNumber = 0;

function paintDraw() {
  if (!drawPeopleEl) return;
  drawPeopleEl.innerHTML = "";

  for (let i = 1; i <= TOTAL_PEOPLE; i++) {
    const chip = document.createElement("div");
    chip.className = "citizen-chip draw-dot-sm";
    chip.textContent = i;
    chip.setAttribute("data-id", i);

    if (currentTable.includes(i)) {
      chip.classList.add("chip-table", "active-table");
    } else if (pastParticipants.has(i)) {
      chip.classList.add("chip-past", "past-table");
    }

    drawPeopleEl.appendChild(chip);
  }

  if (drawSeatsContainer) {
    drawSeatsContainer.innerHTML = "";
    for (let s = 1; s <= TABLE_SIZE; s++) {
      const seat = document.createElement("div");
      seat.className = "draw-seat-btn";
      seat.setAttribute("data-seat", s);

      const citizenId = currentTable[s - 1];
      if (citizenId) {
        seat.classList.add("seat-occupied", "seat-filled");
        seat.innerHTML = `<span class="draw-seat-num">${citizenId}</span>`;
      } else {
        seat.classList.add("seat-empty");
        seat.innerHTML = `<span class="draw-seat-placeholder">${s}</span>`;
      }

      drawSeatsContainer.appendChild(seat);
    }
  }

  const totalCalled = pastParticipants.size + currentTable.length;
  if (drawProgressEl) {
    drawProgressEl.textContent = `${totalCalled} de ${TOTAL_PEOPLE} participaram`;
  }
}

if (lotBtn) {
  paintDraw();

  lotBtn.addEventListener("click", () => {
    if (
      pastParticipants.size + currentTable.length >= TOTAL_PEOPLE &&
      currentTable.length > 0
    ) {
      pastParticipants.clear();
      currentTable = [];
      roundNumber = 0;
      lotBtn.textContent = "Sortear Mesa (10 pessoas)";
      if (drawPhaseTag) drawPhaseTag.textContent = "Aguardando Início";
      if (drawTableState) drawTableState.textContent = "Cadeiras Livres";
      if (lotMsg) {
        lotMsg.innerHTML =
          "Clique para sortear as primeiras 10 pessoas e abrir a discussão.";
      }
      paintDraw();
      return;
    }

    if (currentTable.length > 0) {
      currentTable.forEach((id) => pastParticipants.add(id));
      currentTable = [];
    }

    const pool = [];
    for (let i = 1; i <= TOTAL_PEOPLE; i++) {
      if (!pastParticipants.has(i)) {
        pool.push(i);
      }
    }

    const pickCount = Math.min(TABLE_SIZE, pool.length);
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, pickCount);

    lotBtn.disabled = true;
    lotBtn.classList.add("spinning");
    if (drawPhaseTag) drawPhaseTag.textContent = "Sorteando...";
    if (drawTableState) drawTableState.textContent = "Girando a roda...";

    setTimeout(() => {
      currentTable = selected;
      roundNumber++;
      lotBtn.disabled = false;
      lotBtn.classList.remove("spinning");

      const totalCalled = pastParticipants.size + currentTable.length;
      const isComplete = totalCalled >= TOTAL_PEOPLE;

      if (drawPhaseTag) {
        drawPhaseTag.textContent = isComplete
          ? "Ciclo Completo! (100/100)"
          : `Mesa ${roundNumber}/10`;
        drawPhaseTag.className =
          "draw-phase-badge" +
          (isComplete ? " badge-complete" : " badge-active");
      }

      if (drawTableState) {
        drawTableState.textContent = isComplete
          ? "Ciclo Concluído"
          : "Discussão em Andamento";
      }

      if (lotMsg) {
        if (isComplete) {
          lotBtn.innerHTML =
            '<span class="material-symbols-rounded btn-icon">restart_alt</span> Reiniciar Novo Ciclo';
          lotMsg.innerHTML = `<strong>Ciclo Completo!</strong> Todas as 100 pessoas participaram de uma Mesa de 10. Todos tiveram sua voz ouvida e respeitada!`;
        } else {
          lotBtn.innerHTML =
            '<span class="material-symbols-rounded btn-icon">casino</span> Sortear Próxima';
          lotMsg.innerHTML = `10 novos moradores sentam para debater as propostas.`;
        }
      }

      paintDraw();
    }, 350);
  });

  lotReset?.addEventListener("click", () => {
    pastParticipants.clear();
    currentTable = [];
    roundNumber = 0;
    lotBtn.innerHTML =
      '<span class="material-symbols-rounded btn-icon">casino</span> Sortear';
    lotBtn.disabled = false;
    lotBtn.classList.remove("spinning");
    if (drawPhaseTag) {
      drawPhaseTag.textContent = "Aguardando Início";
      drawPhaseTag.className = "draw-phase-badge";
    }
    if (drawTableState) drawTableState.textContent = "Cadeiras Livres";
    if (lotMsg) {
      lotMsg.innerHTML =
        "Clique para sortear as primeiras 10 pessoas e abrir a discussão.";
    }
    paintDraw();
  });
}
