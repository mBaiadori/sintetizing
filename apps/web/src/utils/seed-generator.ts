import { bytesToHex } from "@noble/hashes/utils";
import type { CommunityRecord, LocalIdentity } from "@sintetizing/storage";
import {
  calculateDocId,
  ConfigKind,
  createAuthorNameBlock,
  createBodyBlock,
  createCategoryHashBlock,
  createConfigKindBlock,
  createDeadlineBlock,
  createDeliberationModeBlock,
  createFieldLinkBlock,
  createFieldSubtitleBlock,
  createFieldTableBlock,
  createFieldTextBlock,
  createFieldValueBlock,
  createInactivityDaysBlock,
  createInvitePolicyBlock,
  createInviteProofBlock,
  createLawArticleBlock,
  createParentHashBlock,
  createPickTargetBlock,
  createQuorumPctBlock,
  createScopeBlock,
  createSignedInvite,
  createTimestampBlock,
  createTitleBlock,
  DeliberationMode,
  DocType,
  generateEd25519Keypair,
  InvitePolicy,
  packDocument,
} from "@sintetizing/wire";

export type SeedScale = "medium" | "large" | "stress";

export interface SeedScaleConfig {
  readonly label: string;
  readonly description: string;
  readonly communities: number;
  readonly membersPerCommunity: number;
  readonly categoriesPerCommunity: number;
  readonly subjectsPerCategory: number;
  readonly generalSubjects: number;
  readonly proposalsPerSubject: number;
  readonly maxPicksPerProposalRatio: number;
}

export const SEED_SCALE_CONFIGS: Readonly<Record<SeedScale, SeedScaleConfig>> = {
  medium: {
    label: "Médio",
    description: "2 comunidades, 15 membros/comunidade, 4 categorias, 24 assuntos, ~72 propostas",
    communities: 2,
    membersPerCommunity: 15,
    categoriesPerCommunity: 4,
    subjectsPerCategory: 2,
    generalSubjects: 2,
    proposalsPerSubject: 3,
    maxPicksPerProposalRatio: 0.45,
  },
  large: {
    label: "Grande Porte",
    description: "4 comunidades, 35 membros/comunidade, 6 categorias, 96 assuntos, ~320 propostas",
    communities: 4,
    membersPerCommunity: 35,
    categoriesPerCommunity: 6,
    subjectsPerCategory: 3,
    generalSubjects: 6,
    proposalsPerSubject: 3,
    maxPicksPerProposalRatio: 0.55,
  },
  stress: {
    label: "Massivo (Stress)",
    description: "5 comunidades, 60 membros/comunidade, 8 categorias, 200 assuntos, ~600+ propostas",
    communities: 5,
    membersPerCommunity: 60,
    categoriesPerCommunity: 8,
    subjectsPerCategory: 4,
    generalSubjects: 8,
    proposalsPerSubject: 3,
    maxPicksPerProposalRatio: 0.5,
  },
};

export interface SeedCommunityBundle {
  readonly record: CommunityRecord;
  readonly packets: readonly Uint8Array[];
}

export interface SeedDatasetStats {
  readonly communities: number;
  readonly members: number;
  readonly categories: number;
  readonly subjects: number;
  readonly proposals: number;
  readonly picks: number;
  readonly totalPackets: number;
}

export interface SeedDatasetResult {
  readonly bundles: readonly SeedCommunityBundle[];
  readonly stats: SeedDatasetStats;
}

interface SimulatedMember {
  readonly displayName: string;
  readonly publicKey: Uint8Array;
  readonly privateKey: Uint8Array;
  readonly publicKeyHex: string;
  seq: number;
}

const FIRST_NAMES = [
  "Ana", "Bruno", "Camila", "Daniel", "Eduarda", "Felipe", "Gabriela", "Henrique",
  "Isabela", "João", "Karina", "Lucas", "Mariana", "Nathan", "Olívia", "Pedro",
  "Quintino", "Rafael", "Sofia", "Thiago", "Úrsula", "Vinícius", "Wesley", "Yasmin",
  "Zeca", "Beatriz", "Caio", "Débora", "Enzo", "Fernanda", "Gustavo", "Helena",
  "Igor", "Juliana", "Kauã", "Larissa", "Mateus", "Natália", "Otávio", "Patrícia",
] as const;

const LAST_NAMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Pereira", "Costa", "Rodrigues", "Almeida",
  "Nascimento", "Lima", "Araújo", "Fernandes", "Carvalho", "Gomes", "Martins", "Rocha",
  "Ribeiro", "Alves", "Monteiro", "Mendes", "Barros", "Freitas", "Barbosa", "Pinto",
] as const;

const COMMUNITY_TEMPLATES = [
  {
    title: "Assembleia Urbana Central",
    body: "Deliberação comunitária sobre infraestrutura, mobilidade, segurança e orçamento participativo.",
    quorumPct: 51,
    inactivityDays: 30,
  },
  {
    title: "Coletivo Tecnologia Aberta",
    body: "Governança de software livre, protocolos descentralizados, infraestrutura local e padrões técnicos.",
    quorumPct: 60,
    inactivityDays: 45,
  },
  {
    title: "Conselho de Clima e Energia",
    body: "Planejamento de microgrids solares, arborização urbana, gestão hídrica e metas de carbono zero.",
    quorumPct: 55,
    inactivityDays: 30,
  },
  {
    title: "Fórum Educação e Cultura",
    body: "Propostas para bibliotecas comunitárias, oficinas técnicas, bolsas de estudo e festivais locais.",
    quorumPct: 50,
    inactivityDays: 60,
  },
  {
    title: "Rede Cooperativa Regional",
    body: "Coordenação logística, compras coletivas, fundo mútuo e feiras de produtores independentes.",
    quorumPct: 51,
    inactivityDays: 30,
  },
] as const;

const CATEGORY_TEMPLATES = [
  { title: "Infraestrutura", body: "Obras, manutenção urbana, saneamento e energia." },
  { title: "Governança", body: "Estatuto, transparência, auditoria e regras de consenso." },
  { title: "Tecnologia", body: "Sistemas digitais, redes mesh, dados abertos e segurança." },
  { title: "Economia Local", body: "Orçamento, compras coletivas, incentivos e fundo comum." },
  { title: "Educação", body: "Formação contínua, oficinas, mentorias e acervos." },
  { title: "Sustentabilidade", body: "Resíduos, eficiência energética, áreas verdes e água." },
  { title: "Mobilidade", body: "Ciclovias, transporte público, acessibilidade e sinalização." },
  { title: "Cultura e Lazer", body: "Eventos, praças, espaços de convivência e esportes." },
] as const;

const SUBJECT_TOPICS = [
  "Plano de iluminação inteligente",
  "Orçamento anual participativo",
  "Protocolo de auditoria aberta",
  "Expansão da rede comunitária",
  "Reforma dos espaços compartilhados",
  "Programa de energia solar local",
  "Diretrizes de acessibilidade universal",
  "Fundo de apoio a projetos novos",
  "Calendário de assembleias mensais",
  "Sistema de coleta seletiva",
  "Conectividade para áreas periféricas",
  "Manutenção preventiva de equipamentos",
  "Política de dados e privacidade",
  "Integração com cooperativas vizinhas",
  "Oficinas de capacitação técnica",
  "Reserva de emergência comunitária",
] as const;

const PROPOSAL_PREFIXES = [
  "Modelo incremental em 3 fases",
  "Execução direta por mutirão técnico",
  "Parceria com cooperativas locais",
  "Implementação enxuta com métricas trimestrais",
  "Revisão focada em redução de custos",
] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function randomSuffix(bytesLen = 2): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytesLen));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function deterministicPick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

/**
 * Gera um conjunto de dados completo e criptograficamente válido (pacotes TLV assinados em Ed25519)
 * para popular comunidades, membros, categorias, assuntos, propostas e apoios em grande escala.
 */
export async function generateSeedDataset(params: {
  readonly identity: LocalIdentity;
  readonly scale: SeedScale;
  readonly nowMs?: number;
  readonly onProgress?: (message: string) => void;
}): Promise<SeedDatasetResult> {
  const config = SEED_SCALE_CONFIGS[params.scale];
  const baseNow = params.nowMs ?? Date.now();
  const bundles: SeedCommunityBundle[] = [];

  let totalMembers = 0;
  let totalCategories = 0;
  let totalSubjects = 0;
  let totalProposals = 0;
  let totalPicks = 0;
  let totalPackets = 0;

  for (let cIdx = 0; cIdx < config.communities; cIdx += 1) {
    const template = deterministicPick(COMMUNITY_TEMPLATES, cIdx);
    const commTitle =
      cIdx < COMMUNITY_TEMPLATES.length
        ? template.title
        : `${template.title} #${cIdx + 1}`;
    const communityId = `${slugify(commTitle)}-${randomSuffix(3)}`;
    const commCreatedAt = baseNow - (config.communities - cIdx) * 86_400_000 * 7;

    params.onProgress?.(
      `Gerando comunidade ${cIdx + 1}/${config.communities}: ${commTitle}...`
    );

    const packets: Uint8Array[] = [];
    const localMember: SimulatedMember = {
      displayName: params.identity.displayName,
      publicKey: params.identity.publicKey,
      privateKey: params.identity.privateKey,
      publicKeyHex: params.identity.publicKeyHex,
      seq: 1,
    };

    // 1. Genesis .cmnt (local user is founder so they can manage/invite/test everything)
    const genesisBytes = await packDocument(
      {
        docType: DocType.CONFIG,
        authorPub: localMember.publicKey,
        seq: 1,
        blocks: [
          createScopeBlock(communityId),
          createConfigKindBlock(ConfigKind.COMMUNITY),
          createTitleBlock(commTitle),
          createBodyBlock(template.body),
          createQuorumPctBlock(template.quorumPct),
          createInactivityDaysBlock(template.inactivityDays),
          createInvitePolicyBlock(InvitePolicy.ANY_ACTIVE_MEMBER),
          createAuthorNameBlock(localMember.displayName),
          createTimestampBlock(commCreatedAt),
        ],
      },
      localMember.privateKey
    );
    const genesisDocId = calculateDocId(genesisBytes);
    packets.push(genesisBytes);

    // 2. Membros simulados com chaves Ed25519 próprias e MEMB_JOIN assinado
    const simMembers: SimulatedMember[] = [localMember];
    totalMembers += 1;

    for (let mIdx = 1; mIdx < config.membersPerCommunity; mIdx += 1) {
      const kp = await generateEd25519Keypair();
      const firstName = deterministicPick(FIRST_NAMES, mIdx + cIdx * 7);
      const lastName = deterministicPick(LAST_NAMES, mIdx * 3 + cIdx * 5);
      const displayName = `${firstName} ${lastName}`;
      const joinTs = commCreatedAt + mIdx * 60_000;

      const proofBytes = await createSignedInvite({
        communityId,
        inviterPub: localMember.publicKey,
        inviterPrivateKey: localMember.privateKey,
        issuedAtMs: commCreatedAt + 1_000,
        expiresAtMs: baseNow + 30 * 86_400_000,
        nonce: cIdx * 10_000 + mIdx,
      });

      const joinBytes = await packDocument(
        {
          docType: DocType.MEMB_JOIN,
          authorPub: kp.publicKey,
          seq: 1,
          blocks: [
            createScopeBlock(communityId),
            createInviteProofBlock(proofBytes),
            createAuthorNameBlock(displayName),
            createTimestampBlock(joinTs),
          ],
        },
        kp.privateKey
      );
      packets.push(joinBytes);
      simMembers.push({
        displayName,
        publicKey: kp.publicKey,
        privateKey: kp.privateKey,
        publicKeyHex: bytesToHex(kp.publicKey),
        seq: 1,
      });
      totalMembers += 1;
    }

    // 3. Categorias
    const categoryIds: Uint8Array[] = [];
    for (let catIdx = 0; catIdx < config.categoriesPerCommunity; catIdx += 1) {
      const catTpl = deterministicPick(CATEGORY_TEMPLATES, catIdx);
      const catTitle =
        catIdx < CATEGORY_TEMPLATES.length
          ? catTpl.title
          : `${catTpl.title} ${catIdx + 1}`;
      const author = deterministicPick(simMembers, catIdx + 1);
      author.seq += 1;
      const catScope = `${communityId}/cat-${slugify(catTitle)}-${randomSuffix(2)}`;
      const catBytes = await packDocument(
        {
          docType: DocType.CONFIG,
          authorPub: author.publicKey,
          seq: author.seq,
          blocks: [
            createScopeBlock(catScope),
            createConfigKindBlock(ConfigKind.CATEGORY),
            createTitleBlock(catTitle),
            createBodyBlock(catTpl.body),
            createAuthorNameBlock(author.displayName),
            createTimestampBlock(commCreatedAt + 3_600_000 + catIdx * 30_000),
          ],
        },
        author.privateKey
      );
      packets.push(catBytes);
      categoryIds.push(calculateDocId(catBytes));
      totalCategories += 1;
    }

    // 4. Assuntos (por categoria + Geral)
    interface SeededSubject {
      readonly scope: string;
      readonly ts: number;
    }
    const subjects: SeededSubject[] = [];
    const totalSubjForComm =
      config.categoriesPerCommunity * config.subjectsPerCategory +
      config.generalSubjects;

    for (let sIdx = 0; sIdx < totalSubjForComm; sIdx += 1) {
      const isGeneral = sIdx >= config.categoriesPerCommunity * config.subjectsPerCategory;
      const catHash = isGeneral
        ? null
        : categoryIds[Math.floor(sIdx / config.subjectsPerCategory)]!;
      const topicBase = deterministicPick(SUBJECT_TOPICS, sIdx + cIdx * 3);
      const subjTitle = `${topicBase} (${cIdx + 1}.${sIdx + 1})`;
      const subjScope = `${communityId}/${slugify(topicBase).slice(0, 20)}-${randomSuffix(2)}`;
      const author = deterministicPick(simMembers, sIdx + 2);
      author.seq += 1;
      const subjTs = commCreatedAt + 7_200_000 + sIdx * 60_000;

      const isOpenSubject = sIdx % 4 === 0;
      const subjDeadlineSec =
        sIdx % 7 === 6
          ? Math.floor(baseNow / 1000) - 3_600
          : sIdx % 3 === 1
            ? Math.floor(baseNow / 1000) + 86_400 * 5
            : null;

      const blocks = [
        createScopeBlock(subjScope),
        createConfigKindBlock(ConfigKind.SUBJECT),
        ...(catHash ? [createCategoryHashBlock(catHash)] : []),
        createTitleBlock(subjTitle),
        createBodyBlock(
          `Discussão estruturada para definir a melhor abordagem sobre "${subjTitle}" na comunidade ${commTitle}.`
        ),
        createDeliberationModeBlock(
          isOpenSubject ? DeliberationMode.OPEN : DeliberationMode.QUORUM
        ),
        ...(subjDeadlineSec !== null ? [createDeadlineBlock(subjDeadlineSec)] : []),
        createAuthorNameBlock(author.displayName),
        createTimestampBlock(subjTs),
      ];

      const subjBytes = await packDocument(
        {
          docType: DocType.CONFIG,
          authorPub: author.publicKey,
          seq: author.seq,
          blocks,
        },
        author.privateKey
      );
      packets.push(subjBytes);
      subjects.push({ scope: subjScope, ts: subjTs });
      totalSubjects += 1;
    }

    // 5. Propostas e Apoios (Picks)
    for (let sIdx = 0; sIdx < subjects.length; sIdx += 1) {
      const subj = subjects[sIdx]!;
      const subjectProposalIds: Uint8Array[] = [];

      for (let pIdx = 0; pIdx < config.proposalsPerSubject; pIdx += 1) {
        const author = deterministicPick(simMembers, sIdx * 3 + pIdx + 1);
        const propTs = subj.ts + 120_000 + pIdx * 90_000;
        const prefix = deterministicPick(PROPOSAL_PREFIXES, pIdx + sIdx);
        const propTitle = `${prefix} — Opção ${pIdx + 1}`;
        const parentHash =
          pIdx > 0 && pIdx === config.proposalsPerSubject - 1
            ? subjectProposalIds[0]
            : undefined;

        const isForkVariant = parentHash !== undefined;
        const propStructuredBlocks = isForkVariant
          ? [
              createFieldSubtitleBlock({
                fieldId: "sec-escopo",
                label: "Escopo e Execução",
              }),
              createFieldTextBlock({
                fieldId: "txt-resumo",
                label: "Resumo Executivo",
                text: `Versão sintetizada (${propTitle}) reduzindo custos operacionais e mantendo garantia estendida.`,
              }),
              createFieldValueBlock({
                fieldId: "val-custo",
                label: "Orçamento Estimado",
                amountCents: (85 + ((sIdx + pIdx) % 6) * 15) * 10000,
                unit: "BRL",
              }),
              createFieldTableBlock({
                fieldId: "tbl-etapas",
                label: "Cronograma de Entregas",
                columns: ["Fase", "Duração", "Responsável"],
                rows: [
                  ["Diagnóstico", "3 dias", "Comitê Técnico"],
                  ["Execução", "10 dias", "Fornecedor Local"],
                ],
              }),
              createFieldTextBlock({
                fieldId: "txt-melhoria",
                label: "Melhoria desta Síntese",
                text: "Inclui auditoria comunitária antes da liberação da última parcela.",
              }),
            ]
          : [
              createFieldSubtitleBlock({
                fieldId: "sec-escopo",
                label: "Escopo e Execução",
              }),
              createFieldTextBlock({
                fieldId: "txt-resumo",
                label: "Resumo Executivo",
                text: `Proposta detalhada (${propTitle}) com cronograma de entregas, responsáveis claros e prestação de contas aberta à comunidade.`,
              }),
              createFieldValueBlock({
                fieldId: "val-custo",
                label: "Orçamento Estimado",
                amountCents: (100 + ((sIdx + pIdx) % 6) * 20) * 10000,
                unit: "BRL",
              }),
              createFieldTableBlock({
                fieldId: "tbl-etapas",
                label: "Cronograma de Entregas",
                columns: ["Fase", "Duração", "Responsável"],
                rows: [
                  ["Diagnóstico", "5 dias", "Equipe A"],
                  ["Execução", "14 dias", "Fornecedor B"],
                ],
              }),
              createFieldLinkBlock({
                fieldId: "lnk-ref",
                label: "Referência Técnica",
                url: "https://sintetize.org/referencias/escopo-base",
              }),
              createLawArticleBlock(
                1,
                "Toda entrega deve ser acompanhada de relatório fotográfico público."
              ),
            ];

        const propBytes = await packDocument(
          {
            docType: DocType.PROPOSAL,
            authorPub: author.publicKey,
            seq: 1,
            blocks: [
              createScopeBlock(subj.scope),
              ...(parentHash ? [createParentHashBlock(parentHash)] : []),
              createTitleBlock(propTitle),
              createBodyBlock(
                `Proposta (${propTitle}) com blocos estruturados de escopo, orçamento e entregas.`
              ),
              ...propStructuredBlocks,
              createAuthorNameBlock(author.displayName),
              createTimestampBlock(propTs),
            ],
          },
          author.privateKey
        );
        const propDocId = calculateDocId(propBytes);
        packets.push(propBytes);
        subjectProposalIds.push(propDocId);
        totalProposals += 1;

        // Distribui apoios (PICKS) de membros distintos; deixa ~30% dos assuntos sem voto do usuário local para popular pendências
        const maxSupporters = Math.max(
          1,
          Math.floor(simMembers.length * config.maxPicksPerProposalRatio)
        );
        const targetSupporters =
          pIdx === 0
            ? maxSupporters
            : Math.max(1, Math.floor(maxSupporters * (0.65 / (pIdx + 1))));

        for (let vIdx = 0; vIdx < targetSupporters; vIdx += 1) {
          // Pula o membro local (índice 0) nos primeiros 40% dos assuntos para manter pendências no Feed
          const memberIdx =
            sIdx % 3 !== 0 && vIdx === 0
              ? (simMembers.length - 1)
              : (vIdx + sIdx + pIdx) % simMembers.length;
          const voter = simMembers[memberIdx]!;
          if (voter.publicKeyHex === localMember.publicKeyHex && sIdx % 3 !== 0) {
            continue;
          }
          voter.seq += 1;
          const pickBytes = await packDocument(
            {
              docType: DocType.PICK,
              authorPub: voter.publicKey,
              seq: voter.seq,
              blocks: [
                createScopeBlock(subj.scope),
                createPickTargetBlock(propDocId),
                createAuthorNameBlock(voter.displayName),
                createTimestampBlock(propTs + 30_000 + vIdx * 5_000),
              ],
            },
            voter.privateKey
          );
          packets.push(pickBytes);
          totalPicks += 1;
        }
      }
    }

    // 6. Uma proposta de alteração de regras (v2) na primeira comunidade para testar governança no Feed
    if (cIdx === 0 && simMembers.length > 2) {
      const proposer = simMembers[1]!;
      proposer.seq += 1;
      const v2Ts = baseNow - 3_600_000;
      const v2Bytes = await packDocument(
        {
          docType: DocType.CONFIG,
          authorPub: proposer.publicKey,
          seq: proposer.seq,
          blocks: [
            createScopeBlock(communityId),
            createConfigKindBlock(ConfigKind.COMMUNITY),
            createParentHashBlock(genesisDocId),
            createTitleBlock(`${commTitle} (v2)`),
            createBodyBlock(
              "Proposta de atualização do quórum padrão para 55% e prazo de inatividade para 45 dias."
            ),
            createQuorumPctBlock(55),
            createInactivityDaysBlock(45),
            createInvitePolicyBlock(InvitePolicy.ANY_ACTIVE_MEMBER),
            createAuthorNameBlock(proposer.displayName),
            createTimestampBlock(v2Ts),
          ],
        },
        proposer.privateKey
      );
      const v2DocId = calculateDocId(v2Bytes);
      packets.push(v2Bytes);

      const endorsers = Math.min(4, simMembers.length - 1);
      for (let eIdx = 1; eIdx <= endorsers; eIdx += 1) {
        const endorser = simMembers[eIdx]!;
        endorser.seq += 1;
        const cPickBytes = await packDocument(
          {
            docType: DocType.COMMUNITY_PICK,
            authorPub: endorser.publicKey,
            seq: endorser.seq,
            blocks: [
              createScopeBlock(communityId),
              createPickTargetBlock(v2DocId),
              createAuthorNameBlock(endorser.displayName),
              createTimestampBlock(v2Ts + eIdx * 10_000),
            ],
          },
          endorser.privateKey
        );
        packets.push(cPickBytes);
        totalPicks += 1;
      }
    }

    totalPackets += packets.length;
    bundles.push({
      record: {
        communityId,
        title: commTitle,
        relays: [],
        createdAtMs: commCreatedAt,
      },
      packets,
    });
  }

  return {
    bundles,
    stats: {
      communities: config.communities,
      members: totalMembers,
      categories: totalCategories,
      subjects: totalSubjects,
      proposals: totalProposals,
      picks: totalPicks,
      totalPackets,
    },
  };
}
