import * as fs from "node:fs";
import * as path from "node:path";
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

const wireDir = path.resolve(import.meta.dirname, "..");
const testOutputDir = path.resolve(wireDir, "test-output");
const packetsDir = path.resolve(testOutputDir, "rede-local/vps-sao-paulo/pacotes_stze");

async function generateTreeFromRealTestFiles() {
  if (!fs.existsSync(packetsDir)) {
    console.error("Diretório de pacotes de teste não encontrado. Execute pnpm rede:criar primeiro.");
    process.exit(1);
  }

  const files = fs.readdirSync(packetsDir).filter((f) => f.endsWith(".stze")).sort();
  const parsedFiles: any[] = [];

  for (const fileName of files) {
    const fullPath = path.join(packetsDir, fileName);
    const rawBytes = fs.readFileSync(fullPath);
    const docId = calculateDocId(rawBytes);
    const docIdHex = bytesToHex(docId);
    const doc = await unpackAndVerifyDocument(rawBytes);

    let docTypeName = "PROPOSTA";
    let title = "";
    let scope = "";
    let articleText = "";
    let pickTargetDesc = "";

    for (const b of doc.blocks) {
      if (b.tag === Tag.TITLE) title = readUtf8Block(b);
      if (b.tag === Tag.SCOPE) scope = readUtf8Block(b);
      if (b.tag === Tag.LAW_ARTICLE) {
        const art = readLawArticleBlock(b);
        articleText = `Artigo #${art.articleNum}: ${art.text}`;
      }
      if (b.tag === Tag.PICK_TARGET) {
        const pt = readPickTargetBlock(b);
        if (pt.targetSeq === 0) {
          pickTargetDesc = "Remoção de Apoio (Alvo: 0)";
        } else if (pt.targetSeq !== undefined) {
          pickTargetDesc = `Apoio ao índice #${pt.targetSeq}`;
        } else if (pt.targetHash) {
          pickTargetDesc = `Apoio à Proposta [${bytesToHex(pt.targetHash).slice(0, 8)}...]`;
        }
      }
    }

    if (doc.docType === DocType.PICK) {
      docTypeName = "PICK";
    }

    // Identifica o autor pelo nome do arquivo
    let authorName = "Cidadão";
    if (fileName.includes("ana")) authorName = "Ana Silva";
    else if (fileName.includes("carlos")) authorName = "Carlos Oliveira";
    else if (fileName.includes("bruno")) authorName = "Bruno Souza";
    else if (fileName.includes("eduardo")) authorName = "Eduardo Lima";

    // Dump hexadecimal dos primeiros 64 bytes
    const preview = rawBytes.subarray(0, 64);
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

    parsedFiles.push({
      fileName,
      filePathRel: `packages/wire/test-output/rede-local/vps-sao-paulo/pacotes_stze/${fileName}`,
      sizeBytes: rawBytes.length,
      docType: doc.docType,
      docTypeName,
      seq: doc.seq,
      authorName,
      authorPubHex: bytesToHex(doc.authorPub),
      docIdHex,
      scope: scope || "condominio/jardins/energia",
      title: title || pickTargetDesc,
      articleText: articleText || pickTargetDesc,
      pickTargetDesc,
      hexDumpPreview: hexDump,
    });
  }

  // Mapeia os 7 arquivos do teste para a árvore fractal visual idêntica ao desenho:
  // Base: "Início"
  // Ramo Esquerdo: Proposta Solar (01) -> Apoio Ana (03) & Apoio Antigo Bruno (05) -> Remoção Apoio Bruno (06)
  // Ramo Direito: Proposta Baterias (02) -> Apoio Carlos (04) & Apoio Eduardo Elevador (07)

  const f01 = parsedFiles.find((f) => f.fileName.includes("01_proposta_solar"))!;
  const f02 = parsedFiles.find((f) => f.fileName.includes("02_proposta_baterias"))!;
  const f03 = parsedFiles.find((f) => f.fileName.includes("03_apoio_ana"))!;
  const f04 = parsedFiles.find((f) => f.fileName.includes("04_apoio_carlos"))!;
  const f05 = parsedFiles.find((f) => f.fileName.includes("05_apoio_antigo_bruno"))!;
  const f06 = parsedFiles.find((f) => f.fileName.includes("06_remocao_apoio_bruno"))!;
  const f07 = parsedFiles.find((f) => f.fileName.includes("07_apoio_eduardo"))!;

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
        authorName: "Protocolo Sintetize",
        authorPubHex: "0000000000000000000000000000000000000000000000000000000000000000",
        articleText: "Tronco principal de consenso da comunidade.",
        hexDumpPreview: "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  |................|\n",
      },
      // Ramo Esquerdo: Proposta Solar (01)
      {
        id: "prop-solar",
        label: "gov/energia-so...",
        scope: f01.scope,
        subTitle: "feat(solar): Usina Solar Central no Telhado",
        color: "purple",
        count: 1, // 1 apoio ativo no final
        ...f01,
      },
      {
        id: "apoio-ana",
        label: "gov/apoio-ana...",
        scope: "apoio/ana-silva",
        subTitle: "feat(apoio): Ana apoia Proposta Solar (seq #2)",
        color: "orange",
        count: 1,
        ...f03,
      },
      {
        id: "apoio-bruno-antigo",
        label: "gov/apoio-bru...",
        scope: "apoio/bruno-souza",
        subTitle: "feat(apoio): Bruno apoiou Solar (seq #1)",
        color: "orange",
        count: 1,
        ...f05,
      },
      {
        id: "remocao-bruno",
        label: "gov/remocao-b...",
        scope: "remocao/bruno-souza",
        subTitle: "feat(remocao): Bruno retira apoio (alvo: 0, seq #2)",
        color: "green",
        count: 0, // retirou o apoio
        ...f06,
      },
      // Ramo Direito: Proposta Baterias (02)
      {
        id: "prop-baterias",
        label: "gov/baterias...",
        scope: f02.scope,
        subTitle: "feat(baterias): Backup & Eficiência LED",
        color: "purple",
        count: 3, // 3 apoios ativos no final
        ...f02,
      },
      {
        id: "apoio-carlos",
        label: "gov/apoio-car...",
        scope: "apoio/carlos-oliveira",
        subTitle: "feat(apoio): Carlos apoia Baterias (seq #2)",
        color: "orange",
        count: 1,
        ...f04,
      },
      {
        id: "apoio-eduardo",
        label: "gov/apoio-edu...",
        scope: "apoio/eduardo-lima",
        subTitle: "feat(offline): Apoio do elevador sincronizado (seq #1)",
        color: "orange",
        count: 1,
        ...f07,
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

  const outputPath = path.join(testOutputDir, "arvore_grafo.json");
  fs.writeFileSync(outputPath, JSON.stringify(treeGraphData, null, 2), "utf-8");
  console.log(`✔ Árvore fractal gerada com sucesso a partir dos 7 arquivos .stze reais em: ${outputPath}`);
}

generateTreeFromRealTestFiles().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});

