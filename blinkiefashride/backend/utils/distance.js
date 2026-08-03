/**
 * Road distance calculation utility.
 *
 * If GOOGLE_MAPS_API_KEY is set in environment variables, uses the
 * Google Distance Matrix API to get real road distance.
 *
 * Falls back to Haversine × 1.6 road factor when no key is present
 * or when the API call fails.
 */

const https = require('https');

/**
 * Straight-line (Haversine) distance × 1.6 road factor.
 * @returns {number} estimated km
 */
function haversineFallback(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const straight = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(straight * 1.6 * 10) / 10;
}

/**
 * Google Distance Matrix API — returns actual road distance in km.
 * Returns null on any error so caller can fall back.
 */
function googleRoadDistance(lat1, lon1, lat2, lon2) {
  return new Promise((resolve) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${lat1},${lon1}` +
      `&destinations=${lat2},${lon2}` +
      `&mode=driving` +
      `&key=${encodeURIComponent(key)}`;

    https
      .get(url, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            const element = json.rows?.[0]?.elements?.[0];
            if (element?.status === 'OK') {
              // distance.value is in metres
              const km = Math.round((element.distance.value / 1000) * 10) / 10;
              resolve(km);
            } else {
              console.warn('[distance] Google API element status:', element?.status);
              resolve(null);
            }
          } catch (e) {
            console.warn('[distance] Google API parse error:', e.message);
            resolve(null);
          }
        });
      })
      .on('error', (e) => {
        console.warn('[distance] Google API network error:', e.message);
        resolve(null);
      });
  });
}

/**
 * Get road distance in km between two coordinates.
 * Uses Google Distance Matrix if GOOGLE_MAPS_API_KEY is set, else Haversine×1.6.
 *
 * @param {number} lat1  Store latitude
 * @param {number} lon1  Store longitude
 * @param {number} lat2  Drop latitude
 * @param {number} lon2  Drop longitude
 * @returns {Promise<number>} Road distance in km (1 decimal)
 */
async function getRoadDistance(lat1, lon1, lat2, lon2) {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    const dist = await googleRoadDistance(lat1, lon1, lat2, lon2);
    if (dist !== null) {
      console.log(`[distance] Google road distance: ${dist} km`);
      return dist;
    }
    console.warn('[distance] Google failed, falling back to Haversine×1.6');
  }
  const dist = haversineFallback(lat1, lon1, lat2, lon2);
  console.log(`[distance] Haversine×1.6 distance: ${dist} km`);
  return dist;
}

module.exports = { getRoadDistance };
