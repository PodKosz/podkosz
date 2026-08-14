-- =====================================================================
--  OPCJONALNIE: 18 przykładowych boisk, żeby mapa nie była pusta na starcie.
--  Wklej do SQL Editor → Run. Zdjęć nie ma — karty pokażą grafiki zastępcze.
--
--  Kasowanie danych demo:
--    delete from courts where added_by_name = 'demo';
-- =====================================================================

insert into courts (slug, name, city, voivodeship, lat, lng, type, surface, hoops,
                    lit, fenced, access, hours, description, heat, likes_count, added_by_name)
values
  ('warszawa-pole-mokotowskie','Pole Mokotowskie','Warszawa','mazowieckie',52.2119,20.9950,'otwarty','poliuretan',2,true,true,'24h','całą dobę','Pełnowymiarowa płyta w środku parku. Nowy poliuretan, wyraźne linie.',true,412,'demo'),
  ('warszawa-park-skaryszewski','Park Skaryszewski','Warszawa','mazowieckie',52.2450,21.0530,'streetball','asfalt',2,false,false,'24h','całą dobę','Klasyczny streetball pod drzewami.',false,168,'demo'),
  ('warszawa-hala-osir-ochota','Hala OSiR Ochota','Warszawa','mazowieckie',52.2135,20.9705,'kryty','parkiet',2,true,false,'godziny','07:00 - 22:00','Parkiet w dobrym stanie, regulowane kosze.',false,96,'demo'),
  ('krakow-park-jordana','Park Jordana','Kraków','małopolskie',50.0630,19.9200,'otwarty','tartan',2,true,true,'godziny','06:00 - 22:00','Tartan, ogrodzone, oświetlone do 22.',true,287,'demo'),
  ('krakow-zalew-nowohucki','Zalew Nowohucki','Kraków','małopolskie',50.0402,20.0468,'streetball','beton',1,false,false,'24h','całą dobę','Jeden kosz nad wodą.',false,74,'demo'),
  ('gdansk-zaspa','Zaspa','Gdańsk','pomorskie',54.3900,18.6100,'otwarty','poliuretan',2,true,true,'24h','całą dobę','Boisko między blokami z muralami w tle.',false,331,'demo'),
  ('gdansk-brzezno-przy-plazy','Brzeźno — przy plaży','Gdańsk','pomorskie',54.4051,18.6304,'streetball','asfalt',2,false,true,'24h','całą dobę','200 metrów od morza.',false,142,'demo'),
  ('poznan-cytadela','Cytadela','Poznań','wielkopolskie',52.4231,16.9351,'otwarty','beton',2,false,false,'24h','całą dobę','Betonowa płyta na skarpie parku.',false,205,'demo'),
  ('poznan-malta-kompleks','Malta — kompleks','Poznań','wielkopolskie',52.4019,16.9797,'otwarty','tartan',2,true,true,'godziny','08:00 - 21:00','Dwa pełne boiska obok siebie przy jeziorze.',false,118,'demo'),
  ('wroclaw-wyspa-slodowa','Wyspa Słodowa','Wrocław','dolnośląskie',51.1153,17.0351,'streetball','beton',1,true,false,'24h','całą dobę','Legendarny kosz na wyspie.',true,264,'demo'),
  ('wroclaw-park-poludniowy','Park Południowy','Wrocław','dolnośląskie',51.0900,17.0200,'otwarty','asfalt',2,false,true,'godziny','07:00 - 21:00','Spokojne boisko w cieniu.',false,61,'demo'),
  ('katowice-dolina-trzech-stawow','Dolina Trzech Stawów','Katowice','śląskie',50.2450,19.0400,'otwarty','poliuretan',2,true,true,'24h','całą dobę','Nowy kompleks sportowy w parku.',false,193,'demo'),
  ('lodz-park-poniatowskiego','Park Poniatowskiego','Łódź','łódzkie',51.7500,19.4400,'streetball','asfalt',2,false,false,'24h','całą dobę','Stary asfalt, nowe tablice.',false,88,'demo'),
  ('szczecin-jasne-blonia','Jasne Błonia','Szczecin','zachodniopomorskie',53.4380,14.5400,'otwarty','syntetyk',2,true,true,'godziny','08:00 - 22:00','Boisko wielofunkcyjne, siatki nowe.',false,57,'demo'),
  ('lublin-zalew-zemborzycki','Zalew Zemborzycki','Lublin','lubelskie',51.1900,22.5300,'otwarty','beton',2,false,false,'24h','całą dobę','Nad wodą, blisko plaży miejskiej.',false,44,'demo'),
  ('bialystok-planty','Planty','Białystok','podlaskie',53.1300,23.1600,'otwarty','tartan',2,true,true,'godziny','07:00 - 22:00','Świeżo wyremontowane.',false,39,'demo'),
  ('rzeszow-hala-millenium','Hala Millenium','Rzeszów','podkarpackie',50.0413,21.9990,'kryty','parkiet',2,true,false,'ograniczony','16:00 - 21:00 (pn-pt)','Hala przyszkolna, otwarta popołudniami.',false,31,'demo'),
  ('olsztyn-nad-lyna','Nad Łyną','Olsztyn','warmińsko-mazurskie',53.7784,20.4801,'streetball','beton',1,false,false,'24h','całą dobę','Pojedynczy kosz nad rzeką.',false,22,'demo')
on conflict (slug) do nothing;
