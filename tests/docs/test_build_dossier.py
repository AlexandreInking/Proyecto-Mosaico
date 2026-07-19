import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[2] / "tools" / "docs" / "build_dossier.py"
SPEC = importlib.util.spec_from_file_location("build_dossier", MODULE_PATH)
build_dossier = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(build_dossier)


class BuildDossierTests(unittest.TestCase):
    def make_corpus(self, root: Path) -> None:
        documents = root / "documentos"
        documents.mkdir()
        for index in range(15):
            image = "\n![Diagrama](../diagramas/context.png)\n" if index == 0 else ""
            (documents / f"{index:02d}_Chapter.md").write_text(
                "---\n"
                f'title: "Capítulo {index:02d}"\n'
                "lang: es-ES\n"
                "---\n\n"
                f"> **Documento:** PM-{index:02d}  \n\n"
                f"# Capítulo {index:02d}\n"
                f"Contenido {index:02d}.{image}",
                encoding="utf-8",
            )

    def test_build_removes_chapter_frontmatter_and_rewrites_image_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_corpus(root)

            dossier = build_dossier.render_dossier(root)

            self.assertEqual(1, dossier.count("# Proyecto Mosaico — Dossier completo"))
            self.assertNotIn('title: "Capítulo', dossier)
            self.assertIn("![Diagrama](diagramas/context.png)", dossier)
            self.assertNotIn("../diagramas/", dossier)

    def test_build_includes_each_chapter_once_in_numeric_order(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_corpus(root)

            dossier = build_dossier.render_dossier(root)

            positions = [dossier.index(f"> **Documento:** PM-{index:02d}") for index in range(15)]
            self.assertEqual(sorted(positions), positions)
            for index in range(15):
                self.assertEqual(1, dossier.count(f"> **Documento:** PM-{index:02d}"))

    def test_build_is_deterministic_and_uses_lf_newlines(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_corpus(root)

            first = build_dossier.render_dossier(root)
            second = build_dossier.render_dossier(root)

            self.assertEqual(first, second)
            self.assertNotIn("\r\n", first)
            self.assertTrue(first.endswith("\n"))

    def test_build_rejects_incomplete_chapter_sequence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_corpus(root)
            (root / "documentos" / "14_Chapter.md").unlink()

            with self.assertRaisesRegex(ValueError, "00 through 14"):
                build_dossier.render_dossier(root)

    def test_check_reports_generated_dossier_drift(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_corpus(root)
            output = root / "Proyecto_Mosaico_Dossier_Completo.md"
            output.write_text("stale\n", encoding="utf-8")

            self.assertFalse(build_dossier.dossier_is_current(root, output))
            output.write_text(build_dossier.render_dossier(root), encoding="utf-8", newline="\n")
            self.assertTrue(build_dossier.dossier_is_current(root, output))


if __name__ == "__main__":
    unittest.main()
