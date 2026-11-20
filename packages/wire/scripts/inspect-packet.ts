import * as fs from "node:fs";
import * as path from "node:path";
import * as ed25519 from "@noble/ed25519";
import { bytesToHex } from "@noble/hashes/utils";
import {
  calculateDocId,
  DocType,
  readLawArticleBlock,
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
  bgCyan: "\x1b[46m\x1b[30m",
  bgGreen: "\x1b[42m\x1b[30m",
};

const targetFile = process.argv[2];

if (!targetFile) {
  console.log(`\n\x1b[31mErro: Nenhum arquivo .stze informado.\x1b[0m`);
  console.log(`Uso correto:`);
  console.log(`  pnpm inspecionar <caminho-do-arquivo.stze>\n`);
  console.log(`Exemplos:`);
  console.log(`  pnpm inspecionar rede-local/celular-ana/pacotes_stze/01_minha_proposta_solar.stze`);
  console.log(`  pnpm inspecionar rede-local/celular-bruno/pacotes_stze/03_minha_remocao_de_apoio.stze\n`);
  process.exit(1);
}

const wireDir = path.resolve(import.meta.dirname, "..");
const cleanedTarget = targetFile.replace(/^packages\/wire\//, "");

let resolvedPath = path.resolve(wireDir, cleanedTarget);
if (!fs.existsSync(resolvedPath)) {
  const c1 = path.resolve(wireDir, "test-output", cleanedTarget);
  const c2 = path.resolve(wireDir, "test-output/rede-local", cleanedTarget);
  const c3 = path.resolve(process.cwd(), targetFile);

  if (fs.existsSync(c1)) resolvedPath = c1;
  else if (fs.existsSync(c2)) resolvedPath = c2;
  else if (fs.existsSync(c3)) resolvedPath = c3;
}

if (!fs.existsSync(resolvedPath)) {
  console.log(`\n\x1b[31mErro: Arquivo não encontrado:\x1b[0m ${targetFile}\n`);
  process.exit(1);
}

async function inspect() {
  const rawBytes = fs.readFileSync(resolvedPath);
  const docId = calculateDocId(rawBytes);
  const docIdHex = bytesToHex(docId);

  let doc;
  let signatureValid = false;
  try {
    doc = await unpackAndVerifyDocument(rawBytes);
    signatureValid = true;
  } catch (err: any) {
    console.error(`Erro ao desempacotar documento: ${err.message}`);
    process.exit(1);
  }

  const docTypeName =
    doc.docType === DocType.PROPOSAL
      ? "PROPOSTA (1)"
      : doc.docType === DocType.PICK
      ? "PICK / APOIO (2)"
      : doc.docType === DocType.COMMUNITY_PICK
      ? "COMMUNITY_PICK (3)"
      : "EXECUTION (4)";

  console.log(`\n${c.bold}${c.cyan}╔═══════════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║  SINTETIZE PROTOCOL - INSPEÇÃO FORENSE DE PACOTE BINÁRIO (.stze)                   ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚═══════════════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);

  console.log(`📁 Arquivo Físico no Disco:`);
  console.log(`   ${c.yellow}${resolvedPath}${c.reset}`);
  console.log(`   Tamanho Real em Bytes: ${c.bold}${c.green}${rawBytes.length} bytes${c.reset}\n`);

  console.log(`${c.bold}1. CABEÇALHO BINÁRIO DETERMINÍSTICO (102 BYTES POSICIONAIS):${c.reset}`);
  console.log(`   • Versão do Protocolo:  ${doc.version}`);
  console.log(`   • Tipo de Documento:    ${c.bold}${docTypeName}${c.reset}`);
  console.log(`   • Número de Sequência:  #${doc.seq} (Seq incremental anti-replay)`);
  console.log(`   • Chave Pública Autor:  ${c.magenta}${bytesToHex(doc.authorPub)}${c.reset}`);
  console.log(`   • Assinatura Ed25519:   ${bytesToHex(doc.signature).slice(0, 32)}... (64 bytes)`);
  console.log(`   • Validação da Chave:   ${signatureValid ? `${c.green}✔ ASSINATURA VÁLIDA (100% Autêntica)${c.reset}` : `${c.red}INVÁLIDA${c.reset}`}`);
  console.log(`   • Hash Canônico DocID:  ${c.cyan}${docIdHex}${c.reset}\n`);

  console.log(`${c.bold}2. FITA DE BLOCOS TLV (TAG-LENGTH-VALUE) DESEMPACOTADA:${c.reset}`);
  console.log(`   Total de Blocos: ${doc.blocks.length}\n`);

  for (let i = 0; i < doc.blocks.length; i++) {
    const block = doc.blocks[i];
    let tagDesc = `Tag Desconhecida (${block.tag})`;
    let valueDesc = "";

    if (block.tag === Tag.SCOPE) {
      tagDesc = `TAG 1 (SCOPE)`;
      valueDesc = `"${readUtf8Block(block)}"`;
    } else if (block.tag === Tag.PARENT_HASH) {
      tagDesc = `TAG 2 (PARENT_HASH)`;
      valueDesc = bytesToHex(block.value);
    } else if (block.tag === Tag.TITLE) {
      tagDesc = `TAG 10 (TITLE)`;
      valueDesc = `"${readUtf8Block(block)}"`;
    } else if (block.tag === Tag.BODY) {
      tagDesc = `TAG 11 (BODY)`;
      valueDesc = `"${readUtf8Block(block)}"`;
    } else if (block.tag === Tag.LAW_ARTICLE) {
      tagDesc = `TAG 14 (LAW_ARTICLE)`;
      const art = readLawArticleBlock(block);
      valueDesc = `Artigo #${art.articleNum}: "${art.text}"`;
    } else if (block.tag === Tag.PICK_TARGET) {
      tagDesc = `TAG 20 (PICK_TARGET)`;
      const target = readPickTargetBlock(block);
      if (target.targetSeq !== undefined) {
        if (target.targetSeq === 0) {
          valueDesc = `${c.bold}${c.yellow}0 (REMOÇÃO DELIBERADA DE APOIO / NEUTRO)${c.reset}`;
        } else {
          valueDesc = `Índice de Proposta: #${target.targetSeq}`;
        }
      } else if (target.targetHash) {
        valueDesc = `Hash da Proposta Apoiada: ${c.magenta}${bytesToHex(target.targetHash)}${c.reset}`;
      }
    }

    console.log(`   ┌─ Bloco #${i + 1}: ${c.bold}${tagDesc}${c.reset} [${block.value.length} bytes]`);
    console.log(`   └─ Conteúdo: ${valueDesc}\n`);
  }

  console.log(`${c.bold}3. VISÃO HEXADECIMAL DOS PRIMEIROS 64 BYTES (DUMP FORENSE):${c.reset}`);
  const preview = rawBytes.subarray(0, 64);
  let hexLine = "";
  let asciiLine = "";
  for (let i = 0; i < preview.length; i++) {
    const byte = preview[i];
    hexLine += byte.toString(16).padStart(2, "0") + " ";
    asciiLine += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
    if ((i + 1) % 16 === 0 || i === preview.length - 1) {
      console.log(`   ${c.dim}${hexLine.padEnd(48)}${c.reset}  |${c.yellow}${asciiLine}${c.reset}|`);
      hexLine = "";
      asciiLine = "";
    }
  }
  console.log(`\n${c.green}✔ Pacote íntegro, assinado e determinístico.${c.reset}\n`);
}

inspect().catch((err) => {
  console.error("Erro na inspeção:", err);
  process.exit(1);
});
