"""
build.py — Konverterar en .md-fil (med YAML-frontmatter) till PDF.

Användning:
    python tools/md-to-pdf/build.py <input.md> [<output.pdf>]

Om output utelämnas hamnar PDF:en bredvid .md:n med samma basnamn.

Beroenden (pip install): reportlab pyyaml markdown-it-py
"""

import os
import sys
import re
from pathlib import Path

import yaml
from markdown_it import MarkdownIt
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)


# ----- Argument -----
if len(sys.argv) < 2:
    print("Ange en .md-fil. Ex: python build.py docs/info/.../foo.md")
    sys.exit(1)

input_path = Path(sys.argv[1])
output_path = Path(sys.argv[2]) if len(sys.argv) >= 3 else input_path.with_suffix(".pdf")

raw = input_path.read_text(encoding="utf-8")


# ----- Frontmatter -----
def split_frontmatter(text):
    m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n(.*)$", text, re.DOTALL)
    if not m:
        return {}, text
    meta = yaml.safe_load(m.group(1)) or {}
    return meta, m.group(2)


meta, body = split_frontmatter(raw)


# ----- Stilar -----
styles = getSampleStyleSheet()

H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=18, leading=22, spaceBefore=8, spaceAfter=6, textColor=colors.HexColor("#111111"))
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=14, leading=18, spaceBefore=10, spaceAfter=4, textColor=colors.HexColor("#111111"))
H3 = ParagraphStyle("H3", parent=styles["Heading3"], fontSize=12, leading=15, spaceBefore=8, spaceAfter=3, textColor=colors.HexColor("#222222"))
BODY = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=10, leading=14, spaceAfter=4, textColor=colors.black)
LIST_ITEM = ParagraphStyle("ListItem", parent=BODY, leftIndent=14, spaceAfter=2, bulletIndent=2)
CODE = ParagraphStyle("Code", parent=styles["Code"], fontSize=9, leading=12, leftIndent=8, backColor=colors.HexColor("#f5f5f5"), borderPadding=4)
META_LABEL = ParagraphStyle("MetaLabel", parent=BODY, fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#444444"))
META_VALUE = ParagraphStyle("MetaValue", parent=BODY, fontSize=9, textColor=colors.HexColor("#111111"))


# ----- Inline markdown → ReportLab markup -----
INLINE_RE_BOLD = re.compile(r"\*\*(.+?)\*\*")
INLINE_RE_ITALIC = re.compile(r"(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)")
INLINE_RE_CODE = re.compile(r"`([^`]+)`")
INLINE_RE_LINK = re.compile(r"\[(.+?)\]\(([^)]+)\)")


def escape_xml(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline_to_xml(text):
    """Konvertera markdown-inline till ReportLab Paragraph-XML."""
    # Skydda kod-spans först (innehåller specialtecken)
    placeholders = {}
    def stash_code(m):
        key = f"\x00CODE{len(placeholders)}\x00"
        placeholders[key] = f"<font name='Courier'>{escape_xml(m.group(1))}</font>"
        return key
    text = INLINE_RE_CODE.sub(stash_code, text)

    text = escape_xml(text)

    # Länkar (efter escape så att URL:er fortfarande funkar)
    text = INLINE_RE_LINK.sub(r'<link href="\2" color="#0645ad"><u>\1</u></link>', text)
    # Fetstil + kursiv
    text = INLINE_RE_BOLD.sub(r"<b>\1</b>", text)
    text = INLINE_RE_ITALIC.sub(r"<i>\1</i>", text)

    for key, val in placeholders.items():
        text = text.replace(key, val)
    return text


# ----- Render meta-block -----
def build_meta_block():
    rows = []
    fields = [
        ("Titel", meta.get("title", "")),
        ("Kategori", meta.get("category", "")),
        ("Slug", meta.get("slug", "")),
        ("Uppdaterad", meta.get("last_updated", "")),
    ]
    if meta.get("short_description"):
        fields.append(("Kort beskrivning", meta.get("short_description")))
    for label, val in fields:
        rows.append([
            Paragraph(label, META_LABEL),
            Paragraph(inline_to_xml(str(val) if val else "—"), META_VALUE),
        ])
    table = Table(rows, colWidths=[30 * mm, None])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f4f4f4")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


# ----- Markdown-body → flowables -----
md = MarkdownIt("commonmark", {"html": False}).enable("table")
tokens = md.parse(body)


def render_tokens(tokens):
    """Walk markdown-it tokens and yield ReportLab flowables."""
    flowables = []
    i = 0
    while i < len(tokens):
        t = tokens[i]

        if t.type == "heading_open":
            level = int(t.tag[1])
            style = {1: H1, 2: H2, 3: H3}.get(level, H3)
            text = tokens[i + 1].content
            flowables.append(Paragraph(inline_to_xml(text), style))
            i += 3  # heading_open, inline, heading_close
            continue

        if t.type == "paragraph_open":
            text = tokens[i + 1].content
            flowables.append(Paragraph(inline_to_xml(text), BODY))
            i += 3
            continue

        if t.type == "bullet_list_open" or t.type == "ordered_list_open":
            ordered = t.type == "ordered_list_open"
            start = int(t.attrs.get("start", 1)) if ordered else None
            i, items = _collect_list_items(tokens, i + 1)
            for idx, item_flowables in enumerate(items):
                bullet = f"{start + idx}." if ordered else "•"
                # Slå ihop första texten med bullet via en tabell-cell
                if item_flowables:
                    first = item_flowables[0]
                    rest = item_flowables[1:]
                    row = [[Paragraph(bullet, BODY), first]]
                    tbl = Table(row, colWidths=[8 * mm, None])
                    tbl.setStyle(TableStyle([
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ]))
                    flowables.append(tbl)
                    flowables.extend(rest)
            flowables.append(Spacer(1, 4))
            continue

        if t.type == "fence" or t.type == "code_block":
            flowables.append(Paragraph(f"<font name='Courier'>{escape_xml(t.content).replace(chr(10), '<br/>')}</font>", CODE))
            flowables.append(Spacer(1, 4))
            i += 1
            continue

        if t.type == "hr":
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceBefore=6, spaceAfter=6))
            i += 1
            continue

        if t.type == "blockquote_open":
            j = i + 1
            depth = 1
            inner = []
            while j < len(tokens) and depth > 0:
                if tokens[j].type == "blockquote_open":
                    depth += 1
                elif tokens[j].type == "blockquote_close":
                    depth -= 1
                    if depth == 0:
                        break
                inner.append(tokens[j])
                j += 1
            sub = render_tokens(inner)
            # Indent
            indented_style = ParagraphStyle("Quote", parent=BODY, leftIndent=14, textColor=colors.HexColor("#555555"), fontName="Helvetica-Oblique")
            for f in sub:
                if isinstance(f, Paragraph):
                    flowables.append(Paragraph(f.text, indented_style))
                else:
                    flowables.append(f)
            i = j + 1
            continue

        if t.type == "table_open":
            i, table_flowable = _render_table(tokens, i)
            flowables.append(table_flowable)
            flowables.append(Spacer(1, 4))
            continue

        i += 1
    return flowables


def _collect_list_items(tokens, start_idx):
    """Returnerar (next_idx, [item_flowables_per_item])."""
    items = []
    i = start_idx
    depth = 1
    current_item_tokens = None
    while i < len(tokens) and depth > 0:
        t = tokens[i]
        if t.type in ("bullet_list_open", "ordered_list_open"):
            depth += 1
            if current_item_tokens is not None:
                current_item_tokens.append(t)
        elif t.type in ("bullet_list_close", "ordered_list_close"):
            depth -= 1
            if depth == 0:
                break
            if current_item_tokens is not None:
                current_item_tokens.append(t)
        elif t.type == "list_item_open" and depth == 1:
            current_item_tokens = []
        elif t.type == "list_item_close" and depth == 1:
            items.append(render_tokens(current_item_tokens))
            current_item_tokens = None
        else:
            if current_item_tokens is not None:
                current_item_tokens.append(t)
        i += 1
    return i + 1, items


def _render_table(tokens, idx):
    """Returnerar (next_idx, Table-flowable)."""
    rows = []
    current_row = None
    in_header = False
    i = idx + 1
    depth = 1
    while i < len(tokens) and depth > 0:
        t = tokens[i]
        if t.type == "table_close":
            break
        if t.type == "thead_open":
            in_header = True
        elif t.type == "thead_close":
            in_header = False
        elif t.type == "tr_open":
            current_row = []
        elif t.type == "tr_close":
            if current_row is not None:
                rows.append((in_header, current_row))
                current_row = None
        elif t.type in ("th_open", "td_open"):
            # nästa token är inline
            inline = tokens[i + 1]
            text = inline.content if inline.type == "inline" else ""
            style = META_LABEL if t.type == "th_open" else BODY
            if current_row is not None:
                current_row.append(Paragraph(inline_to_xml(text), style))
        i += 1

    data = [r[1] for r in rows]
    if not data:
        return i + 1, Spacer(1, 0)
    cols = max(len(r) for r in data)
    for r in data:
        while len(r) < cols:
            r.append(Paragraph("", BODY))

    tbl = Table(data, repeatRows=1 if rows and rows[0][0] else 0)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dddddd")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return i + 1, tbl


# ----- Bygg PDF -----
doc = SimpleDocTemplate(
    str(output_path),
    pagesize=A4,
    leftMargin=20 * mm,
    rightMargin=20 * mm,
    topMargin=18 * mm,
    bottomMargin=18 * mm,
    title=meta.get("title") or input_path.stem,
    subject=meta.get("short_description") or "",
    keywords=meta.get("category") or "",
)

story = [build_meta_block(), Spacer(1, 6)]
story.extend(render_tokens(tokens))

doc.build(story)
print(f"PDF genererad: {output_path}")
