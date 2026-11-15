// Real distance calculation between two GPS coordinates — the Haversine
// formula, the same standard math real navigation and mapping tools use.
// Deliberately not calling any external geocoding/distance API — this is
// pure, free calculation once two points are known, matching the design
// goal of adding real GPS support with zero paid dependency, unlike
// features that genuinely need a third-party service (payments, SMS,
// the AI chat).

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Returns the real, great-circle distance between two points in miles.
function distanceInMiles(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

function isValidCoordinate(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' &&
    !Number.isNaN(lat) && !Number.isNaN(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

module.exports = { distanceInMiles, isValidCoordinate };
