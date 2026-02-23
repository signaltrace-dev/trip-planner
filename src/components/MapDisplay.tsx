'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { useTrip } from '@/context/TripContext';
import { CalculatedStop } from '@/types/trip';
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

const drivePolylineOptions = {
  strokeColor: '#3B82F6',
  strokeOpacity: 0.8,
  strokeWeight: 4,
  geodesic: true,
};

const flightPolylineOptions = {
  strokeOpacity: 0,
  geodesic: true,
  icons: [
    {
      icon: {
        path: 'M 0,-1 0,1',
        strokeOpacity: 0.8,
        strokeColor: '#7C3AED',
        scale: 3,
      },
      offset: '0',
      repeat: '15px',
    },
  ],
};

interface RouteLine {
  path: Array<{ lat: number; lng: number }>;
  type: 'drive' | 'fly';
}

// Group consecutive legs into drive segments and individual fly legs
function buildSegments(
  stops: CalculatedStop[]
): Array<{ type: 'drive' | 'fly'; stopIndices: number[] }> {
  if (stops.length < 2) return [];

  const segments: Array<{ type: 'drive' | 'fly'; stopIndices: number[] }> = [];

  for (let i = 1; i < stops.length; i++) {
    const legType = stops[i].travelType === 'fly' ? 'fly' : 'drive';

    if (legType === 'fly') {
      segments.push({ type: 'fly', stopIndices: [i - 1, i] });
    } else {
      const last = segments[segments.length - 1];
      if (last && last.type === 'drive') {
        last.stopIndices.push(i);
      } else {
        segments.push({ type: 'drive', stopIndices: [i - 1, i] });
      }
    }
  }

  return segments;
}

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
  const [routeLines, setRouteLines] = useState<RouteLine[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Fetch driving directions (per segment) and build flight straight lines
  useEffect(() => {
    if (!isExpanded || calculatedStops.length < 2) {
      setRouteLines([]);
      return;
    }

    const segments = buildSegments(calculatedStops);

    const fetchRoutes = async () => {
      const apiKey = getApiKey();
      if (!apiKey) {
        console.error('No API key available for Routes API');
        return;
      }

      setIsLoadingRoute(true);
      const lines: RouteLine[] = [];

      for (const segment of segments) {
        if (segment.type === 'fly') {
          const from = calculatedStops[segment.stopIndices[0]];
          const to = calculatedStops[segment.stopIndices[1]];
          lines.push({
            type: 'fly',
            path: [
              { lat: from.lat, lng: from.lng },
              { lat: to.lat, lng: to.lng },
            ],
          });
          continue;
        }

        // Drive segment -- fetch route from Routes API
        const indices = segment.stopIndices;
        const originStop = calculatedStops[indices[0]];
        const destStop = calculatedStops[indices[indices.length - 1]];

        const origin = {
          location: {
            latLng: { latitude: originStop.lat, longitude: originStop.lng },
          },
        };

        const destination = {
          location: {
            latLng: { latitude: destStop.lat, longitude: destStop.lng },
          },
        };

        const intermediates = indices.slice(1, -1).map((i) => ({
          location: {
            latLng: {
              latitude: calculatedStops[i].lat,
              longitude: calculatedStops[i].lng,
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
            lines.push({ type: 'drive', path: decoded });
          }
        } catch (error) {
          console.error('Error fetching route for drive segment:', error);
        }
      }

      setRouteLines(lines);
      setIsLoadingRoute(false);
    };

    fetchRoutes();
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
    routeLines.forEach((line) => {
      line.path.forEach((point) => {
        bounds.extend(point);
      });
    });

    mapRef.current.fitBounds(bounds);

    if (calculatedStops.length === 1) {
      mapRef.current.setZoom(12);
    }
  }, [calculatedStops, isExpanded, routeLines]);

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
          {/* Show route polylines -- solid for drive, dashed for flight */}
          {routeLines.map((line, index) => (
            <Polyline
              key={`${line.type}-${index}`}
              path={line.path}
              options={line.type === 'fly' ? flightPolylineOptions : drivePolylineOptions}
            />
          ))}

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
