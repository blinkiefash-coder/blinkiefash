// Best-effort reverse geocoding using the free Nominatim API — no API key required.
export async function detectCurrentCity() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  const position = await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  });

  if (!position) return null;

  try {
    const { latitude, longitude } = position.coords;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    const address = data?.address || {};
    return address.city || address.town || address.state_district || address.state || null;
  } catch {
    return null;
  }
}
