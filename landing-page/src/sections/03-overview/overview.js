/**
 * SINTETIZANDO — OVERVIEW / TRILHA DA APLICAÇÃO
 * Gerencia a navegação entre etapas, atualização visual do stepper e linha conectora.
 */

(function () {
  function initOverviewStepper() {
    const section = document.getElementById("overview");
    if (!section) return;

    const stepButtons = section.querySelectorAll(".stepper-step-item");
    const panels = section.querySelectorAll(".overview-panel");
    const counter = document.getElementById("overview-counter");
    const progressFill = document.getElementById("stepper-progress-fill");
    const totalSteps = stepButtons.length;

    let currentStep = 1;

    function goToStep(stepIndex) {
      if (stepIndex < 1 || stepIndex > totalSteps) return;
      currentStep = stepIndex;

      // 1. Atualiza botões da trilha (active / completed)
      stepButtons.forEach((btn) => {
        const step = parseInt(btn.getAttribute("data-step"), 10);
        btn.classList.remove("active", "completed");
        btn.setAttribute("aria-selected", "false");

        if (step === currentStep) {
          btn.classList.add("active");
          btn.setAttribute("aria-selected", "true");
        } else if (step < currentStep) {
          btn.classList.add("completed");
        }
      });

      // 2. Atualiza painéis de exibição
      panels.forEach((panel) => {
        const panelStep = parseInt(panel.getAttribute("data-panel"), 10);
        if (panelStep === currentStep) {
          panel.classList.add("active");
          panel.removeAttribute("hidden");
        } else {
          panel.classList.remove("active");
          panel.setAttribute("hidden", "true");
        }
      });

      // 3. Atualiza pontos (dots) em todos os painéis
      const allDots = section.querySelectorAll(".step-dot");
      allDots.forEach((dot) => {
        const dotGoto = parseInt(dot.getAttribute("data-goto"), 10);
        if (dotGoto === currentStep) {
          dot.classList.add("active");
        } else {
          dot.classList.remove("active");
        }
      });

      // 4. Atualiza Contador textual
      if (counter) {
        counter.textContent = `Etapa ${currentStep} de ${totalSteps}`;
      }

      // 5. Atualiza preenchimento da linha conectora (Vertical no Desktop, Horizontal no Mobile)
      if (progressFill) {
        const percentage = totalSteps > 1 ? ((currentStep - 1) / (totalSteps - 1)) * 100 : 0;
        const isMobile = window.innerWidth <= 980;

        if (isMobile) {
          progressFill.style.height = "100%";
          progressFill.style.width = `${percentage}%`;
        } else {
          progressFill.style.width = "100%";
          progressFill.style.height = `${percentage}%`;
        }
      }
    }

    // Eventos de clique nos botões da trilha (coluna esquerda)
    stepButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetStep = parseInt(btn.getAttribute("data-step"), 10);
        goToStep(targetStep);
      });
    });

    // Eventos nos botões Anterior / Próximo dentro dos painéis
    section.querySelectorAll(".btn-step-nav").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const action = btn.getAttribute("data-nav");
        if (action === "next") {
          goToStep(currentStep + 1);
        } else if (action === "prev") {
          goToStep(currentStep - 1);
        }
      });
    });

    // Eventos nos dots de navegação direta
    section.querySelectorAll(".step-dot").forEach((dot) => {
      dot.addEventListener("click", () => {
        const targetStep = parseInt(dot.getAttribute("data-goto"), 10);
        goToStep(targetStep);
      });
    });

    // Suporte ao redimensionamento de janela para recalcular progresso
    window.addEventListener("resize", () => {
      goToStep(currentStep);
    });

    // Inicializa na etapa 1
    goToStep(1);
  }

  // Executa quando carregado ou assim que o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOverviewStepper);
  } else {
    initOverviewStepper();
  }
})();
