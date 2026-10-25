"""Renders the Testamentti (perusmalli) template as a branded A4 PDF.

usage: python3 templates/gen_testamentti.py OUT_DIR [variant ...]
Variants are header/footer designs (A–D); default renders all of them.
"""
import sys, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Flowable, KeepTogether)
from reportlab.lib.utils import ImageReader

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONTS = os.path.join(HERE, "fonts")
for name, file in [("NR", "Newsreader-Regular.ttf"), ("NR-M", "Newsreader-Medium.ttf"),
                   ("NR-I", "Newsreader-Italic.ttf"), ("NR-D", "Newsreader-Display.ttf"),
                   ("NR-DL", "Newsreader-DisplayLight.ttf"),
                   ("JBM", "JetBrainsMono-Regular.ttf"), ("JBM-M", "JetBrainsMono-Medium.ttf")]:
    pdfmetrics.registerFont(TTFont(name, os.path.join(FONTS, file)))

INK, PEBBLE, PAPER, MAROON = HexColor("#0F1419"), HexColor("#6B6B6B"), HexColor("#ECE7DD"), HexColor("#5B21B6")
RULE, LINE = HexColor("#CFC9BD"), HexColor("#B9B3A6")
WORDMARK = ImageReader(os.path.join(ROOT, "public", "lexoria-logo-dark.png"))
WORDMARK_PURPLE = ImageReader(os.path.join(HERE, "lexoria-logo-purple.png"))
BARMARK = ImageReader(os.path.join(ROOT, "public", "asianajaja-mark.png"))
WM_RATIO = 377 / 1584

W, H = A4
L = R = 56
FIRM = "Asianajotoimisto Lexoria Oy"
FIRM_EN = "Attorneys Lexoria Ltd"
ADDRESS = "Vekarakatu 14, 13500 Hämeenlinna"
PHONE = "+358 (0)45 656 0060"
WEB = "www.lexoria.fi"
YT = "Y-tunnus 3561005-2"
HOME = "Kotipaikka Hämeenlinna"
SEP = "  ·  "


# ---------- drawing helpers ----------
def text(c, x, y, s, font="JBM", size=6.3, color=PEBBLE, track=0.6, align="left"):
    w = pdfmetrics.stringWidth(s, font, size) + track * (len(s) - 1)
    if align == "right": x -= w
    elif align == "center": x -= w / 2
    c.saveState(); c.setFillColor(color)
    t = c.beginText(x, y); t.setFont(font, size); t.setCharSpace(track); t.textOut(s)
    c.drawText(t); c.restoreState()
    return w

def wordmark(c, x, y, width, img=WORDMARK):
    c.drawImage(img, x, y, width, width * WM_RATIO, mask="auto")

def barmark(c, x, y, size):
    c.drawImage(BARMARK, x, y, size, size, mask="auto")

def hairline(c, y, x0=L, x1=W - R, color=RULE):
    c.saveState(); c.setStrokeColor(color); c.setLineWidth(0.4); c.line(x0, y, x1, y); c.restoreState()

def page_label(doc):
    return f"Sivu {doc.page} / {doc.total_pages}"


# ---------- header / footer variants ----------
def variant_a(c, doc):
    """Purple wordmark left, bar mark right, no rules. Two-line footer."""
    top = H - 46
    wm_w = 98; wm_h = wm_w * WM_RATIO
    wordmark(c, L, top - wm_h, wm_w, WORDMARK_PURPLE)
    mk = 30
    barmark(c, W - R - mk, top - wm_h + (wm_h - mk) / 2, mk)
    text(c, L, 46, f"{FIRM}{SEP}{ADDRESS}{SEP}{PHONE}")
    text(c, L, 35, f"{WEB}{SEP}{YT}{SEP}{HOME}")
    text(c, W - R, 46, page_label(doc), color=INK, align="right")

def variant_b(c, doc):
    """Centered wordmark with a tagline; the bar mark anchors the footer."""
    wm_w = 124; wm_h = wm_w * WM_RATIO
    wordmark(c, (W - wm_w) / 2, H - 44 - wm_h, wm_w)
    text(c, W / 2, H - 44 - wm_h - 13, "ASIANAJOTOIMISTO  ·  ATTORNEYS AT LAW", size=5.6, track=1.5, align="center")
    mk = 20
    barmark(c, (W - mk) / 2, 60, mk)
    text(c, W / 2, 46, f"{FIRM}{SEP}{ADDRESS}{SEP}{PHONE}", align="center")
    text(c, W / 2, 35, f"{WEB}{SEP}{YT}{SEP}{HOME}{SEP}{page_label(doc)}", align="center")

def variant_c(c, doc):
    """Typographic header (firm name in mono caps), bar mark right; wordmark lives in the footer."""
    top = H - 50
    text(c, L, top, "ASIANAJOTOIMISTO LEXORIA OY", font="JBM-M", size=7.4, color=INK, track=1.6)
    text(c, L, top - 11, "ATTORNEYS LEXORIA LTD", size=6, track=1.6)
    mk = 30
    barmark(c, W - R - mk, top - 11 - 6, mk)
    hairline(c, top - 11 - 18)
    hairline(c, 60)
    wm_w = 62
    wordmark(c, L, 36, wm_w)
    text(c, W - R, 46, f"{ADDRESS}{SEP}{PHONE}{SEP}{WEB}", align="right")
    text(c, W - R, 35, f"{YT}{SEP}{HOME}{SEP}{page_label(doc)}", align="right")

def variant_d(c, doc):
    """Paper-tone bands top and bottom carrying the marks and the firm details."""
    c.saveState(); c.setFillColor(PAPER)
    c.rect(0, H - 66, W, 66, stroke=0, fill=1)
    c.rect(0, 0, W, 58, stroke=0, fill=1)
    c.restoreState()
    wm_w = 98; wm_h = wm_w * WM_RATIO
    wordmark(c, L, H - 33 - wm_h / 2, wm_w)
    mk = 28
    barmark(c, W - R - mk, H - 33 - mk / 2, mk)
    text(c, L, 34, f"{FIRM}{SEP}{ADDRESS}{SEP}{PHONE}", color=INK)
    text(c, L, 23, f"{WEB}{SEP}{YT}{SEP}{HOME}")
    text(c, W - R, 34, page_label(doc), color=INK, align="right")

VARIANTS = {
    "A": (variant_a, 112, 82),
    "B": (variant_b, 118, 92),
    "C": (variant_c, 112, 82),
    "D": (variant_d, 96, 80),
}


# ---------- body flowables ----------
class Tracked(Flowable):
    """Single line of letterspaced text; Paragraph has no tracking."""
    def __init__(self, s, font, size, color, track, space_after=0, space_before=0):
        super().__init__()
        self.s, self.font, self.size, self.color, self.track = s, font, size, color, track
        self.h = size * 1.2 + space_after + space_before
        self.space_before, self.space_after = space_before, space_after
    def wrap(self, aw, ah):
        return aw, self.h
    def draw(self):
        text(self.canv, 0, self.space_after + self.size * 0.25, self.s, self.font, self.size, self.color, self.track)

class Field(Flowable):
    """Label in mono caps and a writing line; `segments` splits the line (for dates)."""
    def __init__(self, label, segments=None):
        super().__init__()
        self.label, self.segments = label, segments
        self.h = 24
    def wrap(self, aw, ah):
        self.aw = aw
        return aw, self.h
    def draw(self):
        c = self.canv
        text(c, 0, 8, self.label.upper(), size=6.3, track=1.2)
        x0 = 118; x1 = self.aw
        c.saveState(); c.setStrokeColor(LINE); c.setLineWidth(0.5)
        if not self.segments:
            c.line(x0, 5, x1, 5)
        else:
            x = x0
            for i, (w, sep) in enumerate(self.segments):
                c.line(x, 5, x + w, 5); x += w
                if sep:
                    text(c, x + 6, 8, sep, font="NR", size=10, color=PEBBLE, track=0)
                    x += 6 + pdfmetrics.stringWidth(sep, "NR", 10) + 6
        c.restoreState()

# Ragged right on purpose: justified Finnish body text opens ugly gaps.
body = ParagraphStyle("body", fontName="NR", fontSize=10.5, leading=15.5, textColor=INK, spaceAfter=6)
intro = body

def heading(s):
    return Tracked(s.upper(), "JBM-M", 6.8, INK, 1.5, space_before=10, space_after=4)

def story():
    s = []
    s.append(Tracked("TESTAMENTTI", "NR-D", 27, INK, 4, space_after=4))
    s.append(Tracked("PERUSMALLI  ·  LEXORIA 2026", "JBM", 6.3, MAROON, 1.4, space_after=16))

    s.append(heading("Testamentintekijä"))
    s.append(Paragraph("Minä,", intro))
    for f in ["Nimi", "Henkilötunnus", "Osoite", "Kotikunta"]:
        s.append(Field(f))
    s.append(Spacer(1, 4))
    s.append(Paragraph("olen oikeustoimikelpoisena ja vapaasta tahdostani tehnyt tämän testamentin.", body))

    s.append(heading("Aikaisempien testamenttien peruuttaminen"))
    s.append(Paragraph("Peruutan tällä testamentilla kaikki aikaisemmin tekemäni testamentit ja muut "
                       "kuolemanvaraismääräykset.", body))

    s.append(heading("Testamenttimääräys"))
    s.append(Paragraph("Määrään viimeisenä tahtonani ja testamenttinani, että kuolemani jälkeen koko "
                       "omaisuuteni kaikkine siihen kuolemahetkellä kuuluvine oikeuksineen ja varoineen "
                       "menee täydellä omistusoikeudella,", body))
    for f in ["Nimi", "Henkilötunnus", "Osoite", "Kotikunta"]:
        s.append(Field(f))

    s.append(heading("Avio-oikeuden poissulkeminen"))
    s.append(Paragraph("Määrään, että kaikki testamentinsaajan minulta testamentilla tai perintönä saama "
                       "omaisuus, sen tuotto sekä sen sijaan tullut omaisuus ovat kokonaisuudessaan "
                       "testamentinsaajan avio-oikeuden ulkopuolista omaisuutta. Testamentinsaajan "
                       "nykyisellä tai tulevalla aviopuolisolla ei ole eikä voi saada avioliittolain "
                       "mukaista avio-oikeutta tällaiseen omaisuuteen, sen tuottoon tai sen sijaan "
                       "tulleeseen omaisuuteen.", body))

    s.append(heading("Velat ja kulut"))
    s.append(Paragraph("Jäämistöstä suoritetaan ennen testamentin täytäntöönpanoa kaikki lain mukaiset "
                       "velat, hautauskulut, perunkirjoituksesta aiheutuvat kustannukset sekä muut "
                       "jäämistön selvittämisestä aiheutuvat kulut.", body))

    s.append(KeepTogether([
        heading("Allekirjoitukset"),
        Field("Paikka"),
        Field("Päiväys", segments=[(40, "/"), (40, "/"), (70, None)]),
        Field("Allekirjoitus"),
        Field("Nimen selvennys"),
    ]))

    s.append(KeepTogether([
        heading("Todistajien todistuslauseke"),
        Paragraph("Todistamme täten, että testamentintekijä on omakätisesti allekirjoittanut tämän "
                  "testamentin yhtä aikaa läsnä ollessamme sekä ilmoittanut sen sisältävän hänen "
                  "viimeisen tahtonsa. Olemme samalla todenneet hänen tehneen testamentin vapaasta "
                  "tahdostaan ja olleen kykenevä ymmärtämään testamentin merkityksen.", body),
    ]))
    for n in (1, 2):
        s.append(KeepTogether([
            Tracked(f"TODISTAJA {n}", "JBM", 6.3, PEBBLE, 1.4, space_before=8, space_after=2),
            Field("Nimi"), Field("Henkilötunnus"), Field("Allekirjoitus"),
        ]))
    return s


# ---------- build ----------
class Doc(BaseDocTemplate):
    total_pages = 1

def build(path, variant):
    draw, top, bottom = VARIANTS[variant]
    def make(total):
        doc = Doc(path, pagesize=A4, leftMargin=L, rightMargin=R, topMargin=top, bottomMargin=bottom,
                  title="Testamentti – perusmalli", author=FIRM, subject="Testamenttimalli")
        doc.total_pages = total
        frame = Frame(L, bottom, W - L - R, H - top - bottom, id="f", leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=draw)])
        doc.build(story())
        return doc.page
    total = make(1)      # first pass only counts pages
    make(total)

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for v in (sys.argv[2:] or VARIANTS):
        p = os.path.join(out, f"testamentti-perusmalli-{v}.pdf")
        build(p, v); print("wrote", p)
