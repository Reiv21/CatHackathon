# Screenshots & Demo

## Live Demo

🌐 **Visit the live application:** [mrucznik.serwerigora.com](https://mrucznik.serwerigora.com)

The application is deployed on a Raspberry Pi and automatically updated on every push to main.

---

## Screenshots

> Place screenshots in `docs/screenshots/` folder.

### Homepage
`docs/screenshots/homepage.png`
- Hero section with call-to-action buttons
- Cat of the Day feature
- Platform statistics (cats, shelters, voivodeships)
- "Why adopt?" and "Want to help?" sections

### Cat Search
`docs/screenshots/cat-search.png`
- Search bar with filters (region, sex, sort)
- Paginated cat card grid
- "Surprise Me" random cat button

### Interactive Map
`docs/screenshots/map-view.png`
- Full-screen Leaflet map of Poland
- Shelter pins with click-to-expand
- Nearest shelter finder with GPS
- Stray cat report overlay (red markers)

### Cat Card Detail
`docs/screenshots/cat-card.png`
- Cat photo with lightbox zoom
- Name, sex, age badges
- Shelter location and link
- Share button

### Stray Cat Report Form
`docs/screenshots/report-stray.png`
- City selection dropdown
- Description textarea
- Photo upload with preview
- GPS location capture button

### Admin Dashboard
`docs/screenshots/admin-panel.png`
- Shelter suggestion management
- Stray report management
- Sync trigger and status

### Mobile View
`docs/screenshots/mobile-responsive.png`
- Responsive hamburger menu
- Full functionality on phone screens
- Touch-friendly interface

### Aikido Security Scan
`docs/screenshots/aikido-scan.png`
- Clean scan result (0 issues)

---

## Key User Flows

### Flow 1: Finding a Cat to Adopt

1. User opens the site → sees Cat of the Day and stats
2. Clicks "Find a Cat" → search page with filters
3. Types their city → sees local cats
4. Clicks a cat card → sees photo in lightbox
5. Clicks "View on shelter page" → goes to shelter's adoption page

### Flow 2: Reporting a Stray Cat

1. User spots a homeless cat
2. Navigates to "Report Stray" 
3. Selects city, adds description and optional photo
4. Optionally shares GPS location
5. Submits → cat appears on the map for others to see

### Flow 3: Using the Map

1. User opens Map view → sees all shelters in Poland
2. Clicks "Find Nearest" → grants GPS permission
3. Sees 5 closest shelters with distances
4. Clicks one → sidebar shows that shelter's available cats
5. Can toggle stray cat reports layer to see reported strays nearby

### Flow 4: Admin Data Sync

1. Admin navigates to #admin
2. Enters password → dashboard appears
3. Clicks "Trigger Sync" → Temporal workflow starts
4. Each shelter is scraped independently (retries on failure)
5. Fresh data appears in the app within minutes
