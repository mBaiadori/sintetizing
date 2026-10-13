// Lógica interativa para o Demonstrador de Síntese & Diffs (v2)
document.addEventListener("DOMContentLoaded", function () {
  initSinteseDemo();
});

function initSinteseDemo() {
  const btnSynthesize = document.getElementById("btn-synthesize");
  const btnDiffToggle = document.getElementById("btn-diff-toggle");
  const btnSupport = document.getElementById("btn-support");
  const outputContainer = document.getElementById("synthesis-output");
  const supportCounter = document.getElementById("support-counter");
  const statusBadge = document.getElementById("synthesis-status");

  let isSynthesized = false;
  let showDiffOnly = false;
  let hasSupported = false;
  let supportCount = 342;

  if (btnSynthesize) {
    btnSynthesize.addEventListener("click", function () {
      if (isSynthesized) {
        // Reset
        isSynthesized = false;
        outputContainer.innerHTML = `
          <div style="text-align: center; padding: 48px 16px; color: var(--v2-text-soft);">
            <span class="material-symbols-rounded" style="font-size: 36px; margin-bottom: 8px; display: block; opacity: 0.5;">magic_button</span>
            <p>Clique em <strong>"Sintetizar com IA"</strong> para unificar as propostas dos moradores em uma versão consolidada.</p>
          </div>
        `;
        statusBadge.textContent = "Aguardando Síntese";
        statusBadge.style.background = "var(--v2-surface-alt)";
        statusBadge.style.color = "var(--v2-text-muted)";
        btnSynthesize.innerHTML = `<span class="material-symbols-rounded">auto_awesome</span> Sintetizar com IA`;
        if (btnDiffToggle) btnDiffToggle.style.display = "none";
        return;
      }

      // Animando o estado de síntese
      btnSynthesize.innerHTML = `<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span> Sintetizando 3 propostas...`;
      btnSynthesize.disabled = true;

      setTimeout(() => {
        isSynthesized = true;
        btnSynthesize.disabled = false;
        btnSynthesize.innerHTML = `<span class="material-symbols-rounded">restart_alt</span> Reiniciar Demonstração`;
        statusBadge.textContent = "Versão v1.0 Gerada";
        statusBadge.style.background = "var(--v2-forest-light)";
        statusBadge.style.color = "var(--v2-forest)";
        if (btnDiffToggle) btnDiffToggle.style.display = "inline-flex";

        renderSynthesisContent(showDiffOnly);
      }, 700);
    });
  }

  if (btnDiffToggle) {
    btnDiffToggle.addEventListener("click", function () {
      showDiffOnly = !showDiffOnly;
      btnDiffToggle.textContent = showDiffOnly ? "Ver Texto Completo" : "Destacar Apenas Diffs";
      renderSynthesisContent(showDiffOnly);
    });
  }

  if (btnSupport) {
    btnSupport.addEventListener("click", function () {
      if (!isSynthesized) {
        alert("Por favor, clique em 'Sintetizar com IA' primeiro para gerar a proposta!");
        return;
      }

      if (!hasSupported) {
        hasSupported = true;
        supportCount++;
        supportCounter.textContent = `${supportCount} apoios confirmados (94% da comunidade)`;
        btnSupport.classList.add("supported");
        btnSupport.innerHTML = `<span class="material-symbols-rounded">check_circle</span> Apoio Registrado com Sucesso`;
        btnSupport.style.background = "var(--v2-forest-light)";
        btnSupport.style.color = "var(--v2-forest)";
        btnSupport.style.borderColor = "var(--v2-forest-border)";
      } else {
        hasSupported = false;
        supportCount--;
        supportCounter.textContent = `${supportCount} apoios confirmados (93% da comunidade)`;
        btnSupport.innerHTML = `<span class="material-symbols-rounded">thumb_up</span> Apoiar esta Versão`;
        btnSupport.style.background = "var(--v2-forest)";
        btnSupport.style.color = "#ffffff";
        btnSupport.style.borderColor = "transparent";
      }
    });
  }

  function renderSynthesisContent(diffOnly) {
    if (!outputContainer) return;

    outputContainer.innerHTML = `
      <div class="v2-diff-view">
        <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 12px; color: var(--v2-text);">
          Proposta Unificada: Plano de Modernização da Iluminação e Convivência
        </div>
        
        <span class="v2-diff-line is-added">
          <strong>+ Adicionado [Consenso de 3 Moradores]:</strong> Substituição imediata de todos os postes antigos por luminárias LED de alta eficiência energética.
        </span>

        <span class="v2-diff-line is-modified">
          <strong>~ Ajustado via Diff [Sugestão da Dona Vera]:</strong> Em vez de extinguir a vigilância física, manter a escala noturna e integrá-la a 4 novas câmeras solares conectadas.
        </span>

        <span class="v2-diff-line is-added">
          <strong>+ Adicionado [Economia Compartilhada]:</strong> Uso da economia mensal da conta de luz (estimada em R$ 850/mês) para financiar o novo playground infantil.
        </span>

        ${
          !diffOnly
            ? `
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--v2-border); font-size: 0.8125rem; color: var(--v2-text-soft);">
            * Todas as 3 propostas originais foram preservadas e continuam vinculadas às assinaturas criptográficas de seus autores.
          </div>
        `
            : ""
        }
      </div>
    `;
  }
}
