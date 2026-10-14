---
name: image-trim-and-bg-removal
description: >-
  Otimiza imagens de assets para projetos web: remove o fundo tornando-o transparente,
  converte imagens JPG/JPEG em PNG transparente, e faz o trim (recorte) automático
  de sobras e espaços vazios aplicando padding de segurança.
  Use esta skill sempre que precisar tratar, recortar ou remover fundo de imagens/assets
  no projeto ou a pedido do usuário.
---

# Image Trim & Background Removal Skill

Esta skill fornece uma ferramenta automatizada para otimização de assets visuais, combinando:
1. **Remoção de Fundo (Background Removal)**: Inunda e recorta fundos sólidos/brancos conectados às bordas externas (preservando elementos brancos internos via FloodFill com OpenCV/PIL, ou via IA `rembg`).
2. **Conversão para PNG**: Transforma arquivos JPG/JPEG em PNG com canal alfa (transparência).
3. **Trim com Padding**: Elimina bordas vazias (espaços transparentes ou margens sólidas) mantendo margem de segurança configurável (padrão: 16px).

---

## Localização do Script

- **Script no Workspace**: `interactive-page/trim_assets.py`
- **Script da Skill**: `.agents/skills/image-trim-and-bg-removal/scripts/trim_assets.py`

Ambos são executáveis diretamente com `python3`.

---

## Como Usar

### 1. Remover Fundo, Converter para PNG e Fazer Trim

#### Para uma imagem específica:
```bash
python3 interactive-page/trim_assets.py --file caminho/para/imagem.jpeg --remove-bg
```
*(Gera automaticamente `imagem.png` recortada e transparente).*

#### Para uma pasta inteira de assets:
```bash
python3 interactive-page/trim_assets.py --dir interactive-page/assets --remove-bg
```

#### Excluir o arquivo JPEG original após gerar o PNG:
```bash
python3 interactive-page/trim_assets.py --file caminho/para/imagem.jpeg --remove-bg --delete-source
```

---

### 2. Apenas Fazer Trim (sem remover fundo)

Remove apenas o espaço transparente ou a borda vazia sem alterar as cores do fundo:
```bash
# Pasta inteira (padrão: padding 16px)
python3 interactive-page/trim_assets.py --dir interactive-page/assets

# Com padding customizado (ex: 24px)
python3 interactive-page/trim_assets.py --dir interactive-page/assets --padding 24

# Em um único arquivo
python3 interactive-page/trim_assets.py --file interactive-page/assets/logo.png --padding 16
```

---

### 3. Ajustes Avançados de Remoção de Fundo

| Parâmetro | Padrão | Descrição |
| :--- | :--- | :--- |
| `--remove-bg` | `False` | Ativa a remoção de fundo e saída em PNG transparente |
| `--bg-method` | `floodfill` | `floodfill` (seguro, preserva miolo branco), `color` (cor global), ou `ai` (`rembg`) |
| `--bg-tolerance` | `25` | Sensibilidade de cor para fundos não 100% brancos (10 a 50) |
| `--feather` | `1` | Suavização da borda do recorte em pixels (evita serrilhado) |
| `--padding` | `16` | Margem interna preservada em pixels após o corte |
| `--delete-source` | `False` | Remove o `.jpeg`/`.jpg` original após converter em `.png` |

---

## Verificação e Qualidade

Após a execução, o script imprime o resumo detalhado no terminal:
- Formato original vs destino
- Dimensões anteriores vs novas dimensões
- Espaço em pixels economizado
