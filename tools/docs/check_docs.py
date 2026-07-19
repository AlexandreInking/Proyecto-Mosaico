#!/usr/bin/env python3
"""Check canonical and generated Markdown for non-portable or missing local links."""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from urllib.parse import unquote


MARKDOWN_LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
EXTERNAL_SCHEME = re.compile(r"^[a-z][a-z0-9+.-]*://", re.IGNORECASE)
WINDOWS_ABSOLUTE = re.compile(r"^[a-zA-Z]:[\\/]")
DOCUMENT_FILE_ID = re.compile(r"^(\d{2})_")
DOCUMENT_MARKER = re.compile(r"^> \*\*Documento:\*\* PM-(\d{2})", re.MULTILINE)
VERSION_MARKER = re.compile(r"^> \*\*Versión:\*\* (\S+)", re.MULTILINE)
STATE_MARKER = re.compile(r"^> \*\*Estado:\*\* ([^;.,—\n]+)", re.MULTILINE)
ALLOWED_STATES = {"Borrador", "Auditado", "Aprobado", "Estable", "Sustituido"}


def repository_markdown_files(root: Path) -> list[Path]:
    files = [root / "README.md", root / "Proyecto_Mosaico_Dossier_Completo.md"]
    files.extend(sorted((root / "documentos").glob("[0-9][0-9]_*.md")))
    return [path for path in files if path.is_file()]


def find_link_issues(root: Path, files: list[Path]) -> list[str]:
    issues: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        display = path.relative_to(root).as_posix()
        for line_number, line in enumerate(text.splitlines(), start=1):
            if "/mnt/data/" in line:
                issues.append(f"{display}:{line_number}: non-portable /mnt/data reference")

            for match in MARKDOWN_LINK.finditer(line):
                target = match.group(1).strip().strip("<>")
                if not target or target.startswith("#") or target.startswith("mailto:"):
                    continue
                if EXTERNAL_SCHEME.match(target):
                    continue
                if target.startswith("/") or WINDOWS_ABSOLUTE.match(target):
                    if "/mnt/data/" not in target:
                        issues.append(f"{display}:{line_number}: absolute local path: {target}")
                    continue

                local_target = unquote(target.split("#", maxsplit=1)[0])
                resolved = (path.parent / local_target).resolve()
                try:
                    resolved.relative_to(root.resolve())
                except ValueError:
                    issues.append(f"{display}:{line_number}: local link escapes repository: {target}")
                    continue
                if not resolved.exists():
                    issues.append(f"{display}:{line_number}: local link does not exist: {target}")
    return issues


def find_metadata_issues(root: Path, files: list[Path]) -> list[str]:
    issues: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        display = path.relative_to(root).as_posix()
        filename_id = DOCUMENT_FILE_ID.match(path.name)
        document_id = DOCUMENT_MARKER.search(text)
        version = VERSION_MARKER.search(text)
        state = STATE_MARKER.search(text)

        if not document_id:
            issues.append(f"{display}: missing document ID")
        elif filename_id and document_id.group(1) != filename_id.group(1):
            issues.append(f"{display}: document ID does not match filename")
        if not version:
            issues.append(f"{display}: missing document version")
        if not state:
            issues.append(f"{display}: missing document state")
        elif state.group(1).strip() not in ALLOWED_STATES:
            issues.append(f"{display}: unknown document state: {state.group(1).strip()}")
    return issues


def parse_args() -> argparse.Namespace:
    default_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=default_root)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    files = repository_markdown_files(root)
    chapters = sorted((root / "documentos").glob("[0-9][0-9]_*.md"))
    issues = find_link_issues(root, files) + find_metadata_issues(root, chapters)
    if issues:
        print("\n".join(issues))
        print(f"Problemas documentales: {len(issues)}")
        return 1
    print("Enlaces documentales locales: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
