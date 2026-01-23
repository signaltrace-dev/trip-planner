interface DistanceResult {
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  durationHours: number;
}

export async function calculateDrivingDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DistanceResult | null> {
  return new Promise((resolve) => {
    const service = new google.maps.DistanceMatrixService();

    service.getDistanceMatrix(
      {
        origins: [{ lat: originLat, lng: originLng }],
        destinations: [{ lat: destLat, lng: destLng }],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
      },
      (response, status) => {
        if (
          status !== 'OK' ||
          !response ||
          !response.rows[0]?.elements[0] ||
          response.rows[0].elements[0].status !== 'OK'
        ) {
          console.error('Distance Matrix error:', status, response);
          resolve(null);
          return;
        }

        const element = response.rows[0].elements[0];
        const durationSeconds = element.duration.value;
        const durationHours = durationSeconds / 3600;

        resolve({
          distanceMeters: element.distance.value,
          distanceText: element.distance.text,
          durationSeconds,
          durationText: element.duration.text,
          durationHours: Math.round(durationHours * 100) / 100, // Round to 2 decimals
        });
      }
    );
  });
}

export async function calculateAllDrivingDistances(
  stops: Array<{ lat: number; lng: number; id: string }>
): Promise<Map<string, number>> {
  const driveTimesMap = new Map<string, number>();

  for (let i = 1; i < stops.length; i++) {
    const origin = stops[i - 1];
    const dest = stops[i];

    const result = await calculateDrivingDistance(
      origin.lat,
      origin.lng,
      dest.lat,
      dest.lng
    );

    if (result) {
      driveTimesMap.set(dest.id, result.durationHours);
    }
  }

  return driveTimesMap;
}
