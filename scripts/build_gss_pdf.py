"""Renders the GSS questions PDF from scripts/questions.json.
Run:  python3 scripts/build_gss_pdf.py [output.pdf]
"""
import json, sys, pathlib
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether

root = pathlib.Path(__file__).resolve().parent.parent
D = json.loads((root / "scripts" / "questions.json").read_text(encoding="utf-8"))
out = sys.argv[1] if len(sys.argv) > 1 else "GSS questions.pdf"

ink, muted, accent = colors.HexColor("#1f2a24"), colors.HexColor("#5b6b62"), colors.HexColor("#2f6b4f")
title = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=ink, spaceAfter=4)
sub = ParagraphStyle("s", fontName="Helvetica", fontSize=10, leading=14, textColor=muted, spaceAfter=14)
h = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=accent, spaceBefore=16, spaceAfter=8)
qs = ParagraphStyle("q", fontName="Helvetica", fontSize=10.5, leading=14.5, textColor=ink, leftIndent=26, firstLineIndent=-26)
op = ParagraphStyle("o", fontName="Helvetica", fontSize=9.5, leading=13, textColor=muted, leftIndent=26, spaceAfter=9)
sc = ParagraphStyle("sc", fontName="Helvetica", fontSize=9.5, leading=13, textColor=ink, leftIndent=14, firstLineIndent=-14, spaceAfter=3)

def opts_text(o):
    if isinstance(o, str):
        return f"(Scale {o})"
    if o and o[0].startswith("@"):
        extra = [x for x in o[1:]]
        return f"(Scale {o[0][1:]}, plus “{extra[0]}”)" if extra else f"(Scale {o[0][1:]})"
    return " / ".join(o)

def question(label, text, opts, code=None):
    tag = f"<font color='#2f6b4f'>[{escape(code)}]</font> " if code else ""
    return KeepTogether([
        Paragraph(f"<b>{label}</b>&nbsp;&nbsp;{tag}{escape(text)}", qs),
        Paragraph(escape(opts_text(opts)), op),
    ])

story = [
    Paragraph("GSS questions", title),
    Paragraph("General Social Survey items adapted for a Tamil Nadu sample (ages 20–50). "
              "8 demographic items + 42 attitude items. [LOCAL] marks items written for the Tamil Nadu context.", sub),
    Paragraph("Reusable answer scales", h),
]
for k, v in D["scales"].items():
    story.append(Paragraph(f"<b>Scale {k}:</b> " + escape(" / ".join(v)), sc))

story.append(Paragraph("A. Demographics (8)", h))
for code, text, opts in D["demographics"]:
    story.append(question(code + ".", text, opts))

n = 0
for section, items in D["gss"]:
    story.append(Paragraph(f"{escape(section)} ({len(items)})", h))
    for code, text, opts in items:
        n += 1
        story.append(question(f"Q{n}.", text, opts, code))

def footer(c, d):
    c.saveState(); c.setFont("Helvetica", 8); c.setFillColor(muted)
    c.drawCentredString(A4[0] / 2, 12 * mm, f"GSS questions  ·  page {d.page}")
    c.restoreState()

SimpleDocTemplate(out, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm,
                  bottomMargin=20 * mm, title="GSS questions", author="").build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote", out, "-", n, "attitude questions")
