const DELIVERY_TIERS = [
  { max: 15, label: '60 minutes', tier: 'hyperlocal', etaHours: 1, note: 'Add buffer during peak traffic/rain' },
  { max: 45, label: 'Same day', tier: 'local', etaHours: 8, note: 'May slip to next day after local cutoff' },
  { max: 500, label: '24 hours', tier: 'regional', etaHours: 24, note: 'Highway delays can add 4-6 hrs' },
  { max: Infinity, label: '3-4 days', tier: 'long-haul', etaHours: 96, note: 'Customs/remote-area surcharge possible' },
];

export function estimateDeliveryFromDistance(distanceKm) {
  const isInvalid =
    distanceKm === null ||
    distanceKm === undefined ||
    typeof distanceKm !== 'number' ||
    Number.isNaN(distanceKm) ||
    distanceKm < 0;

  if (isInvalid) {
    return {
      distanceKm: null,
      label: 'Delivery time unavailable',
      tier: 'unknown',
      etaHours: null,
      note: 'Distance could not be calculated — check shop/user coordinates',
    };
  }

  const match = DELIVERY_TIERS.find((t) => distanceKm <= t.max);
  return { distanceKm, ...match };
}