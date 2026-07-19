import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[2] / "tools" / "docs" / "check_docs.py"
SPEC = importlib.util.spec_from_file_location("check_docs", MODULE_PATH)
check_docs = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(check_docs)


class CheckDocsTests(unittest.TestCase):
    def test_reports_missing_relative_link(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            document = root / "guide.md"
            document.write_text("![Missing](images/missing.png)\n", encoding="utf-8")

            issues = check_docs.find_link_issues(root, [document])

            self.assertEqual(1, len(issues))
            self.assertIn("does not exist", issues[0])

    def test_reports_non_portable_mnt_data_reference(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            document = root / "guide.md"
            document.write_text(
                "header-includes: /mnt/data/project/header.tex\n",
                encoding="utf-8",
            )

            issues = check_docs.find_link_issues(root, [document])

            self.assertEqual(1, len(issues))
            self.assertIn("non-portable /mnt/data reference", issues[0])

    def test_accepts_existing_relative_links_and_external_urls(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "images").mkdir()
            (root / "images" / "ok.png").write_bytes(b"png")
            document = root / "guide.md"
            document.write_text(
                "![Existing](images/ok.png)\n"
                "[External](https://example.com/docs)\n"
                "[Section](#local-section)\n",
                encoding="utf-8",
            )

            issues = check_docs.find_link_issues(root, [document])

            self.assertEqual([], issues)

    def test_reports_absolute_local_markdown_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            document = root / "guide.md"
            document.write_text("[Local](/private/build/file.png)\n", encoding="utf-8")

            issues = check_docs.find_link_issues(root, [document])

            self.assertEqual(1, len(issues))
            self.assertIn("absolute local path", issues[0])

    def test_reports_unknown_document_state(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            documents = root / "documentos"
            documents.mkdir()
            document = documents / "00_Test.md"
            document.write_text(
                "> **Documento:** PM-00  \n"
                "> **Versión:** 0.1.0  \n"
                "> **Estado:** Base aprobable  \n",
                encoding="utf-8",
            )

            issues = check_docs.find_metadata_issues(root, [document])

            self.assertEqual(1, len(issues))
            self.assertIn("unknown document state", issues[0])

    def test_accepts_audited_document_with_matching_id(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            documents = root / "documentos"
            documents.mkdir()
            document = documents / "03_Test.md"
            document.write_text(
                "> **Documento:** PM-03  \n"
                "> **Versión:** 0.1.1  \n"
                "> **Estado:** Auditado; no aprobado para implementación.  \n",
                encoding="utf-8",
            )

            issues = check_docs.find_metadata_issues(root, [document])

            self.assertEqual([], issues)

    def test_reports_document_id_that_does_not_match_filename(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            documents = root / "documentos"
            documents.mkdir()
            document = documents / "04_Test.md"
            document.write_text(
                "> **Documento:** PM-03  \n"
                "> **Versión:** 0.1.1  \n"
                "> **Estado:** Auditado  \n",
                encoding="utf-8",
            )

            issues = check_docs.find_metadata_issues(root, [document])

            self.assertEqual(1, len(issues))
            self.assertIn("does not match filename", issues[0])


if __name__ == "__main__":
    unittest.main()
