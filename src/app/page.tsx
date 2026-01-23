'use client';

import { useState, useEffect } from 'react';
import { TripProvider } from '@/context/TripContext';
import { GoogleMapsProvider } from '@/components/GoogleMapsProvider';
import { TripItinerary } from '@/components/TripItinerary';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [isKeySet, setIsKeySet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for API key in env or localStorage on mount
  useEffect(() => {
    const envKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const savedKey = localStorage.getItem('googleMapsApiKey');

    if (envKey) {
      setApiKey(envKey);
      setIsKeySet(true);
    } else if (savedKey) {
      setApiKey(savedKey);
      setIsKeySet(true);
    }
    setIsLoading(false);
  }, []);

  const handleSetApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem('googleMapsApiKey', apiKey.trim());
      setIsKeySet(true);
    }
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('googleMapsApiKey');
    setApiKey('');
    setIsKeySet(false);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Road Trip Planner</h1>
            </div>
          </div>
        </header>

        {!isKeySet ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Enter Your Google Maps API Key
            </h2>
            <p className="text-gray-600 mb-6">
              This app requires a Google Maps API key with the following APIs enabled:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1">
              <li>Places API</li>
              <li>Distance Matrix API</li>
            </ul>
          </div>
        ) : (
          <GoogleMapsProvider apiKey={apiKey}>
            <TripProvider>
              <TripItinerary />
            </TripProvider>
          </GoogleMapsProvider>
        )}
      </div>
    </main>
  );
}
