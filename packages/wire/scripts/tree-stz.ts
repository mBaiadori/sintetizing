import * as fs from "node:fs";
import * as path from "node:path";
import { bytesToHex } from "@noble/hashes/utils";
import {
  calculateDocId,
  DocType,
  readPickTargetBlock,
  readUtf8Block,
  Tag,
  unpackAndVerifyDocument,
} from "../src/index.js";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
};

const wireDir = path.resolve(import.meta.dirname, "..");
const testOutputDir = path.resolve(wireDir, "test-output", "rede-local");

if (!fs.existsSync(testOutputDir)) {
  console.log(`\n\x1b[31mRede local ainda não foi gerada.\x1b[0m Execute: pnpm rede:criar\n`);
  process.exit(1);
}

interface StzFileInfo {
  fileName: string;
  sizeBytes: number;
  docTypeName: string;
  seq: number;
  docIdHex: string;
  summary: string;
}

interface NodeFolder {
  nodeName: string;
  nodeType: "VPS" | "CELULAR";
  address: string;
  files: StzFileInfo[];
}

async function parseStz(filePath: string): Promise<StzFileInfo> {
  const bytes = fs.readFileSync(filePath);
  const docIdHex = bytesToHex(calculateDocId(bytes)).slice(0, 8);
  const fileName = path.basename(filePath);

  try {
    const doc = await unpackAndVerifyDocument(bytes);
    let docTypeName = "PROPOSTA";
    let summary = "";

    if (doc.docType === DocType.PROPOSAL) {
      docTypeName = "PROPOSTA";
      const titleBlock = doc.blocks.find((b) => b.tag === Tag.TITLE);
      summary = titleBlock ? readUtf8Block(titleBlock) : "Sem título";
    } else if (doc.docType === DocType.PICK) {
      docTypeName = "PICK/APOIO";
      const targetBlock = doc.blocks.find((b) => b.tag === Tag.PICK_TARGET);
      if (targetBlock) {
        const t = readPickTargetBlock(targetBlock);
        if (t.targetSeq === 0) {
          summary = "REMOÇÃO DE APOIO (Neutro)";
        } else if (t.targetSeq !== undefined) {
          summary = `Apoio ao índice #${t.targetSeq}`;
        } else if (t.targetHash) {
          summary = `Apoio à Proposta [${bytesToHex(t.targetHash).slice(0, 8)}...]`;
        }
      }
    } else if (doc.docType === DocType.COMMUNITY_PICK) {
      docTypeName = "ROLLUP";
      summary = "Síntese comunitária com Merkle Root";
    }

    return {
      fileName,
      sizeBytes: bytes.length,
      docTypeName,
      seq: doc.seq,
      docIdHex,
      summary,
    };
  } catch {
    return {
      fileName,
      sizeBytes: bytes.length,
      docTypeName: "ARQUIVO_BINÁRIO",
      seq: 0,
      docIdHex,
      summary: "Binário .stz não parseado",
    };
  }
}

async function renderTree() {
  console.log(`\n${c.bold}${c.cyan}╔═══════════════════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║  GERENCIADOR DE ARQUIVOS BINÁRIOS (.stz) - MALHA SINTETIZE LOCAL                          ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚═══════════════════════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);

  console.log(`📂 ${c.bold}packages/wire/test-output/rede-local/${c.reset}`);

  const nodeDirs = fs
    .readdirSync(testOutputDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (let i = 0; i < nodeDirs.length; i++) {
    const nodeDir = nodeDirs[i];
    const isLastNode = i === nodeDirs.length - 1;
    const nodePrefix = isLastNode ? "└── " : "├── ";
    const childPrefix = isLastNode ? "    " : "│   ";

    const isVps = nodeDir.startsWith("vps");
    const icon = isVps ? "☁️ " : "📱";
    const typeLabel = isVps ? `${c.cyan}[VPS RELAY]${c.reset}` : `${c.green}[CELULAR]${c.reset}`;

    // Lê endereço de identidade se existir
    let address = "";
    const identPath = path.join(testOutputDir, nodeDir, "identidade.json");
    if (fs.existsSync(identPath)) {
      try {
        const ident = JSON.parse(fs.readFileSync(identPath, "utf-8"));
        address = ident.endereco_rede || "";
      } catch {}
    }

    console.log(`${nodePrefix}${icon} ${c.bold}${nodeDir}${c.reset} ${typeLabel} ${c.dim}(${address})${c.reset}`);

    const packetsDir = path.join(testOutputDir, nodeDir, "pacotes_stz");
    if (fs.existsSync(packetsDir)) {
      const files = fs.readdirSync(packetsDir).filter((f) => f.endsWith(".stz")).sort();

      for (let j = 0; j < files.length; j++) {
        const file = files[j];
        const isLastFile = j === files.length - 1;
        const filePrefix = isLastFile ? "└── " : "├── ";
        const stzInfo = await parseStz(path.join(packetsDir, file));

        const typeBadge =
          stzInfo.docTypeName === "PROPOSTA"
            ? `${c.magenta}[PROPOSTA]${c.reset}`
            : stzInfo.summary.includes("REMOÇÃO")
            ? `${c.yellow}[DESAPOIO]${c.reset}`
            : `${c.green}[APOIO]${c.reset}`;

        const sizeStr = `${c.cyan}${String(stzInfo.sizeBytes).padStart(3)}B${c.reset}`;
        const seqStr = `${c.dim}seq #${stzInfo.seq}${c.reset}`;
        const hashStr = `${c.dim}docId: ${stzInfo.docIdHex}${c.reset}`;

        console.log(
          `${childPrefix}${filePrefix}📄 ${c.bold}${stzInfo.fileName.padEnd(35)}${c.reset} ${sizeStr} ${typeBadge} ${seqStr} | ${c.dim}"${stzInfo.summary}"${c.reset}`
        );
      }
    } else {
      console.log(`${childPrefix}└── ${c.dim}(sem arquivos .stz)${c.reset}`);
    }
  }

  console.log(`\n${c.dim}Para abrir e inspecionar os bytes internos de qualquer um deles:${c.reset}`);
  console.log(`${c.yellow}pnpm inspecionar rede-local/<pasta-da-maquina>/pacotes_stz/<arquivo.stz>${c.reset}\n`);
}

renderTree().catch((err) => {
  console.error("Erro ao gerar árvore:", err);
  process.exit(1);
});

