'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { useTrip } from '@/context/TripContext';
import { formatDuration } from '@/lib/timeCalculations';
import { format } from 'date-fns';

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const defaultCenter = {
  lat: 39.8283,
  lng: -98.5795,
};

const defaultZoom = 4;

const polylineOptions = {
  strokeColor: '#3B82F6',
  strokeOpacity: 0.8,
  strokeWeight: 4,
  geodesic: true,
};

// Decode Google's encoded polyline format
function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

// Get API key from environment or localStorage
function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || localStorage.getItem('googleMapsApiKey');
}

export function MapDisplay() {
  const { calculatedStops } = useTrip();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [routePath, setRoutePath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Fetch driving directions using Routes API
  useEffect(() => {
    if (!isExpanded || calculatedStops.length < 2) {
      setRoutePath([]);
      return;
    }

    const fetchRoute = async () => {
      const apiKey = getApiKey();
      if (!apiKey) {
        console.error('No API key available for Routes API');
        return;
      }

      setIsLoadingRoute(true);

      const origin = {
        location: {
          latLng: {
            latitude: calculatedStops[0].lat,
            longitude: calculatedStops[0].lng,
          },
        },
      };

      const destination = {
        location: {
          latLng: {
            latitude: calculatedStops[calculatedStops.length - 1].lat,
            longitude: calculatedStops[calculatedStops.length - 1].lng,
          },
        },
      };

      const intermediates = calculatedStops.slice(1, -1).map((stop) => ({
        location: {
          latLng: {
            latitude: stop.lat,
            longitude: stop.lng,
          },
        },
      }));

      try {
        const response = await fetch(
          `https://routes.googleapis.com/directions/v2:computeRoutes`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
            },
            body: JSON.stringify({
              origin,
              destination,
              intermediates: intermediates.length > 0 ? intermediates : undefined,
              travelMode: 'DRIVE',
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Routes API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.routes && data.routes[0]?.polyline?.encodedPolyline) {
          const decoded = decodePolyline(data.routes[0].polyline.encodedPolyline);
          setRoutePath(decoded);
        } else {
          console.error('No route found in response', data);
          setRoutePath([]);
        }
      } catch (error) {
        console.error('Error fetching route:', error);
        setRoutePath([]);
      } finally {
        setIsLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [isExpanded, calculatedStops]);

  // Fit bounds when stops change
  useEffect(() => {
    if (!mapRef.current || calculatedStops.length === 0 || !isExpanded) return;

    const bounds = new google.maps.LatLngBounds();

    // Include all stops in bounds
    calculatedStops.forEach((stop) => {
      bounds.extend({ lat: stop.lat, lng: stop.lng });
    });

    // Also include route path points for better fit
    routePath.forEach((point) => {
      bounds.extend(point);
    });

    mapRef.current.fitBounds(bounds);

    if (calculatedStops.length === 1) {
      mapRef.current.setZoom(12);
    }
  }, [calculatedStops, isExpanded, routePath]);

  const selectedStop = calculatedStops.find((stop) => stop.id === selectedStopId);

  const formatDateTime = (date: Date | null) => {
    if (!date) return '-';
    return format(date, 'EEE M/d @ h:mm a');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Route Map
          </h3>
          {isLoadingRoute && isExpanded && (
            <span className="text-xs text-gray-500 italic">Loading route...</span>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isExpanded && (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={defaultZoom}
          onLoad={onMapLoad}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {/* Show route polyline if available */}
          {routePath.length > 0 && (
            <Polyline path={routePath} options={polylineOptions} />
          )}

          {/* Custom markers with stop numbers */}
          {calculatedStops.map((stop, index) => (
            <Marker
              key={stop.id}
              position={{ lat: stop.lat, lng: stop.lng }}
              label={{
                text: String(index + 1),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '12px',
              }}
              onClick={() => setSelectedStopId(stop.id)}
            />
          ))}

          {selectedStop && (
            <InfoWindow
              position={{ lat: selectedStop.lat, lng: selectedStop.lng }}
              onCloseClick={() => setSelectedStopId(null)}
            >
              <div className="p-1 min-w-[180px]">
                <h4 className="font-semibold text-gray-900 mb-2">{selectedStop.name}</h4>
                {selectedStop.name !== selectedStop.city && (
                  <p className="text-sm text-gray-600 mb-2">
                    {selectedStop.city}, {selectedStop.state}
                  </p>
                )}
                <div className="text-sm text-gray-700 space-y-1">
                  {selectedStop.arrivalTime && (
                    <p>
                      <span className="text-gray-500">Arrive:</span>{' '}
                      {formatDateTime(selectedStop.arrivalTime)}
                    </p>
                  )}
                  <p>
                    <span className="text-gray-500">Depart:</span>{' '}
                    {formatDateTime(selectedStop.departureTime)}
                  </p>
                  {calculatedStops.findIndex((s) => s.id === selectedStop.id) > 0 && (
                    <p>
                      <span className="text-gray-500">Time here:</span>{' '}
                      {formatDuration(selectedStop.timeAtDestination)}
                    </p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}
    </div>
  );
}
