# Road Trip Planner - Code Review Tasks

Last reviewed: 2026-01-23

## Summary

Overall, this is a well-structured Next.js application with clean separation of concerns. The codebase follows modern React patterns with proper use of Context API, hooks, and TypeScript. However, there are several areas that need attention, particularly around security, error handling, and robustness.

---

## Critical Priority

- [ ] **[SECURITY]** API key exposed in client-side localStorage - `src/app/page.tsx:16,31`
  - The Google Maps API key is stored in localStorage and can be easily extracted by any user or malicious script
  - Consider using a backend proxy for API calls or implementing proper key restrictions in Google Cloud Console

- [ ] **[SECURITY]** JSON import lacks validation - `src/context/TripContext.tsx:192-208`
  - The `importTrip` function parses JSON without any schema validation
  - Malicious JSON could inject unexpected data types or cause runtime errors
  - Add schema validation (e.g., with Zod) before processing imported data

- [ ] **[SECURITY]** URL hash data is trusted without validation - `src/context/TripContext.tsx:107-123`
  - The `decompressTrip` function parses base64-encoded data from the URL hash without validation
  - Could allow injection of malicious data or cause crashes with malformed input
  - Add validation for decompressed trip data structure

---

## High Priority

- [ ] **[BUG]** `calculateDriveTimeForStop` can use stale stops array - `src/components/TripItinerary.tsx:50-72`
  - The `useCallback` depends on `stops` but may execute with stale state during rapid additions
  - The effect at line 75-86 can trigger unnecessary recalculations
  - Consider using refs or consolidating the logic into TripContext

- [ ] **[BUG]** Incomplete form in page.tsx - `src/app/page.tsx:62-74`
  - The API key input form is missing the actual input field and submit button
  - Only the description and list are rendered; `handleSetApiKey` is never called

- [ ] **[ERROR-HANDLING]** Missing error handling in distance service - `src/lib/distanceService.ts:14-51`
  - `calculateDrivingDistance` catches errors internally but doesn't propagate them
  - Callers have no way to distinguish between "no route exists" and "API error"
  - Add proper error differentiation and user feedback

- [ ] **[ERROR-HANDLING]** Routes API errors not shown to user - `src/components/MapDisplay.tsx:150-165`
  - Errors are logged to console but user sees no feedback when route fetch fails
  - Add visual error state for failed route loading

- [ ] **[REFACTOR]** Large component with too many responsibilities - `src/components/TripItinerary.tsx`
  - 503 lines handling table, drag-drop, editing, and business logic
  - Extract into smaller components: StopRow, TripTable, TripSummary, TripActions

- [ ] **[PERFORMANCE]** useEffect triggers on every stops.length change - `src/components/TripItinerary.tsx:75-86`
  - The effect runs `recalculateDriveTimes` on every length change even when not needed
  - Should track which stops need recalculation more precisely

---

## Medium Priority

- [ ] **[BUG]** reorderStops clears all drive times unnecessarily - `src/context/TripContext.tsx:147-158`
  - Reordering clears drive time for ALL stops, even those whose neighbors didn't change
  - Only stops at and after the reorder position need recalculation

- [ ] **[TESTING]** No test files present
  - Add unit tests for `timeCalculations.ts` (parseDuration, formatDuration, calculateItinerary)
  - Add unit tests for `distanceService.ts`
  - Add component tests for TripItinerary editing behaviors

- [ ] **[ACCESSIBILITY]** Drag handles lack keyboard support - `src/components/TripItinerary.tsx:264-268`
  - Table rows use HTML drag-and-drop which is not keyboard accessible
  - Consider adding keyboard reordering (e.g., arrow keys with modifier)

- [ ] **[ACCESSIBILITY]** Missing ARIA labels on icon buttons - `src/components/TripItinerary.tsx:166-211`
  - Action buttons (Save, Load, Share, Reset) have icons but rely on visual recognition
  - Add `aria-label` attributes for screen readers

- [ ] **[TYPE-SAFETY]** Type assertion used instead of type guard - `src/components/PlaceAutocomplete.tsx:92-94`
  - `const event = e as PlaceSelectEvent;` could fail silently if event structure changes
  - Add runtime type checking for the event structure

- [ ] **[UX]** No confirmation before clearing all stops - `src/components/TripItinerary.tsx:204`
  - `clearAllStops` is called directly without user confirmation
  - Add a confirmation dialog for destructive action

- [ ] **[UX]** No loading indicator during distance calculation in UI - `src/components/TripItinerary.tsx:301-302`
  - Shows "calculating..." text but no visual progress indicator
  - Consider a more prominent loading state

- [ ] **[CODE-REUSE]** Duplicate `formatDateTime` function - `src/components/TripItinerary.tsx:132-135` and `src/components/MapDisplay.tsx:199-202`
  - Same function defined in two components
  - Move to a shared utility file

---

## Low Priority

- [ ] **[CLEANUP]** Unused `calculateAllDrivingDistances` function - `src/lib/distanceService.ts:53-75`
  - This function is exported but never used in the codebase
  - Either integrate it or remove it to reduce dead code

- [ ] **[CLEANUP]** Unused `TripPlan` interface - `src/types/trip.ts:16-21`
  - Interface is defined but never used anywhere
  - Remove if not planned for future use

- [ ] **[STYLE]** Inconsistent component export style
  - Some files use `export function` (most components)
  - `distanceService.ts` uses `export async function`
  - Consider consistent named exports with explicit function declarations

- [ ] **[STYLE]** Magic numbers in code
  - `src/lib/timeCalculations.ts:46,52` - 24 hours per day not named
  - `src/context/TripContext.tsx:38-39` - Coordinate precision (100000) not named
  - Extract to named constants for clarity

- [ ] **[DEPS]** Consider pinning major versions in package.json
  - `"tailwindcss": "^4"` allows breaking changes
  - Consider using more specific version ranges

- [ ] **[DOCS]** Missing JSDoc for public API functions in lib/
  - `calculateDrivingDistance`, `parseDuration`, `formatDuration` would benefit from documented parameters and return values

---

## Notes

### Strengths
- Clean separation between context (state), components (UI), and lib (utilities)
- Good TypeScript usage with proper interface definitions
- Modern React patterns (hooks, context, functional components)
- Proper handling of Google Maps web components
- Flexible duration parsing with multiple format support

### Technical Debt Observations
- No form validation library despite user input
- No state management library - acceptable for current size but may need if app grows
- Console logging used for error handling instead of structured error reporting
