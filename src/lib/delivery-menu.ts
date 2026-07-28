// Auto-generiert aus der Piratino Lieferkarte (Uber Eats). Preise in CHF.
export interface DeliveryMenuItem {
  id: string;
  name: string;
  price: number;
  description?: string | null;
}

export interface DeliveryMenuCategory {
  category: string;
  items: DeliveryMenuItem[];
}

export const DELIVERY_MENU: DeliveryMenuCategory[] = [
  {
    "category": "Beilagen",
    "items": [
      {
        "id": "ue-beilagen-hausgemachte-joghurtsosse",
        "name": "hausgemachte Joghurtsosse",
        "price": 1.0,
        "description": null
      },
      {
        "id": "ue-beilagen-warme-brotli",
        "name": "warme Brötli",
        "price": 6.0,
        "description": null
      },
      {
        "id": "ue-beilagen-hausgemachte-knoblauchsosse",
        "name": "hausgemachte Knoblauchsosse",
        "price": 1.0,
        "description": null
      },
      {
        "id": "ue-beilagen-hausgemachte-peperoncini-in-olivenol",
        "name": "hausgemachte Peperoncini in Olivenöl",
        "price": 1.0,
        "description": null
      },
      {
        "id": "ue-beilagen-hausgemachte-cocktailsosse",
        "name": "hausgemachte Cocktailsosse",
        "price": 1.0,
        "description": null
      },
      {
        "id": "ue-beilagen-hausgemachte-tartarsosse",
        "name": "hausgemachte  Tartarsosse",
        "price": 1.0,
        "description": null
      }
    ]
  },
  {
    "category": "Salate",
    "items": [
      {
        "id": "ue-salate-gemischter-salat",
        "name": "Gemischter Salat",
        "price": 8.0,
        "description": null
      },
      {
        "id": "ue-salate-gruner-salat",
        "name": "Grüner Salat",
        "price": 7.0,
        "description": null
      },
      {
        "id": "ue-salate-insalata-caprese",
        "name": "Insalata Caprese",
        "price": 9.0,
        "description": null
      },
      {
        "id": "ue-salate-griechischer-salat",
        "name": "Griechischer Salat",
        "price": 12.0,
        "description": "Grüner Salat mit Tomaten, Fetakäse, Gurken, Oliven und Zwiebeln."
      },
      {
        "id": "ue-salate-wurstkasesalat",
        "name": "Wurstkäsesalat",
        "price": 10.0,
        "description": null
      },
      {
        "id": "ue-salate-thonsalat",
        "name": "Thonsalat",
        "price": 10.0,
        "description": null
      },
      {
        "id": "ue-salate-rucola-salat-mit-parmesan",
        "name": "Rucola Salat mit Parmesan",
        "price": 10.0,
        "description": null
      },
      {
        "id": "ue-salate-tomatensalat",
        "name": "Tomatensalat",
        "price": 9.0,
        "description": null
      },
      {
        "id": "ue-salate-crevetten-cocktail",
        "name": "Crevetten Cocktail",
        "price": 15.0,
        "description": null
      }
    ]
  },
  {
    "category": "Vorspeisen",
    "items": [
      {
        "id": "ue-vorspeisen-knoblibrot",
        "name": "Knoblibrot",
        "price": 9.0,
        "description": "Mozzarella und Knoblauch"
      },
      {
        "id": "ue-vorspeisen-portion-pommes-frittes",
        "name": "Portion Pommes Frittes",
        "price": 7.0,
        "description": null
      },
      {
        "id": "ue-vorspeisen-lahmacun",
        "name": "Lahmacun",
        "price": 18.0,
        "description": null
      }
    ]
  },
  {
    "category": "Kebabgerichte",
    "items": [
      {
        "id": "ue-kebabgerichte-donerbox-klein",
        "name": "Dönerbox - klein",
        "price": 16.0,
        "description": "Mit hausgemachten Saucen"
      },
      {
        "id": "ue-kebabgerichte-donerbox-grosse",
        "name": "Dönerbox - grosse",
        "price": 26.0,
        "description": "Mit hausgemachten Saucen"
      },
      {
        "id": "ue-kebabgerichte-cevapebox-klein",
        "name": "Cevapebox - klein",
        "price": 15.0,
        "description": "Mit hausgemachten Saucen"
      },
      {
        "id": "ue-kebabgerichte-cevapebox-grosse",
        "name": "Cevapebox - grosse",
        "price": 25.0,
        "description": "Mit hausgemachten Saucen"
      },
      {
        "id": "ue-kebabgerichte-donerbox-xxl",
        "name": "Dönerbox - XXL",
        "price": 36.0,
        "description": null
      },
      {
        "id": "ue-kebabgerichte-falafalbox-klein",
        "name": "Falafalbox - klein",
        "price": 16.0,
        "description": null
      }
    ]
  },
  {
    "category": "Pasta",
    "items": [
      {
        "id": "ue-pasta-pasta-bolognese",
        "name": "Pasta Bolognese",
        "price": 23.0,
        "description": "Tomatensauce mit Rindshackfleisch. Wird mit eine Nudelsorte nach Wahl zubereitet."
      },
      {
        "id": "ue-pasta-pasta-piratino",
        "name": "Pasta Piratino",
        "price": 21.0,
        "description": "Kalbfleisch, Zwiebeln, Knoblauch, Peperoncini und Rahm. Wird mit eine Nudelsorte nach Wahl zubereitet."
      },
      {
        "id": "ue-pasta-pasta-carbonara",
        "name": "Pasta Carbonara",
        "price": 18.0,
        "description": "Speck, Eigelb und Rahmsauce. Wird mit eine Nudelsorte nach Wahl zubereitet."
      },
      {
        "id": "ue-pasta-pasta-ai-funghi-porcini",
        "name": "Pasta Ai Funghi Porcini",
        "price": 24.0,
        "description": "Rahmsauce mit Steinpilzen, Knoblauch und Zwiebeln. Wird mit eine Nudelsorte nach Wahl zubereitet."
      },
      {
        "id": "ue-pasta-pasta-all-arrabbiata",
        "name": "Pasta All`Arrabbiata",
        "price": 21.0,
        "description": "Tomatensauce, Peperoncini und Knoblauch. Wird mit eine Nudelsorte nach Wahl zubereitet."
      },
      {
        "id": "ue-pasta-penne-al-forno",
        "name": "Penne Al Forno",
        "price": 24.0,
        "description": "Schinken, Zwiebeln, Knoblauch, Tomatensauce mit Rahm und gratiniert."
      },
      {
        "id": "ue-pasta-pasta-boscaiola",
        "name": "Pasta Boscaiola",
        "price": 19.0,
        "description": "Rahmsauce mit verschiedenen Pilzen und Knoblauch. Wird mit eine Nudelsorte nach Wahl zubereitet."
      },
      {
        "id": "ue-pasta-cannelloni-vegetarisch",
        "name": "Cannelloni (Vegetarisch)",
        "price": 23.0,
        "description": "Ricotta, Spinat- und Broccolifüllung"
      },
      {
        "id": "ue-pasta-lasagne",
        "name": "Lasagne",
        "price": 23.0,
        "description": "Mit Rindfleisch"
      },
      {
        "id": "ue-pasta-pasta-napoli",
        "name": "Pasta Napoli",
        "price": 16.0,
        "description": "Tomatensauce. Wird mit eine Nudelsorte nach Wahl zubereitet."
      },
      {
        "id": "ue-pasta-pasta-tiziana",
        "name": "Pasta Tiziana",
        "price": 20.0,
        "description": "Tomatensauce mit Rahm, Zwiebeln und Curry. Wird mit eine Nudelsorte nach Wahl zubereitet."
      },
      {
        "id": "ue-pasta-cannelloni",
        "name": "Cannelloni",
        "price": 23.0,
        "description": "Mit Rindfleischfüllung"
      },
      {
        "id": "ue-pasta-tortellini-alla-panna",
        "name": "Tortellini Alla Panna",
        "price": 23.0,
        "description": "Mit Rahmsauce"
      }
    ]
  },
  {
    "category": "Fleisch, Fisch & Grill",
    "items": [
      {
        "id": "ue-fleisch-fisch-grill-pouletflugeli-7-stuck",
        "name": "Pouletflügeli - 7 Stück",
        "price": 25.0,
        "description": "Mit 1 Beilagen"
      },
      {
        "id": "ue-fleisch-fisch-grill-cevapcici-10-stuck",
        "name": "Cevapcici - 10 Stück",
        "price": 27.0,
        "description": "Mit 1 Beilagen"
      },
      {
        "id": "ue-fleisch-fisch-grill-fischknusperli-8-stuck",
        "name": "Fischknusperli - 8 Stück",
        "price": 24.0,
        "description": "Mit 1Beilagen"
      },
      {
        "id": "ue-fleisch-fisch-grill-schweinskotelett-2-stuck",
        "name": "Schweinskotelett - 2 Stück",
        "price": 29.0,
        "description": "Mit 1 Beilagen"
      },
      {
        "id": "ue-fleisch-fisch-grill-chicken-nuggets-kids",
        "name": "Chicken Nuggets - Kids",
        "price": 13.0,
        "description": "Kinderportion"
      },
      {
        "id": "ue-fleisch-fisch-grill-rinds-entrecote",
        "name": "Rinds Entrecôte",
        "price": 37.0,
        "description": "Mit 1 Beilage"
      },
      {
        "id": "ue-fleisch-fisch-grill-calamares-im-bierteig-8-stuck",
        "name": "Calamares im Bierteig - 8 Stück",
        "price": 24.0,
        "description": "Mit 1 Beilagen"
      },
      {
        "id": "ue-fleisch-fisch-grill-pouletspiess-3-stuck",
        "name": "Pouletspiess - 3 Stück",
        "price": 27.0,
        "description": "Mit 1 Beilagen"
      },
      {
        "id": "ue-fleisch-fisch-grill-lammspiess-3-stuck",
        "name": "Lammspiess - 3 Stück",
        "price": 29.0,
        "description": "Mit 1 Beilagen"
      },
      {
        "id": "ue-fleisch-fisch-grill-frutti-di-mare-platte-solo",
        "name": "Frutti di Mare Platte - Solo",
        "price": 29.95,
        "description": "Frutti di Mare Platte Solo: Muscheln, Oktopus, Garnelen, Crevetten auf Salat, verfeinert mit frischer Zitrone. Ein Meer an Genuss."
      },
      {
        "id": "ue-fleisch-fisch-grill-frutti-di-mare-platte-family",
        "name": "Frutti di Mare Platte - Family",
        "price": 99.95,
        "description": "Frutti di Mare Platte Family : Muscheln, Oktopus, Garnelen, Crevetten auf Salat, verfeinert mit frischer Zitrone. Ein Meer an Genuss."
      },
      {
        "id": "ue-fleisch-fisch-grill-lamm-kotelett-3-stuck",
        "name": "Lamm Kotelett - 3 Stück",
        "price": 29.0,
        "description": "Mit 1 Beilagen"
      },
      {
        "id": "ue-fleisch-fisch-grill-frutti-di-mare-platte-duo",
        "name": "Frutti di Mare Platte - Duo",
        "price": 59.95,
        "description": "Frutti di Mare Platte Duo : Muscheln, Oktopus, Garnelen, Crevetten auf Salat, verfeinert mit frischer Zitrone. Ein Meer an Genuss."
      },
      {
        "id": "ue-fleisch-fisch-grill-chickencurry-mit-basmatireis",
        "name": "Chickencurry mit Basmatireis",
        "price": 27.0,
        "description": null
      },
      {
        "id": "ue-fleisch-fisch-grill-crevetten-curry-mit-basmatireis",
        "name": "Crevetten Curry mit Basmatireis",
        "price": 29.0,
        "description": null
      },
      {
        "id": "ue-fleisch-fisch-grill-rindsbraten-mit-basmatireis",
        "name": "Rindsbraten mit Basmatireis",
        "price": 29.0,
        "description": null
      },
      {
        "id": "ue-fleisch-fisch-grill-zurcher-geschnetzeltes-mit-pommes",
        "name": "Zürcher Geschnetzeltes mit Pommes",
        "price": 27.0,
        "description": null
      }
    ]
  },
  {
    "category": "Pizza - 32cm",
    "items": [
      {
        "id": "ue-pizza-32cm-pizza-salami-scharf-32cm",
        "name": "Pizza Salami (scharf) - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, scharfe Salami, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-margherita-32cm",
        "name": "Pizza Margherita - 32cm",
        "price": 19.0,
        "description": "Tomaten, Mozzarella und Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-kebab-32cm",
        "name": "Pizza Kebab - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Kebabfleisch, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-prosciutto-e-funghi-32cm",
        "name": "Pizza Prosciutto e Funghi - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Schinken, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-da-arda-32cm",
        "name": "Pizza Da Arda - 32cm",
        "price": 26.0,
        "description": "Tomaten, Mozzarella, Rohschinken, Mascarpone, Rucola, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-hawaii-32cm",
        "name": "Pizza Hawaii - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Schinken, Ananas, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-o-sole-mio-32cm",
        "name": "Pizza O Sole Mio - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Thon, Zwiebeln, Oliven, Kapern, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-toscana-scharf-32cm",
        "name": "Pizza Toscana (scharf) - 32cm",
        "price": 25.0,
        "description": "Tomaten, Mozzarella, scharfe Salami, Speck, Peperoni, Champignons, Zwiebeln, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-prosciutto-32cm",
        "name": "Pizza Prosciutto - 32cm",
        "price": 22.0,
        "description": "Tomaten, Mozzarella, Schinken, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-quattro-stagioni-32cm",
        "name": "Pizza Quattro Stagioni - 32cm",
        "price": 25.0,
        "description": "Tomaten, Mozzarella, Schinken, Artischocken, Peperoni, Oliven, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-piratino-32cm",
        "name": "Pizza Piratino - 32cm",
        "price": 25.0,
        "description": "Tomaten, Mozzarella, Kalbfleisch, Oliven, Peperoncini, Knoblauch, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-padrone-32cm",
        "name": "Pizza Padrone - 32cm",
        "price": 25.0,
        "description": "Tomaten, Mozzarella, Kalbfleisch, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-vegetariana-32cm",
        "name": "Pizza Vegetariana - 32cm",
        "price": 25.0,
        "description": "Tomaten, Mozzarella, verschiedene Gemüse, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-napoli-32cm",
        "name": "Pizza Napoli - 32cm",
        "price": 21.0,
        "description": "Tomaten, Mozzarella, Sardellen, Kapern, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-pesto-32cm",
        "name": "Pizza Pesto - 32cm",
        "price": 21.0,
        "description": "Tomaten, Mozzarella, Pestosauce, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-da-reco-32cm",
        "name": "Pizza Da Reco - 32cm",
        "price": 26.0,
        "description": "Tomaten, Mozzarella, Hackfleisch, Ei, Spinat, Gorgonzola, Speck, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-fiorentina-32cm",
        "name": "Pizza Fiorentina - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Spinat, Ei, Knoblauch, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-funghi-32cm",
        "name": "Pizza Funghi - 32cm",
        "price": 22.0,
        "description": "Tomaten, Mozzarella, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-salmone-32cm",
        "name": "Pizza Salmone - 32cm",
        "price": 26.0,
        "description": "Tomaten, Mozzarella, Lachs, Zwiebeln, Kapern, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-capricciosa-32cm",
        "name": "Pizza Capricciosa - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Artischocken, Peperoni, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-boscaiola-32cm",
        "name": "Pizza Boscaiola - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Champignons, Steinpilze, Knoblauch, Oregano"
      },
      {
        "id": "ue-pizza-32cm-calzone-zugedeckt-32cm",
        "name": "Calzone (zugedeckt) - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Pilzen, Schinken, Ei, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-frutti-di-mare-32cm",
        "name": "Pizza Frutti di Mare - 32cm",
        "price": 25.0,
        "description": "Tomaten, Mozzarella, Meeresfrüchte, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-contadino-32cm",
        "name": "Pizza Contadino - 32cm",
        "price": 25.0,
        "description": "Tomaten, Mozzarella, Gorgonzola, Rohschinken, Rucola, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-luca-32cm",
        "name": "Pizza Luca - 32cm",
        "price": 26.0,
        "description": "Tomaten, Mozzarella, Auberginen, Parmesan, Rohschinken, Rucola, Cherrytomaten, Oregano"
      },
      {
        "id": "ue-pizza-32cm-calzone-puzzone-zugedeckt-32cm",
        "name": "Calzone Puzzone (zugedeckt) - 32cm",
        "price": 21.0,
        "description": "Mozzarella, Zwiebeln, Schinken, Gorgonzola, Pesto, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-fammy-32cm",
        "name": "Pizza Fammy - 32cm",
        "price": 26.0,
        "description": "Tomaten, Mozzarella, Salami, Rindfleisch, Steinpilze, Ei, Gorgonzola, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-vegana-32cm",
        "name": "Pizza Vegana - 32cm",
        "price": 26.0,
        "description": "Tomaten, Vegankäse und verschiedene Gemüse."
      },
      {
        "id": "ue-pizza-32cm-pizza-da-esma-32cm",
        "name": "Pizza Da Esma - 32cm",
        "price": 26.0,
        "description": "Tomaten, Mozzarella, Schinken, Salami, Speck, Auberginen, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-inferno-32cm",
        "name": "Pizza Inferno - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Oliven, Sardellen, Peperoncini, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-cipolla-peperoni-32cm",
        "name": "Pizza Cipolla Peperoni - 32cm",
        "price": 22.0,
        "description": "Tomaten, Mozzarella, Cherrytomaten, Zwiebeln, Peperoni, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-gorgonzola-32cm",
        "name": "Pizza Gorgonzola - 32cm",
        "price": 22.0,
        "description": "Tomaten, Mozzarella, Gorgonzola, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-mediterranea-32cm",
        "name": "Pizza Mediterranea - 32cm",
        "price": 26.0,
        "description": "Tomaten, Mozzarella, Zwiebeln, Spinat, Crevetten, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-da-osi-32cm",
        "name": "Pizza Da Osi - 32cm",
        "price": 26.0,
        "description": "Tomaten, Mozzarella, Salami, Spinat, Auberginen, Parmesan, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-zitella-32cm",
        "name": "Pizza Zitella - 32cm",
        "price": 21.0,
        "description": "Tomaten, Mozzarella, Knoblauch, Oliven, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-madras-32cm",
        "name": "Pizza Madras - 32cm",
        "price": 21.0,
        "description": "Tomaten, Mozzarella, Ananas, Banane, Curry, Pouletgeschnetzeltes, Oregano"
      },
      {
        "id": "ue-pizza-32cm-calzone-special-zugedeckt-32cm",
        "name": "Calzone Special (zugedeckt) - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Spinat, Ei, Pesto, Gorgonzola, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-32cm-my-pizza-32cm",
        "name": "My Pizza - 32cm",
        "price": 28.0,
        "description": "Stelle dir deine eigene Pizza zusammen mit deinen Lieblings Beilagen"
      },
      {
        "id": "ue-pizza-32cm-pizza-tre-formaggi-32cm",
        "name": "Pizza Tre Formaggi - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, 3 verschiedene Käsesorten, Oregano"
      },
      {
        "id": "ue-pizza-32cm-pizza-campagnola-32cm",
        "name": "Pizza Campagnola - 32cm",
        "price": 24.0,
        "description": "Tomaten, Mozzarella, Mais, Speck, Zwiebeln, Oregano"
      }
    ]
  },
  {
    "category": "Kinder Pizza",
    "items": [
      {
        "id": "ue-kinder-pizza-pizza-kapitan-hook-kids",
        "name": "Pizza Kapitan Hook - Kids",
        "price": 16.0,
        "description": "Tomaten, Mozzarella, Oregano"
      },
      {
        "id": "ue-kinder-pizza-pizza-peter-pan-kids",
        "name": "Pizza Peter Pan - Kids",
        "price": 16.0,
        "description": "Tomaten, Mozzarella, Schinken, Ananas, Oregano"
      },
      {
        "id": "ue-kinder-pizza-pizza-piratino-kids",
        "name": "Pizza Piratino - Kids",
        "price": 17.0,
        "description": "Tomaten, Mozzarella, Schinken, Pilze, Eier, Oregano"
      }
    ]
  },
  {
    "category": "Pizza Grande - 45cm",
    "items": [
      {
        "id": "ue-pizza-grande-45cm-pizza-salami-scharf-45cm",
        "name": "Pizza Salami (scharf) - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, scharfe Salami, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-funghi-45cm",
        "name": "Pizza Funghi - 45cm",
        "price": 39.0,
        "description": "Tomaten, Mozzarella, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-prosciutto-e-funghi-45cm",
        "name": "Pizza Prosciutto e Funghi - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, Schinken, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-frutti-di-mare-45cm",
        "name": "Pizza Frutti di Mare - 45cm",
        "price": 45.0,
        "description": "Tomaten, Mozzarella, Meeresfrüchte, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-da-arda-45cm",
        "name": "Pizza Da Arda - 45cm",
        "price": 47.0,
        "description": "Tomaten, Mozzarella, Rohschinken, Mascarpone, Rucola, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-fiorentina-45cm",
        "name": "Pizza Fiorentina - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, Spinat, Ei, Knoblauch, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-o-sole-mio-45cm",
        "name": "Pizza O Sole Mio - 45cm",
        "price": 46.0,
        "description": "Tomaten, Mozzarella, Thon, Zwiebeln, Oliven, Kapern, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-padrone-45cm",
        "name": "Pizza Padrone - 45cm",
        "price": 45.0,
        "description": "Tomaten, Mozzarella, Kalbfleisch, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-madras-45cm",
        "name": "Pizza Madras - 45cm",
        "price": 46.0,
        "description": "Tomaten, Mozzarella, Ananas, Banane, Curry, Pouletgeschnetzeltes, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-calzone-zugedeckt-45cm",
        "name": "Calzone (zugedeckt) - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, Pilzen, Schinken, Ei, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-gorgonzola-45cm",
        "name": "Pizza Gorgonzola - 45cm",
        "price": 39.0,
        "description": "Tomaten, Mozzarella, Gorgonzola, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-vegetariana-45cm",
        "name": "Pizza Vegetariana - 45cm",
        "price": 45.0,
        "description": "Tomaten, Mozzarella, verschiedene Gemüse, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-toscana-scharf-45cm",
        "name": "Pizza Toscana (scharf) - 45cm",
        "price": 45.0,
        "description": "Tomaten, Mozzarella, scharfe Salami, Speck, Peperoni, Champignons, Zwiebeln, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-inferno-45cm",
        "name": "Pizza Inferno - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, Oliven, Sardellen, Peperoncini, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-salmone-45cm",
        "name": "Pizza Salmone - 45cm",
        "price": 47.0,
        "description": "Tomaten, Mozzarella, Lachs, Zwiebeln, Kapern, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-calzone-puzzone-zugedeckt-45cm",
        "name": "Calzone Puzzone (zugedeckt) - 45cm",
        "price": 44.0,
        "description": "Mozzarella, Zwiebeln, Schinken, Gorgonzola, Pesto, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-vegana-45cm",
        "name": "Pizza Vegana - 45cm",
        "price": 47.0,
        "description": "Tomaten, Vegankäse und verschiedene Gemüse."
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-margherita-45cm",
        "name": "Pizza Margherita - 45cm",
        "price": 33.0,
        "description": "Tomaten, Mozzarella und Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-prosciutto-45cm",
        "name": "Pizza Prosciutto - 45cm",
        "price": 39.0,
        "description": "Tomaten, Mozzarella, Schinken, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-kebab-45cm",
        "name": "Pizza Kebab - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, Kebabfleisch, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-quattro-stagioni-45cm",
        "name": "Pizza Quattro Stagioni - 45cm",
        "price": 45.0,
        "description": "Tomaten, Mozzarella, Schinken, Artischocken, Peperoni, Oliven, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-campagnola-45cm",
        "name": "Pizza Campagnola - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, Mais, Speck, Zwiebeln, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-da-reco-45cm",
        "name": "Pizza Da Reco - 45cm",
        "price": 47.0,
        "description": "Tomaten, Mozzarella, Hackfleisch, Ei, Spinat, Gorgonzola, Speck, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-boscaiola-45cm",
        "name": "Pizza Boscaiola - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, Champignons, Steinpilze, Knoblauch, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-capricciosa-45cm",
        "name": "Pizza Capricciosa - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, Artischocken, Peperoni, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-fammy-45cm",
        "name": "Pizza Fammy - 45cm",
        "price": 47.0,
        "description": "Tomaten, Mozzarella, Salami, Rindfleisch, Steinpilze, Ei, Gorgonzola, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-cipolla-peperoni-45cm",
        "name": "Pizza Cipolla Peperoni - 45cm",
        "price": 39.0,
        "description": "Tomaten, Mozzarella, Cherrytomaten, Zwiebeln, Peperoni, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-napoli-45cm",
        "name": "Pizza Napoli - 45cm",
        "price": 37.0,
        "description": "Tomaten, Mozzarella, Sardellen, Kapern, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-pesto-45cm",
        "name": "Pizza Pesto - 45cm",
        "price": 37.0,
        "description": "Tomaten, Mozzarella, Pestosauce, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-piratino-45cm",
        "name": "Pizza Piratino - 45cm",
        "price": 45.0,
        "description": "Tomaten, Mozzarella, Kalbfleisch, Oliven, Peperoncini, Knoblauch, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-hawaii-45cm",
        "name": "Pizza Hawaii - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, Schinken, Ananas, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-calzone-special-zugedeckt-45cm",
        "name": "Calzone Special (zugedeckt) - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, Spinat, Ei, Pesto, Gorgonzola, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-contadino-45cm",
        "name": "Pizza Contadino - 45cm",
        "price": 45.0,
        "description": "Tomaten, Mozzarella, Gorgonzola, Rohschinken, Rucola, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-da-esma-45cm",
        "name": "Pizza Da Esma - 45cm",
        "price": 47.0,
        "description": "Tomaten, Mozzarella, Schinken, Salami, Speck, Auberginen, Champignons, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-zitella-45cm",
        "name": "Pizza Zitella - 45cm",
        "price": 37.0,
        "description": "Tomaten, Mozzarella, Knoblauch, Oliven, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-mediterranea-45cm",
        "name": "Pizza Mediterranea - 45cm",
        "price": 47.0,
        "description": "Tomaten, Mozzarella, Zwiebeln, Spinat, Crevetten, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-tre-formaggi-45cm",
        "name": "Pizza Tre Formaggi - 45cm",
        "price": 43.0,
        "description": "Tomaten, Mozzarella, 3 verschiedene Käsesorten, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-luca-45cm",
        "name": "Pizza Luca - 45cm",
        "price": 47.0,
        "description": "Tomaten, Mozzarella, Auberginen, Parmesan, Rohschinken, Rucola, Cherrytomaten, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-pizza-da-osi-45cm",
        "name": "Pizza Da Osi - 45cm",
        "price": 47.0,
        "description": "Tomaten, Mozzarella, Salami, Spinat, Auberginen, Parmesan, Oregano"
      },
      {
        "id": "ue-pizza-grande-45cm-my-pizza-45cm",
        "name": "My Pizza - 45cm",
        "price": 57.95,
        "description": "Stelle dir deine eigene Pizza zusammen mit deinen Lieblings Beilagen"
      }
    ]
  },
  {
    "category": "Desserts",
    "items": [
      {
        "id": "ue-desserts-tiramisu",
        "name": "Tiramisu",
        "price": 12.0,
        "description": null
      },
      {
        "id": "ue-desserts-panna-cotta-al-caramello",
        "name": "Panna Cotta al caramello",
        "price": 9.5,
        "description": null
      },
      {
        "id": "ue-desserts-meringa",
        "name": "Meringa",
        "price": 9.5,
        "description": null
      },
      {
        "id": "ue-desserts-tartufo-al-cioccolato",
        "name": "Tartufo al cioccolato",
        "price": 9.0,
        "description": null
      },
      {
        "id": "ue-desserts-coppa-al-limone-di-sorrento",
        "name": "Coppa al Limone di Sorrento",
        "price": 10.0,
        "description": null
      },
      {
        "id": "ue-desserts-torta-della-nonna",
        "name": "Torta della nonna",
        "price": 9.0,
        "description": null
      },
      {
        "id": "ue-desserts-torta-macao",
        "name": "Torta macao",
        "price": 9.0,
        "description": null
      },
      {
        "id": "ue-desserts-cheesecake",
        "name": "Cheesecake",
        "price": 9.0,
        "description": null
      },
      {
        "id": "ue-desserts-ricotta-e-pere",
        "name": "Ricotta e pere",
        "price": 8.0,
        "description": null
      },
      {
        "id": "ue-desserts-souffle-al-cioccolato",
        "name": "Souffle al cioccolato",
        "price": 8.0,
        "description": null
      },
      {
        "id": "ue-desserts-souffle-al-pistacchio",
        "name": "Souffle al pistacchio",
        "price": 8.0,
        "description": null
      },
      {
        "id": "ue-desserts-coppa-mandorle-e-amaetto",
        "name": "Coppa Mandorle e amaetto",
        "price": 8.0,
        "description": null
      },
      {
        "id": "ue-desserts-coppa-spagnola",
        "name": "Coppa Spagnola",
        "price": 10.0,
        "description": null
      },
      {
        "id": "ue-desserts-coppa-cioccolato-e-nocciola",
        "name": "Coppa Cioccolato e Nocciola",
        "price": 10.0,
        "description": null
      },
      {
        "id": "ue-desserts-coppa-crema-e-pistacchio",
        "name": "Coppa Crema e Pistacchio",
        "price": 10.0,
        "description": null
      },
      {
        "id": "ue-desserts-coppa-cheesecake-monterosa",
        "name": "Coppa Cheesecake Monterosa",
        "price": 10.0,
        "description": null
      },
      {
        "id": "ue-desserts-cip-cioc",
        "name": "Cip Cioc",
        "price": 8.0,
        "description": null
      },
      {
        "id": "ue-desserts-pan-dan",
        "name": "Pan Dan",
        "price": 8.0,
        "description": null
      }
    ]
  },
  {
    "category": "Spirituosen",
    "items": [
      {
        "id": "ue-spirituosen-bombay-gin-sapphire-70cl",
        "name": "Bombay Gin Sapphire 70cl",
        "price": 49.9,
        "description": null
      },
      {
        "id": "ue-spirituosen-vodka-absolut-70cl",
        "name": "Vodka Absolut 70cl",
        "price": 45.9,
        "description": null
      },
      {
        "id": "ue-spirituosen-jagermeister-krauterlikor-70cl",
        "name": "Jägermeister Kräuterlikör 70cl",
        "price": 47.95,
        "description": null
      },
      {
        "id": "ue-spirituosen-jack-daniels-whiskey-70cl",
        "name": "Jack Daniels Whiskey 70cl",
        "price": 49.95,
        "description": null
      },
      {
        "id": "ue-spirituosen-grants-scotch-whisky",
        "name": "Grants Scotch Whisky",
        "price": 35.95,
        "description": null
      },
      {
        "id": "ue-spirituosen-ballantines-finest-70cl",
        "name": "Ballantines Finest 70cl",
        "price": 39.95,
        "description": null
      },
      {
        "id": "ue-spirituosen-trojka-vodka-pure-grain-70cl",
        "name": "Trojka Vodka Pure Grain 70cl",
        "price": 35.95,
        "description": null
      },
      {
        "id": "ue-spirituosen-johnny-walker-red-label-70cl",
        "name": "Johnny Walker Red Label 70cl",
        "price": 39.95,
        "description": null
      },
      {
        "id": "ue-spirituosen-wodka-gorbatschow-70cl",
        "name": "Wodka Gorbatschow 70cl",
        "price": 39.95,
        "description": null
      }
    ]
  },
  {
    "category": "Softdrinks",
    "items": [
      {
        "id": "ue-softdrinks-coca-cola-0-5l",
        "name": "Coca-Cola 0,5l",
        "price": 4.0,
        "description": null
      },
      {
        "id": "ue-softdrinks-coca-cola-zero-0-5l",
        "name": "Coca-Cola Zero 0,5l",
        "price": 4.0,
        "description": null
      },
      {
        "id": "ue-softdrinks-fanta-orange-0-5l",
        "name": "Fanta Orange 0,5l",
        "price": 4.0,
        "description": null
      },
      {
        "id": "ue-softdrinks-eistea-0-5l",
        "name": "Eistea 0,5l",
        "price": 4.0,
        "description": null
      },
      {
        "id": "ue-softdrinks-sprite-0-5l",
        "name": "Sprite 0,5l",
        "price": 4.0,
        "description": null
      },
      {
        "id": "ue-softdrinks-red-bull-0-25l",
        "name": "Red Bull 0,25l",
        "price": 5.0,
        "description": null
      },
      {
        "id": "ue-softdrinks-mineralwasser-0-5l",
        "name": "Mineralwasser 0,5l",
        "price": 4.0,
        "description": null
      },
      {
        "id": "ue-softdrinks-tony-el-mate",
        "name": "Tony El Mate",
        "price": 5.0,
        "description": null
      }
    ]
  },
  {
    "category": "Bier",
    "items": [
      {
        "id": "ue-bier-schneider-weisse-0-5l",
        "name": "Schneider Weisse 0,5l",
        "price": 6.0,
        "description": "Flasche."
      },
      {
        "id": "ue-bier-corona-0-3l",
        "name": "Corona 0,3l",
        "price": 5.0,
        "description": "Flasche."
      },
      {
        "id": "ue-bier-feldschlosschen-dose-0-5l",
        "name": "Feldschlösschen Dose 0,5l",
        "price": 5.0,
        "description": "Flasche."
      },
      {
        "id": "ue-bier-franziskaner-weissbier-0-5l",
        "name": "Franziskaner Weissbier 0,5l",
        "price": 6.0,
        "description": "Flasche."
      },
      {
        "id": "ue-bier-feldschlosschen-alkoholfrei-0-3l",
        "name": "Feldschlösschen Alkoholfrei 0,3l",
        "price": 5.0,
        "description": "Flasche."
      }
    ]
  },
  {
    "category": "Pizza - 50cm",
    "items": [
      {
        "id": "ue-pizza-50cm-pizza-margerita-50cm",
        "name": "Pizza Margerita - 50cm",
        "price": 45.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-napoli-50cm",
        "name": "Pizza Napoli - 50cm",
        "price": 56.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-pesto-50cm",
        "name": "Pizza Pesto - 50cm",
        "price": 56.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-prosciutto-50cm",
        "name": "Pizza Prosciutto - 50cm",
        "price": 57.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-funghi-50cm",
        "name": "Pizza Funghi - 50cm",
        "price": 49.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-o-sole-mio-50cm",
        "name": "Pizza O Sole Mio - 50cm",
        "price": 56.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-frutti-di-mare-45cm",
        "name": "Pizza Frutti di Mare - 45cm",
        "price": 55.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-da-arda-50cm",
        "name": "Pizza da Arda - 50cm",
        "price": 57.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-padrone-50cm",
        "name": "Pizza Padrone - 50cm",
        "price": 55.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-piratino-50cm",
        "name": "Pizza Piratino - 50cm",
        "price": 55.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-madras-50cm",
        "name": "Pizza Madras - 50cm",
        "price": 56.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-calzone-zugedeckt-50cm",
        "name": "Calzone (zugedeckt) - 50cm",
        "price": 53.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-gorgonzola-50cm",
        "name": "Pizza Gorgonzola - 50cm",
        "price": 44.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-hawaii-50cm",
        "name": "Pizza Hawaii - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-vegeteriana-50cm",
        "name": "Pizza Vegeteriana - 50cm",
        "price": 50.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-toscana-scharf-50cm",
        "name": "Pizza Toscana (scharf) - 50cm",
        "price": 50.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-capricciosa-50cm",
        "name": "Pizza Capricciosa - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-calzone-special-zugedeckt-50cm",
        "name": "Calzone Special (zugedeckt) - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-inferno-50cm",
        "name": "Pizza Inferno - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-fiorentina-50cm",
        "name": "Pizza Fiorentina - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-salami-scharf-50cm",
        "name": "Pizza Salami (scharf) - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-contandino-50cm",
        "name": "Pizza Contandino - 50cm",
        "price": 50.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-da-esma-50cm",
        "name": "Pizza da Esma - 50cm",
        "price": 52.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-salmone-50cm",
        "name": "Pizza Salmone - 50cm",
        "price": 52.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-da-reco-50cm",
        "name": "Pizza Da Reco - 50cm",
        "price": 52.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-fammy-50cm",
        "name": "Pizza Fammy - 50cm",
        "price": 52.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-kebab-50cm",
        "name": "Pizza Kebab - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-prosciutto-e-funghi-50cm",
        "name": "Pizza Prosciutto e Funghi - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-zitella-50cm",
        "name": "Pizza Zitella - 50cm",
        "price": 42.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-cipolla-peperoni",
        "name": "Pizza Cipolla Peperoni",
        "price": 44.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-mediterranea-50cm",
        "name": "Pizza Mediterranea - 50cm",
        "price": 52.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-calzone-puzzone-zugedeckt-50cm",
        "name": "Calzone Puzzone (zugedeckt) - 50cm",
        "price": 49.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-tre-formaggi-50cm",
        "name": "Pizza Tre Formaggi - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-luca-50cm",
        "name": "Pizza Luca - 50cm",
        "price": 52.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-vegana-50cm",
        "name": "Pizza Vegana - 50cm",
        "price": 52.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-quattro-stagioni-50cm",
        "name": "Pizza Quattro Stagioni - 50cm",
        "price": 50.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-boscaiola-50cm",
        "name": "Pizza Boscaiola - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-campagnola-50cm",
        "name": "Pizza Campagnola - 50cm",
        "price": 48.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-pizza-da-osi-50cm",
        "name": "Pizza Da Osi - 50cm",
        "price": 52.0,
        "description": null
      },
      {
        "id": "ue-pizza-50cm-my-pizza-50cm",
        "name": "My Pizza - 50cm",
        "price": 62.95,
        "description": null
      }
    ]
  }
];

export const DELIVERY_CATEGORIES = DELIVERY_MENU.map((c) => c.category);

export const DELIVERY_ITEMS: Array<DeliveryMenuItem & { category: string }> = DELIVERY_MENU.flatMap((c) =>
  c.items.map((i) => ({ ...i, category: c.category })),
);
