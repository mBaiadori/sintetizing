/* ==========================================================================
 * SEÇÃO PROPOSTAS: GOOGLE FORMS, GIT DIFFS & CHAT COM IA
 * ========================================================================== */

// 1. Navegação por Abas
const propTabButtons = document.querySelectorAll(".prop-tab-btn");
const propPanels = document.querySelectorAll(".prop-panel");

function switchProposalTab(targetTab) {
  propTabButtons.forEach((btn) => {
    const isSelected = btn.getAttribute("data-tab") === targetTab;
    btn.classList.toggle("active", isSelected);
    btn.setAttribute("aria-selected", isSelected ? "true" : "false");
  });

  propPanels.forEach((panel) => {
    const isTarget = panel.id === `panel-${targetTab}`;
    panel.classList.toggle("active", isTarget);
  });
}

propTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetTab = btn.getAttribute("data-tab");
    switchProposalTab(targetTab);
  });
});

// 2. Templates do Painel 1 (Google Forms)
const templateButtons = document.querySelectorAll(".btn-template");
const formBadgeCategory = document.getElementById("form-badge-category");
const formPropTitle = document.getElementById("form-prop-title");
const formPropLead = document.getElementById("form-prop-lead");
const fieldProblema = document.getElementById("field-problema");
const fieldAcao = document.getElementById("field-acao");
const fieldRecursos = document.getElementById("field-recursos");
const fieldResponsaveis = document.getElementById("field-responsaveis");
const fieldSucesso = document.getElementById("field-sucesso");
const btnCopyForm = document.getElementById("btn-copy-form");

const formTemplatesData = {
  praca: {
    category: '<span class="material-symbols-rounded form-tag-icon">handyman</span> Tipo: Ação Prática com Prazo',
    title: "Instalação de Iluminação Solar Autônoma nos Canteiros da Praça",
    lead: "Proposta formulada pela Mesa 03 para resolver a escuridão noturna sem custos de eletricista.",
    problema: "A praça fica no escuro após as 19h. Moradores evitam circular com crianças e pets pelo risco de tropeços nos desníveis da calçada e sensação de insegurança.",
    acao: "Instalar 6 refletores com placas solares integradas e postes autônomos nos canteiros centrais da praça, sem precisar quebrar concreto nem passar tubulações elétricas.",
    recursos: '<span class="money-badge">R$ 1.200 no total</span> (compra de 6 refletores solares com nota fiscal). Zero impacto na conta de luz mensal e zero necessidade de quebra de piso.',
    responsaveis: "Mariana (Bloco B) e Seu Jorge (Casa 14) realizam a cotação e compra; mutirão de fixação voluntária agendado para o sábado 18/11 às 9h da manhã.",
    sucesso: "Área de convivência 100% iluminada até às 23h, retorno de passeios familiares noturnos e zero relatos de quedas ou incidentes na calçada."
  },
  silencio: {
    category: '<span class="material-symbols-rounded form-tag-icon">gavel</span> Tipo: Regra de Convivência Duradoura',
    title: "Regulamento de Sons e Convivência Harmoniosa nas Áreas Comuns",
    lead: "Norma consensual para equilibrar eventos sociais e o descanso dos moradores que trabalham cedo.",
    problema: "Conflitos frequentes nos fins de semana devido a caixas de som de alta potência tocando após a meia-noite ao lado dos quartos térreos.",
    acao: "Estabelecer limite sonoro máximo de 60dB até as 22h nos dias úteis e 23h às sextas e sábados, além de proibir uso de caixas de som de terceiros sem isolamento.",
    recursos: '<span class="money-badge">R$ 350</span> para aquisição de 1 decibelímetro digital padrão mantido na portaria para medição neutra e transparente.',
    responsaveis: "Comissão de moradores sorteada e portaria orientada a aplicar aviso cordial prévio antes de qualquer notificação formal.",
    sucesso: "Zero chamados de atrito entre vizinhos em 60 dias e aprovação de 100% dos usuários do salão nos testes de eventos."
  },
  boato: {
    category: '<span class="material-symbols-rounded form-tag-icon">fact_check</span> Tipo: Checagem de Fato & Evidência',
    title: "Apuração Coletiva sobre Boato de 'Taxa Extra de R$ 500 para Pintura'",
    lead: "Investigação documental transparente para esclarecer mensagem viral que gerou pânico no grupo de WhatsApp.",
    problema: "Circulou mensagem de áudio afirmando que a administração cobraria taxa surpresa de R$ 500 de cada família no próximo mês para obras não aprovadas.",
    acao: "Mesa de 10 vizinhos solicitou e analisou os extratos bancários, atas e contratos oficiais dos últimos 6 meses com o conselho fiscal.",
    recursos: '<span class="money-badge">Custo Zero (R$ 0)</span>. Apenas conferência colaborativa de 3 orçamentos e livros de contabilidade abertos.',
    responsaveis: "Três moradores voluntários (contadora Ana, engenheiro Marcos e Seu Wilson) conferiram as notas fiscais e publicaram o parecer com links.",
    sucesso: "Comprovado boato falso: o saldo em caixa cobria 100% da manutenção preventiva sem necessidade de nenhum rateio extra."
  }
};

templateButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const templateKey = btn.getAttribute("data-template");
    const data = formTemplatesData[templateKey];
    if (!data) return;

    templateButtons.forEach((b) => {
      const isCur = b === btn;
      b.classList.toggle("active", isCur);
      b.setAttribute("aria-pressed", isCur ? "true" : "false");
    });

    if (formBadgeCategory) formBadgeCategory.innerHTML = data.category;
    if (formPropTitle) formPropTitle.textContent = data.title;
    if (formPropLead) formPropLead.textContent = data.lead;
    if (fieldProblema) fieldProblema.innerHTML = data.problema;
    if (fieldAcao) fieldAcao.innerHTML = data.acao;
    if (fieldRecursos) fieldRecursos.innerHTML = data.recursos;
    if (fieldResponsaveis) fieldResponsaveis.innerHTML = data.responsaveis;
    if (fieldSucesso) fieldSucesso.innerHTML = data.sucesso;
  });
});

btnCopyForm?.addEventListener("click", () => {
  const textToCopy = `PROPOSTA CÍVICA: ${formPropTitle?.textContent}\n\n1. Problema: ${fieldProblema?.textContent?.trim()}\n2. Ação: ${fieldAcao?.textContent?.trim()}\n3. Recursos: ${fieldRecursos?.textContent?.trim()}\n4. Responsáveis: ${fieldResponsaveis?.textContent?.trim()}\n5. Sucesso: ${fieldSucesso?.textContent?.trim()}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      const origHtml = btnCopyForm.innerHTML;
      btnCopyForm.innerHTML = '<span class="material-symbols-rounded btn-icon-sm">check</span> Estrutura Copiada!';
      btnCopyForm.style.borderColor = "var(--civic-forest)";
      btnCopyForm.style.color = "var(--civic-forest)";
      setTimeout(() => {
        btnCopyForm.innerHTML = origHtml;
        btnCopyForm.style.borderColor = "";
        btnCopyForm.style.color = "";
      }, 2000);
    });
  }
});

// 3. Comparador Visual de Diff (Painel 2)
const scenarioButtons = document.querySelectorAll(".btn-scenario");
const btnModeDiff = document.getElementById("btn-mode-diff");
const btnModeConsolidated = document.getElementById("btn-mode-consolidated");
const diffViewerContainer = document.getElementById("diff-viewer-container");
const diffBranchOrigName = document.getElementById("diff-branch-orig-name");
const diffBranchSyntName = document.getElementById("diff-branch-synt-name");
const diffConsensusText = document.getElementById("diff-consensus-text");
const statCountAdd = document.getElementById("stat-count-add");
const statCountRem = document.getElementById("stat-count-rem");
const statCountEq = document.getElementById("stat-count-eq");
const statHighlightText = document.getElementById("stat-highlight-text");
const diffRowsList = document.getElementById("diff-rows-list");

const diffScenariosData = {
  praca: {
    orig: "Proposta #04 (Mariana)",
    synt: "Síntese #04-B (Mesa 03)",
    consensus: "Aprovado por 9 de 10 vizinhos da mesa",
    add: "+ 2 Adições",
    rem: "- 1 Corte",
    eq: "= 3 Mantidos",
    highlight: "Economia de R$ 2.300",
    rowsHtml: `
      <div class="diff-row diff-row-equal">
        <div class="diff-row-gutter"><span class="diff-tag-badge tag-eq">[ = ]</span></div>
        <div class="diff-row-main">
          <div class="diff-field-name">Ação Prática</div>
          <div class="diff-field-content">Instalação de postes de iluminação para clarear os canteiros e calçadas centrais da praça comunitária.</div>
        </div>
      </div>
      <div class="diff-row diff-row-removed">
        <div class="diff-row-gutter"><span class="diff-tag-badge tag-rem">[ - ]</span></div>
        <div class="diff-row-main">
          <div class="diff-field-name">Orçamento Original de Obra Pesada</div>
          <div class="diff-field-content strike-through">R$ 3.500 para quebra de piso de concreto, cabeamento subterrâneo e ligação com o relógio geral do condomínio.</div>
          <div class="diff-note-explain note-rem">
            <span class="material-symbols-rounded note-icon">delete_forever</span>
            Corte solicitado pelo Seu Jorge e apoiado pela mesa: evitar quebrar calçadas e poupar R$ 2.300 do caixa.
          </div>
        </div>
      </div>
      <div class="diff-row diff-row-added">
        <div class="diff-row-gutter"><span class="diff-tag-badge tag-add">[ + ]</span></div>
        <div class="diff-row-main">
          <div class="diff-field-name">Novo Orçamento Sustentável (Adicionado pela Mesa)</div>
          <div class="diff-field-content add-text">R$ 1.200 para compra de 6 refletores com placas solares autônomas. Instalação rápida em terra/canteiro, sem quebra de piso e zero despesa mensal de luz.</div>
          <div class="diff-note-explain note-add">
            <span class="material-symbols-rounded note-icon">check_circle</span>
            Aprovado por unanimidade: solução ecológica, rápida e muito mais barata.
          </div>
        </div>
      </div>
      <div class="diff-row diff-row-added">
        <div class="diff-row-gutter"><span class="diff-tag-badge tag-add">[ + ]</span></div>
        <div class="diff-row-main">
          <div class="diff-field-name">Cláusula de Proteção ao Sono (Emenda da Mesa)</div>
          <div class="diff-field-content add-text">Sensor automático com timer programado para reduzir a luminosidade para 20% após as 23h, garantindo que o facho de luz não incida nas janelas dos apartamentos térreos.</div>
          <div class="diff-note-explain note-add">
            <span class="material-symbols-rounded note-icon">bedtime</span>
            Incluído para atender à solicitação da Dra. Lúcia (vizinha do bloco térreo).
          </div>
        </div>
      </div>
      <div class="diff-row diff-row-equal">
        <div class="diff-row-gutter"><span class="diff-tag-badge tag-eq">[ = ]</span></div>
        <div class="diff-row-main">
          <div class="diff-field-name">Responsáveis & Execução</div>
          <div class="diff-field-content">Mariana e Seu Jorge coordenam a compra online com nota fiscal e o mutirão voluntário no sábado 18/11.</div>
        </div>
      </div>
    `
  },
  salao: {
    orig: "Proposta #11 (Carlos)",
    synt: "Síntese #11-B (Mesa 02)",
    consensus: "Aprovado por 10 de 10 vizinhos (Unanimidade)",
    add: "+ 2 Adições",
    rem: "- 1 Corte",
    eq: "= 2 Mantidos",
    highlight: "Isenção de taxa para mutirões",
    rowsHtml: `
      <div class="diff-row diff-row-equal">
        <div class="diff-row-gutter"><span class="diff-tag-badge tag-eq">[ = ]</span></div>
        <div class="diff-row-main">
          <div class="diff-field-name">Horário Limite para Fins de Semana</div>
          <div class="diff-field-content">Encerramento de eventos no salão de festas às 23h nas sextas e sábados com tolerância de 30 minutos para desmonte.</div>
        </div>
      </div>
      <div class="diff-row diff-row-removed">
        <div class="diff-row-gutter"><span class="diff-tag-badge tag-rem">[ - ]</span></div>
        <div class="diff-row-main">
          <div class="diff-field-name">Taxa Fixa Obrigatória de R$ 150 para Limpeza Externa</div>
          <div class="diff-field-content strike-through">Cobrança automática de R$ 150 para contratação de diarista terceirizada mesmo para encontros rápidos.</div>
          <div class="diff-note-explain note-rem">
            <span class="material-symbols-rounded note-icon">delete_forever</span>
            Removido pela mesa: penalizava reuniões simples de estudo e cafés de vizinhos.
          </div>
        </div>
      </div>
      <div class="diff-row diff-row-added">
        <div class="diff-row-gutter"><span class="diff-tag-badge tag-add">[ + ]</span></div>
        <div class="diff-row-main">
          <div class="diff-field-name">Opção de Limpeza Autônoma com Check-list (Adicionado)</div>
          <div class="diff-field-content add-text">Morador pode optar por entregar o espaço limpo conforme check-list fotográfico no aplicativo, ficando 100% isento da taxa de R$ 150.</div>
          <div class="diff-note-explain note-add">
            <span class="material-symbols-rounded note-icon">check_circle</span>
            Emenda acolhida: estimula cuidado com o espaço comum e reduz custo para famílias.
          </div>
        </div>
      </div>
      <div class="diff-row diff-row-added">
        <div class="diff-row-gutter"><span class="diff-tag-badge tag-add">[ + ]</span></div>
        <div class="diff-row-main">
          <div class="diff-field-name">Isenção Total para Encontros Culturais e Comunitários</div>
          <div class="diff-field-content add-text">Círculos de leitura de crianças, oficinas de horta e reuniões da própria mesa de 10 têm gratuidade integral e reserva prioritária.</div>
          <div class="diff-note-explain note-add">
            <span class="material-symbols-rounded note-icon">menu_book</span>
            Apoiado pela unanimidade da comunidade.
          </div>
        </div>
      </div>
      <div class="diff-row diff-row-equal">
        <div class="diff-row-gutter"><span class="diff-tag-badge tag-eq">[ = ]</span></div>
        <div class="diff-row-main">
          <div class="diff-field-name">Vistoria e Devolução de Chaves</div>
          <div class="diff-field-content">Conferência dos itens básicos do inventário pela zeladoria até as 10h da manhã seguinte.</div>
        </div>
      </div>
    `
  }
};

scenarioButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const scenKey = btn.getAttribute("data-scenario");
    const data = diffScenariosData[scenKey];
    if (!data) return;

    scenarioButtons.forEach((b) => {
      const isCur = b === btn;
      b.classList.toggle("active", isCur);
      b.setAttribute("aria-pressed", isCur ? "true" : "false");
    });

    if (diffBranchOrigName) diffBranchOrigName.textContent = data.orig;
    if (diffBranchSyntName) diffBranchSyntName.textContent = data.synt;
    if (diffConsensusText) diffConsensusText.textContent = data.consensus;
    if (statCountAdd) statCountAdd.textContent = data.add;
    if (statCountRem) statCountRem.textContent = data.rem;
    if (statCountEq) statCountEq.textContent = data.eq;
    if (statHighlightText) statHighlightText.textContent = data.highlight;
    if (diffRowsList) diffRowsList.innerHTML = data.rowsHtml;
  });
});

btnModeDiff?.addEventListener("click", () => {
  btnModeDiff.classList.add("active");
  btnModeDiff.setAttribute("aria-pressed", "true");
  btnModeConsolidated?.classList.remove("active");
  btnModeConsolidated?.setAttribute("aria-pressed", "false");
  diffViewerContainer?.classList.remove("diff-consolidated");
});

btnModeConsolidated?.addEventListener("click", () => {
  btnModeConsolidated.classList.add("active");
  btnModeConsolidated.setAttribute("aria-pressed", "true");
  btnModeDiff?.classList.remove("active");
  btnModeDiff?.setAttribute("aria-pressed", "false");
  diffViewerContainer?.classList.add("diff-consolidated");
});

// 4. Chat com Assistente de IA (Painel 3)
const chatMessagesContainer = document.getElementById("chat-messages-container");
const chatMsgRows = document.querySelectorAll(".chat-msg-row");
const btnChatStep = document.getElementById("btn-chat-step");
const btnChatReset = document.getElementById("btn-chat-reset");
const btnViewGeneratedForm = document.getElementById("btn-view-generated-form");

let currentChatVisibleCount = 3;

function updateChatVisibility() {
  chatMsgRows.forEach((row) => {
    const step = parseInt(row.getAttribute("data-step"), 10);
    if (step <= currentChatVisibleCount) {
      row.style.display = "flex";
    } else {
      row.style.display = "none";
    }
  });

  if (chatMessagesContainer) {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  if (btnChatStep) {
    if (currentChatVisibleCount >= chatMsgRows.length) {
      btnChatStep.innerHTML = '<span class="material-symbols-rounded btn-icon-sm">check_circle</span> Diálogo Concluído';
      btnChatStep.disabled = true;
    } else {
      btnChatStep.innerHTML = '<span class="material-symbols-rounded btn-icon-sm">play_arrow</span> Avançar Próxima Mensagem';
      btnChatStep.disabled = false;
    }
  }
}

updateChatVisibility();

btnChatStep?.addEventListener("click", () => {
  if (currentChatVisibleCount < chatMsgRows.length) {
    currentChatVisibleCount++;
    updateChatVisibility();
  }
});

btnChatReset?.addEventListener("click", () => {
  currentChatVisibleCount = 2;
  updateChatVisibility();
});

btnViewGeneratedForm?.addEventListener("click", () => {
  switchProposalTab("form");
  const formsSec = document.getElementById("propostas");
  if (formsSec) {
    formsSec.scrollIntoView({ behavior: "smooth" });
  }
});
