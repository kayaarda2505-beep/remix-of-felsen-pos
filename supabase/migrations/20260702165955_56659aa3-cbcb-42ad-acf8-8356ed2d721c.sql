
-- Replace product catalog with SAINTS Barkarte
DELETE FROM public.product_recipes;
DELETE FROM public.products;

INSERT INTO public.products (id, name, category, price, description, meta, active, sort_order) VALUES
-- SIGNATURES
('sig-the-saint','the saint','Signatures',13.00,'xxx',NULL,true,10),
('sig-the-sinner','the sinner','Signatures',13.00,'xxx',NULL,true,20),
('sig-the-smoke','the smoke','Signatures',13.00,'xxx',NULL,true,30),

-- COCKTAILS
('cktl-hugo','hugo','Cocktails',12.00,'prosecco, mineralwasser, holunderblütensirup, limette, minze, eiswürfel',NULL,true,110),
('cktl-negroni','negroni','Cocktails',12.00,'gin, campari bitter, wermut, orangenschale, eiswürfel',NULL,true,120),
('cktl-mojito','mojito','Cocktails',12.00,'weisser cubanrum, mineralwasser, rohrzucker, limette, minze, crushed ice',NULL,true,130),
('cktl-moscow-mule','moscow mule','Cocktails',12.00,'vodka, spicy gingerbier, limettensaft, limette, eiswürfel',NULL,true,140),
('cktl-amaretto-sour','amaretto sour','Cocktails',12.00,'amaretto, zitronensaft, orangensaft, frisches eiweiss, zitrone, eiswürfel',NULL,true,150),
('cktl-wildberry-lillet','wildberry lillet','Cocktails',13.00,'lillet blanc, thomas henry wild berry, himbeeren, erdbeeren, eiswürfel',NULL,true,160),
('cktl-gin-basil-smash','gin basil smash','Cocktails',14.00,'gin, basilikum, zitronensaft, rohrzuckersirup, eiswürfel',NULL,true,170),
('cktl-espresso-martini','espresso martini','Cocktails',15.00,'vodka, frischer espresso-shot, kahlùa, rohrzuckersirup, kaffebohne',NULL,true,180),

-- SPRITZ
('spr-aperol','aperol spritz','Spritz',13.00,'aperol, prosecco, mineralwasser, orangenscheibe, eiswürfel',NULL,true,210),
('spr-limoncello','limoncello spritz','Spritz',13.00,'limoncello, prosecco, mineralwasser, zitronenscheibe, minze, eiswürfel',NULL,true,220),
('spr-weisser','weisser spritzer','Spritz',7.00,'weisswein, mineralwasser (sauer) oder sprite (süss), eiswürfel',NULL,true,230),

-- MOCKTAILS
('mck-virgin-hugo','virgin hugo','Mocktails',11.00,'ginger ale, mineralwasser, holunderblütensirup, limette, minze, eiswürfel',NULL,true,310),
('mck-virgin-negroni','virgin negroni','Mocktails',11.00,'gin (alkfrei), campari bitter (alkfrei), wermut (alkfrei), orangenschale, eiswürfel',NULL,true,320),
('mck-virgin-mojito','virgin mojito','Mocktails',11.00,'ginger ale, mineralwasser, rohrzucker, limette, minze, crushed ice',NULL,true,330),
('mck-virgin-moscow-mule','virgin moscow mule','Mocktails',11.00,'spicy gingerbier (alkfrei), limettensaft, limette, minze, eiswürfel',NULL,true,340),
('mck-virgin-amaretto-sour','virgin amaretto sour','Mocktails',11.00,'amaretti (alkfrei), zitronensaft, orangensaft, frisches eiweiss, zitrone, eiswürfel',NULL,true,350),

-- BIER FLASCHE
('bier-heineken','heineken','Bier',6.00,'holländisches lagerbier','33cl · 5.0%',true,410),
('bier-moretti','moretti','Bier',6.50,'italienisches lagerbier','33cl · 4.6%',true,420),
('bier-moretti-limone','moretti limone','Bier',6.50,'italienisches panaché','33cl · 1.3%',true,430),
('bier-moretti-alkfrei','moretti alkoholfrei','Bier',6.50,'italienisches alkoholfreies lagerbier','33cl · 4.6%',true,440),
('bier-corona','corona','Bier',7.00,'mexikanisches bier mit limette','33cl · 5.0%',true,450),
('bier-schneider-weisse','schneider weisse','Bier',7.00,'bayrisches weissbier','33cl · 5.3%',true,460),
('bier-efes-draft','efes draft','Bier',7.00,'türkisches helles bier','50cl · 5.0%',true,470),
('bier-collesi-ambrata','collesi ambrata','Bier',9.50,'italienisches stark gehopftes craftbier','50cl · 6.0%',true,480),
('bier-guinness','guinness microdraught','Bier',8.00,'irisches schwarzbier mit röstaromen','50cl · 4.2%',true,490),
-- BIER OFFEN
('bier-herrgoettli','herrgöttli','Bier',3.00,'feldschlösschen helvetic oder saisonbier','2.0dl · 4.8%',true,510),
('bier-stange','stange','Bier',4.00,'feldschlösschen helvetic oder saisonbier','3.0dl · 4.8%',true,520),
('bier-chuebel','chübel','Bier',6.00,'feldschlösschen helvetic oder saisonbier','5.0dl · 4.8%',true,530),

-- WEIN
('wein-weiss-1dl','weiss 1dl','Wein',7.00,'senza parole – italien · 13%','1.0dl',true,610),
('wein-weiss-2dl','weiss 2dl','Wein',13.00,'senza parole – italien · 13%','2.0dl',true,611),
('wein-weiss-flasche','weiss flasche','Wein',32.00,'senza parole – italien · 13%','7.5dl',true,612),
('wein-rot-1dl','rot 1dl','Wein',7.00,'primitivo puglia senza parole – italien · 13%','1.0dl',true,620),
('wein-rot-2dl','rot 2dl','Wein',13.00,'primitivo puglia senza parole – italien · 13%','2.0dl',true,621),
('wein-rot-flasche','rot flasche','Wein',32.00,'primitivo puglia senza parole – italien · 13%','7.5dl',true,622),
('wein-rose-1dl','rosé 1dl','Wein',7.00,'rosapasso pinot nero – italien · 12%','1.0dl',true,630),
('wein-rose-2dl','rosé 2dl','Wein',13.00,'rosapasso pinot nero – italien · 12%','2.0dl',true,631),
('wein-rose-flasche','rosé flasche','Wein',32.50,'rosapasso pinot nero – italien · 12%','7.5dl',true,632),
('wein-prosecco-1dl','prosecco 1dl','Wein',7.50,'nudo DOC brut – italien · 11%','1.0dl',true,640),
('wein-prosecco-2dl','prosecco 2dl','Wein',15.00,'nudo DOC brut – italien · 11%','2.0dl',true,641),
('wein-prosecco-flasche','prosecco flasche','Wein',49.00,'nudo DOC brut – italien · 11%','7.5dl',true,642),
('wein-champagner-1dl','champagner 1dl','Wein',8.50,'pierre mignon brut – frankreich · 12%','1.0dl',true,650),
('wein-champagner-2dl','champagner 2dl','Wein',16.00,'pierre mignon brut – frankreich · 12%','2.0dl',true,651),
('wein-champagner-flasche','champagner flasche','Wein',52.00,'pierre mignon brut – frankreich · 12%','7.5dl',true,652),

-- SHOTS
('shot-limoncello','limoncello','Shots',5.00,'limoncé','2cl · 25%',true,710),
('shot-tequila','tequila','Shots',5.00,'sierra blanco','2cl · 25%',true,720),
('shot-vodka-cornichon','vodka + cornichon','Shots',5.00,'absolut','2cl · 40%',true,730),
('shot-baby-guinness','baby guinness','Shots',6.00,'kahlua kaffeelikör, bailey''s irish cream','2cl · 23%',true,740),
('shot-jaegermeisterli','jägermeisterli','Shots',5.00,'jägermeister kräuterlikör','2cl · 35%',true,750),

-- SPIRITUOSEN
('sp-whiskey','whiskey','Spirituosen',8.00,'jack daniels old no.7 tennessee','4cl · 40%',true,810),
('sp-vodka','vodka','Spirituosen',8.00,'absolut','4cl · 40%',true,820),
('sp-gin','gin','Spirituosen',10.00,'hendrick''s','4cl · 41.4%',true,830),
('sp-rum','rum','Spirituosen',8.00,'havana club anejo','4cl · 37.5%',true,840),

-- SOFTDRINKS
('sd-mineral-still','mineral still','Softdrinks',3.50,NULL,'33cl',true,910),
('sd-mineral-prickelnd','mineral prickelnd','Softdrinks',3.50,NULL,'33cl',true,920),
('sd-coca-cola','coca cola','Softdrinks',4.50,NULL,'33cl',true,930),
('sd-coca-cola-zero','coca cola zero','Softdrinks',4.50,NULL,'33cl',true,940),
('sd-fuseta-lemon','fuseta lemon','Softdrinks',4.50,NULL,'33cl',true,950),
('sd-fuseta-peach','fuseta peach','Softdrinks',4.50,NULL,'33cl',true,960),
('sd-rivella-blau','rivella blau','Softdrinks',4.50,NULL,'33cl',true,970),
('sd-tonic-water','tonic water','Softdrinks',4.50,NULL,'20cl',true,980),
('sd-bitter-lemon','bitter lemon','Softdrinks',4.50,NULL,'20cl',true,990),
('sd-sanbitter','sanbitter','Softdrinks',4.50,NULL,'10cl',true,1000),
('sd-el-tony-mate','el tony mate','Softdrinks',4.50,NULL,'33cl',true,1010),
('sd-redbull','redbull','Softdrinks',5.00,NULL,'25cl',true,1020),
('sd-redbull-sf','redbull sugarfree','Softdrinks',5.00,NULL,'25cl',true,1030),
('sd-fizzy-mandarine','fizzy mandarine','Softdrinks',6.00,'mit flasche serviert','35cl',true,1040),
('sd-fizzy-heidelbeere','fizzy heidelbeere','Softdrinks',6.00,'mit flasche serviert','35cl',true,1050),

-- HOMEMADES
('hm-italian-lemonade','italian lemonade','Homemades',8.00,'frischer zitronensaft, wasser, zucker, minze, eiswürfel','homemade',true,1110),
('hm-brasilian-lemonade','brasilian lemonade','Homemades',8.00,'limetten, wasser, kondensmilch, limettenscheibe, eiswürfel','homemade',true,1120),
('hm-saints-icetea','saints icetea','Homemades',8.00,'kalter türkischer cay, frischer zitronensaft, zucker, himbeersirup, eiswürfel','homemade',true,1130),

-- HOT (Café + Tee)
('hot-espresso','espresso','Hot',4.50,NULL,NULL,true,1210),
('hot-ristretto','ristretto','Hot',4.50,NULL,NULL,true,1220),
('hot-cafe-creme','cafe créme','Hot',4.50,NULL,NULL,true,1230),
('hot-cappuccino','cappuccino','Hot',5.50,NULL,NULL,true,1240),
('hot-tee-fruechte','tee früchte','Hot',4.00,'natura bio','2.50g',true,1310),
('hot-tee-hagebutten','tee hagebutten-hibiskus','Hot',4.00,'natura bio','2.25g',true,1320),
('hot-tee-kamillen','tee kamillen','Hot',4.00,'natura bio','1.20g',true,1330),
('hot-tee-schwarz','tee schwarz','Hot',4.00,'natura bio','1.50g',true,1340),
('hot-tee-pfefferminze','tee pfefferminze','Hot',4.00,'natura bio','1.40g',true,1350),

-- SNACKS
('sn-bruschetta','bruschetta','Snacks',12.00,'tomaten, knoblauch-öl, basilikum, olivenöl, salz, pfeffer auf baguette','homemade',true,1410),
('sn-focaccia','focaccia','Snacks',11.00,'focaccia-brot mit olivenöl','homemade',true,1420),
('sn-chaltes-plaettli','chaltes plättli','Snacks',14.00,'rohschinken, parmesan, oliven',NULL,true,1430),
('sn-oliven','oliven','Snacks',8.00,'grüne oliven',NULL,true,1440),
('sn-guacamole','guacamole mit nachos','Snacks',7.00,'avocado, limettensaft, gewürzt',NULL,true,1450),
('sn-pao-de-queijo','pao de queijo','Snacks',8.00,'brasilianische käsebällchen',NULL,true,1460);
