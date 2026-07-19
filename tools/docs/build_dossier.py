#!/usr/bin/env python3
"""Build the generated dossier from the canonical PM-00 through PM-14 chapters."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


CHAPTER_PATTERN = re.compile(r"^(\d{2})_.+\.md$")
EXPECTED_CHAPTERS = tuple(range(15))
DEFAULT_OUTPUT = "Proyecto_Mosaico_Dossier_Completo.md"


def discover_chapters(root: Path) -> list[Path]:
    documents = root / "documentos"
    chapters: list[tuple[int, Path]] = []
    for path in documents.glob("[0-9][0-9]_*.md"):
        match = CHAPTER_PATTERN.match(path.name)
        if match:
            chapters.append((int(match.group(1)), path))

    chapters.sort(key=lambda item: item[0])
    indexes = tuple(index for index, _ in chapters)
    if indexes != EXPECTED_CHAPTERS:
        raise ValueError("Canonical chapters must form the complete sequence 00 through 14")
    return [path for _, path in chapters]


def strip_frontmatter(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return normalized.lstrip("\n")

    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return "".join(lines[index + 1 :]).lstrip("\n")
    raise ValueError("Unclosed YAML frontmatter")


def rewrite_for_dossier(text: str) -> str:
    return text.replace("](../diagramas/", "](diagramas/")


def render_dossier(root: Path) -> str:
    sections = []
    for path in discover_chapters(root):
        source = path.read_text(encoding="utf-8")
        body = rewrite_for_dossier(strip_frontmatter(source)).rstrip()
        sections.append(body)

    preface = (
        "# Proyecto Mosaico — Dossier completo\n\n"
        "> **Artefacto generado. No editar directamente.**  \n"
        "> Fuentes canónicas: `documentos/00_...md` a `documentos/14_...md`.  \n"
        "> Regenerar: `python tools/docs/build_dossier.py`.\n"
    )
    return preface + "\n\n---\n\n" + "\n\n---\n\n".join(sections) + "\n"


def dossier_is_current(root: Path, output: Path) -> bool:
    return output.is_file() and output.read_bytes() == render_dossier(root).encode("utf-8")


def write_dossier(root: Path, output: Path) -> None:
    output.write_text(render_dossier(root), encoding="utf-8", newline="\n")


def parse_args() -> argparse.Namespace:
    default_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=default_root)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check", action="store_true", help="Fail when generated dossier is stale")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    output = args.output.resolve() if args.output else root / DEFAULT_OUTPUT
    if args.check:
        if dossier_is_current(root, output):
            print(f"Dossier vigente: {output}")
            return 0
        print(f"Dossier desactualizado: {output}")
        return 1

    write_dossier(root, output)
    print(f"Dossier generado: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
