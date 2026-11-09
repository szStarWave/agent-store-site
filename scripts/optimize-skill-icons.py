#!/usr/bin/env python3
"""把市场索引引用到的图标压成适合目录页的小尺寸 WebP / 原样保留 SVG。

由 `scripts/import-wmc-skill-index.mjs` 调用；输入是一个 JSON 映射数组：
`[{ "src": "<绝对路径>", "dst": "<相对 icons/ 的文件名>" }, ...]`。

目录页头像按 40×40 CSS 像素渲染，128px 已经覆盖 3x 屏；把上游动辄上百 KB 的
PNG/JPG 原图直接入库会让仓库无谓膨胀。SVG 是矢量，原样复制。

需要 Pillow（本仓库不把它列为运行时依赖：这是维护脚本，不进 `check:release`）。
"""

import json
import os
import shutil
import sys

from PIL import Image


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: optimize-skill-icons.py <mapping.json> <target-dir> <max-size>", file=sys.stderr)
        return 2
    mapping_file, target_dir, max_size_text = sys.argv[1], sys.argv[2], sys.argv[3]
    max_size = int(max_size_text)

    with open(mapping_file, encoding="utf-8") as handle:
        mapping = json.load(handle)

    os.makedirs(target_dir, exist_ok=True)
    total = 0
    for item in mapping:
        src = item["src"]
        rel = item["dst"]
        dst = os.path.join(target_dir, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)

        if os.path.splitext(rel)[1].lower() == ".svg":
            shutil.copyfile(src, dst)
            total += os.path.getsize(dst)
            continue

        with Image.open(src) as image:
            image.load()
            if image.mode not in ("RGBA", "RGB"):
                image = image.convert("RGBA")
            width, height = image.size
            if max(width, height) > max_size:
                ratio = max_size / max(width, height)
                image = image.resize(
                    (max(1, int(width * ratio)), max(1, int(height * ratio))),
                    Image.Resampling.LANCZOS,
                )
            image.save(dst, "WEBP", quality=82, method=4)
        total += os.path.getsize(dst)

    print(f"[optimize-skill-icons] {len(mapping)} icon(s) -> {total / 1048576:.2f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
