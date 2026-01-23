'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TripStop, CalculatedStop } from '@/types/trip';
import { calculateItinerary } from '@/lib/timeCalculations';

// Compact stop format for URL sharing (smaller payload)
interface CompactStop {
  p: string;  // placeId
  n: string;  // name
  c: string;  // city
  s: string;  // state
  a: string;  // fullAddress
  lt: number; // lat
  lg: number; // lng
  t: number;  // timeAtDestination
  d: number | null; // driveTimeFromPrevious
  nt: string; // notes
}

interface ShareData {
  n: string;  // tripName
  st: string; // startDateTime (ISO)
  sp: CompactStop[]; // stops
}

function compressTrip(tripName: string, startDateTime: Date, stops: TripStop[]): string {
  const data: ShareData = {
    n: tripName,
    st: startDateTime.toISOString(),
    sp: stops.map(stop => ({
      p: stop.placeId,
      n: stop.name,
      c: stop.city,
      s: stop.state,
      a: stop.fullAddress,
      lt: Math.round(stop.lat * 100000) / 100000, // Reduce precision for smaller size
      lg: Math.round(stop.lng * 100000) / 100000,
      t: stop.timeAtDestination,
      d: stop.driveTimeFromPrevious,
      nt: stop.notes,
    })),
  };
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

function decompressTrip(encoded: string): { tripName: string; startDateTime: Date; stops: TripStop[] } | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const data: ShareData = JSON.parse(json);
    return {
      tripName: data.n,
      startDateTime: new Date(data.st),
      stops: data.sp.map(s => ({
        id: uuidv4(),
        placeId: s.p,
        name: s.n,
        city: s.c,
        state: s.s,
        fullAddress: s.a,
        lat: s.lt,
        lng: s.lg,
        timeAtDestination: s.t,
        driveTimeFromPrevious: s.d,
        notes: s.nt,
        manualDepartureTime: null,
      })),
    };
  } catch (e) {
    console.error('Failed to decompress trip data:', e);
    return null;
  }
}

interface TripContextType {
  stops: TripStop[];
  startDateTime: Date;
  calculatedStops: CalculatedStop[];
  tripName: string;
  setTripName: (name: string) => void;
  setStartDateTime: (date: Date) => void;
  addStop: (stop: Omit<TripStop, 'id' | 'driveTimeFromPrevious'>) => void;
  updateStop: (id: string, updates: Partial<TripStop>) => void;
  removeStop: (id: string) => void;
  reorderStops: (fromIndex: number, toIndex: number) => void;
  updateDriveTime: (id: string, driveTime: number | null) => void;
  clearAllStops: () => void;
  exportTrip: () => void;
  importTrip: (file: File) => Promise<void>;
  generateShareLink: () => string;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [tripName, setTripName] = useState('My Road Trip');
  const [startDateTime, setStartDateTime] = useState(() => {
    const date = new Date();
    date.setHours(8, 0, 0, 0);
    return date;
  });
  const [stops, setStops] = useState<TripStop[]>([]);
  const [hasLoadedFromUrl, setHasLoadedFromUrl] = useState(false);

  // Load trip from URL hash on mount
  useEffect(() => {
    if (hasLoadedFromUrl) return;

    const hash = window.location.hash;
    if (hash && hash.startsWith('#trip=')) {
      const encoded = hash.slice(6); // Remove '#trip='
      const tripData = decompressTrip(encoded);
      if (tripData) {
        setTripName(tripData.tripName);
        setStartDateTime(tripData.startDateTime);
        setStops(tripData.stops);
        // Clear the hash after loading
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    setHasLoadedFromUrl(true);
  }, [hasLoadedFromUrl]);

  const calculatedStops = calculateItinerary(stops, startDateTime);

  const addStop = useCallback((stopData: Omit<TripStop, 'id' | 'driveTimeFromPrevious' | 'manualDepartureTime'>) => {
    const newStop: TripStop = {
      ...stopData,
      id: uuidv4(),
      driveTimeFromPrevious: null, // Will be calculated
      manualDepartureTime: null,
    };
    setStops(prev => [...prev, newStop]);
  }, []);

  const updateStop = useCallback((id: string, updates: Partial<TripStop>) => {
    setStops(prev =>
      prev.map(stop => (stop.id === id ? { ...stop, ...updates } : stop))
    );
  }, []);

  const removeStop = useCallback((id: string) => {
    setStops(prev => prev.filter(stop => stop.id !== id));
  }, []);

  const reorderStops = useCallback((fromIndex: number, toIndex: number) => {
    setStops(prev => {
      const newStops = [...prev];
      const [removed] = newStops.splice(fromIndex, 1);
      newStops.splice(toIndex, 0, removed);
      // Clear drive times since order changed
      return newStops.map((stop, index) => ({
        ...stop,
        driveTimeFromPrevious: index === 0 ? null : null,
      }));
    });
  }, []);

  const updateDriveTime = useCallback((id: string, driveTime: number | null) => {
    setStops(prev =>
      prev.map(stop =>
        stop.id === id ? { ...stop, driveTimeFromPrevious: driveTime } : stop
      )
    );
  }, []);

  const clearAllStops = useCallback(() => {
    setStops([]);
  }, []);

  const exportTrip = useCallback(() => {
    const tripData = {
      tripName,
      startDateTime: startDateTime.toISOString(),
      stops: stops.map(stop => ({
        ...stop,
        manualDepartureTime: stop.manualDepartureTime?.toISOString() ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(tripData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tripName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tripName, startDateTime, stops]);

  const importTrip = useCallback(async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.tripName) {
      setTripName(data.tripName);
    }
    if (data.startDateTime) {
      setStartDateTime(new Date(data.startDateTime));
    }
    if (data.stops && Array.isArray(data.stops)) {
      setStops(data.stops.map((stop: TripStop & { manualDepartureTime?: string | null }) => ({
        ...stop,
        manualDepartureTime: stop.manualDepartureTime ? new Date(stop.manualDepartureTime) : null,
      })));
    }
  }, []);

  const generateShareLink = useCallback(() => {
    const encoded = compressTrip(tripName, startDateTime, stops);
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#trip=${encoded}`;
  }, [tripName, startDateTime, stops]);

  return (
    <TripContext.Provider
      value={{
        stops,
        startDateTime,
        calculatedStops,
        tripName,
        setTripName,
        setStartDateTime,
        addStop,
        updateStop,
        removeStop,
        reorderStops,
        updateDriveTime,
        clearAllStops,
        exportTrip,
        importTrip,
        generateShareLink,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
}
