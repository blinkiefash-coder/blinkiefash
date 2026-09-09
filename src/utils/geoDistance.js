const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function getDistanceKm(shopCoords, userCoords) {
  if (
    !shopCoords || !userCoords ||
    typeof shopCoords.lat !== 'number' || typeof shopCoords.lng !== 'number' ||
    typeof userCoords.lat !== 'number' || typeof userCoords.lng !== 'number' ||
    Number.isNaN(shopCoords.lat) || Number.isNaN(shopCoords.lng) ||
    Number.isNaN(userCoords.lat) || Number.isNaN(userCoords.lng)
  ) {
    return null;
  }

  const dLat = toRad(userCoords.lat - shopCoords.lat);
  const dLng = toRad(userCoords.lng - shopCoords.lng);
  const lat1 = toRad(shopCoords.lat);
  const lat2 = toRad(userCoords.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}