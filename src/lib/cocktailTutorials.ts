// Detaillierte Cocktail-Tutorials mit echten Bildern.
// Max ~1 Min Lesezeit pro Cocktail.

import hugoImg from "@/assets/cocktails/hugo.jpg";
import wildberryImg from "@/assets/cocktails/wildberry-lillet.jpg";
import mojitoImg from "@/assets/cocktails/mojito.jpg";
import ginBasilImg from "@/assets/cocktails/gin-basil-smash.jpg";
import amarettoSourImg from "@/assets/cocktails/amaretto-sour.jpg";
import moscowMuleImg from "@/assets/cocktails/moscow-mule.jpg";
import negroniImg from "@/assets/cocktails/negroni.jpg";
import espressoMartiniImg from "@/assets/cocktails/espresso-martini.jpg";
import aperolSpritzImg from "@/assets/cocktails/aperol-spritz.jpg";
import limoncelloSpritzImg from "@/assets/cocktails/limoncello-spritz.jpg";
import theSaintImg from "@/assets/cocktails/the-saint.jpg";
import theSinnerImg from "@/assets/cocktails/the-sinner.jpg";
import theSmokeImg from "@/assets/cocktails/the-smoke.jpg";

export type Technique = "Build" | "Shake" | "Stir" | "Dry Shake + Shake" | "Build & Stir";

export type CocktailTutorial = {
  name: string;
  image: string;
  glass: { name: string; detail: string };   // z.B. "Highball" + "schlank, hoch, 30–35 cl"
  ice: { name: string; detail: string };
  technique: Technique;
  prepTime: string;                          // "~2 Min"
  difficulty: "Leicht" | "Mittel" | "Anspruchsvoll";
  garnish: string;
  service: string;                            // Strohhalm, Untersetzer, etc.
  color: string;
  ingredients: { label: string; amount: string; note?: string }[];
  steps: { title: string; text: string }[];
  tips?: string[];
};

export const COCKTAIL_TUTORIALS: Record<string, CocktailTutorial> = {
  "ck-1": {
    name: "Hugo",
    image: hugoImg,
    glass: { name: "Weinglas (Ballonglas)", detail: "30–40 cl, bauchige Form für Aromaentfaltung" },
    ice: { name: "Eiswürfel", detail: "Ganze klare Würfel, Glas zu 3/4 füllen" },
    technique: "Build",
    prepTime: "~1.5 Min",
    difficulty: "Leicht",
    garnish: "Minzbouquet + Limettenscheibe seitlich am Glasrand",
    service: "Strohhalm + Untersetzer",
    color: "#d4f0c8",
    ingredients: [
      { label: "Holunderblütensirup", amount: "2 cl", note: "z.B. Monin oder Aelia" },
      { label: "Frische Minze", amount: "5–6 Blätter", note: "ganze Zweige, nicht zerrissen" },
      { label: "Limette", amount: "2 Spalten", note: "frisch, ungespritzt" },
      { label: "Prosecco", amount: "10 cl", note: "gut gekühlt" },
      { label: "Soda", amount: "Top up (~3 cl)", note: "Mineralwasser mit Kohlensäure" },
    ],
    steps: [
      { title: "1. Minze aktivieren", text: "Minze in der Handfläche klatschen — das setzt die ätherischen Öle frei. NICHT muddlen, sonst wird sie bitter. Direkt ins Glas geben." },
      { title: "2. Limette dazu", text: "2 Limettenspalten ins Glas drücken und reinwerfen." },
      { title: "3. Eis", text: "Glas zu 3/4 mit ganzen Eiswürfeln füllen." },
      { title: "4. Sirup", text: "2 cl Holundersirup über das Eis giessen." },
      { title: "5. Aufgiessen", text: "Erst Prosecco langsam dem Glasrand entlang einlaufen lassen, dann mit einem Schuss Soda toppen. Kurz mit Barlöffel von unten nach oben rühren." },
      { title: "6. Garnieren & Service", text: "Frisches Minzbouquet aufsetzen, Limettenscheibe an den Glasrand. Strohhalm + Untersetzer." },
    ],
    tips: [
      "Minze IMMER klatschen, nie muddlen.",
      "Prosecco zuerst, dann Soda — sonst geht die Kohlensäure verloren.",
    ],
  },
  "ck-2": {
    name: "Wildberry Lillet",
    image: wildberryImg,
    glass: { name: "Weinglas (Ballonglas)", detail: "40 cl, gross für Eis + Beeren" },
    ice: { name: "Eiswürfel", detail: "Glas randvoll füllen — verdünnt nicht zu schnell" },
    technique: "Build",
    prepTime: "~1 Min",
    difficulty: "Leicht",
    garnish: "Beeren im Drink + Minzzweig oben",
    service: "Strohhalm",
    color: "#d63864",
    ingredients: [
      { label: "Lillet Blanc", amount: "5 cl", note: "gekühlt" },
      { label: "Schweppes Wild Berry", amount: "10 cl", note: "kalt, frisch geöffnet" },
      { label: "Erdbeeren", amount: "2 Stk.", note: "halbiert" },
      { label: "Himbeeren", amount: "3–4 Stk.", note: "ganz" },
      { label: "Minze", amount: "1 Zweig", note: "zur Garnitur" },
    ],
    steps: [
      { title: "1. Glas füllen", text: "Weinglas randvoll mit Eiswürfeln füllen." },
      { title: "2. Lillet eingiessen", text: "5 cl Lillet Blanc direkt über das Eis." },
      { title: "3. Beeren rein", text: "Halbierte Erdbeeren und ganze Himbeeren ins Glas geben — sie färben sich schön." },
      { title: "4. Wild Berry toppen", text: "Mit Schweppes Wild Berry vorsichtig auffüllen (Glasrand entlang)." },
      { title: "5. Rühren & garnieren", text: "Mit Barlöffel 1× von unten nach oben heben. Minzzweig oben aufsetzen." },
    ],
    tips: ["Beeren NICHT zerdrücken — sie sollen sichtbar bleiben."],
  },
  "ck-3": {
    name: "Mojito",
    image: mojitoImg,
    glass: { name: "Highball / Longdrink", detail: "30 cl, hoch und schlank" },
    ice: { name: "Crushed Ice", detail: "Glas randvoll — Pflicht, keine Würfel!" },
    technique: "Build",
    prepTime: "~3 Min",
    difficulty: "Mittel",
    garnish: "Grosses Minzbouquet + Limettenscheibe",
    service: "Strohhalm (kurz geschnitten) + Untersetzer",
    color: "#a8d99b",
    ingredients: [
      { label: "Frische Minze", amount: "8–10 Blätter", note: "Spearmint, keine Pfefferminze" },
      { label: "Limette", amount: "1/2 (in 4 Spalten)", note: "frisch gepresst" },
      { label: "Rohrzucker", amount: "2 BL (Barlöffel)", note: "braun, grobkörnig" },
      { label: "Weisser Rum (Havana 3 J.)", amount: "5 cl" },
      { label: "Soda", amount: "Top up", note: "ca. 3–4 cl" },
    ],
    steps: [
      { title: "1. Limette muddlen", text: "Limettenspalten + Rohrzucker ins Glas geben. Mit Muddler 3–4× leicht andrücken (NUR Saft raus, nicht zerquetschen — sonst bitter aus der Schale)." },
      { title: "2. Minze dazu", text: "8–10 Minzblätter zugeben. NICHT muddlen, nur 1× sanft mit dem Muddler andrücken." },
      { title: "3. Crushed Ice", text: "Glas zur Hälfte mit Crushed Ice füllen." },
      { title: "4. Rum", text: "5 cl weisser Rum eingiessen, mit Barlöffel kräftig swizzeln (von unten nach oben rühren) — verteilt Aromen." },
      { title: "5. Auffüllen", text: "Mit weiterem Crushed Ice randvoll, mit Soda toppen, nochmals kurz swizzeln." },
      { title: "6. Service", text: "Grosses Minzbouquet aufsetzen (vorher in Hand klatschen). Kurzer Strohhalm — Gast riecht beim Trinken die Minze." },
    ],
    tips: [
      "Strohhalm IMMER kurz — sonst riecht der Gast die Minze nicht.",
      "Minzbouquet vor dem Aufsetzen klatschen — Aromen!",
    ],
  },
  "ck-4": {
    name: "Gin Basil Smash",
    image: ginBasilImg,
    glass: { name: "Tumbler (Old Fashioned)", detail: "25–30 cl, schwerer Boden" },
    ice: { name: "Eiswürfel", detail: "Klare Würfel, Glas zu 3/4 füllen" },
    technique: "Shake",
    prepTime: "~3 Min",
    difficulty: "Mittel",
    garnish: "Frischer Basilikum-Top (3–4 Blätter)",
    service: "Ohne Strohhalm — direkt aus dem Glas",
    color: "#7fa86b",
    ingredients: [
      { label: "Frischer Basilikum", amount: "10 Blätter", note: "Genoveser, kein Thai-Basilikum" },
      { label: "Zitronensaft frisch", amount: "3 cl", note: "immer frisch pressen" },
      { label: "Zuckersirup (1:1)", amount: "2 cl" },
      { label: "Gin (London Dry)", amount: "6 cl", note: "z.B. Tanqueray, Beefeater" },
    ],
    steps: [
      { title: "1. Basilikum muddlen", text: "10 Basilikumblätter in den Shaker (Boston-Tin). Mit Muddler 5–6× kräftig andrücken — Aromen freisetzen." },
      { title: "2. Flüssigkeiten dazu", text: "Zitronensaft, Zuckersirup und Gin in den Shaker geben." },
      { title: "3. Shaken", text: "Shaker zu 2/3 mit Eis füllen, fest verschliessen, 10–12 Sekunden kräftig shaken (vertikal!)." },
      { title: "4. Doppelt absieben", text: "Über Hawthorne-Strainer UND feines Sieb in den Tumbler abseihen — keine Basilikumstücke im Drink!" },
      { title: "5. Eis nachfüllen", text: "Tumbler mit frischen, ganzen Eiswürfeln auffüllen." },
      { title: "6. Garnieren", text: "3–4 frische Basilikumblätter (in Hand geklatscht) oben aufsetzen." },
    ],
    tips: [
      "Doppelsieb ist Pflicht — sonst hat der Gast Blätter zwischen den Zähnen.",
      "Basilikum vor Garnitur klatschen — Aromenpush.",
    ],
  },
  "ck-5": {
    name: "Amaretto Sour",
    image: amarettoSourImg,
    glass: { name: "Tumbler (Old Fashioned)", detail: "25 cl, dickwandig" },
    ice: { name: "1 grosser klarer Eiswürfel", detail: "5x5 cm, schmilzt langsam" },
    technique: "Dry Shake + Shake",
    prepTime: "~3 Min",
    difficulty: "Mittel",
    garnish: "Orangenzeste (aufgesprüht) + Cocktailkirsche an Spiess",
    service: "Ohne Strohhalm",
    color: "#c8884a",
    ingredients: [
      { label: "Amaretto Disaronno", amount: "5 cl" },
      { label: "Zitronensaft frisch", amount: "3 cl" },
      { label: "Orangensaft frisch", amount: "1 cl", note: "rundet ab" },
      { label: "Eiweiss (pasteurisiert)", amount: "1/2 (ca. 1.5 cl)", note: "für die Schaumkrone" },
    ],
    steps: [
      { title: "1. Dry Shake", text: "Alle Zutaten OHNE Eis in den Shaker. 10 Sekunden kräftig shaken — emulgiert das Eiweiss." },
      { title: "2. Wet Shake", text: "Shaker öffnen, mit Eis auffüllen, nochmals 10 Sekunden kräftig shaken bis kalt." },
      { title: "3. Eis ins Glas", text: "Grossen Eiswürfel mittig in den Tumbler legen." },
      { title: "4. Doppelt absieben", text: "Über Hawthorne + Feinsieb in den Tumbler abseihen — schöner Schaum bleibt oben." },
      { title: "5. Schaum setzen lassen", text: "20 Sek warten, bis sich der Schaum kompakt absetzt." },
      { title: "6. Garnieren", text: "Orangenzeste über dem Glas drücken (Öle einsprühen), an den Rand klemmen. Cocktailkirsche auf Spiess." },
    ],
    tips: [
      "DRY SHAKE ZUERST — sonst keine Schaumkrone.",
      "Eiweiss nur pasteurisiert verwenden.",
    ],
  },
  "ck-6": {
    name: "Moscow Mule",
    image: moscowMuleImg,
    glass: { name: "Kupferbecher", detail: "~45 cl, hält Drink eiskalt" },
    ice: { name: "Eiswürfel", detail: "Becher randvoll" },
    technique: "Build",
    prepTime: "~1 Min",
    difficulty: "Leicht",
    garnish: "Limettenspalte + optional Minzzweig",
    service: "Strohhalm (Metall, kurz)",
    color: "#d4a574",
    ingredients: [
      { label: "Vodka", amount: "5 cl", note: "neutral, gut gekühlt" },
      { label: "Limettensaft frisch", amount: "2 cl" },
      { label: "Ingwerbier", amount: "Top up (~12 cl)", note: "Thomas Henry / Fever-Tree" },
    ],
    steps: [
      { title: "1. Becher kalt machen", text: "Kupferbecher mit Eis randvoll füllen, kurz umrühren, dann Wasser abgiessen." },
      { title: "2. Frisches Eis", text: "Becher erneut mit Eis füllen." },
      { title: "3. Vodka + Limette", text: "5 cl Vodka und 2 cl frischer Limettensaft direkt in den Becher." },
      { title: "4. Auffüllen", text: "Mit Ingwerbier vorsichtig dem Becherrand entlang aufgiessen — Kohlensäure schonen." },
      { title: "5. Garnieren", text: "Limettenspalte einklemmen, ggf. Minzzweig dazu. Metall-Strohhalm." },
    ],
    tips: [
      "Becher vorkühlen — der Kupfer macht den Drink eiskalt.",
      "Niemals umrühren nach Ingwerbier — Sprudel weg.",
    ],
  },
  "ck-7": {
    name: "Negroni",
    image: negroniImg,
    glass: { name: "Tumbler (Old Fashioned)", detail: "25 cl, schwerer Boden" },
    ice: { name: "1 grosser klarer Eiswürfel", detail: "Pflicht — langsame Verdünnung" },
    technique: "Stir",
    prepTime: "~2 Min",
    difficulty: "Leicht",
    garnish: "Orangenzeste (Öle aufgesprüht)",
    service: "Ohne Strohhalm",
    color: "#b03a2e",
    ingredients: [
      { label: "Gin", amount: "3 cl", note: "London Dry, z.B. Beefeater" },
      { label: "Campari", amount: "3 cl" },
      { label: "Roter Wermut (Carpano Antica)", amount: "3 cl" },
    ],
    steps: [
      { title: "1. Rührglas vorbereiten", text: "Rührglas mit Eis füllen, kurz vorkühlen, Wasser abgiessen." },
      { title: "2. Zutaten dazu", text: "Gin, Campari und Wermut zu gleichen Teilen (3:3:3) einmessen." },
      { title: "3. Rühren", text: "Mit Barlöffel 20–25 Sekunden ruhig rühren (NICHT shaken!). Sollte kalt und leicht verdünnt sein." },
      { title: "4. Eis ins Glas", text: "Grossen Eiswürfel in den Tumbler legen." },
      { title: "5. Abseihen", text: "Über Julep-Strainer in den Tumbler abseihen." },
      { title: "6. Garnieren", text: "Orangenzeste über dem Glas drücken (Öle aufsprühen), an den Glasrand klemmen oder reinwerfen." },
    ],
    tips: [
      "Equal parts — 3:3:3. Niemals shaken, immer stirred.",
      "Carpano Antica statt Standard-Wermut macht den Unterschied.",
    ],
  },
  "ck-8": {
    name: "Espresso Martini",
    image: espressoMartiniImg,
    glass: { name: "Coupette / Martini-Glas", detail: "15 cl, gekühlt im Tiefkühler" },
    ice: { name: "Kein Eis im Servierglas", detail: "Nur im Shaker — Drink wird straight serviert" },
    technique: "Shake",
    prepTime: "~3 Min",
    difficulty: "Mittel",
    garnish: "3 Kaffeebohnen mittig auf der Crema",
    service: "Ohne Strohhalm",
    color: "#3a2418",
    ingredients: [
      { label: "Vodka", amount: "5 cl", note: "gekühlt" },
      { label: "Frischer Espresso (heiss!)", amount: "3 cl", note: "MUSS frisch gebrüht sein — sonst keine Crema" },
      { label: "Kahlúa (Kaffeelikör)", amount: "2 cl" },
      { label: "Zuckersirup (1:1)", amount: "1 cl", note: "nach Geschmack" },
    ],
    steps: [
      { title: "1. Glas vorkühlen", text: "Coupette vorher in den Tiefkühler — oder mit Eis + Wasser füllen." },
      { title: "2. Espresso ziehen", text: "Frischen Espresso direkt in den Shaker beziehen — heiss verwenden!" },
      { title: "3. Restliche Zutaten", text: "Vodka, Kahlúa und Zuckersirup dazu." },
      { title: "4. Hart shaken", text: "Shaker mit Eis füllen, 15 Sekunden SEHR kräftig shaken — das erzeugt die typische goldene Crema." },
      { title: "5. Doppelt absieben", text: "Über Hawthorne + Feinsieb in die gekühlte Coupette abseihen. Crema setzt sich oben ab." },
      { title: "6. 3 Bohnen", text: "Genau 3 Kaffeebohnen mittig auf die Crema legen (Symbol für Glück, Gesundheit, Wohlstand)." },
    ],
    tips: [
      "Espresso MUSS frisch sein — kalt = keine Crema.",
      "Kräftig shaken ist das ganze Geheimnis der Crema.",
    ],
  },
  "spr-1": {
    name: "Aperol Spritz",
    image: aperolSpritzImg,
    glass: { name: "Weinglas (Ballonglas)", detail: "40 cl, gross für Eis + Aroma" },
    ice: { name: "Eiswürfel", detail: "Glas randvoll" },
    technique: "Build",
    prepTime: "~1 Min",
    difficulty: "Leicht",
    garnish: "Orangenscheibe ins Glas",
    service: "Strohhalm + Untersetzer",
    color: "#ff7a3d",
    ingredients: [
      { label: "Prosecco", amount: "9 cl", note: "gut gekühlt, frisch geöffnet" },
      { label: "Aperol", amount: "6 cl", note: "Raumtemperatur ok" },
      { label: "Soda", amount: "3 cl", note: "Spritz!" },
    ],
    steps: [
      { title: "1. Glas füllen", text: "Weinglas randvoll mit Eiswürfeln füllen." },
      { title: "2. Prosecco ZUERST", text: "9 cl Prosecco dem Glasrand entlang einlaufen lassen. Wichtig: Prosecco vor Aperol, sonst klumpt es." },
      { title: "3. Aperol dazu", text: "6 cl Aperol darüber giessen — er sinkt nach unten und erzeugt das typische Farbspiel." },
      { title: "4. Soda toppen", text: "3 cl Soda dazu — der Spritz braucht den Kick." },
      { title: "5. Garnieren", text: "Frische Orangenscheibe ins Glas legen. Strohhalm + Untersetzer." },
    ],
    tips: [
      "3-2-1 Regel: 3 Teile Prosecco, 2 Teile Aperol, 1 Teil Soda.",
      "Reihenfolge: Prosecco → Aperol → Soda. Niemals umgekehrt.",
    ],
  },
  "spr-2": {
    name: "Limoncello Spritz",
    image: limoncelloSpritzImg,
    glass: { name: "Weinglas (Ballonglas)", detail: "40 cl" },
    ice: { name: "Eiswürfel", detail: "Glas randvoll" },
    technique: "Build",
    prepTime: "~1 Min",
    difficulty: "Leicht",
    garnish: "Zitronenscheibe + Minzzweig",
    service: "Strohhalm + Untersetzer",
    color: "#f4d03f",
    ingredients: [
      { label: "Limoncello (Limoncé)", amount: "5 cl", note: "gut gekühlt" },
      { label: "Prosecco", amount: "9 cl", note: "kalt" },
      { label: "Soda", amount: "3 cl" },
    ],
    steps: [
      { title: "1. Glas füllen", text: "Weinglas randvoll mit Eiswürfeln." },
      { title: "2. Limoncello", text: "5 cl Limoncello eingiessen." },
      { title: "3. Prosecco", text: "9 cl Prosecco vorsichtig dem Glasrand entlang aufgiessen." },
      { title: "4. Soda", text: "3 cl Soda dazu." },
      { title: "5. Garnieren", text: "Zitronenscheibe ins Glas, Minzzweig oben aufsetzen (vorher klatschen)." },
    ],
    tips: ["Limoncello eiskalt aus dem Tiefkühler verwenden — intensiverer Geschmack."],
  },
  "sig-1": {
    name: "The Saint",
    image: theSaintImg,
    glass: { name: "Coupette", detail: "15 cl, vorgekühlt, mit goldenem Zuckerrand" },
    ice: { name: "Kein Eis im Glas", detail: "Wird straight aus dem Shaker serviert" },
    technique: "Dry Shake + Shake",
    prepTime: "~4 Min",
    difficulty: "Anspruchsvoll",
    garnish: "Essbares Goldblatt auf dem Schaum",
    service: "Ohne Strohhalm — Hausspezialität",
    color: "#e8d29a",
    ingredients: [
      { label: "Gin", amount: "4 cl", note: "Monkey in a Bottle bevorzugt" },
      { label: "Holunderblütenlikör (St-Germain)", amount: "2 cl" },
      { label: "Zitronensaft frisch", amount: "2 cl" },
      { label: "Eiweiss (pasteurisiert)", amount: "1/2", note: "Schaumkrone" },
    ],
    steps: [
      { title: "1. Glas-Rand vorbereiten", text: "Coupette-Rand kurz mit Zitrone befeuchten, in goldenen Zucker dippen." },
      { title: "2. Dry Shake", text: "Gin, Holunderlikör, Zitronensaft, Eiweiss OHNE Eis in Shaker — 10 Sek kräftig shaken." },
      { title: "3. Wet Shake", text: "Eis dazu, weitere 10 Sek shaken bis kalt." },
      { title: "4. Doppelt absieben", text: "Über Hawthorne + Feinsieb in die Coupette abseihen — Schaum setzt sich oben." },
      { title: "5. Goldblatt setzen", text: "Mit Pinzette ein essbares Goldblatt mittig auf den Schaum legen." },
    ],
    tips: ["Hausrezept — bei Abweichungen Barchef fragen.", "Goldblatt nur mit Pinzette anfassen."],
  },
  "sig-2": {
    name: "The Sinner",
    image: theSinnerImg,
    glass: { name: "Tumbler (Old Fashioned)", detail: "25 cl, schwerer Boden" },
    ice: { name: "1 grosser klarer Eiswürfel", detail: "5x5 cm" },
    technique: "Stir",
    prepTime: "~3 Min",
    difficulty: "Mittel",
    garnish: "Geräucherte / flambierte Orangenzeste",
    service: "Ohne Strohhalm",
    color: "#7a1f2b",
    ingredients: [
      { label: "Bourbon Whiskey", amount: "5 cl", note: "z.B. Bulleit, Woodford" },
      { label: "Roter Wermut (Carpano)", amount: "2 cl" },
      { label: "Cherry Heering", amount: "1 cl" },
      { label: "Angostura Bitters", amount: "2 Dashes" },
    ],
    steps: [
      { title: "1. Rührglas füllen", text: "Rührglas zu 2/3 mit Eis füllen." },
      { title: "2. Zutaten messen", text: "Bourbon, Wermut, Cherry Heering und Angostura zugeben." },
      { title: "3. Rühren", text: "Mit Barlöffel 25 Sekunden ruhig rühren — bis kalt und leicht verdünnt." },
      { title: "4. Eis ins Glas", text: "Grossen Eiswürfel in den Tumbler legen." },
      { title: "5. Abseihen", text: "Über Julep-Strainer in den Tumbler abseihen." },
      { title: "6. Zeste flambieren", text: "Orangenzeste mit Feuerzeug kurz über dem Glas flambieren, dann ins Glas geben." },
    ],
    tips: ["Hausrezept — bei Abweichungen Barchef fragen."],
  },
  "sig-3": {
    name: "The Smoke",
    image: theSmokeImg,
    glass: { name: "Tumbler (Old Fashioned)", detail: "25 cl, dickwandig" },
    ice: { name: "1 grosser klarer Eiswürfel", detail: "Pflicht" },
    technique: "Shake",
    prepTime: "~4 Min",
    difficulty: "Anspruchsvoll",
    garnish: "Räucherglocke mit Buchenholz-Rauch",
    service: "Räucherglocke beim Servieren vom Gast lüften lassen",
    color: "#5c4a3a",
    ingredients: [
      { label: "Mezcal", amount: "4 cl", note: "z.B. Del Maguey Vida" },
      { label: "Whisky (rauchig)", amount: "2 cl", note: "z.B. Laphroaig 10" },
      { label: "Honigsirup (1:1)", amount: "1.5 cl" },
      { label: "Zitronensaft frisch", amount: "2 cl" },
    ],
    steps: [
      { title: "1. Shaken", text: "Alle Zutaten in den Shaker, mit Eis füllen, 10 Sek kräftig shaken." },
      { title: "2. Eis ins Glas", text: "Grossen Eiswürfel in den Tumbler legen." },
      { title: "3. Abseihen", text: "Über Hawthorne in den Tumbler abseihen." },
      { title: "4. Räuchern", text: "Buchenholz-Späne in der Smoking-Gun anzünden, Glas mit Glocke verschliessen und mit Rauch füllen (10 Sek)." },
      { title: "5. Service", text: "Glocke geschlossen zum Tisch tragen — Gast lüftet selbst." },
    ],
    tips: ["Hausrezept — bei Abweichungen Barchef fragen.", "Smoking-Gun-Filter regelmässig reinigen."],
  },
};

export function getTutorial(productId: string): CocktailTutorial | null {
  return COCKTAIL_TUTORIALS[productId] ?? null;
}
