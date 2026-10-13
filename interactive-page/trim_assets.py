#!/usr/bin/env python3
"""
Script de Otimização e Trim de Imagens (Assets)
Sintetizando - Jornada Interativa

Este script remove os espaços vazios (transparentes ou fundos brancos) das imagens
da pasta assets/, aplicando uma margem de segurança (padding) e salvando as imagens
diretamente com os nomes originais (sem criar arquivos adicionais _trimmed ou _orig).

Uso:
    python3 trim_assets.py
    python3 trim_assets.py --padding 16
    python3 trim_assets.py --dir assets/ --padding 20
"""

import os
import sys
import argparse
from PIL import Image, ImageChops

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
    
    # Se a diferença for insignificante, não precisa cortar
    if x0 == 0 and y0 == 0 and x1 == w and y1 == h:
        return None
        
    return (x0, y0, x1, y1)

def get_crop_box_rgb(img: Image.Image, padding: int = 16, tolerance: int = 8):
    """
    Calcula a caixa de corte para imagens RGB com fundo sólido (ex: branco),
    detectando a cor dos cantos.
    """
    # Cria uma imagem da cor de fundo dos cantos (geralmente branco puro ou quase branco)
    corner_color = img.getpixel((0, 0))
    bg = Image.new(img.mode, img.size, corner_color)
    diff = ImageChops.difference(img, bg)
    
    # Aplica tolerância
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

def trim_image(filepath: str, padding: int = 16):
    """Faz o trim de uma imagem e a sobrescreve no mesmo arquivo original."""
    filename = os.path.basename(filepath)
    try:
        with Image.open(filepath) as img:
            orig_size = img.size
            crop_box = None
            
            if img.mode in ("RGBA", "LA") or ("transparency" in img.info):
                rgba_img = img.convert("RGBA")
                crop_box = get_crop_box_rgba(rgba_img, padding)
                target_mode = "RGBA"
            else:
                crop_box = get_crop_box_rgb(img, padding)
                target_mode = img.mode

            if not crop_box:
                print(f"  [OK] {filename:<20} já está ajustada ({orig_size[0]}x{orig_size[1]})")
                return False

            cropped = img.crop(crop_box)
            new_size = cropped.size

            # Salva no mesmo caminho, sobrescrevendo o original
            cropped.save(filepath, optimize=True)
            saved_w = orig_size[0] - new_size[0]
            saved_h = orig_size[1] - new_size[1]
            print(f"  ✂️  {filename:<20} {orig_size[0]}x{orig_size[1]} -> {new_size[0]}x{new_size[1]} (espaço vazio removido: {saved_w}px L, {saved_h}px A)")
            return True

    except Exception as e:
        print(f"  [Erro] Falha ao processar {filename}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Faz trim de espaços vazios nas imagens de assets/")
    parser.add_argument("--dir", default="assets", help="Caminho da pasta de assets (padrão: assets)")
    parser.add_argument("--padding", type=int, default=16, help="Margem de segurança em pixels ao redor da arte (padrão: 16)")
    parser.add_argument("--no-clean", action="store_true", help="Não remover arquivos temporários *_orig.* / *_trimmed.*")
    args = parser.parse_args()

    assets_dir = os.path.abspath(args.dir)
    if not os.path.isdir(assets_dir):
        print(f"Erro: Diretório '{assets_dir}' não encontrado.")
        sys.exit(1)

    print("=" * 65)
    print(f"✨ Iniciando trim de imagens em: {assets_dir}")
    print(f"📐 Padding configurado: {args.padding}px | Sobrescrevendo originais")
    print("=" * 65)

    if not args.no_clean:
        clean_temporary_files(assets_dir)

    valid_extensions = (".png", ".jpg", ".jpeg", ".webp")
    files = sorted([f for f in os.listdir(assets_dir) if f.lower().endswith(valid_extensions)])
    
    # Processar apenas arquivos originais (ignorar temporários se houver)
    files = [f for f in files if "_orig." not in f and "_trimmed" not in f]

    modified_count = 0
    for filename in files:
        filepath = os.path.join(assets_dir, filename)
        if trim_image(filepath, padding=args.padding):
            modified_count += 1

    print("=" * 65)
    print(f"🎉 Concluído com sucesso! {modified_count} imagem(ns) otimizada(s) e ajustada(s).")
    print("Nenhum código HTML/CSS precisou de novos caminhos de arquivo.")
    print("=" * 65)

if __name__ == "__main__":
    main()
