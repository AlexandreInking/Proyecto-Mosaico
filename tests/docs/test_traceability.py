import csv
import tempfile
import unittest
from pathlib import Path

from tools.docs import check_traceability


class TraceabilityTests(unittest.TestCase):
    def write_matrix(self, root: Path, rows: list[dict[str, str]]) -> Path:
        path = root / "matrix.csv"
        with path.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=check_traceability.REQUIRED_COLUMNS)
            writer.writeheader()
            writer.writerows(rows)
        return path

    def valid_row(self, requirement: str = "REQ-PROJ-001") -> dict[str, str]:
        return {
            "requisito": requirement,
            "prioridad": "P0",
            "objetivo_producto": "Herramienta profesional",
            "documento_contrato": "PM-05 Formato nativo",
            "documento_ux": "PM-06 Flujo básico",
            "documento_pruebas": "PM-12 Round-trip",
            "fase_roadmap": "Fase 1",
            "verificacion_prevista": "Hash igual después de reabrir",
            "cobertura": "Aprobado",
            "notas": "Contrato aprobado para F1",
        }

    def test_accepts_complete_approved_row(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = self.write_matrix(root, [self.valid_row()])

            self.assertEqual([], check_traceability.validate_matrix(path, {"REQ-PROJ-001"}))

    def test_rejects_inferred_priority_and_unjustified_exception(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            row = self.valid_row()
            row["prioridad"] = "P0 (inferida)"
            row["cobertura"] = "Excepción justificada"
            row["notas"] = ""
            path = self.write_matrix(root, [row])

            errors = check_traceability.validate_matrix(path, {"REQ-PROJ-001"})

            self.assertTrue(any("prioridad" in error for error in errors))
            self.assertTrue(any("excepción" in error for error in errors))

    def test_rejects_duplicates_missing_and_unknown_requirements(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = self.write_matrix(
                root,
                [self.valid_row("REQ-PROJ-001"), self.valid_row("REQ-PROJ-001"), self.valid_row("REQ-X-999")],
            )

            errors = check_traceability.validate_matrix(path, {"REQ-PROJ-001", "REQ-PROJ-002"})

            self.assertTrue(any("duplicado" in error for error in errors))
            self.assertTrue(any("faltante" in error for error in errors))
            self.assertTrue(any("desconocido" in error for error in errors))

    def test_extracts_requirement_ids_from_pm02(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            document = Path(temporary) / "pm02.md"
            document.write_text("| REQ-PROJ-001 | Uno |\n| REQ-NFR-007 | Dos |\n", encoding="utf-8")

            self.assertEqual(
                {"REQ-PROJ-001", "REQ-NFR-007"},
                check_traceability.extract_requirement_ids(document),
            )


if __name__ == "__main__":
    unittest.main()
