/**
 * Maps Polish cities to voivodeships.
 */
export const CITY_VOIVODESHIP: Record<string, string> = {
  // dolnoslaskie
  "Wrocław": "dolnoslaskie", "Wałbrzych": "dolnoslaskie", "Legnica": "dolnoslaskie",
  "Jelenia Góra": "dolnoslaskie", "Głogów": "dolnoslaskie", "Lubin": "dolnoslaskie",
  "Świdnica": "dolnoslaskie", "Oleśnica": "dolnoslaskie", "Dzierżoniów": "dolnoslaskie",
  "Bolesławiec": "dolnoslaskie", "Kłodzko": "dolnoslaskie", "Nysa": "dolnoslaskie",
  "Pieńsk": "dolnoslaskie", "Ząbkowice Śląskie": "dolnoslaskie",
  // kujawsko-pomorskie
  "Bydgoszcz": "kujawsko-pomorskie", "Toruń": "kujawsko-pomorskie",
  "Włocławek": "kujawsko-pomorskie", "Grudziądz": "kujawsko-pomorskie",
  "Inowrocław": "kujawsko-pomorskie", "Brodnica": "kujawsko-pomorskie",
  "Chojnice": "kujawsko-pomorskie", "Nakło": "kujawsko-pomorskie",
  // lodzkie
  "Łódź": "lodzkie", "Piotrków Trybunalski": "lodzkie", "Pabianice": "lodzkie",
  "Tomaszów Mazowiecki": "lodzkie", "Bełchatów": "lodzkie", "Skierniewice": "lodzkie",
  "Radomsko": "lodzkie", "Kutno": "lodzkie", "Sieradz": "lodzkie",
  "Łowicz": "lodzkie", "Łęczyca": "lodzkie", "Turek": "lodzkie",
  // lubelskie
  "Lublin": "lubelskie", "Zamość": "lubelskie", "Chełm": "lubelskie",
  "Biała Podlaska": "lubelskie", "Puławy": "lubelskie", "Lubartów": "lubelskie",
  // lubuskie
  "Zielona Góra": "lubuskie", "Gorzów Wielkopolski": "lubuskie",
  "Żary": "lubuskie", "Górzyca": "lubuskie",
  // malopolskie
  "Kraków": "malopolskie", "Tarnów": "malopolskie", "Nowy Sącz": "malopolskie",
  "Oświęcim": "malopolskie", "Nowy Targ": "malopolskie", "Wadowice Dolne": "malopolskie",
  "Bochnia": "malopolskie", "Chrzanów": "malopolskie",
  // mazowieckie
  "Warszawa": "mazowieckie", "Radom": "mazowieckie", "Płock": "mazowieckie",
  "Siedlce": "mazowieckie", "Legionowo": "mazowieckie", "Celestynów": "mazowieckie",
  "Nowy Dwór Mazowiecki": "mazowieckie", "Ostrów Mazowiecka": "mazowieckie",
  "Nasielsk": "mazowieckie", "Sochaczew": "mazowieckie", "Żyrardów": "mazowieckie",
  "Puszcza Mariańska": "mazowieckie", "Iłża": "mazowieckie", "Pawłowo": "mazowieckie",
  // opolskie
  "Opole": "opolskie", "Kędzierzyn-Koźle": "opolskie",
  // podkarpackie
  "Rzeszów": "podkarpackie", "Przemyśl": "podkarpackie", "Mielec": "podkarpackie",
  "Stalowa Wola": "podkarpackie", "Tarnobrzeg": "podkarpackie",
  "Ropczyce": "podkarpackie", "Lesko": "podkarpackie", "Boguchwała": "podkarpackie",
  "Orzechowce": "podkarpackie", "Wysocko Wielkie": "podkarpackie",
  // podlaskie
  "Białystok": "podlaskie", "Suwałki": "podlaskie", "Łomża": "podlaskie",
  "Augustów": "podlaskie", "Hajnówka": "podlaskie", "Sokółka": "podlaskie",
  // pomorskie
  "Gdańsk": "pomorskie", "Gdynia": "pomorskie", "Sopot": "pomorskie",
  "Słupsk": "pomorskie", "Tczew": "pomorskie", "Starogard Gdański": "pomorskie",
  "Luzino": "pomorskie", "Bojano": "pomorskie",
  // slaskie
  "Katowice": "slaskie", "Częstochowa": "slaskie", "Sosnowiec": "slaskie",
  "Gliwice": "slaskie", "Zabrze": "slaskie", "Bytom": "slaskie",
  "Bielsko-Biała": "slaskie", "Rybnik": "slaskie", "Tychy": "slaskie",
  "Chorzów": "slaskie", "Jastrzębie-Zdrój": "slaskie", "Jaworzno": "slaskie",
  "Racibórz": "slaskie", "Cieszyn": "slaskie", "Żywiec": "slaskie",
  "Radlin": "slaskie", "Wilkowice": "slaskie", "Dąbrowa Górnicza": "slaskie",
  "Ruda Śląska": "slaskie", "Siemianowice Śląskie": "slaskie",
  // swietokrzyskie
  "Kielce": "swietokrzyskie", "Ostrowiec Świętokrzyski": "swietokrzyskie",
  "Starachowice": "swietokrzyskie", "Skarżysko-Kamienna": "swietokrzyskie",
  "Kunów": "swietokrzyskie", "Nowiny": "swietokrzyskie",
  // warminsko-mazurskie
  "Olsztyn": "warminsko-mazurskie", "Elbląg": "warminsko-mazurskie",
  "Ostróda": "warminsko-mazurskie",
  "Iława": "warminsko-mazurskie", "Giżycko": "warminsko-mazurskie",
  "Kętrzyn": "warminsko-mazurskie", "Korsze": "warminsko-mazurskie",
  "Pisz": "warminsko-mazurskie", "Ełk": "warminsko-mazurskie",
  // wielkopolskie
  "Poznań": "wielkopolskie", "Kalisz": "wielkopolskie", "Konin": "wielkopolskie",
  "Gniezno": "wielkopolskie", "Piła": "wielkopolskie", "Leszno": "wielkopolskie",
  "Oborniki": "wielkopolskie", "Krotoszyn": "wielkopolskie",
  "Gołańcz": "wielkopolskie", "Środa Wielkopolska": "wielkopolskie",
  "Święciechowa": "wielkopolskie", "Sompolno": "wielkopolskie",
  "Gaj": "wielkopolskie", "Kostrzyn": "wielkopolskie",
  "Stargard Szczeciński": "zachodniopomorskie",
  // zachodniopomorskie
  "Szczecin": "zachodniopomorskie", "Koszalin": "zachodniopomorskie",
  "Stargard": "zachodniopomorskie", "Kołobrzeg": "zachodniopomorskie",
  "Charzyno": "zachodniopomorskie",
};

export function getVoivodeshipForCity(city: string): string | null {
  return CITY_VOIVODESHIP[city] || null;
}
