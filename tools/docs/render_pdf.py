#!/usr/bin/env python3
"""Render Proyecto Mosaico Markdown to a portable PDF using bundled ReportLab."""

from __future__ import annotations

import argparse
import html
import re
import textwrap
from pathlib import Path

import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.utils import ImageReader


IMAGE_LINE = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)$")
HEADING = re.compile(r"^(#{1,6})\s+(.+)$")
LIST_ITEM = re.compile(r"^(?:[-*]|\d+\.)\s+(.+)$")
TABLE_SEPARATOR = re.compile(r"^:?-{3,}:?$")


def register_fonts() -> None:
    fonts = Path(reportlab.__file__).resolve().parent / "fonts"
    registrations = {
        "MosaicoSans": fonts / "Vera.ttf",
        "MosaicoSans-Bold": fonts / "VeraBd.ttf",
    }
    for name, path in registrations.items():
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(name, path))
    pdfmetrics.registerFontFamily(
        "MosaicoSans",
        normal="MosaicoSans",
        bold="MosaicoSans-Bold",
    )


def inline_markup(text: str) -> str:
    rendered = html.escape(text)
    rendered = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", rendered)
    rendered = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', rendered)
    return rendered


def parse_table(lines: list[str]) -> list[list[str]]:
    rows = [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in lines]
    return [
        row
        for row in rows
        if not all(TABLE_SEPARATOR.match(cell.replace(" ", "")) for cell in row)
    ]


def build_story(source: Path, available_width: float) -> list[object]:
    register_fonts()
    base = getSampleStyleSheet()
    body = ParagraphStyle(
        "MosaicoBody",
        parent=base["BodyText"],
        fontName="MosaicoSans",
        fontSize=9,
        leading=12,
        bulletFontName="MosaicoSans",
        bulletFontSize=8,
        spaceAfter=4,
    )
    quote = ParagraphStyle("MosaicoQuote", parent=body, leftIndent=10, textColor=colors.HexColor("#444444"))
    code = ParagraphStyle(
        "MosaicoCode",
        parent=base["Code"],
        fontName="Courier",
        fontSize=6.5,
        leading=8,
        leftIndent=6,
        rightIndent=6,
        backColor=colors.HexColor("#F3F4F6"),
        borderPadding=5,
        spaceBefore=4,
        spaceAfter=6,
    )
    headings = {
        level: ParagraphStyle(
            f"MosaicoH{level}",
            parent=base[f"Heading{min(level, 4)}"],
            fontName="MosaicoSans-Bold",
            fontSize=max(11, 22 - level * 2),
            leading=max(14, 25 - level * 2),
            textColor=colors.HexColor("#172033"),
            spaceBefore=8,
            spaceAfter=6,
        )
        for level in range(1, 7)
    }

    lines = source.read_text(encoding="utf-8").replace("\r\n", "\n").splitlines()
    story: list[object] = []
    index = 0
    while index < len(lines):
        line = lines[index].rstrip()
        if not line:
            story.append(Spacer(1, 2))
            index += 1
            continue
        if line.startswith("```"):
            index += 1
            code_lines: list[str] = []
            while index < len(lines) and not lines[index].startswith("```"):
                code_lines.extend(textwrap.wrap(lines[index], width=105) or [""])
                index += 1
            index += 1
            story.append(Preformatted("\n".join(code_lines), code))
            continue
        heading = HEADING.match(line)
        if heading:
            level = len(heading.group(1))
            story.append(Paragraph(inline_markup(heading.group(2)), headings[level]))
            index += 1
            continue
        image = IMAGE_LINE.match(line)
        if image:
            image_path = (source.parent / image.group(2)).resolve()
            if not image_path.is_file():
                raise FileNotFoundError(f"Missing Markdown image: {image.group(2)}")
            width, height = ImageReader(image_path).getSize()
            scale = min(available_width / width, 95 * mm / height, 1.0)
            story.append(Image(image_path, width=width * scale, height=height * scale))
            story.append(Paragraph(inline_markup(image.group(1)), quote))
            index += 1
            continue
        if line.startswith("|") and line.endswith("|"):
            table_lines: list[str] = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].strip())
                index += 1
            rows = parse_table(table_lines)
            columns = max(len(row) for row in rows)
            data = [[Paragraph(inline_markup(cell), body) for cell in row] for row in rows]
            table = Table(data, colWidths=[available_width / columns] * columns, repeatRows=1)
            table.setStyle(
                TableStyle(
                    [
                        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#AAB2C0")),
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8ECF3")),
                        ("FONTNAME", (0, 0), (-1, 0), "MosaicoSans-Bold"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            story.append(table)
            story.append(Spacer(1, 6))
            continue
        if line == "---":
            story.append(Spacer(1, 6))
            index += 1
            continue
        list_item = LIST_ITEM.match(line)
        if list_item:
            story.append(Paragraph(inline_markup(list_item.group(1)), body, bulletText="•"))
            index += 1
            continue
        if line.startswith(">"):
            story.append(Paragraph(inline_markup(line.lstrip("> ")), quote))
            index += 1
            continue

        paragraph = [line]
        index += 1
        while index < len(lines) and lines[index].strip() and not any(
            (
                HEADING.match(lines[index]),
                IMAGE_LINE.match(lines[index]),
                LIST_ITEM.match(lines[index]),
                lines[index].startswith("```"),
                lines[index].startswith("|"),
                lines[index].startswith(">"),
                lines[index].strip() == "---",
            )
        ):
            paragraph.append(lines[index].strip())
            index += 1
        story.append(Paragraph(inline_markup(" ".join(paragraph)), body))
    return story


def draw_page_number(canvas, document) -> None:
    canvas.saveState()
    canvas.setFont("MosaicoSans", 8)
    canvas.setFillColor(colors.HexColor("#606A78"))
    canvas.drawCentredString(A4[0] / 2, 10 * mm, str(document.page))
    canvas.restoreState()


def render_pdf(source: Path, output: Path) -> None:
    register_fonts()
    output.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="Proyecto Mosaico — Dossier completo",
        author="Proyecto Mosaico",
    )
    story = build_story(source, document.width)
    document.build(story, onFirstPage=draw_page_number, onLaterPages=draw_page_number)


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=root / "Proyecto_Mosaico_Dossier_Completo.md")
    parser.add_argument("--output", type=Path, default=root / "output" / "pdf" / "Proyecto_Mosaico_Dossier_Completo.pdf")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    render_pdf(args.source.resolve(), args.output.resolve())
    print(f"PDF generado: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
