// The upload contains several similarly named food and sauce photos. Keep the
// ambiguous matches explicit so a pizza is never shown with a sauce photo.
const photos = import.meta.glob<{ default: { url: string } }>(
  "../assets/product-photos/*.jpg.asset.json",
  { eager: true },
);

const byFilename = Object.fromEntries(
  Object.entries(photos).map(([path, asset]) => [
    path.split("/").pop()?.replace(".jpg.asset.json", ""),
    asset.default.url,
  ]),
);

const pizzaPhotos: Record<string, string> = {
  "piratino": "piratino-3",
  "napoli": "napoli-2",
  "boscaiola": "boscaiola-2",
  "margherita": "margherita",
  "margerita": "margherita",
  "prosciutto-e-funghi": "prosciutto-funghi",
  "salami-scharf": "salami",
  "toscana-scharf": "toscana",
  "calzone-zugedeckt": "calzone",
  "calzone-special-zugedeckt": "calzone-special",
  "contandino": "contadino",
  "vegeteriana": "vegetariana",
  "o-sole-mio": "o-sole-mio",
  "frutti-di-mare": "frutti-di-mare",
  "tre-formaggi": "tre-formaggi",
  "quattro-stagioni": "quattro-stagioni",
  "da-arda": "da-arda",
  "da-esma": "da-esma",
  "da-osi": "da-osi",
  "da-reco": "da-reco",
  "cipolla-peperoni": "cipolla-peperoni",
  "my-pizza": "margherita",
  "kapitan-hook": "margherita",
  "peter-pan": "hawaii",
};

function slug(value: string) {
  return value.toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/é/g, "e").replace(/è/g, "e")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-+$/g, "");
}

export function qrProductImage(name: string, category: string): string | undefined {
  if (/mittagsmen/i.test(category)) {
    return byFilename[/pasta/i.test(name) ? "pastamenu" : "pizzamenu"];
  }

  if (/pizza|calzone/i.test(category) || /pizza|calzone/i.test(name)) {
    // Kinder-Piratino has different toppings from the regular Piratino.
    if (/kinder/i.test(category) && /piratino/i.test(name)) return undefined;
    const key = slug(name
      .replace(/\s*-\s*(?:32|45|50)\s*cm\b/gi, "")
      .replace(/\s*-\s*kids\b/gi, "")
      .replace(/^pizza\s+/i, ""));
    return byFilename[pizzaPhotos[key] ?? key];
  }

  const key = slug(name.replace(/\s*-\s*(?:klein|grosse|gross)\b/gi, ""));
  return byFilename[key] ?? byFilename[key.replace(/^pasta-/, "")];
}