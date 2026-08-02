/**
 * En egen, minimal PDF-skrivare.
 *
 * Beslutet att inte dra in ett PDF-bibliotek står kvar - men av nya skäl:
 * rapporterna här är strukturerad text, och en handskriven generator på
 * några hundra rader ger deterministiska byten (samma rapport ger samma
 * fil, testbar utan webbläsare), noll beroenden och noll kilobyte extern
 * kod. Base-14-typsnitten (Helvetica) kräver ingen inbäddning, och
 * WinAnsi-kodningen täcker svenskan: åäö, paragraftecken, tankstreck.
 *
 * Begränsningar, med avsikt: ingen grafik utöver linjer, inga bilder,
 * ingen typografisk perfektion. Radbrytningen mäter med en approximativ
 * breddtabell och bryter hellre någon punkt för tidigt än svämmar över -
 * ett dokument som lämnar huset får aldrig klippa text.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = { top: 64, right: 56, bottom: 64, left: 56 };
const CONTENT_WIDTH = A4.width - MARGIN.left - MARGIN.right;

export type PdfFont = "regular" | "bold" | "italic";

/**
 * Approximativa teckenbredder för Helvetica, i tusendelar av teckenstorleken.
 * Klasserna räcker för radbrytning med säkerhetsmarginal - exakta AFM-mått
 * hade gett tätare rader, inte säkrare.
 */
const charWidth = (ch: string, bold: boolean): number => {
  if (/[iíìîjl.,:;'’!|()[\]{}\/\\ ]/.test(ch)) return bold ? 300 : 278;
  if (/[ftr-]/.test(ch)) return bold ? 360 : 333;
  if (/[mwMW@ÅÄÖÆØ]/.test(ch)) return bold ? 900 : 850;
  if (/[A-ZÉÜ0-9åäöéü]/.test(ch)) return bold ? 700 : 640;
  return bold ? 610 : 556;
};

export const measure = (text: string, size: number, font: PdfFont): number => {
  const bold = font === "bold";
  let units = 0;
  for (const ch of text) units += charWidth(ch, bold);
  // 4 % marginal: bryt hellre tidigt än klipp.
  return (units / 1000) * size * 1.04;
};

/** Bryter text till rader som ryms inom maxWidth punkter. */
export const wrapText = (
  text: string,
  size: number,
  font: PdfFont,
  maxWidth: number,
): string[] => {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (measure(candidate, size, font) <= maxWidth || current === "") {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== "") lines.push(current);
  return lines.length > 0 ? lines : [""];
};

/**
 * WinAnsi (CP1252). Tecken utanför ersätts med '?' hellre än att tyst
 * försvinna - ett frågetecken syns i korrektur, ett borttappat tecken
 * ändrar betydelsen.
 */
const CP1252_EXTRAS: Record<string, number> = {
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94,
  "•": 0x95, "–": 0x96, "—": 0x97, "…": 0x85,
  "€": 0x80, "™": 0x99,
};

const encodeWinAnsi = (text: string): number[] => {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63;
    if (code === 0x28 || code === 0x29 || code === 0x5c) {
      bytes.push(0x5c, code); // escapa ( ) \
    } else if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code);
    } else if (code >= 0xa0 && code <= 0xff) {
      bytes.push(code);
    } else if (CP1252_EXTRAS[ch] !== undefined) {
      bytes.push(CP1252_EXTRAS[ch]);
    } else {
      bytes.push(0x3f);
    }
  }
  return bytes;
};

interface Op {
  kind: "text" | "rule";
  x: number;
  y: number;
  text?: string;
  size?: number;
  font?: PdfFont;
  gray?: number;
  toX?: number;
}

export interface PdfLineOptions {
  size?: number;
  font?: PdfFont;
  gray?: number;
  indent?: number;
  spaceAfter?: number;
  /** Ritas högerställd vid högermarginalen på SAMMA rad som nästa text-anrop redan skrivit. */
}

export class PdfWriter {
  private pages: Op[][] = [[]];
  private y = A4.height - MARGIN.top;
  private readonly footerText: string;

  constructor(footerText: string) {
    this.footerText = footerText;
  }

  private get page(): Op[] {
    return this.pages[this.pages.length - 1];
  }

  private ensureRoom(height: number): void {
    if (this.y - height < MARGIN.bottom) {
      this.pages.push([]);
      this.y = A4.height - MARGIN.top;
    }
  }

  /** Skriver ett stycke med radbrytning. */
  text(content: string, options: PdfLineOptions = {}): void {
    const size = options.size ?? 10.5;
    const font = options.font ?? "regular";
    const gray = options.gray ?? 0;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.45;
    const width = CONTENT_WIDTH - indent;
    for (const line of wrapText(content, size, font, width)) {
      this.ensureRoom(lineHeight);
      this.page.push({ kind: "text", x: MARGIN.left + indent, y: this.y - size, text: line, size, font, gray });
      this.y -= lineHeight;
    }
    this.y -= options.spaceAfter ?? size * 0.35;
  }

  /** En rad med vänsterdel och högerställd del - tabellrad för belopp. */
  row(left: string, right: string, options: PdfLineOptions = {}): void {
    const size = options.size ?? 10.5;
    const font = options.font ?? "regular";
    const gray = options.gray ?? 0;
    const lineHeight = size * 1.45;
    const rightWidth = measure(right, size, font);
    const leftMax = CONTENT_WIDTH - rightWidth - 12;
    const leftLines = wrapText(left, size, font, leftMax);
    for (let i = 0; i < leftLines.length; i += 1) {
      this.ensureRoom(lineHeight);
      this.page.push({ kind: "text", x: MARGIN.left, y: this.y - size, text: leftLines[i], size, font, gray });
      if (i === 0) {
        this.page.push({
          kind: "text",
          x: A4.width - MARGIN.right - rightWidth,
          y: this.y - size,
          text: right,
          size,
          font,
          gray,
        });
      }
      this.y -= lineHeight;
    }
    this.y -= options.spaceAfter ?? size * 0.25;
  }

  rule(gray = 0.75): void {
    this.ensureRoom(10);
    this.page.push({ kind: "rule", x: MARGIN.left, y: this.y - 4, toX: A4.width - MARGIN.right, gray });
    this.y -= 12;
  }

  space(points: number): void {
    this.ensureRoom(points);
    this.y -= points;
  }

  /** Serialiserar dokumentet till PDF-byte. */
  toBytes(): Uint8Array {
    const chunks: number[] = [];
    const push = (s: string) => {
      for (let i = 0; i < s.length; i += 1) chunks.push(s.charCodeAt(i) & 0xff);
    };

    const offsets: number[] = [];
    const startObj = (n: number) => {
      offsets[n] = chunks.length;
      push(`${n} 0 obj\n`);
    };

    push("%PDF-1.4\n%åäö\n");

    const pageCount = this.pages.length;
    const fontRegular = 3 + pageCount * 2;
    const fontBold = fontRegular + 1;
    const fontItalic = fontRegular + 2;
    const totalObjects = fontItalic;

    startObj(1);
    push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    startObj(2);
    const kids = this.pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
    push(`<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>\nendobj\n`);

    this.pages.forEach((ops, index) => {
      const pageObj = 3 + index * 2;
      const contentObj = pageObj + 1;

      startObj(pageObj);
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] ` +
          `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R /F3 ${fontItalic} 0 R >> >> ` +
          `/Contents ${contentObj} 0 R >>\nendobj\n`,
      );

      const stream: number[] = [];
      const pushStream = (s: string) => {
        for (let i = 0; i < s.length; i += 1) stream.push(s.charCodeAt(i) & 0xff);
      };
      const fontRef = (f: PdfFont) => (f === "bold" ? "F2" : f === "italic" ? "F3" : "F1");

      const footer: Op[] = [
        {
          kind: "text",
          x: MARGIN.left,
          y: 36,
          text: `${this.footerText} · sida ${index + 1} (${pageCount})`,
          size: 8,
          font: "regular",
          gray: 0.45,
        },
      ];

      for (const op of [...ops, ...footer]) {
        if (op.kind === "rule") {
          pushStream(`${op.gray ?? 0.75} G 0.7 w ${op.x} ${op.y} m ${op.toX} ${op.y} l S\n`);
        } else {
          pushStream(`BT /${fontRef(op.font ?? "regular")} ${op.size} Tf ${op.gray ?? 0} g ${op.x.toFixed(2)} ${op.y.toFixed(2)} Td (`);
          for (const byte of encodeWinAnsi(op.text ?? "")) stream.push(byte);
          pushStream(") Tj ET\n");
        }
      }

      startObj(contentObj);
      push(`<< /Length ${stream.length} >>\nstream\n`);
      chunks.push(...stream);
      push("\nendstream\nendobj\n");
    });

    const fontDef = (n: number, base: string) => {
      startObj(n);
      push(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>\nendobj\n`);
    };
    fontDef(fontRegular, "Helvetica");
    fontDef(fontBold, "Helvetica-Bold");
    fontDef(fontItalic, "Helvetica-Oblique");

    const xrefStart = chunks.length;
    push(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
    for (let n = 1; n <= totalObjects; n += 1) {
      push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
    }
    push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

    return new Uint8Array(chunks);
  }
}
