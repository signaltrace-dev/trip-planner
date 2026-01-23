'use client';

import { useRef, useEffect, useState } from 'react';

interface PlaceResult {
  placeId: string;
  name: string;
  city: string;
  state: string;
  fullAddress: string;
  lat: number;
  lng: number;
}

interface PlaceAutocompleteProps {
  onPlaceSelect: (place: PlaceResult) => void;
  placeholder?: string;
}

// Event interface for gmp-select
interface PlaceSelectEvent extends Event {
  placePrediction: google.maps.places.PlacePrediction;
}

// Environment variable configuration
// NEXT_PUBLIC_GOOGLE_PLACES_COUNTRY: comma-separated country codes (default: 'us')
// NEXT_PUBLIC_GOOGLE_PLACES_TYPES: comma-separated place types (default: 'locality,establishment')
//   Common types: locality (cities), establishment (businesses), address, geocode
const getCountryRestrictions = (): string | string[] => {
  const countries = process.env.NEXT_PUBLIC_GOOGLE_PLACES_COUNTRY || 'us';
  const countryList = countries.split(',').map(c => c.trim().toLowerCase());
  return countryList.length === 1 ? countryList[0] : countryList;
};

const getPlaceTypes = (): string[] | undefined => {
  const types = process.env.NEXT_PUBLIC_GOOGLE_PLACES_TYPES;
  if (!types) {
    // Default: cities and businesses
    return ['locality', 'establishment'];
  }
  if (types.toLowerCase() === 'all') {
    return undefined; // No type restriction
  }
  return types.split(',').map(t => t.trim());
};

export function PlaceAutocomplete({
  onPlaceSelect,
  placeholder = 'Search for a city or place...',
}: PlaceAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  // Counter to force recreation of the element (for clearing input)
  const [resetKey, setResetKey] = useState(0);

  // Keep the callback ref up to date
  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up existing element if any
    if (elementRef.current) {
      elementRef.current.remove();
      elementRef.current = null;
    }

    // Build configuration from environment variables
    const countryRestriction = getCountryRestrictions();
    const placeTypes = getPlaceTypes();

    const options: google.maps.places.PlaceAutocompleteElementOptions = {
      componentRestrictions: { country: countryRestriction },
    };

    if (placeTypes) {
      options.includedPrimaryTypes = placeTypes;
    }

    // Create the PlaceAutocompleteElement
    const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement(options);

    // Set placeholder
    placeAutocomplete.setAttribute('placeholder', placeholder);

    // Handle place selection
    const handlePlaceSelect = async (e: Event) => {
      const event = e as PlaceSelectEvent;
      const placePrediction = event.placePrediction;

      if (!placePrediction) {
        console.error('No placePrediction in event');
        return;
      }

      try {
        // Convert prediction to Place and fetch details
        const place = placePrediction.toPlace();
        await place.fetchFields({
          fields: ['id', 'location', 'addressComponents', 'formattedAddress', 'displayName', 'types'],
        });

        const location = place.location;
        const placeId = place.id;

        if (!location || !placeId) {
          console.error('Missing location or placeId', { location, placeId });
          return;
        }

        let city = '';
        let state = '';

        place.addressComponents?.forEach(component => {
          if (component.types.includes('locality')) {
            city = component.longText || '';
          }
          if (component.types.includes('administrative_area_level_1')) {
            state = component.shortText || '';
          }
          // Fallback for places without locality
          if (!city && component.types.includes('sublocality_level_1')) {
            city = component.longText || '';
          }
          if (!city && component.types.includes('administrative_area_level_2')) {
            city = component.longText || '';
          }
        });

        // For establishments/businesses, use displayName as the name
        // For cities, use the city name as both name and city
        const isEstablishment = place.types?.some(t =>
          t === 'establishment' || t === 'point_of_interest'
        );
        const displayName = place.displayName || '';
        const cityName = city || place.formattedAddress?.split(',')[0] || '';
        const name = isEstablishment && displayName ? displayName : cityName;

        onPlaceSelectRef.current({
          placeId,
          name,
          city: cityName,
          state,
          fullAddress: place.formattedAddress || '',
          lat: location.lat(),
          lng: location.lng(),
        });

        // Clear the input by recreating the element
        setResetKey(k => k + 1);
      } catch (err) {
        console.error('Error fetching place fields:', err);
      }
    };

    // Use gmp-select event (not gmp-placeselect)
    placeAutocomplete.addEventListener('gmp-select', handlePlaceSelect);

    // Append to container
    containerRef.current.appendChild(placeAutocomplete);
    elementRef.current = placeAutocomplete;

    return () => {
      if (elementRef.current) {
        elementRef.current.removeEventListener('gmp-select', handlePlaceSelect);
        elementRef.current.remove();
        elementRef.current = null;
      }
    };
  }, [placeholder, resetKey]);

  return (
    <div
      ref={containerRef}
      className="place-autocomplete-container"
    />
  );
}
