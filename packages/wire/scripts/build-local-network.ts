import * as fs from "node:fs";
import * as path from "node:path";
import * as ed25519 from "@noble/ed25519";
import { bytesToHex } from "@noble/hashes/utils";
import {
  calculateDocId,
  calculateMerkleRoot,
  createLawArticleBlock,
  createPickTargetBlock,
  createScopeBlock,
  createTitleBlock,
  DocType,
  packDocument,
  SubjectStateEngine,
} from "../src/index.js";

// Diretório de saída de testes isolado em packages/wire/test-output/ (ignorado pelo git)
const wireDir = path.resolve(import.meta.dirname, "..");
const testOutputDir = path.resolve(wireDir, "test-output");
const networkDir = path.resolve(testOutputDir, "rede-local");

async function makeKeys(name: string) {
  const priv = ed25519.utils.randomPrivateKey();
  const pub = await ed25519.getPublicKeyAsync(priv);
  return {
    name,
    priv,
    privHex: bytesToHex(priv),
    pub,
    pubHex: bytesToHex(pub),
  };
}

async function createLocalNetworkEnvironment() {
  console.log(`\n\x1b[1m\x1b[36m╔═══════════════════════════════════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m║  SINTETIZE PROTOCOL - MATERIALIZANDO REDE LOCAL FÍSICA NO DISCO                   ║\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m║  Criando pastas, arquivos binários .stze, identidades e estados individuais        ║\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m╚═══════════════════════════════════════════════════════════════════════════════════╝\x1b[0m\n`);

  // Limpa diretório anterior se existir para criar tudo limpo e palpável
  if (fs.existsSync(networkDir)) {
    fs.rmSync(networkDir, { recursive: true, force: true });
  }
  fs.mkdirSync(networkDir, { recursive: true });

  // 1. GERAÇÃO DE IDENTIDADES CRIPTOGRÁFICAS
  const vpsSPKeys = await makeKeys("VPS São Paulo (Relay Central)");
  const vpsRJKeys = await makeKeys("VPS Rio de Janeiro (Relay Backup)");

  const anaKeys = await makeKeys("Ana Silva");
  const brunoKeys = await makeKeys("Bruno Souza");
  const carlosKeys = await makeKeys("Carlos Oliveira");
  const eduardoKeys = await makeKeys("Eduardo Lima");

  // Estrutura de pastas para cada participante
  const nodes = [
    { id: "vps-sao-paulo", type: "VPS_RELAY", keys: vpsSPKeys, addr: "p2p://sp.vps.sintetize.net:443" },
    { id: "vps-rio-de-janeiro", type: "VPS_RELAY", keys: vpsRJKeys, addr: "p2p://rj.vps.sintetize.net:443" },
    { id: "celular-ana", type: "MOBILE_CITIZEN", keys: anaKeys, addr: "device://ana-phone@192.168.1.101:7770" },
    { id: "celular-bruno", type: "MOBILE_CITIZEN", keys: brunoKeys, addr: "device://bruno-phone@192.168.1.102:7770" },
    { id: "celular-carlos", type: "MOBILE_CITIZEN", keys: carlosKeys, addr: "device://carlos-phone@192.168.1.103:7770" },
    { id: "celular-eduardo", type: "MOBILE_CITIZEN", keys: eduardoKeys, addr: "device://eduardo-phone@10.0.4.88:7770" },
  ];

  for (const n of nodes) {
    const nodePath = path.join(networkDir, n.id);
    const packetsPath = path.join(nodePath, "pacotes_stze");
    fs.mkdirSync(packetsPath, { recursive: true });

    // Grava identidade criptográfica física
    const identData = {
      nome: n.keys.name,
      tipo_no: n.type,
      endereco_rede: n.addr,
      chave_publica_ed25519_hex: n.keys.pubHex,
      chave_privada_ed25519_hex: n.keys.privHex,
      descricao: "Chave criptográfica soberana. Usada para assinar e verificar pacotes binários .stze.",
    };
    fs.writeFileSync(path.join(nodePath, "identidade.json"), JSON.stringify(identData, null, 2), "utf-8");
  }

  console.log(`📁 Pastas de máquinas e identidades criadas em:\n   \x1b[32m${networkDir}\x1b[0m\n`);

  // =========================================================================
  // 2. CRIAÇÃO DOS PACOTES BINÁRIOS REAIS (.stze) NO DISCO
  // =========================================================================

  // PROPOSTA A (Ana)
  const propAPacket = await packDocument(
    {
      docType: DocType.PROPOSAL,
      authorPub: anaKeys.pub,
      seq: 1,
      blocks: [
        createScopeBlock("condominio/jardins/energia"),
        createTitleBlock("Proposta A: Usina Solar Central no Telhado"),
        createLawArticleBlock(1, "Instalação de 50 placas fotovoltaicas no Bloco Central."),
        createLawArticleBlock(2, "Rateio igualitário do abatimento na fatura entre as unidades."),
      ],
    },
    anaKeys.priv
  );
  const propADocId = calculateDocId(propAPacket);
  const propADocIdHex = bytesToHex(propADocId);

  // PROPOSTA B (Carlos)
  const propBPacket = await packDocument(
    {
      docType: DocType.PROPOSAL,
      authorPub: carlosKeys.pub,
      seq: 1,
      blocks: [
        createScopeBlock("condominio/jardins/energia"),
        createTitleBlock("Proposta B: Baterias de Backup e Iluminação LED"),
        createLawArticleBlock(1, "Instalação de no-break central para manter portaria e elevadores ativos."),
      ],
    },
    carlosKeys.priv
  );
  const propBDocId = calculateDocId(propBPacket);
  const propBDocIdHex = bytesToHex(propBDocId);

  // APOIO DA ANA NA PROPOSTA A
  const pickAna = await packDocument(
    {
      docType: DocType.PICK,
      authorPub: anaKeys.pub,
      seq: 2,
      blocks: [createPickTargetBlock(propADocId)],
    },
    anaKeys.priv
  );

  // APOIO DO CARLOS NA PROPOSTA B
  const pickCarlos = await packDocument(
    {
      docType: DocType.PICK,
      authorPub: carlosKeys.pub,
      seq: 2,
      blocks: [createPickTargetBlock(propBDocId)],
    },
    carlosKeys.priv
  );

  // BRUNO APOIA PROPOSTA A (SEQ 1)
  const pickBrunoA = await packDocument(
    {
      docType: DocType.PICK,
      authorPub: brunoKeys.pub,
      seq: 1,
      blocks: [createPickTargetBlock(propADocId)],
    },
    brunoKeys.priv
  );

  // BRUNO MUDA DE IDEIA E RETIRA O APOIO (SEQ 2, ALVO 0)
  const pickBrunoRetira = await packDocument(
    {
      docType: DocType.PICK,
      authorPub: brunoKeys.pub,
      seq: 2,
      blocks: [createPickTargetBlock(0)],
    },
    brunoKeys.priv
  );

  // EDUARDO APOIA PROPOSTA B OFFLINE NO ELEVADOR
  const pickEduardoOffline = await packDocument(
    {
      docType: DocType.PICK,
      authorPub: eduardoKeys.pub,
      seq: 1,
      blocks: [createPickTargetBlock(propBDocId)],
    },
    eduardoKeys.priv
  );

  // =========================================================================
  // 3. DISTRIBUIÇÃO DOS ARQUIVOS BINÁRIOS NAS PASTAS DE CADA MÁQUINA
  // =========================================================================

  // No Celular da Ana:
  fs.writeFileSync(path.join(networkDir, "celular-ana/pacotes_stze/01_minha_proposta_solar.stze"), propAPacket);
  fs.writeFileSync(path.join(networkDir, "celular-ana/pacotes_stze/02_meu_apoio_proposta_solar.stze"), pickAna);

  // No Celular do Carlos:
  fs.writeFileSync(path.join(networkDir, "celular-carlos/pacotes_stze/01_minha_proposta_baterias.stze"), propBPacket);
  fs.writeFileSync(path.join(networkDir, "celular-carlos/pacotes_stze/02_meu_apoio_baterias.stze"), pickCarlos);

  // No Celular do Bruno (com histórico visível nos arquivos!):
  fs.writeFileSync(path.join(networkDir, "celular-bruno/pacotes_stze/01_proposta_solar_recebida.stze"), propAPacket);
  fs.writeFileSync(path.join(networkDir, "celular-bruno/pacotes_stze/02_meu_primeiro_apoio_solar.stze"), pickBrunoA);
  fs.writeFileSync(path.join(networkDir, "celular-bruno/pacotes_stze/03_minha_remocao_de_apoio.stze"), pickBrunoRetira);

  // No Celular do Eduardo (armazenado offline no elevador):
  fs.writeFileSync(path.join(networkDir, "celular-eduardo/pacotes_stze/01_proposta_baterias_recebida.stze"), propBPacket);
  fs.writeFileSync(path.join(networkDir, "celular-eduardo/pacotes_stze/02_meu_apoio_retido_offline.stze"), pickEduardoOffline);

  // Na VPS São Paulo (todos os pacotes públicos consolidados):
  const vpsSPPackets = [propAPacket, propBPacket, pickAna, pickCarlos, pickBrunoA, pickBrunoRetira, pickEduardoOffline];
  const fileNames = [
    "01_proposta_solar_ana.stze",
    "02_proposta_baterias_carlos.stze",
    "03_apoio_ana_solar.stze",
    "04_apoio_carlos_baterias.stze",
    "05_apoio_antigo_bruno_solar.stze",
    "06_remocao_apoio_bruno.stze",
    "07_apoio_eduardo_sincronizado.stze",
  ];

  for (let i = 0; i < vpsSPPackets.length; i++) {
    fs.writeFileSync(path.join(networkDir, "vps-sao-paulo/pacotes_stze", fileNames[i]), vpsSPPackets[i]);
    fs.writeFileSync(path.join(networkDir, "vps-rio-de-janeiro/pacotes_stze", fileNames[i]), vpsSPPackets[i]);
  }

  // =========================================================================
  // 4. PROCESSA O ESTADO LOCAL DE CADA NÓ E GRAVA OS ARQUIVOS JSON DE ESTADO
  // =========================================================================
  const engineSP = new SubjectStateEngine();
  for (const pkt of vpsSPPackets) {
    await engineSP.ingestBinaryPacket(pkt);
  }

  const canonMerkleRoot = calculateMerkleRoot(vpsSPPackets);
  const canonMerkleRootHex = bytesToHex(canonMerkleRoot);

  const vpsState = {
    nome_servidor: "VPS São Paulo (Relay Neutro)",
    status_conexao: "ONLINE",
    total_pacotes_stze_armazenados: vpsSPPackets.length,
    placar_apoios_propostas: {
      "Proposta A (Usina Solar)": engineSP.getTally()[propADocIdHex] ?? 0,
      "Proposta B (Baterias Backup)": engineSP.getTally()[propBDocIdHex] ?? 0,
    },
    nota_sobre_bruno: "Bruno Souza retirou o apoio no seq 2. O apoio dele foi removido do placar da Proposta A (caiu para 1).",
    raiz_merkle_canonica_32_bytes_sha256: canonMerkleRootHex,
  };

  fs.writeFileSync(
    path.join(networkDir, "vps-sao-paulo/estado_consenso.json"),
    JSON.stringify(vpsState, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(networkDir, "vps-rio-de-janeiro/estado_consenso.json"),
    JSON.stringify({ ...vpsState, nome_servidor: "VPS Rio de Janeiro (Backup)" }, null, 2),
    "utf-8"
  );

  // Grava o Footprint auditável na pasta do Bruno
  const brunoFootprint = engineSP.getPersonFootprint(brunoKeys.pub);
  const brunoFootprintFile = {
    proprietario: "Bruno Souza",
    chave_publica_hex: brunoKeys.pubHex,
    total_acoes_registradas: brunoFootprint.length,
    historico_imutavel: [
      {
        seq: 1,
        acao: "APOIOU_PROPOSTA_A",
        alvo_hash_hex: propADocIdHex,
        doc_id_hex: bytesToHex(brunoFootprint[0].docId),
        arquivo_correspondente: "pacotes_stze/02_meu_primeiro_apoio_solar.stze",
        explicacao: "Bruno assinou apoio para a Proposta A.",
      },
      {
        seq: 2,
        acao: "REMOÇÃO_DE_APOIO",
        alvo_hash_hex: "0",
        doc_id_hex: bytesToHex(brunoFootprint[1].docId),
        arquivo_correspondente: "pacotes_stze/03_minha_remocao_de_apoio.stze",
        explicacao: "Bruno retirou o apoio. O placar ativo foi decrementado, mas este pacote comprova a mudança de posição sem apagar o passado.",
      },
    ],
  };
  fs.writeFileSync(
    path.join(networkDir, "celular-bruno/meu_footprint.json"),
    JSON.stringify(brunoFootprintFile, null, 2),
    "utf-8"
  );

  // =========================================================================
  // 5. GERAÇÃO DA ÁRVORE FRACTAL COM OS DOCUMENTOS REAIS DOS TESTES (.stze)
  // =========================================================================
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

  const treeGraphData = {
    rootNodeId: "inicio",
    nodes: [
      {
        id: "inicio",
        label: "Início",
        scope: "rede-local/genese",
        subTitle: "Gênese do Consenso Comunitário",
        color: "blue",
        count: 0,
        fileName: "inicio_rede.stze",
        filePathRel: "packages/wire/test-output/rede-local/vps-sao-paulo/estado_consenso.json",
        docIdHex: "genesis-0000000000000000000000000000000000000000000000000000000000000000",
        sizeBytes: 0,
        docTypeName: "GÊNESE",
        seq: 0,
        authorName: "Protocolo Sintetize",
        authorPubHex: "0000000000000000000000000000000000000000000000000000000000000000",
        articleText: "Tronco principal de consenso da comunidade local.",
        hexDumpPreview: "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  |................|\n",
      },
      // Ramo Esquerdo: Proposta Solar (01)
      {
        id: "prop-solar",
        label: "gov/energia-so...",
        scope: "condominio/jardins/energia",
        subTitle: "feat(solar): Usina Solar Central no Telhado",
        color: "purple",
        count: 1, // 1 apoio ativo
        fileName: "01_proposta_solar_ana.stze",
        filePathRel: "packages/wire/test-output/rede-local/vps-sao-paulo/pacotes_stze/01_proposta_solar_ana.stze",
        sizeBytes: propAPacket.length,
        docTypeName: "PROPOSTA",
        seq: 1,
        authorName: "Ana Silva",
        authorPubHex: anaKeys.pubHex,
        docIdHex: propADocIdHex,
        articleText: "Artigo 1: Instalação de 50 placas fotovoltaicas no Bloco Central.",
        hexDumpPreview: makeHexDump(propAPacket),
      },
      {
        id: "apoio-ana",
        label: "gov/apoio-ana...",
        scope: "apoio/ana-silva",
        subTitle: "feat(apoio): Ana apoia Proposta Solar (seq #2)",
        color: "orange",
        count: 1,
        fileName: "03_apoio_ana_solar.stze",
        filePathRel: "packages/wire/test-output/rede-local/vps-sao-paulo/pacotes_stze/03_apoio_ana_solar.stze",
        sizeBytes: pickAna.length,
        docTypeName: "PICK / APOIO",
        seq: 2,
        authorName: "Ana Silva",
        authorPubHex: anaKeys.pubHex,
        docIdHex: bytesToHex(calculateDocId(pickAna)),
        articleText: `Apoio confirmado à Proposta Solar [${propADocIdHex.slice(0, 12)}...]`,
        hexDumpPreview: makeHexDump(pickAna),
      },
      {
        id: "apoio-bruno-antigo",
        label: "gov/apoio-bru...",
        scope: "apoio/bruno-souza",
        subTitle: "feat(apoio): Bruno apoiou Solar (seq #1)",
        color: "orange",
        count: 1,
        fileName: "05_apoio_antigo_bruno_solar.stze",
        filePathRel: "packages/wire/test-output/rede-local/vps-sao-paulo/pacotes_stze/05_apoio_antigo_bruno_solar.stze",
        sizeBytes: pickBrunoA.length,
        docTypeName: "PICK / APOIO",
        seq: 1,
        authorName: "Bruno Souza",
        authorPubHex: brunoKeys.pubHex,
        docIdHex: bytesToHex(calculateDocId(pickBrunoA)),
        articleText: `Apoio antigo à Proposta Solar [${propADocIdHex.slice(0, 12)}...]`,
        hexDumpPreview: makeHexDump(pickBrunoA),
      },
      {
        id: "remocao-bruno",
        label: "gov/remocao-b...",
        scope: "remocao/bruno-souza",
        subTitle: "feat(remocao): Bruno retira apoio (alvo: 0, seq #2)",
        color: "green",
        count: 0,
        fileName: "06_remocao_apoio_bruno.stze",
        filePathRel: "packages/wire/test-output/rede-local/vps-sao-paulo/pacotes_stze/06_remocao_apoio_bruno.stze",
        sizeBytes: pickBrunoRetira.length,
        docTypeName: "PICK / REMOÇÃO",
        seq: 2,
        authorName: "Bruno Souza",
        authorPubHex: brunoKeys.pubHex,
        docIdHex: bytesToHex(calculateDocId(pickBrunoRetira)),
        articleText: "Remoção deliberada de apoio (Alvo: 0). O apoio saiu do placar mas o footprint gravou a mudança.",
        hexDumpPreview: makeHexDump(pickBrunoRetira),
      },
      // Ramo Direito: Proposta Baterias (02)
      {
        id: "prop-baterias",
        label: "gov/baterias...",
        scope: "condominio/jardins/energia",
        subTitle: "feat(baterias): Backup & Iluminação LED",
        color: "purple",
        count: 2, // 2 apoios ativos
        fileName: "02_proposta_baterias_carlos.stze",
        filePathRel: "packages/wire/test-output/rede-local/vps-sao-paulo/pacotes_stze/02_proposta_baterias_carlos.stze",
        sizeBytes: propBPacket.length,
        docTypeName: "PROPOSTA",
        seq: 1,
        authorName: "Carlos Oliveira",
        authorPubHex: carlosKeys.pubHex,
        docIdHex: propBDocIdHex,
        articleText: "Artigo 1: Instalação de no-break central para manter portaria e elevadores ativos.",
        hexDumpPreview: makeHexDump(propBPacket),
      },
      {
        id: "apoio-carlos",
        label: "gov/apoio-car...",
        scope: "apoio/carlos-oliveira",
        subTitle: "feat(apoio): Carlos apoia Baterias (seq #2)",
        color: "orange",
        count: 1,
        fileName: "04_apoio_carlos_baterias.stze",
        filePathRel: "packages/wire/test-output/rede-local/vps-sao-paulo/pacotes_stze/04_apoio_carlos_baterias.stze",
        sizeBytes: pickCarlos.length,
        docTypeName: "PICK / APOIO",
        seq: 2,
        authorName: "Carlos Oliveira",
        authorPubHex: carlosKeys.pubHex,
        docIdHex: bytesToHex(calculateDocId(pickCarlos)),
        articleText: `Apoio confirmado à Proposta Baterias [${propBDocIdHex.slice(0, 12)}...]`,
        hexDumpPreview: makeHexDump(pickCarlos),
      },
      {
        id: "apoio-eduardo",
        label: "gov/apoio-edu...",
        scope: "apoio/eduardo-lima",
        subTitle: "feat(offline): Apoio do elevador sincronizado (seq #1)",
        color: "orange",
        count: 1,
        fileName: "07_apoio_eduardo_sincronizado.stze",
        filePathRel: "packages/wire/test-output/rede-local/vps-sao-paulo/pacotes_stze/07_apoio_eduardo_sincronizado.stze",
        sizeBytes: pickEduardoOffline.length,
        docTypeName: "PICK / APOIO (OFFLINE)",
        seq: 1,
        authorName: "Eduardo Lima",
        authorPubHex: eduardoKeys.pubHex,
        docIdHex: bytesToHex(calculateDocId(pickEduardoOffline)),
        articleText: `Apoio emitido no elevador (offline) e sincronizado pós-queda [${propBDocIdHex.slice(0, 12)}...]`,
        hexDumpPreview: makeHexDump(pickEduardoOffline),
      },
    ],
    edges: [
      { from: "inicio", to: "prop-solar", side: "left" },
      { from: "prop-solar", to: "apoio-ana", side: "left" },
      { from: "prop-solar", to: "apoio-bruno-antigo", side: "left" },
      { from: "apoio-bruno-antigo", to: "remocao-bruno", side: "left" },

      { from: "inicio", to: "prop-baterias", side: "right" },
      { from: "prop-baterias", to: "apoio-carlos", side: "right" },
      { from: "prop-baterias", to: "apoio-eduardo", side: "right" },
    ],
  };

  fs.writeFileSync(
    path.join(testOutputDir, "arvore_grafo.json"),
    JSON.stringify(treeGraphData, null, 2),
    "utf-8"
  );

  // README orientativo na pasta rede-local
  const readmeContent = `# Rede Local Física do Sintetize Protocol

Esta pasta contém a representação física de cada máquina da malha P2P no seu computador.
Você pode abrir e inspecionar cada pasta e arquivo diretamente pelo editor ou terminal!

## Estrutura Criada:

- ☁️ \`vps-sao-paulo/\`: Servidor central de revezamento.
  - \`identidade.json\`: Chaves criptográficas do servidor.
  - \`estado_consenso.json\`: Placar consolidado e Raiz Merkle de 32 bytes.
  - \`pacotes_stze/\`: Todos os pacotes binários reais (.stze) recebidos da rede.
- ☁️ \`vps-rio-de-janeiro/\`: Servidor secundário espelhado.
- 📱 \`celular-ana/\`: Aparelho da criadora da Proposta A (Solar).
- 📱 \`celular-carlos/\`: Aparelho do criador da Proposta B (Baterias).
- 📱 \`celular-bruno/\`: Aparelho do morador que apoiou e depois retirou o apoio.
  - \`meu_footprint.json\`: Histórico sequencial auditável das decisões do Bruno.
- 📱 \`celular-eduardo/\`: Aparelho que esteve offline no elevador.
  - \`02_meu_apoio_retido_offline.stze\`: Pacote binário retido localmente no 4G instável.

## Como Inspecionar Qualquer Pacote .stze:

Execute no terminal:
\`\`\`bash
pnpm inspecionar rede-local/celular-bruno/pacotes_stze/03_minha_remocao_de_apoio.stze
\`\`\`
`;
  fs.writeFileSync(path.join(networkDir, "README.md"), readmeContent, "utf-8");

  console.log(`\x1b[1m\x1b[32m✔ REDE MATERIALIZADA COM SUCESSO EM WIRE!\x1b[0m\n`);
  console.log(`Todos os arquivos foram salvos na pasta isolada (ignorada pelo git):`);
  console.log(`  📂 \x1b[36mpackages/wire/test-output/rede-local/\x1b[0m\n`);
  console.log(`Pastas criadas:`);
  console.log(`  📂 packages/wire/test-output/rede-local/vps-sao-paulo/       (7 pacotes .stze + estado_consenso.json)`);
  console.log(`  📂 packages/wire/test-output/rede-local/vps-rio-de-janeiro/   (7 pacotes .stze + estado_consenso.json)`);
  console.log(`  📂 packages/wire/test-output/rede-local/celular-ana/          (chave de Ana + proposta solar .stze)`);
  console.log(`  📂 packages/wire/test-output/rede-local/celular-carlos/       (chave de Carlos + proposta baterias .stze)`);
  console.log(`  📂 packages/wire/test-output/rede-local/celular-bruno/        (meu_footprint.json + pacotes de apoio e remoção)`);
  console.log(`  📂 packages/wire/test-output/rede-local/celular-eduardo/      (pacote retido offline no elevador)`);
  console.log(`\nPara inspecionar qualquer pacote binário .stze:`);
  console.log(`  \x1b[1m\x1b[33mpnpm inspecionar packages/wire/test-output/rede-local/celular-bruno/pacotes_stze/03_minha_remocao_de_apoio.stze\x1b[0m\n`);
}

createLocalNetworkEnvironment().catch((err) => {
  console.error("Erro ao gerar ambiente de rede:", err);
  process.exit(1);
});
