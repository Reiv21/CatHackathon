# Screenshots & Demo

## Live Demo

🌐 **Visit the live application:** [mrucznik.serwerigora.com](https://mrucznik.serwerigora.com)

The application is deployed on a Raspberry Pi and automatically updated on every push to main.

---

## Screenshots

## Screenshots

### Homepage & Cat of the Day
![Homepage](screenshots/1.png)

### Interactive Map with Shelters
![Map View](screenshots/2.png)

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
