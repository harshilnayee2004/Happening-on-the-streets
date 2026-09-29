export function pricePerSqftDollars(priceCents, sqft) {
  if (typeof priceCents !== 'number' || !Number.isFinite(priceCents)) return null;
  if (typeof sqft !== 'number' || !Number.isFinite(sqft) || sqft <= 0) return null;
  return priceCents / 100 / sqft;
}

export function betterSide(left, right, prefer = 'lower') {
  if (left == null || right == null || left === right) return null;
  if (prefer === 'higher') return left > right ? 'left' : 'right';
  return left < right ? 'left' : 'right';
}
