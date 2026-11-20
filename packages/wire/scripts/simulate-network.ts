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
  generateMerkleProof,
  NodePeer,
  packDocument,
  verifyMerkleProof,
} from "../src/index.js";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  bgCyan: "\x1b[46m\x1b[30m",
  bgGreen: "\x1b[42m\x1b[30m",
};

const isFast = process.argv.includes("--fast") || process.argv.includes("--instant");
const delay = (ms: number) => (isFast ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

interface CitizenActor {
  name: string;
  role: string;
  networkAddress: string;
  node: NodePeer;
  priv: Uint8Array;
  pub: Uint8Array;
  pubHex: string;
  seq: number;
}

interface ServerActor {
  name: string;
  location: string;
  networkAddress: string;
  node: NodePeer;
  online: boolean;
}

interface SimulationTelemetry {
  timestamp: string;
  nodesTotal: number;
  packetsTotal: number;
  totalBytesWire: number;
  merkleRootConsensusHex: string;
  consensusMatchesAllNodes: boolean;
  proposalsTally: Record<string, number>;
  nodesStatus: Array<{
    id: string;
    type: string;
    networkAddress: string;
    packetCount: number;
    proposalsSupportedTally: Record<string, number>;
    merkleRootHex: string;
  }>;
  citizensFootprints: Array<{
    citizen: string;
    pubHex: string;
    history: Array<{ seq: number; action: string; target: string; docIdHex: string }>;
  }>;
  disasterRecoveryVerified: boolean;
}

async function makeKeyPair() {
  const priv = ed25519.utils.randomPrivateKey();
  const pub = await ed25519.getPublicKeyAsync(priv);
  return { priv, pub, pubHex: bytesToHex(pub) };
}

function printHeader(title: string, subtitle?: string) {
  console.log(`\n${c.bold}${c.cyan}╔═════════════════════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║  ${title.padEnd(87)}║${c.reset}`);
  if (subtitle) {
    console.log(`${c.bold}${c.cyan}║  ${c.dim}${subtitle.padEnd(87)}${c.reset}${c.bold}${c.cyan}║${c.reset}`);
  }
  console.log(`${c.bold}${c.cyan}╚═════════════════════════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);
}

function printStep(stepNum: number, title: string, desc: string) {
  console.log(`\n${c.bold}${c.yellow}▶ TESTE ${stepNum}: ${title.toUpperCase()}${c.reset}`);
  console.log(`${c.dim}  ${desc}${c.reset}\n`);
}

async function runSimulation() {
  let totalBytesWire = 0;

  printHeader(
    "SINTETIZE PROTOCOL - TESTE DE REDE P2P E CONSENSO DINÂMICO",
    "Sem votos 'sim/não': Apoio dinâmico a propostas, remoção de apoio com footprint e failover P2P"
  );

  // =========================================================================
  // TESTE 1: INICIALIZAÇÃO E IDENTIFICAÇÃO DE MÁQUINAS E ENDEREÇOS
  // =========================================================================
  printStep(1, "Topologia das Máquinas e Endereços de Rede", "Endereçamento de VPSs neutras e celulares de moradores com chaves Ed25519");

  const vpsServers: ServerActor[] = [
    {
      name: "vps-sp-central",
      location: "São Paulo DC-1",
      networkAddress: "p2p://sp.vps.sintetize.net:443",
      node: new NodePeer("vps-sp-central", "VPS_RELAY_AI"),
      online: true,
    },
    {
      name: "vps-rj-backup",
      location: "Rio de Janeiro DC-2",
      networkAddress: "p2p://rj.vps.sintetize.net:443",
      node: new NodePeer("vps-rj-backup", "VPS_RELAY_AI"),
      online: true,
    },
  ];

  const citizenMetadata = [
    { name: "Ana Silva", role: "Moradora Bloco A", address: "device://ana-phone@192.168.1.101:7770" },
    { name: "Bruno Souza", role: "Morador Bloco A", address: "device://bruno-phone@192.168.1.102:7770" },
    { name: "Carlos Oliveira", role: "Morador Bloco B", address: "device://carlos-phone@192.168.1.103:7770" },
    { name: "Daniela Santos", role: "Moradora Bloco B", address: "device://daniela-phone@192.168.1.104:7770" },
    { name: "Eduardo Lima", role: "Morador Bloco C (4G Instável)", address: "device://eduardo-phone@10.0.4.88:7770" },
    { name: "Fernanda Costa", role: "Moradora Bloco C", address: "device://fernanda-phone@192.168.1.105:7770" },
  ];

  const citizens: CitizenActor[] = [];
  for (const m of citizenMetadata) {
    const keys = await makeKeyPair();
    citizens.push({
      name: m.name,
      role: m.role,
      networkAddress: m.address,
      node: new NodePeer(`phone-${m.name.toLowerCase().replace(/ /g, "-")}`, "MOBILE_CITIZEN"),
      priv: keys.priv,
      pub: keys.pub,
      pubHex: keys.pubHex,
      seq: 0,
    });
  }

  console.log(`${c.bold}Máquinas VPS (Nós Neutros de Revezamento):${c.reset}`);
  for (const s of vpsServers) {
    console.log(
      `  ☁️  ${c.cyan}${s.name.padEnd(16)}${c.reset} | Endereço: ${c.bold}${s.networkAddress.padEnd(34)}${c.reset} | Local: ${s.location}`
    );
  }

  console.log(`\n${c.bold}Dispositivos Móveis (Identidades Soberanas Ed25519):${c.reset}`);
  for (const cit of citizens) {
    console.log(
      `  📱 ${c.green}${cit.name.padEnd(16)}${c.reset} | Endereço: ${cit.networkAddress.padEnd(38)} | Chave Pub: ${c.dim}${cit.pubHex.slice(0, 16)}...${c.reset}`
    );
  }

  await delay(600);

  // =========================================================================
  // TESTE 2: CRIAÇÃO DE DUAS PROPOSTAS EM CONCORRÊNCIA
  // =========================================================================
  printStep(2, "Publicação de Propostas Concorrentes", "Moradores criam duas alternativas de projeto para o condomínio");

  const ana = citizens[0];
  ana.seq++;
  const propAPacket = await packDocument(
    {
      docType: DocType.PROPOSAL,
      authorPub: ana.pub,
      seq: ana.seq,
      blocks: [
        createScopeBlock("condominio/jardins/energia"),
        createTitleBlock("Proposta A: Usina Solar Central no Telhado"),
        createLawArticleBlock(1, "Instalação de 50 painéis solares para alimentar as áreas comuns."),
      ],
    },
    ana.priv
  );
  const propADocId = calculateDocId(propAPacket);
  const propADocIdHex = bytesToHex(propADocId);
  totalBytesWire += propAPacket.length;

  const carlos = citizens[2];
  carlos.seq++;
  const propBPacket = await packDocument(
    {
      docType: DocType.PROPOSAL,
      authorPub: carlos.pub,
      seq: carlos.seq,
      blocks: [
        createScopeBlock("condominio/jardins/energia"),
        createTitleBlock("Proposta B: Baterias de Backup e Eficiência LED"),
        createLawArticleBlock(1, "Modernização do cabeamento e bateria central para apagões."),
      ],
    },
    carlos.priv
  );
  const propBDocId = calculateDocId(propBPacket);
  const propBDocIdHex = bytesToHex(propBDocId);
  totalBytesWire += propBPacket.length;

  console.log(`  📜 ${c.bold}Proposta A${c.reset} publicada por ${ana.name}:`);
  console.log(`     - Título: "Usina Solar Central no Telhado"`);
  console.log(`     - DocID Hash: ${c.magenta}${propADocIdHex}${c.reset}`);
  console.log(`     - Tamanho do pacote binário .stz: ${c.bold}${propAPacket.length} bytes${c.reset}`);

  console.log(`\n  📜 ${c.bold}Proposta B${c.reset} publicada por ${carlos.name}:`);
  console.log(`     - Título: "Baterias de Backup e Eficiência LED"`);
  console.log(`     - DocID Hash: ${c.magenta}${propBDocIdHex}${c.reset}`);
  console.log(`     - Tamanho do pacote binário .stz: ${c.bold}${propBPacket.length} bytes${c.reset}`);

  // Ingestão de ambas as propostas na VPS Central
  await vpsServers[0].node.ingestPacket(propAPacket);
  await vpsServers[0].node.ingestPacket(propBPacket);
  await vpsServers[1].node.ingestPacket(propAPacket);
  await vpsServers[1].node.ingestPacket(propBPacket);

  await delay(800);

  // =========================================================================
  // TESTE 3: APOIOS INICIAIS A PROPOSTAS ESPECÍFICAS
  // =========================================================================
  printStep(3, "Distribuição de Apoios Iniciais", "Moradores emitem pacotes PICK com o hash da proposta que desejam apoiar");

  // Ana apoia Proposta A (target = propADocId)
  ana.seq++;
  const pickAna = await packDocument(
    { docType: DocType.PICK, authorPub: ana.pub, seq: ana.seq, blocks: [createPickTargetBlock(propADocId)] },
    ana.priv
  );
  totalBytesWire += pickAna.length;
  await ana.node.ingestPacket(pickAna);
  await vpsServers[0].node.ingestPacket(pickAna);
  console.log(`  👍 ${c.green}${ana.name.padEnd(16)}${c.reset} apoiou a ${c.bold}Proposta A${c.reset} [pacote: ${pickAna.length} bytes]`);

  // Bruno apoia Proposta A
  const bruno = citizens[1];
  bruno.seq++;
  const pickBruno = await packDocument(
    { docType: DocType.PICK, authorPub: bruno.pub, seq: bruno.seq, blocks: [createPickTargetBlock(propADocId)] },
    bruno.priv
  );
  totalBytesWire += pickBruno.length;
  await bruno.node.ingestPacket(pickBruno);
  await vpsServers[0].node.ingestPacket(pickBruno);
  console.log(`  👍 ${c.green}${bruno.name.padEnd(16)}${c.reset} apoiou a ${c.bold}Proposta A${c.reset} [pacote: ${pickBruno.length} bytes]`);

  // Carlos apoia Proposta B (a dele)
  carlos.seq++;
  const pickCarlos = await packDocument(
    { docType: DocType.PICK, authorPub: carlos.pub, seq: carlos.seq, blocks: [createPickTargetBlock(propBDocId)] },
    carlos.priv
  );
  totalBytesWire += pickCarlos.length;
  await carlos.node.ingestPacket(pickCarlos);
  await vpsServers[0].node.ingestPacket(pickCarlos);
  console.log(`  👍 ${c.green}${carlos.name.padEnd(16)}${c.reset} apoiou a ${c.bold}Proposta B${c.reset} [pacote: ${pickCarlos.length} bytes]`);

  // Daniela apoia Proposta B
  const daniela = citizens[3];
  daniela.seq++;
  const pickDaniela = await packDocument(
    { docType: DocType.PICK, authorPub: daniela.pub, seq: daniela.seq, blocks: [createPickTargetBlock(propBDocId)] },
    daniela.priv
  );
  totalBytesWire += pickDaniela.length;
  await daniela.node.ingestPacket(pickDaniela);
  await vpsServers[0].node.ingestPacket(pickDaniela);
  console.log(`  👍 ${c.green}${daniela.name.padEnd(16)}${c.reset} apoiou a ${c.bold}Proposta B${c.reset} [pacote: ${pickDaniela.length} bytes]`);

  console.log(`\n  📊 Placar de Apoios Ativos na VPS São Paulo:`);
  console.log(`     - Proposta A (${propADocIdHex.slice(0, 8)}...): ${vpsServers[0].node.engine.getTally()[propADocIdHex] ?? 0} apoios`);
  console.log(`     - Proposta B (${propBDocIdHex.slice(0, 8)}...): ${vpsServers[0].node.engine.getTally()[propBDocIdHex] ?? 0} apoios`);

  await delay(800);

  // =========================================================================
  // TESTE 4: REMOÇÃO DE APOIO E PRESERVAÇÃO DE FOOTPRINT
  // =========================================================================
  printStep(4, "Remoção de Apoio e Rastro Histórico (Footprint)", "Bruno decide RETIRAR seu apoio da Proposta A. Não há voto negativo, o apoio é removido e o rastro auditável é preservado.");

  bruno.seq++;
  // targetSeq = 0 representa explicitamente "REMOÇÃO DE APOIO"
  const removeSupportPacket = await packDocument(
    { docType: DocType.PICK, authorPub: bruno.pub, seq: bruno.seq, blocks: [createPickTargetBlock(0)] },
    bruno.priv
  );
  totalBytesWire += removeSupportPacket.length;

  await bruno.node.ingestPacket(removeSupportPacket);
  await vpsServers[0].node.ingestPacket(removeSupportPacket);

  console.log(`  🚫 ${c.yellow}${bruno.name}${c.reset} emitiu pacote de ${c.bold}REMOÇÃO DE APOIO${c.reset} (seq: ${bruno.seq}, alvo: 0)`);
  console.log(`     - Tamanho do pacote binário de desapoio: ${c.bold}${removeSupportPacket.length} bytes${c.reset}`);
  console.log(`     - Placar da Proposta A atualizado: ${vpsServers[0].node.engine.getTally()[propADocIdHex] ?? 0} apoio(s) (caiu de 2 para 1)`);

  const brunoFootprint = vpsServers[0].node.engine.getPersonFootprint(bruno.pub);
  console.log(`\n  📜 ${c.bold}Footprint Inviolável do Bruno:${c.reset}`);
  for (const step of brunoFootprint) {
    const desc = step.targetKey === propADocIdHex ? "Apoiou Proposta A" : "Removeu Todo Apoio (Neutro)";
    console.log(`     • Seq #${step.seq}: ${desc} [Hash: ${bytesToHex(step.docId).slice(0, 16)}...]`);
  }

  await delay(800);

  // =========================================================================
  // TESTE 5: APOIO OFFLINE NO ELEVADOR (SEM INTERNET)
  // =========================================================================
  printStep(5, "Apoio Offline em Ambiente Desconectado", "Eduardo está sem sinal no elevador e apoia a Proposta B. O pacote fica retido na fita local do seu celular.");

  const eduardo = citizens[4];
  eduardo.seq++;
  const eduardoPick = await packDocument(
    { docType: DocType.PICK, authorPub: eduardo.pub, seq: eduardo.seq, blocks: [createPickTargetBlock(propBDocId)] },
    eduardo.priv
  );
  totalBytesWire += eduardoPick.length;

  // Guarda somente no aparelho do Eduardo
  await eduardo.node.ingestPacket(eduardoPick);

  console.log(`  📵 ${c.red}Eduardo Lima [${eduardo.networkAddress}] desconectado da rede.${c.reset}`);
  console.log(`  📱 Pacote retido no armazenamento local: ${c.bold}${eduardoPick.length} bytes${c.reset}`);
  console.log(`  ☁️  VPS São Paulo ainda tem: ${vpsServers[0].node.getStoredPacketCount()} pacotes (não conhece o apoio de Eduardo).`);

  await delay(800);

  // =========================================================================
  // TESTE 6: PANE NA VPS PRIMÁRIA, FAILOVER E SINCRONIZAÇÃO GOSSIP
  // =========================================================================
  printStep(6, "Tolerância a Pane de Infraestrutura (Failover)", "VPS São Paulo cai. Moradores continuam operando via VPS Rio e Eduardo descarrega seu pacote retido.");

  vpsServers[0].online = false;
  console.log(`  💥 ${c.red}vps-sp-central [${vpsServers[0].networkAddress}] SOFREU CRASH E DESLIGOU!${c.reset}`);
  console.log(`  🔄 Tráfego direcionado para vps-rj-backup [${vpsServers[1].networkAddress}].`);

  // Eduardo sai do elevador e sincroniza com o Rio
  console.log(`\n  📶 ${c.green}Eduardo recupera sinal 4G e sincroniza com a VPS Rio:${c.reset}`);
  const syncEduardo = await eduardo.node.syncWith(vpsServers[1].node);
  console.log(`     - Pacotes transmitidos por Eduardo: ${syncEduardo.sent} (${syncEduardo.bytesTransferred} bytes).`);

  // Os outros moradores sincronizam com o Rio
  for (const cit of citizens) {
    await cit.node.syncWith(vpsServers[1].node);
  }

  // VPS São Paulo volta da pane e ressincroniza
  console.log(`\n  🟢 ${c.green}vps-sp-central religada com sucesso! Handshake com vps-rj-backup...${c.reset}`);
  vpsServers[0].online = true;
  await vpsServers[0].node.syncWith(vpsServers[1].node);

  // Sincronização geral de convergência
  for (const cit of citizens) {
    await cit.node.syncWith(vpsServers[0].node);
  }

  await delay(800);

  // =========================================================================
  // TESTE 7: AUDITORIA DE CONSENSO CRIPTOGRÁFICO DE TODAS AS MÁQUINAS
  // =========================================================================
  printStep(7, "Comprovação de Consenso Criptográfico", "Conferência de placares e Raiz Merkle idêntica em todas as máquinas da malha.");

  const allNodes = [
    ...vpsServers.map((s) => ({ id: s.name, type: "VPS", addr: s.networkAddress, node: s.node })),
    ...citizens.map((c) => ({ id: c.name, type: "CELULAR", addr: c.networkAddress, node: c.node })),
  ];

  const nodeReports: Array<{
    id: string;
    type: string;
    networkAddress: string;
    packetCount: number;
    proposalsSupportedTally: Record<string, number>;
    merkleRootHex: string;
  }> = [];

  for (const n of allNodes) {
    const pkts = n.node.getAllStoredPackets();
    const rootHex = bytesToHex(calculateMerkleRoot(pkts));
    nodeReports.push({
      id: n.id,
      type: n.type,
      networkAddress: n.addr,
      packetCount: n.node.getStoredPacketCount(),
      proposalsSupportedTally: n.node.engine.getTally(),
      merkleRootHex: rootHex,
    });
  }

  const canonRootHex = nodeReports[0].merkleRootHex;
  const allMatch = nodeReports.every((r) => r.merkleRootHex === canonRootHex);

  console.log(`┌──────────────────────┬─────────┬───────────────────────────────────┬──────────┬────────────────────────┬────────────────────────────────────────┐`);
  console.log(`│ MÁQUINA / DISPOSITIVO │ TIPO    │ ENDEREÇO DE REDE                  │ PACOTES  │ APOIOS ATIVOS          │ RAIZ MERKLE CANÔNICA (32 BYTES)        │`);
  console.log(`├──────────────────────┼─────────┼───────────────────────────────────┼──────────┼────────────────────────┼────────────────────────────────────────┤`);
  for (const rep of nodeReports) {
    const apoiosStr = `Prop.A:${rep.proposalsSupportedTally[propADocIdHex] ?? 0} Prop.B:${rep.proposalsSupportedTally[propBDocIdHex] ?? 0}`.padEnd(22);
    console.log(
      `│ ${rep.id.padEnd(20)} │ ${rep.type.padEnd(7)} │ ${rep.networkAddress.slice(0, 33).padEnd(33)} │ ${String(rep.packetCount).padStart(8)} │ ${apoiosStr} │ ${rep.merkleRootHex.slice(0, 36)}... │`
    );
  }
  console.log(`└──────────────────────┴─────────┴───────────────────────────────────┴──────────┴────────────────────────┴────────────────────────────────────────┘`);

  if (allMatch) {
    console.log(`\n  🏆 ${c.bgGreen}${c.bold} CONSENSO ABSOLUTO CONFIRMADO ${c.reset} ${c.green}Todas as 8 máquinas têm o mesmo estado e a mesma raiz Merkle!${c.reset}`);
    console.log(`     Raiz Merkle de 32 bytes: ${c.magenta}${canonRootHex}${c.reset}`);
  }

  // =========================================================================
  // TESTE 8: PROVA MERKLE DE INCLUSÃO DO APOIO DE EDUARDO
  // =========================================================================
  printStep(8, "Verificação Matemática SPV (Merkle Inclusion Proof)", "Prova de que o pacote do Eduardo emitido offline está incluído na raiz oficial da comunidade");

  const canonPackets = vpsServers[0].node.getAllStoredPackets();
  const eduardoPktIndex = canonPackets.findIndex(
    (p) => bytesToHex(calculateDocId(p)) === bytesToHex(calculateDocId(eduardoPick))
  );

  const proof = generateMerkleProof(canonPackets, eduardoPktIndex);
  const isValidProof = verifyMerkleProof(
    eduardoPick,
    proof,
    eduardoPktIndex,
    calculateMerkleRoot(canonPackets)
  );

  console.log(`  🔍 Prova de Inclusão do Apoio de Eduardo Lima:`);
  console.log(`     - Posição na Folha da Árvore: #${eduardoPktIndex}`);
  console.log(`     - Hashes Criptográficos da Prova: ${proof.length} nós intermediários`);
  console.log(`     - Resultado da Verificação Criptográfica: ${isValidProof ? `${c.green}VÁLIDA (100% Auditada)${c.reset}` : `${c.red}INVÁLIDA${c.reset}`}`);

  // Grava Relatório JSON
  const telemetry: SimulationTelemetry = {
    timestamp: new Date().toISOString(),
    nodesTotal: allNodes.length,
    packetsTotal: vpsServers[0].node.getStoredPacketCount(),
    totalBytesWire,
    merkleRootConsensusHex: canonRootHex,
    consensusMatchesAllNodes: allMatch,
    proposalsTally: {
      "Proposta_A_Solar": vpsServers[0].node.engine.getTally()[propADocIdHex] ?? 0,
      "Proposta_B_Baterias": vpsServers[0].node.engine.getTally()[propBDocIdHex] ?? 0,
    },
    nodesStatus: nodeReports,
    citizensFootprints: citizens.map((cit) => {
      const fp = vpsServers[0].node.engine.getPersonFootprint(cit.pub);
      return {
        citizen: cit.name,
        pubHex: cit.pubHex,
        history: fp.map((entry) => {
          let action = "APOIO";
          if (entry.targetKey === "0") action = "REMOCAO_DE_APOIO";
          else if (entry.targetKey === propADocIdHex) action = "APOIO_PROPOSTA_A";
          else if (entry.targetKey === propBDocIdHex) action = "APOIO_PROPOSTA_B";

          return {
            seq: entry.seq,
            action,
            target: entry.targetKey,
            docIdHex: bytesToHex(entry.docId),
          };
        }),
      };
    }),
    disasterRecoveryVerified: isValidProof && allMatch,
  };

  const wireDir = path.resolve(import.meta.dirname, "..");
  const testOutputDir = path.resolve(wireDir, "test-output");
  fs.mkdirSync(testOutputDir, { recursive: true });

  const outputPath = path.resolve(testOutputDir, "simulacao-rede-resultado.json");
  fs.writeFileSync(outputPath, JSON.stringify(telemetry, null, 2), "utf-8");

  console.log(`\n📁 ${c.bold}Relatório da simulação gravado em:${c.reset} ${c.cyan}${outputPath}${c.reset}\n`);
}

runSimulation().catch((err) => {
  console.error("Erro na simulação:", err);
  process.exit(1);
});
