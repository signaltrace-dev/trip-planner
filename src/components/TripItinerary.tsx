'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useTrip } from '@/context/TripContext';
import { PlaceAutocomplete } from './PlaceAutocomplete';
import { MapDisplay } from './MapDisplay';
import { calculateDrivingDistance } from '@/lib/distanceService';
import { formatDuration, parseDuration } from '@/lib/timeCalculations';

export function TripItinerary() {
  const {
    stops,
    calculatedStops,
    startDateTime,
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
  } = useTrip();

  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [editingDeparture, setEditingDeparture] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');

  const handleShare = async () => {
    const link = generateShareLink();
    try {
      await navigator.clipboard.writeText(link);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    } catch (err) {
      // Fallback: show prompt with link
      window.prompt('Copy this link to share your trip:', link);
    }
  };

  // Calculate drive time when a new stop is added
  const calculateDriveTimeForStop = useCallback(async (stopId: string, stopIndex: number) => {
    if (stopIndex === 0) return;

    const previousStop = stops[stopIndex - 1];
    const currentStop = stops[stopIndex];

    if (!previousStop || !currentStop) return;

    setCalculatingDistance(stopId);

    const result = await calculateDrivingDistance(
      previousStop.lat,
      previousStop.lng,
      currentStop.lat,
      currentStop.lng
    );

    if (result) {
      updateDriveTime(stopId, result.durationHours);
    }

    setCalculatingDistance(null);
  }, [stops, updateDriveTime]);

  // Recalculate drive times when stops change order
  useEffect(() => {
    const recalculateDriveTimes = async () => {
      for (let i = 1; i < stops.length; i++) {
        const stop = stops[i];
        if (stop.driveTimeFromPrevious === null) {
          await calculateDriveTimeForStop(stop.id, i);
        }
      }
    };

    recalculateDriveTimes();
  }, [stops.length, calculateDriveTimeForStop]);

  const handlePlaceSelect = (place: {
    placeId: string;
    name: string;
    city: string;
    state: string;
    fullAddress: string;
    lat: number;
    lng: number;
  }) => {
    addStop({
      ...place,
      timeAtDestination: 1,
      notes: '',
      manualDepartureTime: null,
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    reorderStops(draggedIndex, index);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleTimeAtDestChange = (id: string, value: string) => {
    const hours = parseDuration(value);
    if (hours !== null) {
      updateStop(id, { timeAtDestination: hours });
    }
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return '-';
    return format(date, 'EEE M/d @ h:mm a');
  };

  return (
    <div className="space-y-6">
      {/* Trip Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trip Name
            </label>
            <input
              type="text"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={format(startDateTime, "yyyy-MM-dd'T'HH:mm")}
              onChange={(e) => setStartDateTime(new Date(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportTrip}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Save Trip
          </button>
          <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Load Trip
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  importTrip(file);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
          </label>
          <button
            onClick={handleShare}
            disabled={stops.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
            </svg>
            {shareStatus === 'copied' ? 'Link Copied!' : 'Share'}
          </button>
          <button
            onClick={clearAllStops}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Reset Trip
          </button>
        </div>
      </div>

      {/* Add Stop */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add a Stop
        </label>
        <PlaceAutocomplete
          onPlaceSelect={handlePlaceSelect}
          placeholder="Search for a city or place..."
        />
      </div>

      {/* Map Display */}
      <MapDisplay />

      {/* Itinerary Table */}
      {calculatedStops.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-8">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                    Drive Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                    Time There
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">
                    Arrival
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">
                    Departure
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calculatedStops.map((stop, index) => (
                  <tr
                    key={stop.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`hover:bg-gray-50 transition-colors cursor-move ${
                      draggedIndex === index ? 'opacity-50 bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {index === 0 ? (
                        <span className="flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                          </svg>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {index + 1}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {stop.name !== stop.city ? (
                        <div>
                          <div className="font-medium text-gray-900">{stop.name}</div>
                          <div className="text-sm text-gray-500">{stop.city}, {stop.state}</div>
                        </div>
                      ) : (
                        <div className="font-medium text-gray-900">
                          {stop.city}, {stop.state}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {index === 0 ? (
                        <span className="text-gray-400">-</span>
                      ) : calculatingDistance === stop.id ? (
                        <span className="text-gray-400 italic text-sm">calculating...</span>
                      ) : (
                        <span className="text-sm text-gray-700 px-2 py-1">
                          {stop.driveTimeFromPrevious !== null
                            ? formatDuration(stop.driveTimeFromPrevious)
                            : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {index === 0 ? (
                        <span className="text-gray-400">-</span>
                      ) : editingTime === stop.id ? (
                        <input
                          type="text"
                          defaultValue={stop.timeAtDestination.toString()}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => {
                            handleTimeAtDestChange(stop.id, e.target.value);
                            setEditingTime(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleTimeAtDestChange(stop.id, e.currentTarget.value);
                              setEditingTime(null);
                            }
                          }}
                          autoFocus
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingTime(stop.id)}
                          className="text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                        >
                          {formatDuration(stop.timeAtDestination)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateTime(stop.arrivalTime)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingDeparture === stop.id ? (
                        <input
                          type="datetime-local"
                          defaultValue={format(stop.departureTime, "yyyy-MM-dd'T'HH:mm")}
                          onBlur={(e) => {
                            if (e.target.value) {
                              updateStop(stop.id, { manualDepartureTime: new Date(e.target.value) });
                            }
                            setEditingDeparture(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (e.currentTarget.value) {
                                updateStop(stop.id, { manualDepartureTime: new Date(e.currentTarget.value) });
                              }
                              setEditingDeparture(null);
                            } else if (e.key === 'Escape') {
                              setEditingDeparture(null);
                            }
                          }}
                          autoFocus
                          className="w-44 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingDeparture(stop.id)}
                            className={`text-sm hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors ${
                              stop.manualDepartureTime ? 'text-orange-600 font-medium' : 'text-gray-600'
                            }`}
                          >
                            {formatDateTime(stop.departureTime)}
                          </button>
                          {stop.manualDepartureTime && (
                            <button
                              onClick={() => updateStop(stop.id, { manualDepartureTime: null })}
                              className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                              title="Reset to calculated time"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingNotes === stop.id ? (
                        <input
                          type="text"
                          defaultValue={stop.notes}
                          onBlur={(e) => {
                            updateStop(stop.id, { notes: e.target.value });
                            setEditingNotes(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateStop(stop.id, { notes: e.currentTarget.value });
                              setEditingNotes(null);
                            }
                          }}
                          autoFocus
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 placeholder:text-gray-500"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingNotes(stop.id)}
                          className="text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors text-left w-full truncate"
                        >
                          {stop.notes || 'Add notes...'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeStop(stop.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                        title="Remove stop"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Trip Summary */}
          {calculatedStops.length > 1 && (
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Total Stops:</span>{' '}
                  <span className="font-semibold text-gray-900">{calculatedStops.length}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Drive Time:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {formatDuration(
                      calculatedStops.reduce(
                        (sum, stop) => sum + (stop.driveTimeFromPrevious || 0),
                        0
                      )
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Trip End:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {formatDateTime(calculatedStops[calculatedStops.length - 1].departureTime)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {calculatedStops.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No stops yet</h3>
          <p className="text-gray-500">
            Search for a city or place above to start building your trip itinerary.
          </p>
        </div>
      )}
    </div>
  );
}
