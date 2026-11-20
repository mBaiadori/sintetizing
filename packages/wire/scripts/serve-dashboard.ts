import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;

const wireDir = path.resolve(import.meta.dirname, "..");
const dashboardHtmlPath = path.resolve(wireDir, "dashboard/index.html");
const testOutputDir = path.resolve(wireDir, "test-output");
const simJsonPath = path.resolve(testOutputDir, "simulacao-rede-resultado.json");
const stressJsonPath = path.resolve(testOutputDir, "teste-carga-resultado.json");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  // Headers de CORS e JSON
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Rota 1: Página inicial (Dashboard)
  if (url.pathname === "/" || url.pathname === "/index.html") {
    if (fs.existsSync(dashboardHtmlPath)) {
      const html = fs.readFileSync(dashboardHtmlPath, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Arquivo dashboard/index.html não encontrado.");
    }
    return;
  }

  // Rota 2: API Simulacao JSON
  if (url.pathname === "/api/simulacao") {
    if (fs.existsSync(simJsonPath)) {
      const data = fs.readFileSync(simJsonPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Arquivo simulacao-rede-resultado.json não encontrado. Execute a simulação primeiro." }));
    }
    return;
  }

  // Rota 3: API Estresse JSON
  if (url.pathname === "/api/estresse") {
    if (fs.existsSync(stressJsonPath)) {
      const data = fs.readFileSync(stressJsonPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Arquivo teste-carga-resultado.json não encontrado." }));
    }
    return;
  }

  // Rota 3.6: Catálogo de Assuntos
  if (url.pathname === "/api/assuntos") {
    const catalogPath = path.resolve(testOutputDir, "assuntos_catalogo.json");
    if (fs.existsSync(catalogPath)) {
      const data = fs.readFileSync(catalogPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Catálogo de assuntos não encontrado." }));
    }
    return;
  }

  // Rota 3.7: Detalhes do Assunto Selecionado com Árvore de Versões, Picks e Footprints
  if (url.pathname === "/api/assunto") {
    const id = url.searchParams.get("id") || "energia-sustentavel";
    const subjectFile = path.resolve(testOutputDir, `assunto_${id.replace(/-/g, "_")}.json`);
    if (fs.existsSync(subjectFile)) {
      const data = fs.readFileSync(subjectFile, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Assunto ${id} não encontrado.` }));
    }
    return;
  }

  // Rota 4: Executar Simulação via POST
  if (url.pathname === "/api/executar-simulacao" && req.method === "POST") {
    try {
      await execAsync("npx tsx packages/wire/scripts/simulate-network.ts --fast");
      const data = fs.readFileSync(simJsonPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Rota 5: Executar Teste de Estresse via POST
  if (url.pathname === "/api/executar-estresse" && req.method === "POST") {
    try {
      await execAsync("npx tsx packages/wire/scripts/stress-test.ts --users 1000");
      const data = fs.readFileSync(stressJsonPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Rota não encontrada");
});

server.listen(PORT, () => {
  console.log(`\n\x1b[1m\x1b[36m╔══════════════════════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m║  PAINEL LIGHT DA REDE P2P SINTETIZE INICIADO COM SUCESSO!            ║\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m╠══════════════════════════════════════════════════════════════════════╣\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m║\x1b[0m  Abra no seu navegador: \x1b[1m\x1b[32mhttp://localhost:${PORT}\x1b[0m                      \x1b[1m\x1b[36m║\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m║\x1b[0m  Pressione Ctrl+C para encerrar quando quiser.                      \x1b[1m\x1b[36m║\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m╚══════════════════════════════════════════════════════════════════════╝\x1b[0m\n`);
});

