# Road Trip Planner

A Next.js web app for planning road trips with automatic drive time calculations.

## Tech Stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS
- Google Maps APIs (Places API, Distance Matrix API)

## Key Features

- City and business autocomplete search using Google Places API (new `PlaceAutocompleteElement`)
- Automatic driving time calculation between consecutive stops via Distance Matrix API
- Time calculations: arrival/departure times based on drive time + time at destination
- Drag-and-drop reordering of stops
- Inline editing for drive times, time at destination, and notes
- Supports duration input formats: "2 days", "5 hours", "1d 6h", "5h 30m", "5:30", decimal hours

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main page with API key input and trip planner
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles including PlaceAutocomplete styling
├── components/
│   ├── GoogleMapsProvider.tsx   # Loads Google Maps JS API
│   ├── PlaceAutocomplete.tsx    # City search using PlaceAutocompleteElement
│   └── TripItinerary.tsx        # Main trip table UI
├── context/
│   └── TripContext.tsx   # Trip state management (stops, times, CRUD operations)
├── lib/
│   ├── distanceService.ts    # Google Distance Matrix API wrapper
│   └── timeCalculations.ts   # Duration parsing/formatting, itinerary calculation
└── types/
    └── trip.ts           # TypeScript interfaces (TripStop, CalculatedStop, etc.)
```

## Google Maps API Notes

- Uses the new `PlaceAutocompleteElement` (not the deprecated `Autocomplete` class)
- Event name is `gmp-select` (not `gmp-placeselect`)
- Event contains `placePrediction`, call `.toPlace()` then `.fetchFields()` to get details
- API key can be set via `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var or entered in browser (stored in localStorage)
- Required APIs: Places API (New), Distance Matrix API

## Running Locally

```bash
npm install
npm run dev
```

Set your Google Maps API key in `.env.local`:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

### Optional Place Search Configuration

```
# Country restriction (comma-separated ISO country codes, default: us)
NEXT_PUBLIC_GOOGLE_PLACES_COUNTRY=us

# Place types to search (comma-separated, default: locality,establishment)
# Common types: locality (cities), establishment (businesses), address, geocode
# Set to "all" to allow all place types
NEXT_PUBLIC_GOOGLE_PLACES_TYPES=locality,establishment
```

### Optional Basic Authentication

To protect the app with HTTP Basic Auth, set both of these env vars:

```
BASIC_AUTH_USER=username
BASIC_AUTH_PASSWORD=password
```

When both are set, the browser will prompt for credentials before allowing access. When either is missing or empty, auth is disabled (useful for local development).

## Claude Code Skills

Use these skills when applicable for the following types of requests:

- **code-reviewer** - For code review requests, PR reviews, or code quality feedback
- **documentation-reviewer** - When verifying documentation accuracy or auditing docs against code
- **nextjs-application-architect** - For Next.js architecture decisions, App Router patterns, API routes, or data fetching strategies
- **security-analyst** - For security reviews, vulnerability assessments, or auth/input validation audits
- **ux-designer** - For UI/UX feedback, accessibility reviews, or visual consistency checks
