import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cityLine, streetNick } from './format.js';
import { betterSide, pricePerSqftDollars } from './compareTable.js';

test('street nick is the street name, not First home', () => {
  assert.equal(streetNick({ address: '17715 Merryhill Ct, Monument, CO 80132' }), 'Merryhill Ct');
  assert.equal(streetNick({ address: '2617 Scorpio Dr, Colorado Springs, CO 80906' }), 'Scorpio Dr');
});

test('city line drops the street so the picker is not redundant', () => {
  assert.equal(cityLine({ address: '17715 Merryhill Ct, Monument, CO 80132' }), 'Monument, CO 80132');
});

test('price per square foot uses real price and sqft only', () => {
  assert.equal(pricePerSqftDollars(1_000_000_00, 2000), 500);
  assert.equal(pricePerSqftDollars(null, 2000), null);
  assert.equal(pricePerSqftDollars(100, 0), null);
});

test('better side highlights lower cost and higher space', () => {
  assert.equal(betterSide(10, 20, 'lower'), 'left');
  assert.equal(betterSide(3, 2, 'higher'), 'left');
  assert.equal(betterSide(5, 5, 'lower'), null);
  assert.equal(betterSide(null, 4, 'lower'), null);
});
