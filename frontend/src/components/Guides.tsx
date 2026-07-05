import { useState } from "react";
import { useI18n } from "../i18n";

interface Guide {
  id: string;
  title: string;
  emoji: string;
  content: string;
}

const guidesEN: Guide[] = [
  {
    id: "first-cat",
    title: "Your First Shelter Cat",
    emoji: "🏠",
    content: `Adopting a cat from a shelter is a beautiful decision. Here's what you need to know:

**Before visiting the shelter:**
• Make sure you have time and space for a cat
• Confirm no one in your household is allergic
• Check that your landlord allows pets

**At the shelter:**
• Don't rush — talk to caretakers about each cat's personality
• Ask about medical history and behavior
• Pay attention to cats that approach you on their own

**The adoption process:**
• Fill out an adoption questionnaire
• Sign an adoption agreement
• Pay a small fee (covers vaccinations and neutering)
• Take the cat home in a carrier`,
  },
  {
    id: "prepare-home",
    title: "Preparing Your Home",
    emoji: "🛋️",
    content: `Before bringing your cat home, prepare:

**Essentials:**
• Litter box + litter (1 per cat + 1 extra)
• Water and food bowls (ceramic or metal, not plastic)
• Wet + dry food (ask the shelter what they were feeding)
• Scratching post (taller is better, must be stable)
• Carrier (needed for vet visits)

**Nice to have:**
• A bed or blanket in a quiet spot
• Toys (wand toys, balls, mouse toys)
• Grooming brush

**Safety-proof:**
• Windows — window screens are absolutely essential!
• Remove toxic plants (lilies, philodendron, ivy)
• Small objects that could be swallowed
• Keep washing machines/dryers closed`,
  },
  {
    id: "first-days",
    title: "The First Days at Home",
    emoji: "📅",
    content: `Cat adaptation requires patience. Don't expect your cat to be your best friend immediately.

**Days 1-3: "Safe room"**
• Keep the cat in one room with litter box, food, and a hiding spot
• Don't force interaction — let them come out on their own
• Speak softly, avoid loud noises

**Days 3-7: Exploration**
• Open the door and let the cat explore at their own pace
• Don't chase, grab, or pick up by force
• A cat may not eat for 1-2 days — this is normal during stress

**Weeks 2-4: Building trust**
• Play with a wand toy (best way to bond)
• Let the cat come to you, not the other way around
• Avoid sudden movements and loud sounds

**When to worry:**
• Cat hasn't eaten for 48+ hours → vet visit
• Blood in urine or straining → urgent vet
• Aggression toward family members → consult a behaviorist`,
  },
  {
    id: "costs",
    title: "Monthly Cat Costs",
    emoji: "💰",
    content: `A realistic monthly budget for a cat is €40-100. Here's the breakdown:

**Monthly recurring (€40-80):**
• Wet food: €20-50/month
• Dry food: €8-20/month
• Litter: €8-15/month

**Annual/periodic:**
• Vet check-up: €25-50
• Vaccination: €20-40/year
• Deworming: €8-15/quarter

**One-time startup costs:**
• Litter box: €8-40
• Scratching post: €20-80
• Carrier: €15-40
• Bowls, toys: €15-30

**Unexpected:**
• Emergency vet visits: €50-500+
• Consider pet insurance (€12-25/month)

**Tip:** Don't cheap out on food. Good food = fewer vet visits.`,
  },
  {
    id: "fiv-felv",
    title: "FIV+ and FeLV+ Cats",
    emoji: "🩺",
    content: `FIV and FeLV are viruses, but they are NOT a death sentence. These cats can live for years!

**FIV (Feline Immunodeficiency Virus):**
• Similar to HIV in humans, but CANNOT spread to people
• A cat with FIV can live 10+ years normally
• Spreads through deep bite wounds (fighting)
• An indoor FIV cat practically cannot infect other cats
• Needs: regular check-ups, stress-free environment, quality food

**FeLV (Feline Leukemia Virus):**
• More serious than FIV, but still not a death sentence
• Spreads through saliva (shared bowls, mutual grooming)
• FeLV cats should be the only cat OR live with other FeLV+ cats
• Needs: more frequent vet visits, health monitoring

**Why adopt an FIV/FeLV cat:**
• They have the hardest time finding homes — you can be their chance
• They are just as loving and lovable as healthy cats
• With proper care, they live long and happy lives`,
  },
  {
    id: "vet-checklist",
    title: "When to See the Vet",
    emoji: "🚨",
    content: `Not every symptom requires an immediate visit, but some do.

**URGENT — go immediately:**
• Cat hasn't urinated for 12+ hours (especially males!)
• Blood in urine
• Difficulty breathing
• Injury / accident
• Seizures
• Poisoning (ate a plant, chemicals)
• Not eating for 48+ hours

**Within 24 hours:**
• Bloody diarrhea
• Repeated vomiting (more than 3x per day)
• Fever (dry, hot nose + lethargy)
• Limping
• Swollen abdomen

**Schedule a visit:**
• Sneezing for 3+ days
• Appetite changes
• Weight loss
• Behavior changes (sudden aggression or hiding)
• Coat problems (hair loss, itching)

**Routine (once a year):**
• General examination
• Vaccination
• Dental check
• Deworming`,
  },
];

const guidesPL: Guide[] = [
  { id: "first-cat", title: "Pierwszy kot ze schroniska", emoji: "🏠", content: `Adopcja kota ze schroniska to piękna decyzja. Oto co musisz wiedzieć:

**Przed wizytą w schronisku:**
• Zastanów się czy masz czas i przestrzeń na kota
• Upewnij się, że domownicy nie mają alergii
• Sprawdź czy właściciel/spółdzielnia pozwala na zwierzęta

**W schronisku:**
• Nie spiesz się — porozmawiaj z opiekunami o charakterze kota
• Zapytaj o historię zdrowotną i zachowania
• Zwróć uwagę na kota, który sam się do Ciebie zbliży

**Procedura adopcji:**
• Wypełnisz ankietę adopcyjną
• Podpiszesz umowę adopcyjną
• Zapłacisz symboliczną opłatę (50-200 zł)
• Zabierzesz kota w transporterze` },
  { id: "prepare-home", title: "Przygotowanie domu", emoji: "🛋️", content: `Zanim kot wejdzie do domu, przygotuj:

**Niezbędne:**
• Kuweta + żwirek (1 na kota + 1 zapasowa)
• Miski na wodę i jedzenie (ceramiczne lub metalowe)
• Karma mokra + sucha
• Drapak (im wyższy tym lepiej, stabilny)
• Transporter (na wizyty u weta)

**Warto mieć:**
• Legowisko lub koc w spokojnym miejscu
• Zabawki (wędka, piłeczki)
• Szczotka do wyczesywania

**Zabezpiecz:**
• Okna — siatki to absolutna konieczność!
• Rośliny trujące (lilie, filodendron, bluszcz)
• Małe przedmioty do połknięcia` },
  { id: "first-days", title: "Pierwsze dni w domu", emoji: "📅", content: `Adaptacja kota wymaga cierpliwości.

**Dzień 1-3: "Pokój bezpieczny"**
• Zamknij kota w jednym pokoju z kuwetą i jedzeniem
• Nie zmuszaj do kontaktu
• Mów spokojnym głosem

**Dzień 3-7: Eksploracja**
• Pozwól kotu samemu zwiedzać
• Nie goń, nie łap na siłę
• Brak apetytu 1-2 dni to norma przy stresie

**Tydzień 2-4: Budowanie zaufania**
• Baw się wędką (najlepszy sposób na więź)
• Pozwól kotu przyjść do Ciebie

**Kiedy się niepokoić:**
• Nie je 48h+ → weterynarz
• Krew w moczu → pilnie do weta
• Agresja → behawiorysta` },
  { id: "costs", title: "Koszty utrzymania kota", emoji: "💰", content: `Realistyczny budżet miesięczny to 150-400 zł.

**Miesięczne (150-300 zł):**
• Karma mokra: 80-200 zł
• Karma sucha: 30-80 zł
• Żwirek: 30-60 zł

**Roczne:**
• Wizyta kontrolna: 100-200 zł
• Szczepienie: 80-150 zł/rok
• Odrobaczanie: 30-50 zł/kwartał

**Na start:**
• Kuweta: 30-150 zł
• Drapak: 80-300 zł
• Transporter: 50-150 zł

**Tip:** Nie oszczędzaj na karmie. Dobra karma = mniej wizyt u weta.` },
  { id: "fiv-felv", title: "Koty FIV+ i FeLV+", emoji: "🩺", content: `FIV i FeLV to wirusy, ale NIE oznaczają wyroku śmierci!

**FIV:**
• Odpowiednik HIV u ludzi, NIE przenosi się na ludzi
• Kot z FIV może żyć 10+ lat
• Przenosi się przez głębokie ugryzienia
• Wymaga: regularne kontrole, dobra karma

**FeLV:**
• Poważniejszy, ale wciąż nie wyrok
• Przenosi się przez ślinę
• Kot powinien być jedynym lub z innymi FeLV+

**Dlaczego warto adoptować:**
• Najtrudniej znajdują dom
• Są tak samo kochające
• Przy dobrej opiece żyją długo` },
  { id: "vet-checklist", title: "Kiedy do weterynarza", emoji: "🚨", content: `**PILNE — jedź natychmiast:**
• Nie oddaje moczu 12h+ (zwłaszcza kocur!)
• Krew w moczu
• Trudności z oddychaniem
• Drgawki, zatrucie
• Nie je 48h+

**W ciągu 24h:**
• Biegunka z krwią
• Wielokrotne wymioty
• Gorączka, kulawizna

**Planowana wizyta:**
• Kichanie > 3 dni
• Zmiana apetytu/wagi
• Nagła zmiana zachowania
• Problemy z sierścią

**Rutynowo (1x rok):**
• Badanie ogólne + szczepienie
• Kontrola zębów + odrobaczanie` },
];

export function Guides() {
  const { lang } = useI18n();
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const guides = lang === "pl" ? guidesPL : guidesEN;
  const active = guides.find((g) => g.id === activeGuide);
  
  const title = lang === "pl" ? "Poradnik adopcyjny" : "Adoption Guide";
  const subtitle = lang === "pl" ? "Wszystko o adopcji kota ze schroniska" : "Everything you need to know about adopting a shelter cat";
  const clickToRead = lang === "pl" ? "Kliknij aby przeczytać →" : "Click to read →";
  const backToList = lang === "pl" ? "← Wróć do listy" : "← Back to list";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-bold text-center mb-2">{title}</h1>
      <p className="text-center text-gray-500 mb-8">{subtitle}</p>

      {!active ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {guides.map((guide) => (
            <button key={guide.id} onClick={() => setActiveGuide(guide.id)} className="bg-white rounded-2xl p-6 text-left shadow-sm hover:shadow-md transition-shadow border border-cat-sand">
              <div className="text-3xl mb-3">{guide.emoji}</div>
              <h3 className="text-lg font-semibold text-cat-dark">{guide.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{clickToRead}</p>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button onClick={() => setActiveGuide(null)} className="mb-6 text-primary-600 hover:text-primary-700 font-medium">{backToList}</button>
          <article className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-cat-sand">
            <div className="text-4xl mb-4">{active.emoji}</div>
            <h2 className="text-2xl font-display font-bold mb-6">{active.title}</h2>
            <div className="prose prose-sm max-w-none">
              {active.content.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) return <h3 key={i} className="text-lg font-semibold mt-6 mb-2">{line.replace(/\*\*/g, "")}</h3>;
                if (line.startsWith("• ")) return <li key={i} className="ml-4 text-gray-700 mb-1">{line.slice(2)}</li>;
                if (line.trim() === "") return <br key={i} />;
                return <p key={i} className="text-gray-700 mb-2">{line}</p>;
              })}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
