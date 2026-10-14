// ==========================================================================
// SINTETIZANDO — JORNADA INTERATIVA (ORQUESTRAÇÃO GSAP & ESTADOS)
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Inicializa o ScrollToPlugin do GSAP
  if (window.gsap && window.ScrollToPlugin) {
    gsap.registerPlugin(ScrollToPlugin);
  }

  // Definição dos dados das 3 comunidades (Ultra simples, sem jargões)
  const communitiesData = {
    condo: {
      name: "Edifício das Flores",
      category: "Condomínio Residencial",
      icon: "apartment",
      members: 186,
      quorum: 75,
      cycleDays: 3,
      themeIcon: "garage_door",
      themeTitle: "Portão da Garagem",
      themeDesc: "Trocar o motor antigo e melhorar a segurança da entrada.",
      themeCount: "42 moradores já enviaram suas propostas",
      myProposal: "Motor Rápido + Luz Noturna",
      synthAdd: "Motor de 3 segundos com bateria de backup",
      synthMod: "Iluminação em LED integrada ao fechamento automático",
    },
    bairro: {
      name: "Vila Esperança",
      category: "Associação de Moradores",
      icon: "nature_people",
      members: 1420,
      quorum: 60,
      cycleDays: 5,
      themeIcon: "wb_incandescent",
      themeTitle: "Luz na Praça Central",
      themeDesc:
        "Iluminar os caminhos e bancos para uso noturno com segurança.",
      themeCount: "118 vizinhos já enviaram suas propostas",
      myProposal: "Postes Solares na Pista",
      synthAdd: "Instalação de 14 postes solares autônomos",
      synthMod: "Reforço de iluminação ao redor do parquinho infantil",
    },
    coop: {
      name: "Cooperativa Solar",
      category: "Cooperativa de Trabalho",
      icon: "handshake",
      members: 84,
      quorum: 80,
      cycleDays: 2,
      themeIcon: "precision_manufacturing",
      themeTitle: "Novo Equipamento",
      themeDesc:
        "Adquirir conjunto de ferramentas elétricas com sobra de caixa.",
      themeCount: "29 cooperados já enviaram suas propostas",
      myProposal: "Compra Conjunta com Desconto",
      synthAdd: "Aquisição de lote profissional com garantia estendida",
      synthMod: "Escala compartilhada de uso e manutenção preventiva",
    },
  };

  // Estado da Aplicação
  let currentCommunityKey = null;
  let currentSupport = 68;
  let iterationVersion = 1;
  let isFusionRunning = false;

  // Cenários da Etapa 4
  let currentScenario = 1; // 1: 1 doc no centro | 2: 2 docs lado a lado
  let scenario2Cycle = 1; // 1, 2, 3 (no 3º ciclo bate quórum e avança)

  // Elementos do DOM
  const identityCard = document.getElementById("identity-card");
  const commCards = document.querySelectorAll(".comm-card");
  const btnSubmitProposal = document.getElementById("btn-submit-proposal");
  const fusionArena = document.getElementById("fusion-arena");
  const fusionCore = document.getElementById("fusion-core");
  const fusionDayText = document.getElementById("fusion-day-text");
  const fusionStatusIcon = document.getElementById("fusion-status-icon");
  const fusionDocProcessing = document.getElementById("fusion-doc-processing");
  const fusionDocApproved = document.getElementById("fusion-doc-approved");
  const diffCard = document.getElementById("diff-card");
  const synthesisDocsContainer = document.getElementById("synthesis-docs-container");
  const supportCountText = document.getElementById("support-count-text");
  const supportTargetText = document.getElementById("support-target-text");
  const btnNewProposal = document.getElementById("btn-new-proposal");
  const btnSupportProposal = document.getElementById("btn-support-proposal");
  const btnLoopRestart = document.getElementById("btn-loop-restart");
  const btnRestartTop = document.getElementById("btn-restart-top");
  const btnToSecurity = document.getElementById("btn-to-security");
  const btnSecurityRestart = document.getElementById("btn-security-restart");
  const btnBackToConsensus = document.getElementById("btn-back-to-consensus");

  // Elementos Dinâmicos de Tema & Diff
  const themeCommTag = document.getElementById("theme-comm-tag");
  const themeCommName = document.getElementById("theme-comm-name");
  const themeIcon = document.getElementById("theme-icon");
  const themeTitle = document.getElementById("theme-title");
  const themeDesc = document.getElementById("theme-desc");
  const themeActivityCount = document.getElementById("theme-activity-count");
  const themeDeadlineText = document.getElementById("theme-deadline-text");
  const proposalDeadlineCard = document.getElementById(
    "proposal-deadline-card",
  );

  const diffVersionLbl = document.getElementById("diff-version-lbl");
  const quorumTargetVal = document.getElementById("quorum-target-val");
  const mineProposalBox = document.getElementById("mine-proposal-box");
  const diffAddText = document.getElementById("diff-add-text");
  const diffModText = document.getElementById("diff-mod-text");
  const meterNum = document.getElementById("meter-num");
  const meterBar = document.getElementById("meter-bar");
  const meterMarker = document.getElementById("meter-marker");

  const trackerDots = document.querySelectorAll(".tracker-dot");

  // Função utilitária para scroll suave
  function scrollToStep(stepId, dotIndex) {
    if (dotIndex !== undefined && dotIndex >= 0) {
      updateTracker(dotIndex);
    }

    if (stepId === "step-3") {
      startProposalCountdown();
    } else {
      stopProposalCountdown();
    }

    const target = document.getElementById(stepId);
    if (target) {
      if (stepId === "intro") {
        if (window.gsap && window.ScrollToPlugin) {
          gsap.to(window, {
            duration: 0.9,
            scrollTo: { y: 0 },
            ease: "power2.inOut",
          });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        if (window.gsap && window.ScrollToPlugin) {
          const header = document.querySelector(".app-header");
          const headerOffset = header ? header.offsetHeight : 56;
          gsap.to(window, {
            duration: 0.9,
            scrollTo: { y: target, offsetY: headerOffset },
            ease: "power2.inOut",
          });
        } else {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }
  }

  // Atualizar o rastreador de progresso do topo
  function updateTracker(index) {
    trackerDots.forEach((dot, idx) => {
      dot.classList.remove("active", "completed");
      if (idx < index) {
        dot.classList.add("completed");
      } else if (idx === index) {
        dot.classList.add("active");
      }
    });
  }

  // Permitir navegação direta ao clicar nos dots do rastreador
  trackerDots.forEach((dot, idx) => {
    dot.addEventListener("click", () => {
      const stepTarget = `step-${idx + 1}`;
      scrollToStep(stepTarget, idx);
    });
  });

  // ==========================================
  // INTRODUÇÃO: SETA SUTIL PARA ROLAGEM
  // ==========================================
  const scrollArrow = document.getElementById("scroll-arrow");
  if (scrollArrow) {
    scrollArrow.addEventListener("click", (e) => {
      e.preventDefault();
      scrollToStep("step-1", 0);
    });
  }

  // ==========================================
  // ETAPA 1: CLIQUE NA IDENTIDADE
  // ==========================================
  if (identityCard) {
    identityCard.addEventListener("click", () => {
      identityCard.classList.add("activated");
      const callText = identityCard.querySelector(
        ".id-call-to-action span:last-child",
      );
      if (callText) callText.textContent = "Identidade Ativada ✓";

      // Micro animação de escala
      if (window.gsap) {
        gsap.fromTo(
          identityCard,
          { scale: 0.98 },
          { scale: 1.02, duration: 0.25, yoyo: true, repeat: 1 },
        );
      }

      setTimeout(() => {
        scrollToStep("step-2", 1);
      }, 350);
    });

    // Acessibilidade por teclado (Enter ou Espaço)
    identityCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        identityCard.click();
      }
    });
  }

  // ==========================================
  // ETAPA 2: ESCOLHA DA COMUNIDADE
  // ==========================================
  commCards.forEach((card) => {
    card.addEventListener("click", () => {
      commCards.forEach((c) => {
        c.classList.remove("is-selected");
        c.setAttribute("aria-pressed", "false");
      });
      card.classList.add("is-selected");
      card.setAttribute("aria-pressed", "true");

      currentCommunityKey = card.getAttribute("data-community") || "condo";
      applyCommunityTheme(currentCommunityKey);

      setTimeout(() => {
        scrollToStep("step-3", 2);
      }, 300);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
  });

  // Atualizar dados do tema e quórum conforme a comunidade selecionada
  function applyCommunityTheme(key) {
    const data = communitiesData[key] || communitiesData.condo;

    // Atualiza Etapa 3
    if (themeCommName) themeCommName.textContent = data.name;
    if (themeCommTag) {
      const iconSpan = themeCommTag.querySelector(".material-symbols-rounded");
      if (iconSpan) iconSpan.textContent = data.icon;
    }
    if (themeIcon) themeIcon.textContent = data.themeIcon;
    if (themeTitle) themeTitle.textContent = data.themeTitle;
    if (themeDesc) themeDesc.textContent = data.themeDesc;
    if (themeActivityCount) themeActivityCount.textContent = data.themeCount;
    if (themeDeadlineText) {
      themeDeadlineText.textContent = formatDeadlineDate(data.cycleDays || 3);
    }

    // Atualiza Etapa 4
    if (quorumTargetVal) quorumTargetVal.textContent = `${data.quorum}%`;
    if (meterMarker) {
      meterMarker.style.left = `${data.quorum}%`;
      const flag = meterMarker.querySelector(".marker-flag");
      if (flag) flag.textContent = `Mínimo ${data.quorum}%`;
    }
    if (mineProposalBox) {
      mineProposalBox.innerHTML = `<div class="diff-badge-mine">${data.myProposal}</div>`;
    }
    if (diffAddText) diffAddText.textContent = data.synthAdd;
    if (diffModText) diffModText.textContent = data.synthMod;

    // Atualiza Etapa 5 (Rank de Propostas)
    const rankSupport1 = document.getElementById("rank-support-1");
    const rankSupport2 = document.getElementById("rank-support-2");
    const rankSupport3 = document.getElementById("rank-support-3");

    const rankStatsByCommunity = {
      condo: ["148 apoios (79%)", "26 apoios (14%)", "12 apoios (7%)"],
      bairro: ["1.120 apoios (79%)", "190 apoios (13%)", "110 apoios (8%)"],
      coop: ["72 apoios (85%)", "8 apoios (10%)", "4 apoios (5%)"],
    };

    const stats = rankStatsByCommunity[key] || rankStatsByCommunity.condo;
    if (rankSupport1) rankSupport1.textContent = stats[0];
    if (rankSupport2) rankSupport2.textContent = stats[1];
    if (rankSupport3) rankSupport3.textContent = stats[2];
  }

  // ==========================================
  // ETAPA 3: CONTAGEM REGRESSIVA DO PRAZO & ENVIO
  // ==========================================
  let proposalCountdownInterval = null;
  let remainingDays = 3;

  function formatDeadlineDate(days) {
    const dayWord = days === 1 ? "dia" : "dias";
    return `${days} ${dayWord}`;
  }

  function updateDeadlineDisplay(days) {
    if (!themeDeadlineText) return;
    if (days > 0) {
      themeDeadlineText.textContent = formatDeadlineDate(days);
    } else {
      themeDeadlineText.textContent = "Prazo encerrado! Concluindo envio...";
    }
  }

  function stopProposalCountdown() {
    if (proposalCountdownInterval) {
      clearInterval(proposalCountdownInterval);
      proposalCountdownInterval = null;
    }
  }

  function pulseDeadlineCard(isFinal = false) {
    if (!proposalDeadlineCard) return;

    if (window.gsap) {
      gsap.fromTo(
        proposalDeadlineCard,
        {
          scale: 1.05,
          borderColor: "#bd5123",
          boxShadow: "0 0 22px rgba(189, 81, 35, 0.45)",
          backgroundColor: "#fef1ea",
        },
        {
          scale: 1,
          borderColor: isFinal
            ? "rgba(189, 81, 35, 0.4)"
            : "rgba(189, 81, 35, 0.2)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
          backgroundColor: "var(--bg-card-subtle)",
          duration: 0.65,
          ease: "power2.out",
        },
      );
    }
  }

  function startProposalCountdown() {
    stopProposalCountdown();
    const data = communitiesData[currentCommunityKey] || communitiesData.condo;
    remainingDays = data.cycleDays || 3;
    updateDeadlineDisplay(remainingDays);

    proposalCountdownInterval = setInterval(() => {
      remainingDays--;

      if (remainingDays > 0) {
        updateDeadlineDisplay(remainingDays);
        pulseDeadlineCard(false);
      } else {
        updateDeadlineDisplay(0);
        pulseDeadlineCard(true);
        stopProposalCountdown();
        setTimeout(() => {
          advanceToStep4(false);
        }, 800);
      }
    }, 2000);
  }

  function advanceToStep4(isSubmitted = false) {
    stopProposalCountdown();
    if (isSubmitted) {
      currentScenario = 2;
      scenario2Cycle = 1;
    } else {
      currentScenario = 1;
      scenario2Cycle = 1;
    }
    scrollToStep("step-4", 3);
    runFusionAnimation();
  }

  if (btnSubmitProposal) {
    btnSubmitProposal.addEventListener("click", () => {
      advanceToStep4(true);
    });
  }

  // Animação de Fusão e Síntese (Visual Puro: Documentos Convergindo para o Sintetizador e Document-OK Maior)
  function runFusionAnimation() {
    if (isFusionRunning) return;
    isFusionRunning = true;

    // Garante que o arena está visível e o diff-card oculto inicialmente
    if (fusionArena) {
      fusionArena.style.display = "flex";
      fusionArena.style.opacity = 1;
    }
    if (diffCard) diffCard.style.display = "none";

    const nodes = document.querySelectorAll(".flying-doc-item, .flying-node");

    if (window.gsap) {
      // Timeline GSAP
      const tl = gsap.timeline();

      // Reset inicial das imagens
      gsap.set(nodes, { opacity: 1, scale: 1, x: 0, y: 0 });
      gsap.set(fusionCore, { scale: 1, opacity: 1 });
      if (fusionDocProcessing) {
        gsap.set(fusionDocProcessing, { opacity: 1, scale: 1 });
      }
      if (fusionDocApproved) {
        gsap.set(fusionDocApproved, { opacity: 0, scale: 0.5 });
      }

      // Sintetizador central pulsando com ritmo calmo e fluido enquanto os arquivos convergem
      const sintetizorPulse = gsap.to(fusionDocProcessing, {
        scale: 1.15,
        duration: 0.55,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });

      // Fase 1: Documentos flutuam e viajam com tempo estendido e orgânico em direção ao centro
      tl.to(
        ".node-1",
        {
          x: 140,
          y: 55,
          scale: 0.25,
          opacity: 0,
          duration: 2.8,
          ease: "power2.inOut",
        },
        1.4,
      );
      tl.to(
        ".node-2",
        {
          x: -140,
          y: 55,
          scale: 0.25,
          opacity: 0,
          duration: 2.8,
          ease: "power2.inOut",
        },
        1.7,
      );
      tl.to(
        ".node-3",
        {
          x: 120,
          y: -55,
          scale: 0.25,
          opacity: 0,
          duration: 2.7,
          ease: "power2.inOut",
        },
        2.0,
      );
      tl.to(
        ".node-4",
        {
          x: -120,
          y: -55,
          scale: 0.25,
          opacity: 0,
          duration: 2.7,
          ease: "power2.inOut",
        },
        2.3,
      );

      // Fase 2: Conclusão da absorção — o sintetizador absorve todos os arquivos e encerra o pulso
      tl.to(
        fusionDocProcessing,
        {
          opacity: 0,
          scale: 0.7,
          duration: 0.4,
          ease: "power2.in",
          onStart: () => {
            sintetizorPulse.kill();
          },
        },
        5.0,
      );

      // Fase 3: Document-OK surge MAIOR na tela, puro e destacado, sem textos
      tl.to(
        fusionDocApproved,
        {
          opacity: 1,
          scale: 1,
          duration: 0.8,
          ease: "back.out(1.8)",
        },
        5.3,
      );

      // Fase 4: Pausa contemplativa (documento grande em destaque) antes do resultado
      tl.to(fusionArena, {
        opacity: 0,
        duration: 0.5,
        delay: 0.8,
        onComplete: () => {
          fusionArena.style.display = "none";
          fusionArena.style.opacity = 1;
          renderSynthesisOutcome();
          diffCard.style.display = "flex";
          diffCard.style.opacity = 0;
          gsap.fromTo(
            diffCard,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" },
          );
          isFusionRunning = false;
        },
      });
    } else {
      // Fallback sem GSAP
      setTimeout(() => {
        if (fusionDocProcessing) fusionDocProcessing.style.opacity = "0";
        if (fusionDocApproved) {
          fusionDocApproved.style.opacity = "1";
          fusionDocApproved.style.transform = "translate(-50%, -50%) scale(1)";
        }
        setTimeout(() => {
          fusionArena.style.display = "none";
          renderSynthesisOutcome();
          diffCard.style.display = "flex";
          isFusionRunning = false;
        }, 1700);
      }, 4000);
    }
  }

  // ==========================================
  // ETAPA 4: RENDERIZAÇÃO DOS CENÁRIOS 1 E 2
  // ==========================================
  function renderSynthesisOutcome() {
    if (!synthesisDocsContainer) return;

    const data = communitiesData[currentCommunityKey] || communitiesData.condo;
    const targetQuorum = data.quorum || 75;
    const totalMembers =
      parseInt(
        (data.stats && data.stats[0] ? data.stats[0].val : "186").replace(
          /\D/g,
          "",
        ),
        10,
      ) || 186;

    if (currentScenario === 1) {
      // Cenário 1: Se a pessoa não clicou em enviar proposta, mostramos o document-ok ao centro
      synthesisDocsContainer.innerHTML = `
        <div class="synthesis-single-doc-wrap">
          <img
            src="assets/document-ok.png"
            alt="Documento Consensual Validado"
            class="synthesis-doc-img is-ok"
          />
        </div>
      `;

      const pct = Math.max(50, targetQuorum - 12);
      const count = Math.round((totalMembers * pct) / 100);

      if (supportCountText) {
        supportCountText.textContent = `${count} apoios (${pct}%)`;
        supportCountText.classList.remove("is-achieved");
      }
      if (supportTargetText) {
        supportTargetText.textContent = `Mínimo necessário: ${targetQuorum}%`;
      }
    } else {
      // Cenário 2: Aparecem os dois documentos lado a lado ("Anterior" e "Síntese")
      synthesisDocsContainer.innerHTML = `
        <div class="synthesis-double-docs-wrap">
          <div class="synthesis-doc-col">
            <img
              src="assets/document.png"
              alt="Documento Anterior"
              class="synthesis-doc-img"
            />
            <span class="synthesis-doc-label">Anterior</span>
          </div>
          <div class="synthesis-doc-col is-synth">
            <img
              src="assets/document-ok.png"
              alt="Documento Síntese"
              class="synthesis-doc-img is-ok"
            />
            <span class="synthesis-doc-label">Síntese</span>
          </div>
        </div>
      `;

      let pct = targetQuorum - 15;
      if (scenario2Cycle === 2) {
        pct = targetQuorum - 6;
      } else if (scenario2Cycle >= 3) {
        pct = targetQuorum + 8; // Bate o apoio mínimo!
      }

      const count = Math.round((totalMembers * pct) / 100);

      if (supportCountText) {
        supportCountText.textContent = `${count} apoios (${pct}%)`;
      }
      if (supportTargetText) {
        supportTargetText.textContent = `Mínimo necessário: ${targetQuorum}%`;
      }

      if (pct >= targetQuorum) {
        if (supportCountText) supportCountText.classList.add("is-achieved");
        // Atingiu o quórum mínimo no 3º ciclo -> avança automaticamente para o Step 5!
        setTimeout(() => {
          advanceToStep5(pct);
        }, 1600);
      } else {
        if (supportCountText) supportCountText.classList.remove("is-achieved");
      }
    }
  }

  // ==========================================
  // ETAPA 4: NOVA PROPOSTA (RESTART DA SÍNTESE -> CENÁRIO 2)
  // ==========================================
  if (btnNewProposal) {
    btnNewProposal.addEventListener("click", () => {
      if (isFusionRunning) return;
      currentScenario = 2;
      scenario2Cycle = Math.min(3, scenario2Cycle + 1);

      // Re-executa a animação de síntese que levará aos dois documentos lado a lado
      runFusionAnimation();
    });
  }

  // ==========================================
  // ETAPA 4: APOIAR (AVANÇO PARA CONSENSO)
  // ==========================================
  function advanceToStep5() {
    scrollToStep("step-5", 4);
  }

  if (btnSupportProposal) {
    btnSupportProposal.addEventListener("click", () => {
      advanceToStep5();
    });
  }

  // ==========================================
  // ETAPA 5 & TOPO: REINICIAR EXPERIÊNCIA
  // ==========================================
  function restartExperience(target = "intro") {
    stopProposalCountdown();
    const dotIdx = target === "intro" ? -1 : target === "step-2" ? 1 : 0;
    scrollToStep(target, dotIdx);
    setTimeout(() => {
      if (identityCard) {
        identityCard.classList.remove("activated");
        const callText = identityCard.querySelector(
          ".id-call-to-action span:last-child",
        );
        if (callText) callText.textContent = "Toque para entrar";
      }
      commCards.forEach((c) => {
        c.classList.remove("is-selected");
        c.setAttribute("aria-pressed", "false");
      });
      if (fusionArena) {
        fusionArena.style.display = "flex";
        fusionArena.style.opacity = 1;
      }
      if (diffCard) diffCard.style.display = "none";
      if (fusionDocProcessing) {
        fusionDocProcessing.style.opacity = "1";
        fusionDocProcessing.style.transform = "scale(1)";
      }
      if (fusionDocApproved) {
        fusionDocApproved.style.opacity = "0";
        fusionDocApproved.style.transform = "translate(-50%, -50%) scale(0.5)";
      }
      if (fusionStatusIcon) fusionStatusIcon.textContent = "auto_awesome";
      if (fusionDayText)
        fusionDayText.textContent = "Sintetizando propostas...";
      document
        .querySelectorAll(".flying-doc-item, .flying-node")
        .forEach((n) => {
          n.style.opacity = "1";
          n.style.transform = "none";
        });
      currentScenario = 1;
      scenario2Cycle = 1;
      currentSupport = 68;
      iterationVersion = 1;
    }, 600);
  }

  if (btnLoopRestart) {
    btnLoopRestart.addEventListener("click", () => restartExperience("step-2"));
  }

  if (btnRestartTop) {
    btnRestartTop.addEventListener("click", () => restartExperience("intro"));
  }

  // ==========================================
  // ETAPA 6: NAVEGAÇÃO & AÇÕES DE SEGURANÇA
  // ==========================================
  if (btnToSecurity) {
    btnToSecurity.addEventListener("click", () => {
      scrollToStep("step-6", 5);
    });
  }

  if (btnSecurityRestart) {
    btnSecurityRestart.addEventListener("click", () => {
      restartExperience("step-2");
    });
  }

  if (btnBackToConsensus) {
    btnBackToConsensus.addEventListener("click", () => {
      scrollToStep("step-5", 4);
    });
  }

  // Sincronização automática do rastreador durante rolagem livre (IntersectionObserver)
  const stageSections = document.querySelectorAll(".flow-stage");
  if ("IntersectionObserver" in window && stageSections.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            const match = id.match(/step-(\d+)/);
            if (match) {
              const stepNum = parseInt(match[1], 10);
              updateTracker(stepNum - 1);
            } else if (id === "intro") {
              updateTracker(-1);
            }
          }
        });
      },
      {
        rootMargin: "-25% 0px -40% 0px",
        threshold: 0.1,
      },
    );

    stageSections.forEach((sec) => observer.observe(sec));
  }

  // Inicializa o tema padrão (Condomínio)
  applyCommunityTheme("condo");
});
