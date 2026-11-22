const SYSTEM_AUTHOR_PUB_HEX = "00".repeat(32);
export const BUILTIN_TEMPLATE_CATEGORY_IDS = {
    PROCUREMENT: "0000000000000000000000000000000000000000000000000000000074636131",
    RULES: "0000000000000000000000000000000000000000000000000000000074636132",
    ACTIONS: "0000000000000000000000000000000000000000000000000000000074636133",
};
export const BUILTIN_TEMPLATE_IDS = {
    PURCHASE_WORK: "0000000000000000000000000000000000000000000000000000000074706c31",
    REIMBURSEMENT: "0000000000000000000000000000000000000000000000000000000074706c32",
    RULE_CHANGE: "0000000000000000000000000000000000000000000000000000000074706c33",
    EVENT_ACTION: "0000000000000000000000000000000000000000000000000000000074706c34",
};
export const BUILTIN_TEMPLATE_CATEGORIES = [
    {
        docIdHex: BUILTIN_TEMPLATE_CATEGORY_IDS.PROCUREMENT,
        scope: "builtin/tpl-cat/compras-obras",
        title: "Compras, Obras e Contratações",
        body: "Modelos com escopo, cotações, orçamento total, prazos e garantia de entrega.",
        authorPubHex: SYSTEM_AUTHOR_PUB_HEX,
        timestampMs: 1,
        templateCount: 2,
        isBuiltIn: true,
    },
    {
        docIdHex: BUILTIN_TEMPLATE_CATEGORY_IDS.RULES,
        scope: "builtin/tpl-cat/regras-estatuto",
        title: "Regras, Estatuto e Convivência",
        body: "Modelos normativos com justificativa, artigos numerados e critérios de aplicação.",
        authorPubHex: SYSTEM_AUTHOR_PUB_HEX,
        timestampMs: 2,
        templateCount: 1,
        isBuiltIn: true,
    },
    {
        docIdHex: BUILTIN_TEMPLATE_CATEGORY_IDS.ACTIONS,
        scope: "builtin/tpl-cat/acoes-eventos",
        title: "Ações, Eventos e Mutirões",
        body: "Modelos operacionais com objetivo, etapas, responsáveis e recursos necessários.",
        authorPubHex: SYSTEM_AUTHOR_PUB_HEX,
        timestampMs: 3,
        templateCount: 1,
        isBuiltIn: true,
    },
];
export const BUILTIN_PROPOSAL_TEMPLATES = [
    {
        docIdHex: BUILTIN_TEMPLATE_IDS.PURCHASE_WORK,
        scope: `builtin/tpl/${BUILTIN_TEMPLATE_CATEGORY_IDS.PROCUREMENT}`,
        categoryId: BUILTIN_TEMPLATE_CATEGORY_IDS.PROCUREMENT,
        categoryHashHex: BUILTIN_TEMPLATE_CATEGORY_IDS.PROCUREMENT,
        title: "Compra, Obra ou Serviço",
        body: "Modelo completo para contratações com diagnóstico, comparativo de fornecedores e valor total.",
        authorPubHex: SYSTEM_AUTHOR_PUB_HEX,
        authorName: "Modelo Inicial",
        parentHashHex: null,
        timestampMs: 1,
        pickCount: 0,
        supporterPubs: [],
        isTopInCategory: false,
        isBuiltIn: true,
        fields: [
            {
                kind: "SUBTITLE",
                fieldId: "tpl-escopo",
                label: "Diagnóstico e Escopo",
            },
            {
                kind: "TEXT",
                fieldId: "tpl-problema",
                label: "Problema e Necessidade",
                text: "Ex.: Descreva o problema atual, onde ele ocorre e por que esta contratação é necessária.",
            },
            {
                kind: "TEXT",
                fieldId: "tpl-solucao",
                label: "Especificação Técnica",
                text: "Ex.: Detalhe materiais, modelo/marca de referência, quantidade e padrão de qualidade esperado.",
            },
            {
                kind: "TABLE",
                fieldId: "tpl-cotacoes",
                label: "Cotações e Fornecedores",
                columns: ["Fornecedor", "Valor (BRL)", "Prazo de Entrega", "Garantia"],
                rows: [
                    ["Ex.: Empresa Alfa Ltda", "R$ 1.850,00", "10 dias úteis", "12 meses"],
                ],
            },
            {
                kind: "VALUE",
                fieldId: "tpl-orcamento",
                label: "Orçamento Total Previsto",
                amountCents: 0,
                unit: "BRL",
            },
            {
                kind: "LINK",
                fieldId: "tpl-anexo",
                label: "Orçamento / Planta / Laudo (URL)",
                url: "https://exemplo.com/orcamento-referencia.pdf",
            },
        ],
    },
    {
        docIdHex: BUILTIN_TEMPLATE_IDS.REIMBURSEMENT,
        scope: `builtin/tpl/${BUILTIN_TEMPLATE_CATEGORY_IDS.PROCUREMENT}`,
        categoryId: BUILTIN_TEMPLATE_CATEGORY_IDS.PROCUREMENT,
        categoryHashHex: BUILTIN_TEMPLATE_CATEGORY_IDS.PROCUREMENT,
        title: "Reembolso ou Despesa Pontual",
        body: "Ideal para aprovar ou prestar contas de gastos emergenciais ou compras simples.",
        authorPubHex: SYSTEM_AUTHOR_PUB_HEX,
        authorName: "Modelo Inicial",
        parentHashHex: null,
        timestampMs: 2,
        pickCount: 0,
        supporterPubs: [],
        isTopInCategory: false,
        isBuiltIn: true,
        fields: [
            {
                kind: "TEXT",
                fieldId: "tpl-motivo-gasto",
                label: "Motivo da Despesa",
                text: "Ex.: Explique o motivo do gasto, data da ocorrência e quem autorizou ou executou.",
            },
            {
                kind: "TABLE",
                fieldId: "tpl-itens-despesa",
                label: "Itens Adquiridos",
                columns: ["Item", "Qtd", "Valor Unitário"],
                rows: [["Ex.: Lâmpada LED 15W", "4", "R$ 22,50"]],
            },
            {
                kind: "VALUE",
                fieldId: "tpl-valor-reembolso",
                label: "Valor do Reembolso",
                amountCents: 0,
                unit: "BRL",
            },
            {
                kind: "LINK",
                fieldId: "tpl-comprovante",
                label: "Nota Fiscal / Comprovante",
                url: "https://exemplo.com/nota-fiscal",
            },
        ],
    },
    {
        docIdHex: BUILTIN_TEMPLATE_IDS.RULE_CHANGE,
        scope: `builtin/tpl/${BUILTIN_TEMPLATE_CATEGORY_IDS.RULES}`,
        categoryId: BUILTIN_TEMPLATE_CATEGORY_IDS.RULES,
        categoryHashHex: BUILTIN_TEMPLATE_CATEGORY_IDS.RULES,
        title: "Nova Regra ou Alteração de Norma",
        body: "Estrutura jurídica simples com motivação, artigos numerados e início de vigência.",
        authorPubHex: SYSTEM_AUTHOR_PUB_HEX,
        authorName: "Modelo Inicial",
        parentHashHex: null,
        timestampMs: 3,
        pickCount: 0,
        supporterPubs: [],
        isTopInCategory: false,
        isBuiltIn: true,
        fields: [
            {
                kind: "TEXT",
                fieldId: "tpl-justificativa-norma",
                label: "Justificativa da Regra",
                text: "Ex.: Qual situação recorrente esta norma resolve e qual regra anterior está sendo ajustada.",
            },
            {
                kind: "ARTICLE",
                fieldId: "tpl-art-1",
                label: "Art. 1",
                articleNum: 1,
                text: "Ex.: Defina objetivamente o que passa a ser permitido, proibido ou obrigatório.",
            },
            {
                kind: "ARTICLE",
                fieldId: "tpl-art-2",
                label: "Art. 2",
                articleNum: 2,
                text: "Ex.: Defina exceções, horários válidos e prazo de entrada em vigor.",
            },
            {
                kind: "TEXT",
                fieldId: "tpl-criterio-aplicacao",
                label: "Critérios de Aplicação",
                text: "Ex.: Como a comunidade verifica o cumprimento e o que fazer em caso de descumprimento.",
            },
        ],
    },
    {
        docIdHex: BUILTIN_TEMPLATE_IDS.EVENT_ACTION,
        scope: `builtin/tpl/${BUILTIN_TEMPLATE_CATEGORY_IDS.ACTIONS}`,
        categoryId: BUILTIN_TEMPLATE_CATEGORY_IDS.ACTIONS,
        categoryHashHex: BUILTIN_TEMPLATE_CATEGORY_IDS.ACTIONS,
        title: "Mutirão ou Evento Comunitário",
        body: "Organize tarefas, datas, responsáveis e materiais necessários para uma ação coletiva.",
        authorPubHex: SYSTEM_AUTHOR_PUB_HEX,
        authorName: "Modelo Inicial",
        parentHashHex: null,
        timestampMs: 4,
        pickCount: 0,
        supporterPubs: [],
        isTopInCategory: false,
        isBuiltIn: true,
        fields: [
            {
                kind: "TEXT",
                fieldId: "tpl-objetivo-acao",
                label: "Objetivo e Local",
                text: "Ex.: Onde será a ação, qual o resultado esperado e quantos voluntários são necessários.",
            },
            {
                kind: "TABLE",
                fieldId: "tpl-cronograma",
                label: "Etapas e Responsáveis",
                columns: ["Etapa / Tarefa", "Data / Horário", "Responsável"],
                rows: [["Ex.: Limpeza e pintura da área comum", "Sábado, 09h–12h", "Ex.: Equipe A"]],
            },
            {
                kind: "VALUE",
                fieldId: "tpl-custo-materiais",
                label: "Custo Estimado de Materiais",
                amountCents: 0,
                unit: "BRL",
            },
        ],
    },
];
export function getTemplatePickScope(communityId, categoryId) {
    return `${communityId}/tpl/${categoryId}`;
}
export function parseTemplateCategoryFromScope(communityId, scope) {
    const prefix = `${communityId}/tpl/`;
    if (!scope.startsWith(prefix)) {
        return null;
    }
    const rest = scope.slice(prefix.length).trim();
    return rest.length > 0 ? rest : null;
}
function isExampleString(value) {
    const trimmed = value.trim();
    return (trimmed.startsWith("Ex.:") ||
        trimmed.startsWith("Ex:") ||
        trimmed.startsWith("https://exemplo.com"));
}
/**
 * Clona os campos de um template preservando os `fieldId`s originais para
 * maximizar a precisão do Diff Universal (N x N) entre propostas que usam o mesmo modelo.
 */
export function instantiateTemplateFields(fields, clearExamples = false) {
    return fields.map((field) => {
        switch (field.kind) {
            case "SUBTITLE":
                return { ...field };
            case "TEXT":
                return {
                    ...field,
                    text: clearExamples && isExampleString(field.text) ? "" : field.text,
                };
            case "VALUE":
                return { ...field };
            case "LINK":
                return {
                    ...field,
                    url: clearExamples && isExampleString(field.url) ? "https://" : field.url,
                };
            case "ARTICLE":
                return {
                    ...field,
                    text: clearExamples && isExampleString(field.text) ? "" : field.text,
                };
            case "TABLE":
                return {
                    ...field,
                    columns: [...field.columns],
                    rows: clearExamples
                        ? [field.columns.map(() => "")]
                        : field.rows.map((r) => [...r]),
                };
        }
    });
}
/**
 * Converte os campos concretos de uma proposta existente em exemplos didáticos
 * válidos pelas regras do protocolo TLV para criação de um novo template.
 */
export function convertProposalFieldsToTemplateExamples(fields) {
    return fields.map((field) => {
        switch (field.kind) {
            case "SUBTITLE":
                return { ...field };
            case "TEXT": {
                const preview = field.text.trim().slice(0, 120);
                return {
                    ...field,
                    text: preview
                        ? `Ex.: ${preview}${field.text.trim().length > 120 ? "..." : ""}`
                        : `Ex.: Preencha o campo "${field.label || "Texto"}".`,
                };
            }
            case "VALUE":
                return {
                    ...field,
                    amountCents: 0,
                };
            case "LINK":
                return {
                    ...field,
                    url: "https://exemplo.com/documento-referencia",
                };
            case "ARTICLE":
                return {
                    ...field,
                    text: `Ex.: Redação sugerida para o Art. ${field.articleNum}.`,
                };
            case "TABLE":
                return {
                    ...field,
                    columns: [...field.columns],
                    rows: [
                        field.columns.map((col, idx) => field.rows[0]?.[idx]?.trim()
                            ? `Ex.: ${field.rows[0][idx].trim().slice(0, 40)}`
                            : `Ex.: ${col}`),
                    ],
                };
        }
    });
}
//# sourceMappingURL=proposal-templates.js.map