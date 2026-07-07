# Features Overview

A complete list of everything Mrucznik does, explained in plain language.

---

## 🔍 Cat Search & Discovery

### Search with Filters
Users can search for cats by typing a name, city, or shelter name. Results can be filtered by:
- **Region** (voivodeship) — all 16 Polish regions available
- **Sex** — male or female
- **Sorting** — by name or by city

The search is paginated (24 cats per page) so the page loads fast even with hundreds of results.

### "Surprise Me" Button
Can't decide? Click "Surprise Me" and get a random cat from the database. It's a fun way to discover cats you might not have found otherwise.

### Cat of the Day
Every day, one cat is featured on the homepage. The selection is deterministic (based on the date), so everyone sees the same cat on the same day — great for social sharing.

### Cat Cards
Each cat is displayed as a card showing:
- Photo (with lightbox zoom on click)
- Name, sex, and age
- Shelter name and city
- Direct link to the shelter's page for that cat
- Share button to copy the link

---

## 🗺️ Interactive Shelter Map

### Map with All Shelters
An interactive map of Poland showing every shelter in the database as a pin. Click any pin to see the shelter's details and available cats.

### Find Nearest Shelter
Uses your device's GPS to find the 5 closest shelters to your location. Shows distance in kilometers. Can optionally filter to show only shelters that currently have cats listed.

### Stray Cat Overlay
Toggle a layer showing reported stray cats on the map. Red circles indicate where homeless cats have been spotted, helping local organizations locate them.

### Your Location Marker
Your position is shown on the map (if you grant permission) so you can orient yourself relative to nearby shelters.

---

## 📱 Stray Cat Reporting

### Report a Homeless Cat
Anyone can report a stray or neglected cat they've spotted. The form collects:
- City (required, selected from a list of Polish cities)
- Street address or area description (optional)
- Description of the cat (condition, color, behavior)
- Photo upload (optional, max 5MB, stored as base64)
- GPS location (optional, for precise map pin)

### Rate Limiting
To prevent spam, each person can submit maximum 3 reports per day (based on IP address).

### Geocoding
If GPS is not provided, the system geocodes the city name to approximate coordinates so the cat still appears on the map.

---

## 🔍 Lost Cat Finder

### Report a Lost Cat
If your cat has gone missing, you can file a report to alert the community. The form collects:
- **Cat name** (required)
- **Description** — color, markings, breed, temperament
- **Last seen location** — city and street or area
- **Contact info** — phone or email so finders can reach you

### Lost Cats on the Map
Reported lost cats appear on the interactive map as **yellow pins**, making it easy for people in the area to keep an eye out. Click a pin to see the cat's description and contact details.

### Reuniting Cats with Owners
When someone spots a lost cat, they can use the contact info on the report to reach out directly. Found your cat? The report can be removed via the admin panel.

---

## 📖 Adoption Guides

Six comprehensive guides (in both Polish and English) for people considering adopting:

1. **Your First Shelter Cat** — what to expect at the shelter, adoption process
2. **Preparing Your Home** — essentials to buy, safety-proofing tips
3. **The First Days at Home** — adaptation timeline, when to worry
4. **Monthly Cat Costs** — realistic budget breakdown (food, litter, vet)
5. **FIV+ and FeLV+ Cats** — explaining these conditions, why to adopt them
6. **When to See the Vet** — urgent vs. routine symptoms checklist

---

## 🙋 Volunteer Information

A dedicated page explaining:
- What volunteers do at shelters (socialize cats, photography, cleaning, transport, foster care, admin help)
- Step-by-step "how to start" guide
- Who can volunteer (16+, no experience needed)
- Remote volunteering options (social media, fundraising, graphic design)

---

## 🏠 Suggest a Shelter

Community-driven shelter discovery. If a user knows about a shelter that's not in the database, they can suggest it by providing:
- Shelter name (required)
- City (required)
- Voivodeship (dropdown of all 16)
- Website URL
- Contact email (optional)

Submissions go to the admin panel for review.

---

## 🔒 Admin Panel

A password-protected dashboard for managing the platform:
- **View and delete** shelter suggestions
- **View and delete** stray cat reports
- **Trigger data sync** — manually start the Temporal scraping workflow
- **View sync status** — check if scraping is running, completed, or failed

---

## 🌍 Internationalization (i18n)

The entire application is available in:
- 🇵🇱 **Polish** — full translation of all UI text, guides, and error messages
- 🇬🇧 **English** — complete English version for international users

Language preference is saved in the browser and persists between sessions.

---

## ⚡ Performance & UX Features

- **Skeleton loading states** — placeholder animations while data loads (no blank screens)
- **Error handling with retry** — if something fails, users see a friendly message with a "Retry" button
- **Responsive design** — works on phones, tablets, and desktops
- **Lazy image loading** — images load only when scrolled into view
- **Map state persistence** — remembers your zoom level and position on the map
- **Back-to-top button** — on mobile, easily scroll back to navigation
- **Focus management** — keyboard users can navigate the entire app without a mouse
- **ARIA labels** — screen reader support for visually impaired users
- **Gzip compression** — production assets are compressed for faster loading
- **Immutable caching** — static assets (JS, CSS) are cached for 1 year with content hashes

---

## 🔄 Automated Data Pipeline (Temporal.io)

The most technically interesting feature. Here's how data stays fresh:

1. **Admin triggers sync** (or it runs on schedule)
2. **Parent workflow** starts in Temporal — fetches the list of shelters from a public API
3. **Child workflows** spawn — one per shelter, each scraping cat listings from that shelter's website
4. If a shelter's site is down or slow, Temporal **automatically retries** (up to 3 times with exponential backoff)
5. If one shelter fails, the others continue unaffected (fault isolation)
6. After all scrapers finish, data is **immediately available** to the Express API via the shared SQLite database
7. The Express API serves the fresh data on the next request

This architecture ensures the system is **reliable** even when individual shelter websites are unreliable (which they often are).
