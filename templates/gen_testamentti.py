"""Renders the Testamentti (perusmalli) template as a branded A4 PDF in fi, en and et.

usage: python3 templates/gen_testamentti.py OUT_DIR [VARIANT]
Writes testamentti-perusmalli-{fi,en,et}.pdf with header/footer variant A (default) or B–D.
The en and et texts are translations of the client's Finnish original and still need
the firm's legal review.
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
PHONE = "+358 (0)45 656 0060"
WEB = "www.lexoria.fi"
YT = "Y-tunnus 3561005-2"
SEP = "  ·  "



T = {
    "fi": {
        "page": "Sivu",
        "title": "TESTAMENTTI",
        "subtitle": "PERUSMALLI  ·  LEXORIA 2026",
        "testator": "Testamentintekijä",
        "i": "Minä,",
        "person": ["Nimi", "Henkilötunnus", "Osoite", "Kotikunta"],
        "capacity": "olen oikeustoimikelpoisena ja vapaasta tahdostani tehnyt tämän testamentin.",
        "revoke_h": "Aikaisempien testamenttien peruuttaminen",
        "revoke": "Peruutan tällä testamentilla kaikki aikaisemmin tekemäni testamentit ja muut kuolemanvaraismääräykset.",
        "disp_h": "Testamenttimääräys",
        "disp": "Määrään viimeisenä tahtonani ja testamenttinani, että kuolemani jälkeen koko omaisuuteni kaikkine "
                "siihen kuolemahetkellä kuuluvine oikeuksineen ja varoineen menee täydellä omistusoikeudella,",
        "marital_h": "Avio-oikeuden poissulkeminen",
        "marital": "Määrään, että kaikki testamentinsaajan minulta testamentilla tai perintönä saama omaisuus, sen tuotto "
                   "sekä sen sijaan tullut omaisuus ovat kokonaisuudessaan testamentinsaajan avio-oikeuden ulkopuolista "
                   "omaisuutta. Testamentinsaajan nykyisellä tai tulevalla aviopuolisolla ei ole eikä voi saada "
                   "avioliittolain mukaista avio-oikeutta tällaiseen omaisuuteen, sen tuottoon tai sen sijaan tulleeseen "
                   "omaisuuteen.",
        "debts_h": "Velat ja kulut",
        "debts": "Jäämistöstä suoritetaan ennen testamentin täytäntöönpanoa kaikki lain mukaiset velat, hautauskulut, "
                 "perunkirjoituksesta aiheutuvat kustannukset sekä muut jäämistön selvittämisestä aiheutuvat kulut.",
        "sign_h": "Allekirjoitukset",
        "sign": ["Paikka", "Päiväys", "Allekirjoitus", "Nimen selvennys"],
        "witness_h": "Todistajien todistuslauseke",
        "witness": "Todistamme täten, että testamentintekijä on omakätisesti allekirjoittanut tämän testamentin yhtä aikaa "
                   "läsnä ollessamme sekä ilmoittanut sen sisältävän hänen viimeisen tahtonsa. Olemme samalla todenneet "
                   "hänen tehneen testamentin vapaasta tahdostaan ja olleen kykenevä ymmärtämään testamentin merkityksen.",
        "witness_n": "Todistaja {n}",
        "witness_f": ["Nimi", "Henkilötunnus", "Allekirjoitus"],
        "meta_title": "Testamentti – perusmalli",
    },
    "en": {
        "page": "Page",
        "title": "WILL",
        "subtitle": "BASIC TEMPLATE  ·  LEXORIA 2026",
        "testator": "Testator",
        "i": "I,",
        "person": ["Name", "Personal identity code", "Address", "Municipality of residence"],
        "capacity": "having full legal capacity and acting of my own free will, have made this will.",
        "revoke_h": "Revocation of earlier wills",
        "revoke": "By this will I revoke all wills and other testamentary dispositions I have previously made.",
        "disp_h": "Testamentary disposition",
        "disp": "As my last will and testament I direct that, upon my death, all of my property, together with all "
                "rights and assets belonging to it at the time of my death, shall pass with full ownership to",
        "marital_h": "Exclusion of marital right",
        "marital": "I direct that all property the beneficiary receives from me by will or inheritance, its yield and "
                   "any property substituted for it shall in its entirety be property excluded from the marital right "
                   "of the beneficiary's spouse. The beneficiary's present or future spouse shall not have, and cannot "
                   "acquire, a marital right under the Finnish Marriage Act to such property, its yield or any property "
                   "substituted for it.",
        "debts_h": "Debts and expenses",
        "debts": "Before this will is executed, all lawful debts, funeral expenses, the costs of the estate inventory "
                 "and all other costs of administering the estate shall be paid out of the estate.",
        "sign_h": "Signatures",
        "sign": ["Place", "Date", "Signature", "Name in block letters"],
        "witness_h": "Attestation of witnesses",
        "witness": "We hereby certify that the testator signed this will in person in our simultaneous presence and "
                   "declared it to contain their last will. We further confirm that the testator made this will of "
                   "their own free will and was capable of understanding its meaning.",
        "witness_n": "Witness {n}",
        "witness_f": ["Name", "Personal identity code", "Signature"],
        "meta_title": "Will – basic template",
    },
    "et": {
        "page": "Lk",
        "title": "TESTAMENT",
        "subtitle": "PÕHIMALL  ·  LEXORIA 2026",
        "testator": "Testaator",
        "i": "Mina,",
        "person": ["Nimi", "Isikukood", "Aadress", "Elukoht (omavalitsus)"],
        "capacity": "olen teovõimelisena ja vabast tahtest teinud käesoleva testamendi.",
        "revoke_h": "Varasemate testamentide tühistamine",
        "revoke": "Käesoleva testamendiga tühistan kõik oma varem tehtud testamendid ja muud surma puhuks tehtud korraldused.",
        "disp_h": "Testamendi korraldus",
        "disp": "Oma viimse tahte ja testamendina määran, et pärast minu surma läheb kogu minu vara koos kõigi surma "
                "hetkel selle juurde kuuluvate õiguste ja vahenditega täieliku omandiõigusega üle:",
        "marital_h": "Abikaasa varaõiguse välistamine",
        "marital": "Määran, et kogu vara, mille testamendisaaja saab minult testamendi või pärimise teel, selle vili "
                   "ning selle asemele tulnud vara on tervikuna testamendisaaja abikaasa varaõiguse alt välja jääv "
                   "vara. Testamendisaaja praegusel ega tulevasel abikaasal ei ole ega saa tekkida Soome abieluseaduse "
                   "kohast varaõigust sellisele varale, selle viljale ega selle asemele tulnud varale.",
        "debts_h": "Võlad ja kulud",
        "debts": "Enne testamendi täitmist tasutakse pärandvarast kõik seaduse kohased võlad, matusekulud, pärandi "
                 "inventuuri kulud ning muud pärandvara korraldamisega seotud kulud.",
        "sign_h": "Allkirjad",
        "sign": ["Koht", "Kuupäev", "Allkiri", "Nimi trükitähtedega"],
        "witness_h": "Tunnistajate kinnitus",
        "witness": "Kinnitame, et testaator allkirjastas käesoleva testamendi omakäeliselt meie mõlema samaaegsel "
                   "juuresolekul ning teatas, et see sisaldab tema viimset tahet. Samuti oleme veendunud, et testaator "
                   "tegi testamendi vabast tahtest ja oli võimeline mõistma testamendi tähendust.",
        "witness_n": "Tunnistaja {n}",
        "witness_f": ["Nimi", "Isikukood", "Allkiri"],
        "meta_title": "Testament – põhimall",
    },
}

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
    return f"{T[doc.lang]['page']} {doc.page} / {doc.total_pages}"


# ---------- header / footer variants ----------
def variant_a(c, doc):
    """Purple wordmark left, bar mark right, no rules. Two-line footer."""
    top = H - 46
    wm_w = 98; wm_h = wm_w * WM_RATIO
    wordmark(c, L, top - wm_h, wm_w, WORDMARK_PURPLE)
    mk = 30
    barmark(c, W - R - mk, top - wm_h + (wm_h - mk) / 2, mk)
    footer_grid(c, doc)

def footer_grid(c, doc):
    """Two aligned columns instead of a dotted run-on line; page number on the first baseline.
    The street address and domicile are left out at the firm's request."""
    y1, y2 = 47, 36
    text(c, L, y1, FIRM, font="JBM-M", color=INK, track=0.3)
    text(c, L, y2, YT, track=0.3)
    x2 = L + 182
    text(c, x2, y1, PHONE, track=0.3)
    text(c, x2, y2, WEB, track=0.3)
    text(c, W - R, y1, page_label(doc), font="JBM-M", color=INK, track=0.3, align="right")

def variant_b(c, doc):
    """Centered wordmark with a tagline; the bar mark anchors the footer."""
    wm_w = 124; wm_h = wm_w * WM_RATIO
    wordmark(c, (W - wm_w) / 2, H - 44 - wm_h, wm_w)
    text(c, W / 2, H - 44 - wm_h - 13, "ASIANAJOTOIMISTO  ·  ATTORNEYS AT LAW", size=5.6, track=1.5, align="center")
    mk = 20
    barmark(c, (W - mk) / 2, 60, mk)
    text(c, W / 2, 46, f"{FIRM}{SEP}{PHONE}", align="center")
    text(c, W / 2, 35, f"{WEB}{SEP}{YT}{SEP}{page_label(doc)}", align="center")

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
    text(c, W - R, 46, f"{PHONE}{SEP}{WEB}", align="right")
    text(c, W - R, 35, f"{YT}{SEP}{page_label(doc)}", align="right")

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
    text(c, L, 34, f"{FIRM}{SEP}{PHONE}", color=INK)
    text(c, L, 23, f"{WEB}{SEP}{YT}")
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
        lw = text(c, 0, 8, self.label.upper(), size=6.3, track=1.2)
        x0 = max(118, lw + 16); x1 = self.aw
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

def story(lang):
    L_ = T[lang]
    s = []
    s.append(Tracked(L_["title"], "NR-D", 27, INK, 4, space_after=4))
    s.append(Tracked(L_["subtitle"], "JBM", 6.3, MAROON, 1.4, space_after=16))

    s.append(heading(L_["testator"]))
    s.append(Paragraph(L_["i"], intro))
    for f in L_["person"]:
        s.append(Field(f))
    s.append(Spacer(1, 4))
    s.append(Paragraph(L_["capacity"], body))

    s.append(heading(L_["revoke_h"]))
    s.append(Paragraph(L_["revoke"], body))

    s.append(heading(L_["disp_h"]))
    s.append(Paragraph(L_["disp"], body))
    for f in L_["person"]:
        s.append(Field(f))

    s.append(heading(L_["marital_h"]))
    s.append(Paragraph(L_["marital"], body))

    s.append(heading(L_["debts_h"]))
    s.append(Paragraph(L_["debts"], body))

    place, date, sig, name = L_["sign"]
    s.append(KeepTogether([
        heading(L_["sign_h"]),
        Field(place),
        Field(date, segments=[(40, "/"), (40, "/"), (70, None)]),
        Field(sig),
        Field(name),
    ]))

    s.append(KeepTogether([
        heading(L_["witness_h"]),
        Paragraph(L_["witness"], body),
    ]))
    for n in (1, 2):
        s.append(KeepTogether([
            Tracked(L_["witness_n"].format(n=n).upper(), "JBM", 6.3, PEBBLE, 1.4, space_before=8, space_after=2),
        ] + [Field(f) for f in L_["witness_f"]]))
    return s


# ---------- build ----------
class Doc(BaseDocTemplate):
    total_pages = 1
    lang = "fi"

def build(path, variant, lang):
    draw, top, bottom = VARIANTS[variant]
    def make(total):
        doc = Doc(path, pagesize=A4, leftMargin=L, rightMargin=R, topMargin=top, bottomMargin=bottom,
                  title=T[lang]["meta_title"], author=FIRM, subject=T[lang]["meta_title"], lang=lang)
        doc.total_pages = total
        doc.lang = lang
        frame = Frame(L, bottom, W - L - R, H - top - bottom, id="f", leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=draw)])
        doc.build(story(lang))
        return doc.page
    total = make(1)      # first pass only counts pages
    make(total)

if __name__ == "__main__":
    out = sys.argv[1]
    variant = sys.argv[2] if len(sys.argv) > 2 else "A"
    os.makedirs(out, exist_ok=True)
    for lang in T:
        p = os.path.join(out, f"testamentti-perusmalli-{lang}.pdf")
        build(p, variant, lang); print("wrote", p)
