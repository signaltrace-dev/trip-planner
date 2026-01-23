import { TripStop, CalculatedStop } from '@/types/trip';
import { addHours } from 'date-fns';

export function calculateItinerary(
  stops: TripStop[],
  startDateTime: Date
): CalculatedStop[] {
  const calculatedStops: CalculatedStop[] = [];
  let currentTime = startDateTime;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];

    if (i === 0) {
      // First stop: starting point - no arrival, no time spent
      // Use manual override if set, otherwise use startDateTime
      const departureTime = stop.manualDepartureTime ?? currentTime;
      calculatedStops.push({
        ...stop,
        arrivalTime: null,
        departureTime,
      });
      currentTime = departureTime;
    } else {
      // Subsequent stops: calculate arrival based on drive time
      const driveTime = stop.driveTimeFromPrevious ?? 0;
      const arrivalTime = addHours(currentTime, driveTime);

      // Use manual override if set, otherwise calculate from arrival + time at destination
      const departureTime = stop.manualDepartureTime ?? addHours(arrivalTime, stop.timeAtDestination);

      calculatedStops.push({
        ...stop,
        arrivalTime,
        departureTime,
      });

      currentTime = departureTime;
    }
  }

  return calculatedStops;
}

export function formatDuration(hours: number, useDays: boolean = true): string {
  if (useDays && hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
      return `${days}d`;
    }
    return `${days}d ${Math.round(remainingHours)}h`;
  }

  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (wholeHours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  return `${wholeHours}h ${minutes}m`;
}

export function parseDuration(text: string): number | null {
  const trimmed = text.trim().toLowerCase();

  // Handle "X days" or "X day"
  const daysMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:days?|d)$/);
  if (daysMatch) {
    return parseFloat(daysMatch[1]) * 24;
  }

  // Handle "X days Y hours" or "Xd Yh"
  const daysHoursMatch = trimmed.match(/^(\d+)\s*(?:days?|d)\s+(\d+(?:\.\d+)?)\s*(?:hours?|h)?$/);
  if (daysHoursMatch) {
    const days = parseInt(daysHoursMatch[1], 10);
    const hours = parseFloat(daysHoursMatch[2]);
    return days * 24 + hours;
  }

  // Handle "X hours" or "X hour"
  const hoursMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:hours?|h)$/);
  if (hoursMatch) {
    return parseFloat(hoursMatch[1]);
  }

  // Handle formats like "5h 30m"
  const hoursMinutes = trimmed.match(/^(\d+)\s*h(?:\s*(\d+)\s*m)?$/);
  if (hoursMinutes) {
    const hours = parseInt(hoursMinutes[1], 10);
    const minutes = hoursMinutes[2] ? parseInt(hoursMinutes[2], 10) : 0;
    return hours + minutes / 60;
  }

  // Handle "X minutes" or "X min"
  const minutesMatch = trimmed.match(/^(\d+)\s*(?:minutes?|mins?|m)$/);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10) / 60;
  }

  // Handle colon format "5:30"
  const colonFormat = trimmed.match(/^(\d+):(\d+)$/);
  if (colonFormat) {
    const hours = parseInt(colonFormat[1], 10);
    const minutes = parseInt(colonFormat[2], 10);
    return hours + minutes / 60;
  }

  // Handle plain decimal (assumed hours)
  const decimal = parseFloat(trimmed);
  if (!isNaN(decimal)) {
    return decimal;
  }

  return null;
}
