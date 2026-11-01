import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { WeeklyDish } from "./weekly-menu.functions";

const INK = "3A3128";
const MUTED = "6E6253";
const GOLD = "B08D4A";
const SERIF = "Cormorant Garamond";
const CAPS = "Cinzel";

async function logoPng(url: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  const b = await new Promise<Blob>((r) => c.toBlob((x) => r(x!), "image/png"));
  return new Uint8Array(await b.arrayBuffer());
}

const center = (children: TextRun[] | ImageRun[], before = 0, after = 0) =>
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before, after }, children });

const ornament = (before: number, after: number) =>
  center([new TextRun({ text: "———  ◆  ———", color: GOLD, font: SERIF, size: 20 })], before, after);

export async function buildWeeklyMenuDocx(o: {
  week: string;
  subtitle: string;
  dishes: WeeklyDish[];
  footer: string;
  logoUrl: string;
}) {
  const logo = await logoPng(o.logoUrl);
  const many = o.dishes.length > 6;
  const gap = many ? 260 : 420;
  const children: Paragraph[] = [
    center([new ImageRun({ type: "png", data: logo, transformation: { width: 110, height: 110 }, altText: { title: "Piratino", description: "Logo", name: "logo" } })]),
    center([new TextRun({ text: "P I R A T I N O", font: CAPS, size: 20, color: MUTED })], 120),
    center([new TextRun({ text: o.subtitle, font: SERIF, italics: true, size: 68, color: INK })], 360),
    center([new TextRun({ text: `WOCHENMENÜ  ·  ${o.week.toUpperCase()}`, font: CAPS, size: 17, color: MUTED, characterSpacing: 40 })], 200),
    ornament(360, 300),
  ];
  for (const d of o.dishes) {
    children.push(center([new TextRun({ text: d.name.toUpperCase(), font: CAPS, size: many ? 24 : 28, color: INK, characterSpacing: 30 })], gap));
    if (d.description) children.push(center([new TextRun({ text: d.description, font: SERIF, italics: true, size: many ? 24 : 28, color: MUTED })], 40));
    if (d.price) {
      const n = Number(d.price.replace(",", "."));
      children.push(center([new TextRun({ text: Number.isFinite(n) ? `CHF ${n.toFixed(2)}` : d.price, font: SERIF, size: 24, color: GOLD })], 40));
    }
  }
  children.push(ornament(gap + 300, 160));
  children.push(center([new TextRun({ text: "Buon appetito", font: SERIF, italics: true, size: 32, color: INK })]));
  if (o.footer) children.push(center([new TextRun({ text: o.footer.toUpperCase(), font: CAPS, size: 15, color: MUTED, characterSpacing: 30 })], 80));
  children.push(center([new TextRun({ text: "BADENERSTRASSE 696  ·  8048 ZÜRICH", font: CAPS, size: 14, color: MUTED, characterSpacing: 30 })], 40));

  const b = { style: BorderStyle.DOUBLE, size: 4, color: GOLD, space: 24 };
  const doc = new Document({
    styles: { default: { document: { run: { font: SERIF, color: INK } } } },
    background: { color: "FBF8F1" },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1300, bottom: 1000, left: 1500, right: 1500 },
            borders: { pageBorderTop: b, pageBorderBottom: b, pageBorderLeft: b, pageBorderRight: b },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}
