const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const plain = new Intl.NumberFormat('en-US');

export function formatPrice(priceCents) {
  if (priceCents == null) return 'Price not listed';
  return wholeDollars.format(priceCents / 100);
}

export function formatDollars(amount) {
  return cents.format(amount);
}

export function formatWholeDollars(amount) {
  return wholeDollars.format(amount);
}

function addressKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function showAddress(property) {
  if (!property.address) return false;
  if (!property.title) return false;
  return addressKey(property.address) !== addressKey(property.title);
}

export function homeFacts(property) {
  const facts = [];
  if (property.beds != null) facts.push(`${plain.format(property.beds)} bd`);
  if (property.baths != null) facts.push(`${plain.format(property.baths)} ba`);
  if (property.sqft != null) facts.push(`${plain.format(property.sqft)} sq ft`);
  return facts;
}
