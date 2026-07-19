import importlib.util
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader


MODULE_PATH = Path(__file__).parents[2] / "tools" / "docs" / "render_pdf.py"
SPEC = importlib.util.spec_from_file_location("render_pdf", MODULE_PATH)
render_pdf = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(render_pdf)


class RenderPdfTests(unittest.TestCase):
    def test_renders_markdown_headings_paragraphs_lists_code_and_table(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "sample.md"
            output = root / "sample.pdf"
            source.write_text(
                "# Documento de prueba\n\n"
                "Párrafo con **énfasis** y `código`.\n\n"
                "- Elemento uno\n"
                "- Elemento dos\n\n"
                "```text\nvalor = 42\n```\n\n"
                "| Columna | Valor |\n"
                "|---|---|\n"
                "| Estado | Auditado |\n",
                encoding="utf-8",
            )

            render_pdf.render_pdf(source, output)

            self.assertTrue(output.read_bytes().startswith(b"%PDF-"))
            reader = PdfReader(output)
            self.assertGreaterEqual(len(reader.pages), 1)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            self.assertIn("Documento de prueba", text)
            self.assertIn("Elemento uno", text)
            self.assertIn("valor = 42", text)
            self.assertIn("Auditado", text)

    def test_render_is_reproducible_in_page_count_and_text(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "sample.md"
            first = root / "first.pdf"
            second = root / "second.pdf"
            source.write_text("# Repetible\n\nMismo contenido.\n", encoding="utf-8")

            render_pdf.render_pdf(source, first)
            render_pdf.render_pdf(source, second)

            first_reader = PdfReader(first)
            second_reader = PdfReader(second)
            self.assertEqual(len(first_reader.pages), len(second_reader.pages))
            self.assertEqual(
                first_reader.pages[0].extract_text(),
                second_reader.pages[0].extract_text(),
            )


if __name__ == "__main__":
    unittest.main()
