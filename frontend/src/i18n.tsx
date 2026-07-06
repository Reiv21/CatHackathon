import { createContext, useContext, useState, type ReactNode } from "react";

type Lang = "en" | "pl";

const translations = {
  en: {
    // Nav
    home: "Home",
    findCat: "Find a Cat",
    map: "Map",
    guides: "Guides",
    volunteer: "Volunteer",
    addShelter: "Add Shelter",

    // Home hero
    heroTitle: "Every cat deserves a home 🐾",
    heroSubtitle: "Browse cats available for adoption from shelters across Poland. Find your new purring companion.",
    findCatBtn: "🔍 Find a cat",
    shelterMapBtn: "🗺️ Shelter map",

    // Stats
    catsWaiting: "cats waiting for a home",
    sheltersInDb: "shelters in database",
    voivodeships: "voivodeships covered",
    lastUpdated: "Last updated",

    // Cat of the day
    catOfDay: "🌟 Cat of the Day",
    meetMe: "Meet me →",

    // Why adopt
    whyAdopt: "Why adopt?",
    saveLife: "Save a life",
    saveLifeDesc: "Every adoption makes room for another animal in need",
    healthyPets: "Healthy pets",
    healthyPetsDesc: "Shelter cats are vaccinated, dewormed, and neutered",
    gratefulComp: "Grateful companion",
    gratefulCompDesc: "Shelter cats form exceptionally strong bonds with their new families",

    // Want to help
    wantToHelp: "Want to help? 🤝",
    adopt: "Adopt",
    adoptDesc: "Give a shelter cat a forever home. It's the biggest difference you can make.",
    volunteerTitle: "Volunteer",
    volunteerDesc: "Contact your local shelter — they always need people to socialize and photograph animals.",
    spreadWord: "Spread the word",
    spreadWordDesc: "Share this site with friends. The more people see these cats, the faster they find homes.",
    learnVolunteer: "Learn about volunteering →",

    // First time
    firstTime: "First-time cat owner?",
    firstTimeDesc: "We've prepared guides to help you get ready for your new family member.",
    readGuides: "📖 Read our guides",

    // Footer
    footerTitle: "🐾 Mrucznik — helping cats find homes",
    footerDesc: "Shelter data updated automatically. Open-source project.",

    // Search
    searchTitle: "Find your cat 🔍",
    searchSubtitle: "Search by name, city, or shelter",
    searchPlaceholder: "Type a cat name or city...",
    allRegions: "All regions",
    catsFound: "cats found",
    catFound: "cat found",
    noCats: "No cats found",
    noCatsHint: "Try a different search term or region",
    searching: "Searching...",
    prev: "← Prev",
    next: "Next →",
    page: "Page",
    of: "of",

    // Map
    loadingShelters: "Loading shelters...",
    failedMap: "Failed to load map",
    retry: "Retry",
    clickShelter: "Click a shelter on the map to see its cats",
    findNearest: "📍 Find nearest shelter",
    onlyWithCats: "Only shelters with cats listed",
    useLocation: "Use my location",
    gettingLocation: "Getting your location...",
    locationDenied: "Location access denied. Enable it in browser settings.",
    outsidePoland: "😅 Looks like you're not in Poland!",
    outsidePolandDesc: "This app covers Polish shelters only. But thanks for caring about cats!",
    tryAgain: "Try again",
    kmAway: "km away",
    cats: "cats",
    catsAvailable: "cats available",
    noCatsListed: "No cats listed for this shelter.",
    notAllShelters: "Not all shelters share their animal data online.",
    backToMap: "← Back to map",
    youAreHere: "📍 You are here",
    searchAgain: "Search again",

    // Cat card
    viewOnShelter: "View on shelter page →",

    // Suggest shelter
    suggestTitle: "Suggest a Shelter",
    suggestSubtitle: "Know a shelter that should be in our database? Let us know and we'll add it.",
    suggestWhy: "By adding more shelters, you help more cats get visibility and find homes faster.",
    shelterName: "Shelter name",
    city: "City",
    voivodeship: "Voivodeship",
    websiteUrl: "Website URL (cats page)",
    yourEmail: "Your email (optional)",
    submit: "Submit suggestion",
    sending: "Sending...",
    thankYou: "Thank you!",
    submitted: "Your shelter suggestion has been submitted for review.",
    submitAnother: "Submit another →",
    somethingWrong: "Something went wrong. Please try again.",

    // Stray reports
    reportStray: "Report Stray",
    reportStrayTitle: "Report a Stray Cat",
    reportStraySubtitle: "Spotted a homeless or neglected cat? Help by reporting its location.",
    strayDesc: "Description (condition, color, behavior)",
    strayImageUrl: "Photo URL (optional)",
    strayLocation: "Location",
    useMyLocation: "Use my location",
    strayCity: "City / area",
    reportSubmit: "Submit report",
    reportSending: "Sending...",
    reportThanks: "Thank you for reporting!",
    reportThanksSub: "Your report helps local organizations locate and help stray cats.",
    showStrays: "Show stray reports",
    hideStrays: "Hide stray reports",
    strayReported: "Stray cat reported",
  },
  pl: {
    home: "Start",
    findCat: "Znajdź kota",
    map: "Mapa",
    guides: "Poradnik",
    volunteer: "Wolontariat",
    addShelter: "Dodaj schronisko",

    heroTitle: "Każdy kot zasługuje na dom 🐾",
    heroSubtitle: "Przeglądaj koty do adopcji ze schronisk w całej Polsce. Znajdź swojego nowego mruczącego towarzysza.",
    findCatBtn: "🔍 Znajdź kota",
    shelterMapBtn: "🗺️ Mapa schronisk",

    catsWaiting: "kotów czeka na dom",
    sheltersInDb: "schronisk w bazie",
    voivodeships: "województw",
    lastUpdated: "Ostatnia aktualizacja",

    catOfDay: "🌟 Kot Dnia",
    meetMe: "Poznaj mnie →",

    whyAdopt: "Dlaczego warto adoptować?",
    saveLife: "Ratujesz życie",
    saveLifeDesc: "Każda adopcja to miejsce dla kolejnego potrzebującego zwierzaka",
    healthyPets: "Zdrowe zwierzę",
    healthyPetsDesc: "Koty ze schronisk są zaszczepione, odrobaczone i wykastrowane",
    gratefulComp: "Wdzięczny kompan",
    gratefulCompDesc: "Koty ze schronisk tworzą wyjątkowo silne więzi z opiekunami",

    wantToHelp: "Chcesz pomóc? 🤝",
    adopt: "Adoptuj",
    adoptDesc: "Daj kotu dom na zawsze. To największa różnica jaką możesz zrobić.",
    volunteerTitle: "Wolontariat",
    volunteerDesc: "Skontaktuj się z lokalnym schroniskiem — zawsze potrzebują ludzi do socjalizacji zwierząt.",
    spreadWord: "Udostępnij",
    spreadWordDesc: "Podziel się stroną ze znajomymi. Im więcej osób zobaczy te koty, tym szybciej znajdą dom.",
    learnVolunteer: "Dowiedz się o wolontariacie →",

    firstTime: "Pierwszy kot?",
    firstTimeDesc: "Przygotowaliśmy poradniki które pomogą Ci na dobry start.",
    readGuides: "📖 Przeczytaj poradnik",

    footerTitle: "🐾 Mrucznik — pomagamy kotom znaleźć dom",
    footerDesc: "Dane ze schronisk aktualizowane automatycznie. Projekt open-source.",

    searchTitle: "Znajdź swojego kota 🔍",
    searchSubtitle: "Szukaj po imieniu, mieście lub schronisku",
    searchPlaceholder: "Wpisz imię kota lub miasto...",
    allRegions: "Wszystkie regiony",
    catsFound: "kotów znalezionych",
    catFound: "kot znaleziony",
    noCats: "Nie znaleziono kotów",
    noCatsHint: "Spróbuj innej frazy lub regionu",
    searching: "Szukam...",
    prev: "← Poprz.",
    next: "Nast. →",
    page: "Strona",
    of: "z",

    loadingShelters: "Ładuję schroniska...",
    failedMap: "Nie udało się załadować mapy",
    retry: "Spróbuj ponownie",
    clickShelter: "Kliknij schronisko na mapie aby zobaczyć koty",
    findNearest: "📍 Znajdź najbliższe schronisko",
    onlyWithCats: "Tylko schroniska z kotami",
    useLocation: "Użyj mojej lokalizacji",
    gettingLocation: "Pobieram lokalizację...",
    locationDenied: "Brak dostępu do lokalizacji. Włącz w ustawieniach przeglądarki.",
    outsidePoland: "😅 Wygląda na to, że nie jesteś w Polsce!",
    outsidePolandDesc: "Ta aplikacja obejmuje tylko polskie schroniska.",
    tryAgain: "Spróbuj ponownie",
    kmAway: "km stąd",
    cats: "kotów",
    catsAvailable: "kotów dostępnych",
    noCatsListed: "Brak kotów w tym schronisku.",
    notAllShelters: "Nie wszystkie schroniska udostępniają dane o zwierzętach online.",
    backToMap: "← Wróć do mapy",
    youAreHere: "📍 Jesteś tutaj",
    searchAgain: "Szukaj ponownie",

    viewOnShelter: "Zobacz na stronie schroniska →",

    suggestTitle: "Zaproponuj schronisko",
    suggestSubtitle: "Znasz schronisko które powinno być w naszej bazie? Daj nam znać.",
    suggestWhy: "Dodając schroniska pomagasz większej liczbie kotów zostać zauważonymi i szybciej znaleźć dom.",
    shelterName: "Nazwa schroniska",
    city: "Miasto",
    voivodeship: "Województwo",
    websiteUrl: "Adres strony (strona z kotami)",
    yourEmail: "Twój email (opcjonalnie)",
    submit: "Wyślij propozycję",
    sending: "Wysyłam...",
    thankYou: "Dziękujemy!",
    submitted: "Twoja propozycja schroniska została wysłana do weryfikacji.",
    submitAnother: "Wyślij kolejną →",
    somethingWrong: "Coś poszło nie tak. Spróbuj ponownie.",

    // Stray reports
    reportStray: "Zgłoś kota",
    reportStrayTitle: "Zgłoś bezdomnego kota",
    reportStraySubtitle: "Widzisz zaniedbanego lub bezdomnego kota? Zgłoś jego lokalizację.",
    strayDesc: "Opis (stan, kolor, zachowanie)",
    strayImageUrl: "URL zdjęcia (opcjonalnie)",
    strayLocation: "Lokalizacja",
    useMyLocation: "Użyj mojej lokalizacji",
    strayCity: "Miasto / okolica",
    reportSubmit: "Wyślij zgłoszenie",
    reportSending: "Wysyłam...",
    reportThanks: "Dziękujemy za zgłoszenie!",
    reportThanksSub: "Twoje zgłoszenie pomoże lokalnym organizacjom zlokalizować i pomóc bezdomnym kotom.",
    showStrays: "Pokaż bezdomne koty",
    hideStrays: "Ukryj bezdomne koty",
    strayReported: "Zgłoszony bezdomny kot",
  },
};

type Translations = typeof translations.en;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: translations.en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang");
    return (saved === "pl" || saved === "en") ? saved : "en";
  });

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem("lang", newLang);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang: handleSetLang, t: translations[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
