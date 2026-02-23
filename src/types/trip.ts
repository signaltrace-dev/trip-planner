export interface TripStop {
  id: string;
  placeId: string;
  name: string;
  city: string;
  state: string;
  fullAddress: string;
  lat: number;
  lng: number;
  timeAtDestination: number;
  driveTimeFromPrevious: number | null;
  travelType: 'drive' | 'fly';
  notes: string;
  manualDepartureTime: Date | null;
}

export interface TripPlan {
  id: string;
  name: string;
  startDateTime: Date;
  stops: TripStop[];
}

export interface CalculatedStop extends TripStop {
  arrivalTime: Date | null;
  departureTime: Date;
}
