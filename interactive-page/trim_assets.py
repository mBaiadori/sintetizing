#!/usr/bin/env python3
"""
Script de Otimização, Remoção de Fundo e Trim de Imagens (Assets)
Sintetizando - Jornada Interativa

Funcionalidades:
1. Trim de espaços vazios (transparentes ou margens sólidas) mantendo padding configurável.
2. Remoção de fundo (opcional via --remove-bg) preservando detalhes internos brancos via FloodFill inteligente.
3. Conversão automática para PNG transparente quando o fundo é removido.
4. Suporte a processamento por pasta (--dir) ou arquivo individual (--file).

Uso:
    # Apenas Trim (comportamento padrão):
    python3 trim_assets.py
    python3 trim_assets.py --padding 16

    # Trim com Remoção de Fundo e conversão para PNG:
    python3 trim_assets.py --remove-bg
    python3 trim_assets.py --remove-bg --bg-tolerance 30

    # Em uma imagem específica:
    python3 trim_assets.py --file assets/comunnity.jpeg --remove-bg
    python3 trim_assets.py --file assets/id.png --remove-bg

    # Remoção de fundo via IA (se tiver a biblioteca rembg instalada):
    python3 trim_assets.py --remove-bg --bg-method ai
"""

import os
import sys
import argparse
from PIL import Image, ImageChops

# Dependências opcionais para remoção avançada de fundo
try:
    import numpy as np
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


def remove_background(
    img: Image.Image,
    method: str = "floodfill",
    tolerance: int = 25,
    feather: int = 1,
) -> Image.Image:
    """
    Remove o fundo de uma imagem e retorna uma imagem PIL em modo RGBA.
    
    Métodos disponíveis:
    - 'floodfill': (Recomendado) Inunda a partir das bordas/cantos externos.
      Remove o fundo branco/claro conectado à borda, mas PRESERVA partes brancas
      internas da ilustração (como textos, folhas brancas, roupas, etc.).
    - 'color': Remove qualquer pixel na imagem cuja cor seja próxima à cor do canto.
    - 'ai': Usa redes neurais via pacote 'rembg' (requer pip install rembg).
    """
    if method == "ai":
        try:
            import rembg
            return rembg.remove(img)
        except ImportError:
            print("    [Aviso] Pacote 'rembg' não encontrado. Usando método 'floodfill'. Para IA instale: pip install rembg")
            method = "floodfill"

    if not HAS_CV2:
        # Fallback sem OpenCV: detecção simples via Pillow
        return _remove_background_pil_fallback(img, tolerance=tolerance)

    img_rgb = img.convert("RGB")
    w, h = img_rgb.size
    img_np = np.array(img_rgb)
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    if method == "color":
        corner = img_bgr[0, 0].astype(int)
        diff = np.abs(img_bgr.astype(int) - corner)
        dist = np.max(diff, axis=2)
        mask = (dist > tolerance).astype(np.uint8) * 255
    else:
        # FloodFill a partir dos 4 cantos e do meio das 4 bordas
        flood_mask = np.zeros((h + 2, w + 2), np.uint8)
        seeds = [
            (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
            (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)
        ]
        
        for seed in seeds:
            if flood_mask[seed[1] + 1, seed[0] + 1] == 0:
                cv2.floodFill(
                    img_bgr.copy(),
                    flood_mask,
                    seed,
                    0,
                    loDiff=(tolerance, tolerance, tolerance),
                    upDiff=(tolerance, tolerance, tolerance),
                    flags=4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE,
                )

        bg_mask = flood_mask[1 : h + 1, 1 : w + 1]
        mask = cv2.bitwise_not(bg_mask)

    # Suaviza a borda da máscara (anti-aliasing) para acabamento profissional
    if feather > 0:
        ksize = feather * 2 + 1
        mask = cv2.GaussianBlur(mask, (ksize, ksize), 0)

    # Monta imagem RGBA com a nova máscara no canal Alpha
    rgba = np.array(img.convert("RGBA"))
    rgba[:, :, 3] = mask
    return Image.fromarray(rgba)


def _remove_background_pil_fallback(img: Image.Image, tolerance: int = 25) -> Image.Image:
    """Fallback puro em Pillow caso OpenCV não esteja disponível."""
    rgba = img.convert("RGBA")
    datas = rgba.getdata()
    corner = datas[0]
    
    new_data = []
    for item in datas:
        # Verifica se o pixel é próximo da cor do canto
        diff = max(abs(item[0] - corner[0]), abs(item[1] - corner[1]), abs(item[2] - corner[2]))
        if diff <= tolerance:
            new_data.append((item[0], item[1], item[2], 0))
        else:
            new_data.append(item)
    rgba.putdata(new_data)
    return rgba


def get_crop_box_rgba(img: Image.Image, padding: int = 16):
    """
    Calcula a caixa de corte para imagens com canal alfa (transparência),
    mantendo um padding suave ao redor da arte.
    """
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    if not bbox:
        return None
    
    w, h = img.size
    x0 = max(0, bbox[0] - padding)
    y0 = max(0, bbox[1] - padding)
    x1 = min(w, bbox[2] + padding)
    y1 = min(h, bbox[3] + padding)
    
    if x0 == 0 and y0 == 0 and x1 == w and y1 == h:
        return None
        
    return (x0, y0, x1, y1)


def get_crop_box_rgb(img: Image.Image, padding: int = 16, tolerance: int = 8):
    """
    Calcula a caixa de corte para imagens RGB com fundo sólido (ex: branco),
    detectando a cor dos cantos.
    """
    corner_color = img.getpixel((0, 0))
    bg = Image.new(img.mode, img.size, corner_color)
    diff = ImageChops.difference(img, bg)
    diff = ImageChops.add(diff, diff, 2.0, -tolerance)
    bbox = diff.getbbox()
    if not bbox:
        return None
        
    w, h = img.size
    x0 = max(0, bbox[0] - padding)
    y0 = max(0, bbox[1] - padding)
    x1 = min(w, bbox[2] + padding)
    y1 = min(h, bbox[3] + padding)
    
    if x0 == 0 and y0 == 0 and x1 == w and y1 == h:
        return None
        
    return (x0, y0, x1, y1)


def clean_temporary_files(assets_dir: str):
    """Remove arquivos residuais como *_orig.* e *_trimmed.*"""
    removed = []
    for f in os.listdir(assets_dir):
        if "_orig." in f or "_trimmed" in f:
            full_path = os.path.join(assets_dir, f)
            try:
                os.remove(full_path)
                removed.append(f)
            except Exception as e:
                print(f"  [Aviso] Falha ao remover {f}: {e}")
    if removed:
        print(f"🧹 Limpeza: {len(removed)} arquivo(s) temporário(s) removido(s): {', '.join(removed)}")


def process_image(
    filepath: str,
    padding: int = 16,
    remove_bg: bool = False,
    bg_method: str = "floodfill",
    bg_tolerance: int = 25,
    feather: int = 1,
    to_png: bool = False,
    delete_source: bool = False,
) -> bool:
    """
    Processa uma única imagem:
    1. Remove fundo se solicitado (--remove-bg).
    2. Converte para PNG se solicitado ou se o fundo foi removido.
    3. Faz o trim dos espaços vazios com padding.
    4. Salva a imagem otimizada.
    """
    filename = os.path.basename(filepath)
    ext = os.path.splitext(filepath)[1].lower()
    
    # Se remover fundo ou forçado to_png, o arquivo de destino será .png
    must_be_png = remove_bg or to_png or (ext == ".png")
    if must_be_png and ext != ".png":
        dest_filepath = os.path.splitext(filepath)[0] + ".png"
    else:
        dest_filepath = filepath
        
    dest_filename = os.path.basename(dest_filepath)

    try:
        with Image.open(filepath) as img:
            orig_size = img.size
            current_img = img.copy()

            # 1. Remoção de Fundo
            if remove_bg:
                current_img = remove_background(
                    current_img,
                    method=bg_method,
                    tolerance=bg_tolerance,
                    feather=feather,
                )

            # 2. Trim / Recorte de bordas
            is_rgba = current_img.mode in ("RGBA", "LA") or ("transparency" in current_img.info)
            if is_rgba:
                rgba_img = current_img.convert("RGBA")
                crop_box = get_crop_box_rgba(rgba_img, padding)
                work_img = rgba_img
            else:
                crop_box = get_crop_box_rgb(current_img, padding)
                work_img = current_img

            if crop_box:
                work_img = work_img.crop(crop_box)

            new_size = work_img.size
            has_size_changed = (new_size != orig_size)
            has_bg_removed = remove_bg
            has_format_changed = (filepath != dest_filepath)

            # Se nada mudou e o arquivo de destino já existe, não precisa salvar
            if not has_size_changed and not has_bg_removed and not has_format_changed:
                print(f"  [OK] {filename:<22} já está ajustada ({orig_size[0]}x{orig_size[1]})")
                return False

            # Salva a imagem no destino
            if must_be_png:
                work_img.convert("RGBA").save(dest_filepath, format="PNG", optimize=True)
            else:
                work_img.save(dest_filepath, optimize=True)

            # Se convertemos de JPG/JPEG para PNG e o usuário pediu exclusão do original
            if delete_source and has_format_changed and os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception as e:
                    print(f"    [Aviso] Não foi possível remover {filepath}: {e}")

            # Feedback no console
            details = []
            if has_bg_removed:
                details.append(f"fundo removido ({bg_method})")
            if has_format_changed:
                details.append(f"convertido para PNG")
            if has_size_changed:
                saved_w = orig_size[0] - new_size[0]
                saved_h = orig_size[1] - new_size[1]
                details.append(f"trim: {orig_size[0]}x{orig_size[1]} -> {new_size[0]}x{new_size[1]} (-{saved_w}x{saved_h}px)")
            else:
                details.append(f"tam: {new_size[0]}x{new_size[1]}")

            print(f"  ✨ {dest_filename:<22} [{', '.join(details)}]")
            return True

    except Exception as e:
        print(f"  [Erro] Falha ao processar {filename}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Otimização de Imagens: Remoção de Fundo, Conversão para PNG e Trim com Padding"
    )
    parser.add_argument("--dir", default="assets", help="Pasta com as imagens (padrão: assets)")
    parser.add_argument("--file", default=None, help="Caminho de uma imagem específica para processar")
    parser.add_argument("--padding", type=int, default=16, help="Margem em pixels ao redor da arte (padrão: 16)")
    
    # Flags de remoção de fundo e conversão
    parser.add_argument("--remove-bg", action="store_true", help="Remove o fundo das imagens tornando-o transparente")
    parser.add_argument("--bg-method", choices=["floodfill", "color", "ai"], default="floodfill",
                        help="Método de remoção: 'floodfill' (padrão, seguro), 'color' (cor global), 'ai' (rembg)")
    parser.add_argument("--bg-tolerance", type=int, default=25,
                        help="Tolerância de cor para detecção do fundo (padrão: 25)")
    parser.add_argument("--feather", type=int, default=1,
                        help="Suavização da borda do recorte em pixels (padrão: 1)")
    parser.add_argument("--to-png", action="store_true",
                        help="Força a conversão de imagens JPG/JPEG para PNG")
    parser.add_argument("--delete-source", action="store_true",
                        help="Exclui o arquivo original JPEG/JPG após converter para PNG")
    parser.add_argument("--no-clean", action="store_true",
                        help="Não remover arquivos temporários *_orig.* / *_trimmed.*")
    
    args = parser.parse_args()

    print("=" * 70)
    print("🎨 Otimizador de Assets: Trim & Remoção de Fundo")
    if args.remove_bg:
        print(f"🪄  Remoção de Fundo: ATIVADA (Método: {args.bg_method}, Tolerância: {args.bg_tolerance})")
        print("🖼️  Formato de saída: PNG transparente")
    else:
        print("✂️  Modo: Apenas Trim de espaços vazios (use --remove-bg para remover fundo)")
    print(f"📐 Padding: {args.padding}px")
    print("=" * 70)

    # Modo arquivo individual
    if args.file:
        filepath = os.path.abspath(args.file)
        if not os.path.isfile(filepath):
            print(f"Erro: Arquivo '{filepath}' não encontrado.")
            sys.exit(1)
        process_image(
            filepath,
            padding=args.padding,
            remove_bg=args.remove_bg,
            bg_method=args.bg_method,
            bg_tolerance=args.bg_tolerance,
            feather=args.feather,
            to_png=args.to_png,
            delete_source=args.delete_source,
        )
        print("=" * 70)
        return

    # Modo diretório
    assets_dir = os.path.abspath(args.dir)
    if not os.path.isdir(assets_dir):
        print(f"Erro: Diretório '{assets_dir}' não encontrado.")
        sys.exit(1)

    if not args.no_clean:
        clean_temporary_files(assets_dir)

    valid_extensions = (".png", ".jpg", ".jpeg", ".webp")
    files = sorted([f for f in os.listdir(assets_dir) if f.lower().endswith(valid_extensions)])
    files = [f for f in files if "_orig." not in f and "_trimmed" not in f]

    modified_count = 0
    for filename in files:
        filepath = os.path.join(assets_dir, filename)
        if process_image(
            filepath,
            padding=args.padding,
            remove_bg=args.remove_bg,
            bg_method=args.bg_method,
            bg_tolerance=args.bg_tolerance,
            feather=args.feather,
            to_png=args.to_png,
            delete_source=args.delete_source,
        ):
            modified_count += 1

    print("=" * 70)
    print(f"🎉 Processamento concluído! {modified_count} imagem(ns) processada(s)/otimizada(s).")
    print("=" * 70)


if __name__ == "__main__":
    main()
