const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const srcDir = path.join(baseDir, 'src');
const layoutDir = path.join(srcDir, 'layout');
const sectionsDir = path.join(srcDir, 'sections');

const outHtml = path.join(baseDir, 'index.html');

function build() {
  const start = Date.now();

  // 1. MONTAR HTML A PARTIR DE src/layout/ E src/sections/
  const headerHtml = fs.readFileSync(path.join(layoutDir, 'header.html'), 'utf-8');
  const footerHtml = fs.readFileSync(path.join(layoutDir, 'footer.html'), 'utf-8');

  const sectionFolders = fs.readdirSync(sectionsDir).filter(f => {
    return fs.statSync(path.join(sectionsDir, f)).isDirectory();
  }).sort();

  let sectionsHtml = '';
  for (const folder of sectionFolders) {
    const folderPath = path.join(sectionsDir, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.html')).sort();
    for (const file of files) {
      sectionsHtml += `\n<!-- === SEÇÃO: ${folder} === -->\n`;
      sectionsHtml += fs.readFileSync(path.join(folderPath, file), 'utf-8');
      if (!sectionsHtml.endsWith('\n')) sectionsHtml += '\n';
    }
  }

  const finalHtml = headerHtml + '\n' + sectionsHtml + '\n' + footerHtml;
  fs.writeFileSync(outHtml, finalHtml, 'utf-8');

  // 2. LIMPAR ARQUIVOS MONOLÍTICOS OBSOLETOS SE EXISTIREM
  const obsoleteFiles = [
    path.join(baseDir, 'style.css'),
    path.join(baseDir, 'app.js'),
  ];
  for (const f of obsoleteFiles) {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) {}
    }
  }

  // Se dist/ existir com cópias antigas, remover para evitar confusão
  const distDir = path.join(baseDir, 'dist');
  if (fs.existsSync(distDir)) {
    try { fs.rmSync(distDir, { recursive: true, force: true }); } catch (e) {}
  }

  const elapsed = Date.now() - start;
  console.log(`[${new Date().toLocaleTimeString()}] ✨ index.html montado com links modulares em ${elapsed}ms!`);
}

// Execução inicial
build();

// Modo Watch
if (process.argv.includes('--watch') || process.argv.includes('-w')) {
  console.log(`👀 Observando alterações em ${srcDir}... (Pressione Ctrl+C para parar)`);
  
  let debounceTimeout = null;
  fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    // Dispara rebuild se for HTML (CSS e JS são servidos diretamente pelo navegador)
    if (filename.endsWith('.html')) {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        console.log(`🔄 Alteração em template detectada: ${filename}`);
        try {
          build();
        } catch (err) {
          console.error('❌ Erro durante a montagem:', err.message);
        }
      }, 30);
    }
  });
}
