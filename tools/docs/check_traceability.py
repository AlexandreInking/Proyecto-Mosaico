#!/usr/bin/env python3
"""Validate bidirectional requirement coverage for Proyecto Mosaico."""

from __future__ import annotations

import csv
import re
from pathlib import Path


REQUIREMENT = re.compile(r"\bREQ-[A-Z]+-\d{3}\b")
REQUIRED_COLUMNS = [
    "requisito",
    "prioridad",
    "objetivo_producto",
    "documento_contrato",
    "documento_ux",
    "documento_pruebas",
    "fase_roadmap",
    "verificacion_prevista",
    "cobertura",
    "notas",
]
VALID_PRIORITIES = {"P0", "P1", "P2", "P3"}
VALID_COVERAGE = {"Aprobado", "Excepción justificada"}


def extract_requirement_ids(document: Path) -> set[str]:
    return set(REQUIREMENT.findall(document.read_text(encoding="utf-8")))


def validate_matrix(matrix: Path, expected: set[str]) -> list[str]:
    errors: list[str] = []
    with matrix.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        missing_columns = [column for column in REQUIRED_COLUMNS if column not in (reader.fieldnames or [])]
        if missing_columns:
            return [f"Columnas faltantes: {', '.join(missing_columns)}"]
        rows = list(reader)

    seen: set[str] = set()
    required_nonempty = REQUIRED_COLUMNS[:-1]
    for line, row in enumerate(rows, start=2):
        requirement = row["requisito"].strip()
        if requirement in seen:
            errors.append(f"Línea {line}: requisito duplicado {requirement}")
        seen.add(requirement)
        if requirement not in expected:
            errors.append(f"Línea {line}: requisito desconocido {requirement}")
        if row["prioridad"].strip() not in VALID_PRIORITIES:
            errors.append(f"Línea {line}: prioridad no aprobada {row['prioridad']!r}")
        coverage = row["cobertura"].strip()
        if coverage not in VALID_COVERAGE:
            errors.append(f"Línea {line}: cobertura inválida {coverage!r}")
        if coverage == "Excepción justificada" and not row["notas"].strip():
            errors.append(f"Línea {line}: excepción sin justificación")
        for column in required_nonempty:
            if not row[column].strip():
                errors.append(f"Línea {line}: campo vacío {column}")

    for requirement in sorted(expected - seen):
        errors.append(f"Requisito faltante: {requirement}")
    return errors


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    expected = extract_requirement_ids(root / "documentos" / "02_Especificacion_de_Requisitos.md")
    errors = validate_matrix(root / "analisis_documental" / "02_matriz_trazabilidad.csv", expected)
    if len(expected) != 56:
        errors.append(f"PM-02 contiene {len(expected)} IDs REQ; se esperaban 56")
    if errors:
        print("Trazabilidad inválida:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Trazabilidad bidireccional: OK ({len(expected)}/56 REQ)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
