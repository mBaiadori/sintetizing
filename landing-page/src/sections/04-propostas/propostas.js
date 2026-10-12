/* ==========================================================================
 * SEÇÃO PROPOSTAS: EDITOR ESTRUTURADO, COMPARADOR DIFF & CHAT IA
 * ========================================================================== */

// 1. Navegação por Abas Principais
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

// 2. PAINEL 1: Proposta Estruturada (Exemplos Limpos e Modo Criar)
const templateButtons = document.querySelectorAll(".btn-template");
const builderBlocksBar = document.getElementById("builder-blocks-bar");
const structuredDocBody = document.getElementById("structured-doc-body");
const btnClearBuilder = document.getElementById("btn-clear-builder");
const addBlockButtons = document.querySelectorAll(".btn-add-block");

// Dados dos 3 Exemplos de Documentos Formatados e Limpos
const cleanExamplesData = {
  exemplo1: {
    title: "Instalação de Iluminação Solar Autônoma nos Canteiros",
    category: "Ação Prática com Prazo",
    categoryIcon: "handyman",
    html: `
      <div class="clean-doc-container">
        <div class="clean-doc-header">
          <span class="clean-doc-badge">
            <span class="material-symbols-rounded">handyman</span> Ação Prática com Prazo
          </span>
          <h2 class="clean-doc-title">Instalação de Iluminação Solar Autônoma nos Canteiros</h2>
          <p class="clean-doc-lead">Proposta formulada pela Mesa 03 para resolver a escuridão noturna na praça sem gerar custos de fiação nem obras no piso.</p>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Diagnóstico & Problema</h4>
          <p class="clean-section-text">A praça fica no escuro após as 19h. Moradores evitam circular com crianças e pets pelo risco de tropeços nos desníveis da calçada e sensação de insegurança.</p>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Orçamento Estimado</h4>
          <div class="clean-val-card">
            <span class="clean-money-tag">
              <span class="material-symbols-rounded">payments</span> R$ 1.200,00
            </span>
            <span class="clean-val-desc">Compra de 6 refletores com placas solares integradas e nota fiscal. Zero impacto na conta de luz.</span>
          </div>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Prazo & Mutirão</h4>
          <div class="clean-val-card">
            <span class="clean-date-tag">
              <span class="material-symbols-rounded">event</span> 18/11/2026 às 09:00
            </span>
            <span class="clean-val-desc">Fixação voluntária em estacas de terra nos canteiros, sem quebra de piso de concreto.</span>
          </div>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Responsáveis & Execução</h4>
          <ul class="clean-doc-bullets">
            <li>Mariana (Bloco B) e Seu Jorge (Casa 14) efetuam a cotação e compra dos refletores solares.</li>
            <li>Mutirão comunitário no sábado para posicionamento dos postes nos 6 canteiros estratégicos.</li>
            <li>Critério de sucesso: 100% dos canteiros iluminados até 23h e fim dos relatos de quedas.</li>
          </ul>
        </div>
      </div>
    `
  },
  exemplo2: {
    title: "Regulamento de Sons e Convivência Harmoniosa no Condomínio",
    category: "Regra de Convivência Duradoura",
    categoryIcon: "gavel",
    html: `
      <div class="clean-doc-container">
        <div class="clean-doc-header">
          <span class="clean-doc-badge">
            <span class="material-symbols-rounded">gavel</span> Regra de Convivência Duradoura
          </span>
          <h2 class="clean-doc-title">Regulamento de Sons e Convivência Harmoniosa</h2>
          <p class="clean-doc-lead">Norma consensual para equilibrar celebrações no salão e o descanso dos moradores que trabalham cedo.</p>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Objetivo Comunitário</h4>
          <p class="clean-section-text">Garantir o direito ao convívio alegre nas áreas de lazer compartilhadas sem comprometer a saúde e o sono de famílias e profissionais dos blocos vizinhos.</p>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Limite Sonoro Máximo</h4>
          <div class="clean-val-card">
            <span class="clean-range-tag">
              <span class="material-symbols-rounded">volume_down</span> Limite de 60 dB
            </span>
            <span class="clean-val-desc">Até 22h nos dias úteis e 23h às sextas e sábados, medido a 5 metros da fonte sonora.</span>
          </div>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Início de Vigência</h4>
          <div class="clean-val-card">
            <span class="clean-date-tag">
              <span class="material-symbols-rounded">verified_user</span> 01/12/2026
            </span>
            <span class="clean-val-desc">Após homologação do consenso na assembleia ordinária.</span>
          </div>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Diretrizes de Aplicação</h4>
          <ul class="clean-doc-bullets">
            <li>Proibição expressa de caixas de som amplificadas voltadas para as janelas de dormitórios térreos.</li>
            <li>Decibelímetro oficial digital mantido na portaria para verificação neutra e transparente quando solicitado.</li>
            <li>Aviso cordial obrigatório de 15 minutos pela zeladoria antes de qualquer registro ou notificação.</li>
          </ul>
        </div>
      </div>
    `
  },
  exemplo3: {
    title: "Cotação Transparente para Revitalização da Quadra",
    category: "Orçamento & Compras Coletivas",
    categoryIcon: "table_chart",
    html: `
      <div class="clean-doc-container">
        <div class="clean-doc-header">
          <span class="clean-doc-badge">
            <span class="material-symbols-rounded">table_chart</span> Orçamento & Compras Coletivas
          </span>
          <h2 class="clean-doc-title">Aquisição de Redes de Proteção e Demarcação da Quadra</h2>
          <p class="clean-doc-lead">Planilha detalhada de materiais, fornecedores e comparativo de preços homologado pela comissão.</p>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Planilha de Itens & Custos</h4>
          <div class="clean-table-card">
            <table class="clean-doc-table">
              <thead>
                <tr>
                  <th>Item / Especificação</th>
                  <th>Quantidade</th>
                  <th>Fornecedor</th>
                  <th>Valor Unitário</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Rede de Polietileno 4mm</td>
                  <td>2 unidades</td>
                  <td>Redes Brasil Ltda</td>
                  <td>R$ 180,00</td>
                  <td>R$ 360,00</td>
                </tr>
                <tr>
                  <td>Tinta Epóxi Demarcação</td>
                  <td>4 latas</td>
                  <td>Tintas & Cia</td>
                  <td>R$ 115,00</td>
                  <td>R$ 460,00</td>
                </tr>
                <tr>
                  <td>Kit de Fixação e Fitas</td>
                  <td>1 kit</td>
                  <td>Ferragens Central</td>
                  <td>R$ 80,00</td>
                  <td>R$ 80,00</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4"><strong>Valor Consolidado</strong></td>
                  <td><strong class="clean-table-total">R$ 900,00</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Fundo de Reserva</h4>
          <div class="clean-val-card">
            <span class="clean-money-tag">
              <span class="material-symbols-rounded">savings</span> R$ 100,00
            </span>
            <span class="clean-val-desc">Margem para parafusos e pequenos ajustes na instalação.</span>
          </div>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Regras de Liberação</h4>
          <ul class="clean-doc-bullets">
            <li>Exigência de 3 orçamentos comparativos anexados com CNPJ ativo.</li>
            <li>Pagamento liberado somente após conferência física da comissão.</li>
          </ul>
        </div>
      </div>
    `
  },
  exemplo4: {
    title: "Dossiê: O Desaparecimento do Bolo de Cenoura na Copa da Firma",
    category: "Investigação & Bastidores",
    categoryIcon: "search_insights",
    html: `
      <div class="clean-doc-container">
        <div class="clean-doc-header">
          <span class="clean-doc-badge">
            <span class="material-symbols-rounded">search_insights</span> Investigação & Bastidores
          </span>
          <h2 class="clean-doc-title">Dossiê: O Desaparecimento Misterioso do Bolo na Copa</h2>
          <p class="clean-doc-lead">Proposta colaborativa e apartidária para apurar o sumiço do último pedaço com cobertura crocante de chocolate ocorrido na tarde de ontem.</p>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">O Fato em Apuração</h4>
          <p class="clean-section-text">Às 15h30 foi avistado um tupperware de vidro com 3 fatias generosas trazidas pela Dona Neide. Às 15h47 restavam apenas migalhas, um prato abandonado na pia e uma testemunha ocular constrangida.</p>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Horário Estimado do Incidente</h4>
          <div class="clean-val-card">
            <span class="clean-date-tag">
              <span class="material-symbols-rounded">schedule</span> Ontem entre 15h35 e 15h45
            </span>
            <span class="clean-val-desc">Janela crítica de 10 minutos entre a saída da equipe de Vendas e o cafezinho do suporte técnico.</span>
          </div>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Prejuízo Moral & Financeiro</h4>
          <div class="clean-val-card">
            <span class="clean-money-tag">
              <span class="material-symbols-rounded">sentiment_very_dissatisfied</span> R$ 42,00
            </span>
            <span class="clean-val-desc">Valor de reposição por uma torta inteira equivalente na padaria da esquina.</span>
          </div>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Probabilidade do Principal Suspeito</h4>
          <div class="clean-val-card">
            <span class="clean-range-tag">
              <span class="material-symbols-rounded">radar</span> 92% de Certeza (Evidência Forte)
            </span>
            <span class="clean-val-desc">Indivíduo foi flagrado limpando o canto da boca com guardanapo amassado ao lado da impressora.</span>
          </div>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Evidências Coletadas pela Equipe</h4>
          <ul class="clean-doc-bullets">
            <li>Rastro inegável de granulado de chocolate da bancada da pia até a baia número 04.</li>
            <li>Câmera do corredor registra suspeito acelerando o passo com as duas mãos nos bolsos às 15h41.</li>
            <li>Depoimento voluntário e sigiloso de colega confirmando cheiro característico de cacau fresco.</li>
          </ul>
        </div>

        <div class="clean-doc-section">
          <h4 class="clean-section-heading">Sentença Proposta</h4>
          <p class="clean-section-text">O infrator tem 24 horas para trazer um cento de coxinhas ou uma caixa de bombons para a copa sem necessidade de confissão pública formal.</p>
        </div>
      </div>
    `
  }
};

// Gerenciamento de Blocos do Modo Criar
let builderBlocksList = [];

function renderBuilderCanvas() {
  if (!structuredDocBody) return;

  if (builderBlocksList.length === 0) {
    structuredDocBody.innerHTML = `
      <div class="builder-empty-canvas">
        <span class="material-symbols-rounded empty-icon">edit_note</span>
        <h4 class="empty-title">Sua Proposta em Branco</h4>
        <p class="empty-desc">Clique nos botões acima (<strong>Título</strong>, <strong>Texto</strong>, <strong>Data</strong>, <strong>Moeda</strong>, <strong>Tabela</strong>, <strong>Link</strong> ou <strong>Lista</strong>) para estruturar a proposta campo a campo.</p>
      </div>
    `;
    return;
  }

  let html = `<div class="builder-doc-container">`;
  builderBlocksList.forEach((block, idx) => {
    html += `
      <div class="builder-block-item" data-index="${idx}">
        <div class="builder-block-header">
          <span class="builder-block-tag">
            <span class="material-symbols-rounded">${block.icon}</span> ${block.name}
          </span>
          <button class="btn-remove-block" data-index="${idx}" title="Remover campo">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        <div class="builder-block-body">
          ${block.contentHtml}
        </div>
      </div>
    `;
  });
  html += `</div>`;

  structuredDocBody.innerHTML = html;

  // Handler para botões de remover bloco
  structuredDocBody.querySelectorAll(".btn-remove-block").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      builderBlocksList.splice(idx, 1);
      renderBuilderCanvas();
    });
  });
}

function addBlockToBuilder(blockType) {
  let blockObj = null;

  if (blockType === "titulo") {
    blockObj = {
      type: "titulo",
      name: "Título da Proposta",
      icon: "title",
      contentHtml: `<h3 class="builder-rendered-title">Título Objetivo e Claro da Proposta</h3>`
    };
  } else if (blockType === "texto") {
    blockObj = {
      type: "texto",
      name: "Parágrafo Explicativo",
      icon: "notes",
      contentHtml: `<p class="builder-rendered-text">Descreva aqui o problema observado, o contexto da vizinhança e o que esta proposta busca solucionar de forma direta.</p>`
    };
  } else if (blockType === "data") {
    blockObj = {
      type: "data",
      name: "Data & Prazo",
      icon: "calendar_today",
      contentHtml: `
        <div class="clean-val-card">
          <span class="clean-date-tag">
            <span class="material-symbols-rounded">calendar_today</span> 15/12/2026 às 10:00
          </span>
          <span class="clean-val-desc">Prazo estipulado para realização da ação ou início da vigência.</span>
        </div>
      `
    };
  } else if (blockType === "moeda") {
    blockObj = {
      type: "moeda",
      name: "Orçamento / Moeda",
      icon: "payments",
      contentHtml: `
        <div class="clean-val-card">
          <span class="clean-money-tag">
            <span class="material-symbols-rounded">payments</span> R$ 850,00
          </span>
          <span class="clean-val-desc">Custo total estimado com discriminação de notas fiscais.</span>
        </div>
      `
    };
  } else if (blockType === "tabela") {
    blockObj = {
      type: "tabela",
      name: "Tabela de Itens",
      icon: "table_chart",
      contentHtml: `
        <div class="clean-table-card">
          <table class="clean-doc-table">
            <thead>
              <tr><th>Item</th><th>Quantidade</th><th>Estimativa Unitária</th><th>Total</th></tr>
            </thead>
            <tbody>
              <tr><td>Material de Reparo</td><td>1 lote</td><td>R$ 400,00</td><td>R$ 400,00</td></tr>
              <tr><td>Mão de Obra Especializada</td><td>1 diária</td><td>R$ 250,00</td><td>R$ 250,00</td></tr>
            </tbody>
            <tfoot>
              <tr><td colspan="3"><strong>Total Geral</strong></td><td><strong class="clean-table-total">R$ 650,00</strong></td></tr>
            </tfoot>
          </table>
        </div>
      `
    };
  } else if (blockType === "link") {
    blockObj = {
      type: "link",
      name: "Documento Anexo / Link",
      icon: "link",
      contentHtml: `
        <div class="clean-val-card">
          <span class="clean-link-tag">
            <span class="material-symbols-rounded">attach_file</span> Cotação_Oficial_Fornecedor.pdf
          </span>
          <span class="clean-val-desc">Comprovante bancário ou orçamento anexado para conferência de todos.</span>
        </div>
      `
    };
  } else if (blockType === "lista") {
    blockObj = {
      type: "lista",
      name: "Lista de Verificação",
      icon: "format_list_bulleted",
      contentHtml: `
        <ul class="clean-doc-bullets">
          <li>Definição dos 2 moradores responsáveis pela condução.</li>
          <li>Prestação de contas obrigatória com fotos no aplicativo em até 48 horas.</li>
        </ul>
      `
    };
  } else if (blockType === "mais") {
    blockObj = {
      type: "mais",
      name: "Módulos Cívicos Integrados",
      icon: "widgets",
      contentHtml: `
        <div class="clean-val-card">
          <span class="clean-link-tag">
            <span class="material-symbols-rounded">widgets</span> Enquetes, Fotos, Assinatura Digital & Geolocalização
          </span>
          <span class="clean-val-desc">A plataforma permite conectar múltiplos módulos conforme a necessidade de cada comunidade.</span>
        </div>
      `
    };
  }

  if (blockObj) {
    builderBlocksList.push(blockObj);
    renderBuilderCanvas();
  }
}

// Handlers dos botões de adicionar bloco
addBlockButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const blockType = btn.getAttribute("data-block");
    addBlockToBuilder(blockType);
  });
});

// Botão Limpar do Builder
btnClearBuilder?.addEventListener("click", () => {
  builderBlocksList = [];
  renderBuilderCanvas();
});

// Função para chavear entre os modos
function switchStructuredTemplate(templateKey) {
  if (!structuredDocBody) return;

  if (templateKey === "criar") {
    if (builderBlocksBar) builderBlocksBar.style.display = "block";
    renderBuilderCanvas();
  } else {
    if (builderBlocksBar) builderBlocksBar.style.display = "none";
    const example = cleanExamplesData[templateKey];
    if (example) {
      structuredDocBody.innerHTML = example.html;
    }
  }
}

// Handlers dos botões no topo da aba
templateButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tKey = btn.getAttribute("data-template");
    templateButtons.forEach((b) => {
      const isCur = b === btn;
      b.classList.toggle("active", isCur);
      b.setAttribute("aria-pressed", isCur ? "true" : "false");
    });
    switchStructuredTemplate(tKey);
  });
});

// Inicialização: Exemplo 1 ativo por padrão
switchStructuredTemplate("exemplo1");

// 3. PAINEL 2: Comparador Visual de Diff (Split View Minimalista)
const diffPropCards = document.querySelectorAll(".diff-prop-card");
const diffDiffCount = document.getElementById("diff-diff-count");
const diffLeftTitle = document.getElementById("diff-left-title");
const diffRightTitle = document.getElementById("diff-right-title");
const diffLeftContent = document.getElementById("diff-left-content");
const diffRightContent = document.getElementById("diff-right-content");

// 3 Propostas completas do mesmo tema (Iluminação da Praça) com blocos estruturados como no editor
const proposalsLibrary = {
  propA: {
    id: "propA",
    title: "Proposta #01: Obra Convencional",
    author: "Mariana · Bloco B",
    blocks: [
      {
        id: "escopo",
        heading: "Escopo do Projeto",
        type: "text",
        text: "Instalação de postes e refletores nos canteiros para eliminar pontos escuros na praça comunitária.",
      },
      {
        id: "orcamento",
        heading: "Orçamento Estimado",
        type: "money",
        value: "R$ 3.500,00",
        desc: "Quebra de piso de concreto, fiação subterrânea e ligação no relógio geral do condomínio.",
      },
      {
        id: "execucao",
        heading: "Método de Execução",
        type: "badge",
        badgeIcon: "engineering",
        badgeText: "Empreiteira Contratada",
        desc: "Obras com britadeira por 15 dias para abertura de canaletas nas calçadas.",
      },
      {
        id: "horario",
        heading: "Regulagem Noturna",
        type: "badge",
        badgeIcon: "schedule",
        badgeText: "Lâmpadas 100W Contínuas",
        desc: "Acesas ininterruptamente das 18h às 06h (custo mensal na conta do condomínio).",
      },
      {
        id: "responsavel",
        heading: "Coordenação",
        type: "text",
        text: "Mariana conduz a cotação com as empresas e a fiscalização presencial dos pedreiros.",
      },
    ],
  },
  propB: {
    id: "propB",
    title: "Proposta #02: Alternativa Solar & Autônoma",
    author: "Mesa 03 · Bairro Jardins",
    blocks: [
      {
        id: "escopo",
        heading: "Escopo do Projeto",
        type: "text",
        text: "Instalação de postes e refletores nos canteiros para eliminar pontos escuros na praça comunitária.",
      },
      {
        id: "orcamento",
        heading: "Orçamento Estimado",
        type: "money",
        value: "R$ 1.200,00",
        desc: "Compra de 6 refletores com placas solares autônomas. Zero conta de luz e sem obra no chão.",
      },
      {
        id: "execucao",
        heading: "Método de Execução",
        type: "badge",
        badgeIcon: "diversity_3",
        badgeText: "Mutirão Comunitário",
        desc: "Fixação direta em terra nos canteiros com vizinhos voluntários em 1 sábado.",
      },
      {
        id: "horario",
        heading: "Regulagem Noturna",
        type: "badge",
        badgeIcon: "wb_sunny",
        badgeText: "Fotocélula Solar Automática",
        desc: "Acendimento automático ao escurecer e desligamento autônomo ao amanhecer.",
      },
      {
        id: "responsavel",
        heading: "Coordenação",
        type: "text",
        text: "Mariana e Seu Jorge lideram a compra coletiva dos kits solares e o mutirão.",
      },
    ],
  },
  propC: {
    id: "propC",
    title: "Proposta #03: Consenso Final com Sensor",
    author: "Consenso Aprovado · Mesa 03",
    blocks: [
      {
        id: "escopo",
        heading: "Escopo do Projeto",
        type: "text",
        text: "Instalação de postes e refletores nos canteiros para eliminar pontos escuros na praça comunitária.",
      },
      {
        id: "orcamento",
        heading: "Orçamento Estimado",
        type: "money",
        value: "R$ 1.200,00",
        desc: "Compra de 6 refletores com placas solares autônomas. Zero conta de luz e sem obra no chão.",
      },
      {
        id: "execucao",
        heading: "Método de Execução",
        type: "badge",
        badgeIcon: "diversity_3",
        badgeText: "Mutirão Comunitário",
        desc: "Fixação direta em terra nos canteiros com vizinhos voluntários em 1 sábado.",
      },
      {
        id: "horario",
        heading: "Regulagem Noturna",
        type: "badge",
        badgeIcon: "bedtime",
        badgeText: "Sensor com Dimmer Noturno (20%)",
        desc: "Luminosidade reduz para 20% após as 23h, protegendo o sono das janelas térreas.",
      },
      {
        id: "responsavel",
        heading: "Coordenação",
        type: "text",
        text: "Mariana e Seu Jorge coordenam a compra e o mutirão confirmado para sábado 18/11.",
      },
    ],
  },
};

let selectedLeftProp = "propA";
let selectedRightProp = "propB";

function updateDiffPickerUI() {
  diffPropCards.forEach((card) => {
    const propKey = card.getAttribute("data-prop");
    const badge = card.querySelector(".prop-slot-badge");

    card.classList.remove("active-left", "active-right");

    if (propKey === selectedLeftProp) {
      card.classList.add("active-left");
      if (badge) {
        badge.className = "prop-slot-badge slot-left";
        badge.textContent = "Lado Esquerdo";
      }
    } else if (propKey === selectedRightProp) {
      card.classList.add("active-right");
      if (badge) {
        badge.className = "prop-slot-badge slot-right";
        badge.textContent = "Lado Direito";
      }
    } else {
      if (badge) {
        badge.className = "prop-slot-badge slot-idle";
        badge.textContent = "Clique para comparar";
      }
    }
  });
}

// Verifica se dois blocos da mesma linha são idênticos
function areBlocksIdentical(bL, bR) {
  if (!bL || !bR) return false;
  if (bL.type !== bR.type) return false;
  if (bL.heading !== bR.heading) return false;
  if (bL.text !== bR.text) return false;
  if (bL.value !== bR.value) return false;
  if (bL.desc !== bR.desc) return false;
  if (bL.badgeText !== bR.badgeText) return false;
  return true;
}

// Renderiza um bloco formatado com estilos do editor (neutro, removido/anterior em cinza ou adicionado/novo em azul)
function renderDiffFormattedBlock(block, status) {
  if (!block) {
    return `<div class="diff-block-row diff-block-empty"></div>`;
  }

  const isOld = status === "removed";
  const isNew = status === "added";
  const isNeutral = status === "neutral";

  const rowClass = `diff-block-row ${isOld ? "block-removed" : isNew ? "block-added" : "block-neutral"}`;
  let contentHtml = "";

  if (block.type === "text") {
    const textClass = isOld ? "diff-text-old" : isNew ? "diff-bold-blue" : "";
    contentHtml = `<p class="diff-block-text ${textClass}">${block.text}</p>`;
  } else if (block.type === "money") {
    let tagHtml = "";
    let descClass = isOld ? "diff-text-old" : isNew ? "diff-bold-blue" : "";

    if (isNeutral) {
      tagHtml = `
        <span class="clean-money-tag">
          <span class="material-symbols-rounded">payments</span> ${block.value}
        </span>
      `;
    } else if (isOld) {
      tagHtml = `
        <span class="diff-tag-old">
          <span class="material-symbols-rounded">payments</span> ${block.value}
        </span>
      `;
    } else {
      tagHtml = `
        <span class="diff-tag-new">
          <span class="material-symbols-rounded">payments</span> ${block.value}
        </span>
      `;
    }

    contentHtml = `
      <div class="diff-block-card">
        ${tagHtml}
        <span class="diff-card-desc ${descClass}">${block.desc}</span>
      </div>
    `;
  } else if (block.type === "badge") {
    let tagHtml = "";
    let descClass = isOld ? "diff-text-old" : isNew ? "diff-bold-blue" : "";

    if (isNeutral) {
      tagHtml = `
        <span class="clean-range-tag">
          <span class="material-symbols-rounded">${block.badgeIcon}</span> ${block.badgeText}
        </span>
      `;
    } else if (isOld) {
      tagHtml = `
        <span class="diff-tag-old">
          <span class="material-symbols-rounded">${block.badgeIcon}</span> ${block.badgeText}
        </span>
      `;
    } else {
      tagHtml = `
        <span class="diff-tag-new">
          <span class="material-symbols-rounded">${block.badgeIcon}</span> ${block.badgeText}
        </span>
      `;
    }

    contentHtml = `
      <div class="diff-block-card">
        ${tagHtml}
        <span class="diff-card-desc ${descClass}">${block.desc}</span>
      </div>
    `;
  }

  return `
    <div class="${rowClass}">
      <h5 class="diff-block-heading">${block.heading}</h5>
      ${contentHtml}
    </div>
  `;
}

function renderDiffComparison() {
  const docLeft = proposalsLibrary[selectedLeftProp];
  const docRight = proposalsLibrary[selectedRightProp];

  if (!docLeft || !docRight) return;

  if (diffLeftTitle) diffLeftTitle.textContent = docLeft.title;
  if (diffRightTitle) diffRightTitle.textContent = docRight.title;

  updateDiffPickerUI();

  const maxBlocks = Math.max(docLeft.blocks.length, docRight.blocks.length);
  let differentCount = 0;

  let leftHtml = "";
  let rightHtml = "";

  for (let i = 0; i < maxBlocks; i++) {
    const blockL = docLeft.blocks[i];
    const blockR = docRight.blocks[i];

    const isDifferent = !areBlocksIdentical(blockL, blockR);

    if (isDifferent) {
      differentCount++;
      leftHtml += renderDiffFormattedBlock(blockL, "removed");
      rightHtml += renderDiffFormattedBlock(blockR, "added");
    } else {
      leftHtml += renderDiffFormattedBlock(blockL, "neutral");
      rightHtml += renderDiffFormattedBlock(blockR, "neutral");
    }
  }

  if (diffDiffCount) {
    diffDiffCount.textContent = `${differentCount} ${differentCount === 1 ? "diferença" : "diferenças"}`;
  }

  if (diffLeftContent) diffLeftContent.innerHTML = leftHtml;
  if (diffRightContent) diffRightContent.innerHTML = rightHtml;
}

// Ao clicar nas propostas no topo do Diff
diffPropCards.forEach((card) => {
  card.addEventListener("click", () => {
    const clickedProp = card.getAttribute("data-prop");

    if (clickedProp === selectedLeftProp) {
      // Já está na esquerda, não muda
      return;
    }

    if (clickedProp === selectedRightProp) {
      // Inverte as posições
      const temp = selectedLeftProp;
      selectedLeftProp = selectedRightProp;
      selectedRightProp = temp;
    } else {
      // O terceiro card foi clicado: substitui o lado direito
      selectedRightProp = clickedProp;
    }

    renderDiffComparison();
  });
});

// Inicializa a comparação
renderDiffComparison();

// 4. PAINEL 3: Chat com Assistente de IA
const chatMessagesContainer = document.getElementById(
  "chat-messages-container",
);
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
      btnChatStep.innerHTML =
        '<span class="material-symbols-rounded btn-icon-sm">check_circle</span> Diálogo Concluído';
      btnChatStep.disabled = true;
    } else {
      btnChatStep.innerHTML =
        '<span class="material-symbols-rounded btn-icon-sm">play_arrow</span> Avançar Diálogo Passo a Passo';
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
  const sec = document.getElementById("propostas");
  if (sec) {
    sec.scrollIntoView({ behavior: "smooth" });
  }
});
