import * as fs from "node:fs";
import * as path from "node:path";
import * as ed25519 from "@noble/ed25519";
import { bytesToHex } from "@noble/hashes/utils";
import {
  calculateDocId,
  createLawArticleBlock,
  createParentHashBlock,
  createPickTargetBlock,
  createScopeBlock,
  createTitleBlock,
  DocType,
  packDocument,
  SubjectStateEngine,
} from "../src/index.js";

const wireDir = path.resolve(import.meta.dirname, "..");
const testOutputDir = path.resolve(wireDir, "test-output");
const subjectsOutputDir = path.resolve(testOutputDir, "assuntos");

fs.mkdirSync(subjectsOutputDir, { recursive: true });

interface Citizen {
  id: number;
  name: string;
  role: string;
  priv: Uint8Array;
  pub: Uint8Array;
  pubHex: string;
  seq: number;
}

const FIRST_NAMES = ["Ana", "Bruno", "Carlos", "Daniela", "Eduardo", "Fernanda", "Gabriel", "Helena", "Igor", "Juliana", "Lucas", "Mariana", "Nelson", "Olivia", "Pedro", "Renata", "Samuel", "Tatiana", "Vinicius", "Yasmin"];
const LAST_NAMES = ["Silva", "Souza", "Oliveira", "Santos", "Lima", "Costa", "Pereira", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Araujo", "Ribeiro", "Gomes", "Martins"];
const ROLES = ["Morador Bloco A", "Morador Bloco B", "Morador Bloco C", "Morador Bloco D", "Conselheiro", "Comissão de Obras", "Morador Cobertura", "Comissão Financeira"];

async function generateCitizens(total: number): Promise<Citizen[]> {
  const citizens: Citizen[] = [];
  for (let i = 1; i <= total; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const ln = LAST_NAMES[(i * 3) % LAST_NAMES.length]!;
    const role = ROLES[i % ROLES.length]!;
    const name = `${fn} ${ln} #${i}`;

    const priv = ed25519.utils.randomPrivateKey();
    const pub = await ed25519.getPublicKeyAsync(priv);

    citizens.push({
      id: i,
      name,
      role,
      priv,
      pub,
      pubHex: bytesToHex(pub),
      seq: 0,
    });
  }
  return citizens;
}

function makeHexDump(bytes: Uint8Array): string {
  const preview = bytes.subarray(0, 64);
  let hexDump = "";
  let asciiDump = "";
  for (let b = 0; b < preview.length; b++) {
    const byte = preview[b]!;
    hexDump += byte.toString(16).padStart(2, "0") + " ";
    asciiDump += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
    if ((b + 1) % 16 === 0 || b === preview.length - 1) {
      hexDump += "  |" + asciiDump + "|\n";
      asciiDump = "";
    }
  }
  return hexDump;
}

export async function buildLargeScaleSubjectsData(TOTAL_USERS = 350) {
  console.log(`\n\x1b[1m\x1b[36m╔═══════════════════════════════════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m║  SINTETIZE - TESTE DE LARGA ESCALA COM ${TOTAL_USERS} CIDADÃOS EM DELIBERAÇÃO DINÂMICA       ║\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m╚═══════════════════════════════════════════════════════════════════════════════════╝\x1b[0m\n`);

  console.log(`⚡ Gerando ${TOTAL_USERS} identidades com pares de chaves Ed25519...`);
  const t0 = performance.now();
  const citizens = await generateCitizens(TOTAL_USERS);
  console.log(`✔ ${TOTAL_USERS} cidadãos prontos em ${(performance.now() - t0).toFixed(1)}ms`);

  // =========================================================================
  // ASSUNTO 1: condominio/energia-sustentavel
  // =========================================================================
  const engineEnergia = new SubjectStateEngine();
  const subject1Dir = path.join(subjectsOutputDir, "energia-sustentavel");
  fs.mkdirSync(subject1Dir, { recursive: true });

  const ana = citizens[0]!;
  const carlos = citizens[1]!;
  const daniela = citizens[2]!;

  // 1.1 Proposta Base: Usina Solar Central
  ana.seq++;
  const propSolarBase = await packDocument(
    {
      docType: DocType.PROPOSAL,
      authorPub: ana.pub,
      seq: 1,
      blocks: [
        createScopeBlock("condominio/energia-sustentavel"),
        createTitleBlock("Usina Solar Central no Telhado"),
        createLawArticleBlock(1, "Instalação de 50 placas fotovoltaicas no teto do Bloco Central."),
        createLawArticleBlock(2, "Rateio igualitário da redução da conta de energia entre todas as unidades."),
      ],
    },
    ana.priv
  );
  const docIdSolarBase = calculateDocId(propSolarBase);
  await engineEnergia.ingestBinaryPacket(propSolarBase);
  fs.writeFileSync(path.join(subject1Dir, "01_prop_solar_base.stze"), propSolarBase);

  // 1.2 Proposta Base Alternativa: Baterias & Iluminação LED
  carlos.seq++;
  const propBateriasBase = await packDocument(
    {
      docType: DocType.PROPOSAL,
      authorPub: carlos.pub,
      seq: 1,
      blocks: [
        createScopeBlock("condominio/energia-sustentavel"),
        createTitleBlock("Baterias de Backup e Iluminação LED"),
        createLawArticleBlock(1, "Aquisição de no-break industrial para elevadores e portaria contra apagões."),
        createLawArticleBlock(2, "Substituição de todas as lâmpadas comuns por LED dimerizável."),
      ],
    },
    carlos.priv
  );
  const docIdBateriasBase = calculateDocId(propBateriasBase);
  await engineEnergia.ingestBinaryPacket(propBateriasBase);
  fs.writeFileSync(path.join(subject1Dir, "02_prop_baterias_base.stze"), propBateriasBase);

  // 1.3 Emenda à Proposta Solar: 80 Placas nos Blocos A e B
  daniela.seq++;
  const propSolarEmenda = await packDocument(
    {
      docType: DocType.PROPOSAL,
      authorPub: daniela.pub,
      seq: 1,
      blocks: [
        createScopeBlock("condominio/energia-sustentavel"),
        createParentHashBlock(docIdSolarBase),
        createTitleBlock("Emenda com 80 Placas Distribuídas"),
        createLawArticleBlock(1, "Ampliação para 80 placas fotovoltaicas divididas igualmente entre os Blocos A e B."),
      ],
    },
    daniela.priv
  );
  const docIdSolarEmenda = calculateDocId(propSolarEmenda);
  await engineEnergia.ingestBinaryPacket(propSolarEmenda);
  fs.writeFileSync(path.join(subject1Dir, "03_prop_solar_emenda.stze"), propSolarEmenda);

  // 1.4 Síntese Unificada: Solar Híbrida com Bateria
  ana.seq++;
  const propSinteseEnergia = await packDocument(
    {
      docType: DocType.PROPOSAL,
      authorPub: ana.pub,
      seq: 1,
      blocks: [
        createScopeBlock("condominio/energia-sustentavel"),
        createParentHashBlock(docIdSolarEmenda),
        createParentHashBlock(docIdBateriasBase),
        createTitleBlock("Síntese Híbrida: Solar + Bateria Integrada"),
        createLawArticleBlock(1, "Instalação de 60 placas solares e no-break inteligente integrado."),
        createLawArticleBlock(2, "Excedente de energia gerado de dia carrega a bateria para abastecer as áreas comuns à noite."),
      ],
    },
    ana.priv
  );
  const docIdSinteseEnergia = calculateDocId(propSinteseEnergia);
  await engineEnergia.ingestBinaryPacket(propSinteseEnergia);
  fs.writeFileSync(path.join(subject1Dir, "04_prop_sintese_hibrida.stze"), propSinteseEnergia);

  // =========================================================================
  // EMISSÃO DE CENTENAS DE PICKS (APOIOS CRIPTOGRÁFICOS)
  // =========================================================================
  console.log(`\n🗳️  Emitindo apoios com centenas de moradores...`);
  const tPicks = performance.now();

  // Distribuição:
  // - 50% dos moradores apoiam a Síntese Híbrida (v2.0)
  // - 25% apoiam a Usina Solar Base (v1.0)
  // - 15% apoiam as Baterias & LED (v1.0)
  // - 10% mudam de ideia e removem o apoio (testando footprint sob estresse!)

  for (let i = 0; i < citizens.length; i++) {
    const cit = citizens[i]!;
    cit.seq++;

    if (i % 10 === 0) {
      // Este morador primeiro apoiou Solar, e depois retirou o apoio!
      const pick1 = await packDocument(
        { docType: DocType.PICK, authorPub: cit.pub, seq: cit.seq, blocks: [createPickTargetBlock(docIdSolarBase)] },
        cit.priv
      );
      await engineEnergia.ingestBinaryPacket(pick1);

      // Em seguida emite seq #2 com alvo 0 (remoção deliberada)
      cit.seq++;
      const pick2 = await packDocument(
        { docType: DocType.PICK, authorPub: cit.pub, seq: cit.seq, blocks: [createPickTargetBlock(0)] },
        cit.priv
      );
      await engineEnergia.ingestBinaryPacket(pick2);
    } else if (i % 10 < 6) {
      // Apoio na Síntese Híbrida
      const pick = await packDocument(
        { docType: DocType.PICK, authorPub: cit.pub, seq: cit.seq, blocks: [createPickTargetBlock(docIdSinteseEnergia)] },
        cit.priv
      );
      await engineEnergia.ingestBinaryPacket(pick);
    } else if (i % 10 < 8) {
      // Apoio na Usina Solar Base
      const pick = await packDocument(
        { docType: DocType.PICK, authorPub: cit.pub, seq: cit.seq, blocks: [createPickTargetBlock(docIdSolarBase)] },
        cit.priv
      );
      await engineEnergia.ingestBinaryPacket(pick);
    } else {
      // Apoio nas Baterias
      const pick = await packDocument(
        { docType: DocType.PICK, authorPub: cit.pub, seq: cit.seq, blocks: [createPickTargetBlock(docIdBateriasBase)] },
        cit.priv
      );
      await engineEnergia.ingestBinaryPacket(pick);
    }
  }

  console.log(`✔ Centenas de apoios e footprints processados em ${(performance.now() - tPicks).toFixed(1)}ms`);

  // =========================================================================
  // ASSUNTO 2: bairro/mobilidade-seguranca
  // =========================================================================
  const engineMobilidade = new SubjectStateEngine();
  const subject2Dir = path.join(subjectsOutputDir, "mobilidade-seguranca");
  fs.mkdirSync(subject2Dir, { recursive: true });

  const bruno = citizens[3]!;
  bruno.seq++;
  const propCicloviaBase = await packDocument(
    {
      docType: DocType.PROPOSAL,
      authorPub: bruno.pub,
      seq: 1,
      blocks: [
        createScopeBlock("bairro/mobilidade-seguranca"),
        createTitleBlock("Ciclovia Segura e Lombadas Inteligentes"),
        createLawArticleBlock(1, "Criação de faixa exclusiva para bicicletas na via principal do bairro."),
        createLawArticleBlock(2, "Instalação de 3 faixas elevadas para pedestres com iluminação solar."),
      ],
    },
    bruno.priv
  );
  const docIdCiclovia = calculateDocId(propCicloviaBase);
  await engineMobilidade.ingestBinaryPacket(propCicloviaBase);
  fs.writeFileSync(path.join(subject2Dir, "01_prop_ciclovia.stze"), propCicloviaBase);

  const propCamerasBase = await packDocument(
    {
      docType: DocType.PROPOSAL,
      authorPub: carlos.pub,
      seq: 1,
      blocks: [
        createScopeBlock("bairro/mobilidade-seguranca"),
        createTitleBlock("Totens de Monitoramento e Reconhecimento"),
        createLawArticleBlock(1, "Instalação de totens de segurança com botão de emergência nas esquinas."),
      ],
    },
    carlos.priv
  );
  const docIdCameras = calculateDocId(propCamerasBase);
  await engineMobilidade.ingestBinaryPacket(propCamerasBase);
  fs.writeFileSync(path.join(subject2Dir, "02_prop_cameras.stze"), propCamerasBase);

  // 150 cidadãos votam na Mobilidade
  for (let i = 0; i < 150; i++) {
    const cit = citizens[i]!;
    cit.seq++;
    const target = i % 2 === 0 ? docIdCiclovia : docIdCameras;
    const pickMob = await packDocument(
      { docType: DocType.PICK, authorPub: cit.pub, seq: cit.seq, blocks: [createPickTargetBlock(target)] },
      cit.priv
    );
    await engineMobilidade.ingestBinaryPacket(pickMob);
  }

  // =========================================================================
  // GERAÇÃO DOS ARQUIVOS JSON PARA O DASHBOARD (COM TÍTULO NA LABEL!)
  // =========================================================================
  function formatSubjectPayload(
    id: string,
    name: string,
    scope: string,
    description: string,
    engine: SubjectStateEngine,
    versions: any[],
    edges: any[]
  ) {
    const tally = engine.getTally();

    const nodes = versions.map((v) => {
      const docIdHex = bytesToHex(v.docId);
      const consolidated = engine.resolveConsolidatedProposal(v.docId);
      const votesCount = tally[docIdHex] ?? 0;

      // Lista de apoiadores ativos desta versão
      const activeSupporters = citizens
        .filter((c) => {
          const pick = engine.getActivePick(c.pub);
          return pick && pick.targetKey === docIdHex;
        })
        .map((c) => ({
          name: c.name,
          role: c.role,
          pubHex: c.pubHex,
          seq: engine.getActivePick(c.pub)!.seq,
        }));

      const articlesList = Array.from(consolidated.articles.entries()).map(([num, text]) => ({
        num,
        text,
      }));

      return {
        id: v.nodeId,
        label: v.displayLabel, // TÍTULO COLOCADO NA LABEL DA PÍLULA!
        title: v.fullTitle,
        scope,
        subTitle: `${scope} • por ${v.author.name}`,
        color: v.color,
        count: votesCount,
        fileName: v.fileName,
        filePathRel: `packages/wire/test-output/assuntos/${id}/${v.fileName}`,
        sizeBytes: v.rawBytes.length,
        docTypeName: "PROPOSTA",
        seq: v.seq,
        authorName: v.author.name,
        authorPubHex: v.author.pubHex,
        docIdHex,
        articleText: articlesList.map((a) => `Artigo #${a.num}: ${a.text}`).join("\n"),
        articles: articlesList,
        parentHashes: consolidated.parentHashes.map(bytesToHex),
        activeSupporters,
        hexDumpPreview: makeHexDump(v.rawBytes),
      };
    });

    // Footprints
    const footprints = citizens.slice(0, 50).map((c) => {
      const fp = engine.getPersonFootprint(c.pub);
      return {
        citizen: c.name,
        role: c.role,
        pubHex: c.pubHex,
        history: fp.map((entry) => {
          let targetTitle = "Remoção de Apoio (Neutro)";
          if (entry.targetKey !== "0") {
            const foundNode = nodes.find((n) => n.docIdHex === entry.targetKey);
            targetTitle = foundNode ? foundNode.title : `Proposta [${entry.targetKey.slice(0, 8)}...]`;
          }

          return {
            seq: entry.seq,
            targetKey: entry.targetKey,
            targetTitle,
            isWithdrawal: entry.targetKey === "0",
            docIdHex: bytesToHex(entry.docId),
          };
        }),
      };
    });

    return {
      id,
      name,
      scope,
      description,
      rootNodeId: "inicio",
      totalVotes: Object.values(tally).reduce((a, b) => a + b, 0),
      merkleRootHex: bytesToHex(engine.calculateActivePicksMerkleRoot()),
      nodes: [
        {
          id: "inicio",
          label: "Início",
          title: "Gênese do Assunto",
          scope,
          subTitle: "Ponto inicial de convergência deste assunto",
          color: "blue",
          count: 0,
          fileName: "inicio_genese.stze",
          filePathRel: `packages/wire/test-output/assuntos/${id}/inicio.stze`,
          sizeBytes: 0,
          docTypeName: "GÊNESE",
          seq: 0,
          authorName: "Protocolo Sintetize",
          authorPubHex: "0000000000000000000000000000000000000000000000000000000000000000",
          articleText: "Tronco principal de consenso da comunidade.",
          articles: [{ num: 0, text: "Abertura oficial do assunto na comunidade." }],
          parentHashes: [],
          activeSupporters: [],
          hexDumpPreview: "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  |................|\n",
        },
        ...nodes,
      ],
      edges,
      footprints,
    };
  }

  const subject1Payload = formatSubjectPayload(
    "energia-sustentavel",
    "Energia Sustentável e Backup Solar",
    "condominio/energia-sustentavel",
    "Deliberação sobre usina solar, baterias e síntese híbrida consolidada.",
    engineEnergia,
    [
      {
        nodeId: "prop-solar-v1",
        displayLabel: "Usina Solar Central", // TÍTULO NA LABEL!
        fullTitle: "Versão 1.0: Usina Solar Central (50 placas)",
        color: "purple",
        docId: docIdSolarBase,
        rawBytes: propSolarBase,
        fileName: "01_prop_solar_base.stze",
        author: ana,
        seq: 1,
      },
      {
        nodeId: "prop-baterias-v1",
        displayLabel: "Baterias & LED", // TÍTULO NA LABEL!
        fullTitle: "Versão 1.0: Baterias de Backup e Iluminação LED",
        color: "purple",
        docId: docIdBateriasBase,
        rawBytes: propBateriasBase,
        fileName: "02_prop_baterias_base.stze",
        author: carlos,
        seq: 1,
      },
      {
        nodeId: "prop-solar-emenda",
        displayLabel: "Emenda 80 Placas", // TÍTULO NA LABEL!
        fullTitle: "Versão 1.1: Emenda com 80 Placas nos Blocos A e B",
        color: "orange",
        docId: docIdSolarEmenda,
        rawBytes: propSolarEmenda,
        fileName: "03_prop_solar_emenda.stze",
        author: daniela,
        seq: 1,
      },
      {
        nodeId: "prop-sintese-v2",
        displayLabel: "Síntese Híbrida", // TÍTULO NA LABEL!
        fullTitle: "Versão 2.0 (Síntese): Usina Híbrida Solar + Bateria",
        color: "green",
        docId: docIdSinteseEnergia,
        rawBytes: propSinteseEnergia,
        fileName: "04_prop_sintese_hibrida.stze",
        author: ana,
        seq: 1,
      },
    ],
    [
      { from: "inicio", to: "prop-solar-v1", side: "left" },
      { from: "prop-solar-v1", to: "prop-solar-emenda", side: "left" },
      { from: "prop-solar-emenda", to: "prop-sintese-v2", side: "left" },

      { from: "inicio", to: "prop-baterias-v1", side: "right" },
      { from: "prop-baterias-v1", to: "prop-sintese-v2", side: "right" },
    ]
  );

  const subject2Payload = formatSubjectPayload(
    "mobilidade-seguranca",
    "Mobilidade e Segurança Viária",
    "bairro/mobilidade-seguranca",
    "Ciclovia exclusiva e totens de monitoramento comunitário.",
    engineMobilidade,
    [
      {
        nodeId: "prop-ciclovia",
        displayLabel: "Ciclovia Segura", // TÍTULO NA LABEL!
        fullTitle: "Versão 1.0: Ciclovia Segura e Lombadas Inteligentes",
        color: "purple",
        docId: docIdCiclovia,
        rawBytes: propCicloviaBase,
        fileName: "01_prop_ciclovia.stze",
        author: bruno,
        seq: 1,
      },
      {
        nodeId: "prop-cameras",
        displayLabel: "Totens & Câmeras", // TÍTULO NA LABEL!
        fullTitle: "Versão 1.0: Totens de Monitoramento e Reconhecimento",
        color: "orange",
        docId: docIdCameras,
        rawBytes: propCamerasBase,
        fileName: "02_prop_cameras.stze",
        author: carlos,
        seq: 1,
      },
    ],
    [
      { from: "inicio", to: "prop-ciclovia", side: "left" },
      { from: "inicio", to: "prop-cameras", side: "right" },
    ]
  );

  const catalog = [
    {
      id: "energia-sustentavel",
      name: "Energia Sustentável e Backup Solar",
      scope: "condominio/energia-sustentavel",
      versionsCount: 4,
      totalVotes: subject1Payload.totalVotes,
      description: "Deliberação com 350 moradores votando em usina solar, baterias e síntese.",
    },
    {
      id: "mobilidade-seguranca",
      name: "Mobilidade e Segurança Viária",
      scope: "bairro/mobilidade-seguranca",
      versionsCount: 2,
      totalVotes: subject2Payload.totalVotes,
      description: "Deliberação com 150 moradores para ciclovias e totens de monitoramento.",
    },
  ];

  fs.writeFileSync(path.join(testOutputDir, "assuntos_catalogo.json"), JSON.stringify(catalog, null, 2), "utf-8");
  fs.writeFileSync(path.join(testOutputDir, "assunto_energia_sustentavel.json"), JSON.stringify(subject1Payload, null, 2), "utf-8");
  fs.writeFileSync(path.join(testOutputDir, "assunto_mobilidade_seguranca.json"), JSON.stringify(subject2Payload, null, 2), "utf-8");

  console.log(`\n📊 Placar de Apoios Consolidado (Energia Sustentável):`);
  console.log(`   • Síntese Híbrida:       ${subject1Payload.nodes.find((n) => n.id === "prop-sintese-v2")?.count} apoios`);
  console.log(`   • Usina Solar Central:   ${subject1Payload.nodes.find((n) => n.id === "prop-solar-v1")?.count} apoios`);
  console.log(`   • Baterias & LED:        ${subject1Payload.nodes.find((n) => n.id === "prop-baterias-v1")?.count} apoios`);
  console.log(`   • Total de Apoios Ativos: ${subject1Payload.totalVotes}`);
  console.log(`   • Raiz Merkle (32B):      ${subject1Payload.merkleRootHex}\n`);
}

buildLargeScaleSubjectsData(350).catch((err) => {
  console.error("Erro na geração de assuntos de larga escala:", err);
  process.exit(1);
});
