import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateMonthlyCost } from './trueMonthlyCost.js';

function monthly(overrides) {
  return estimateMonthlyCost({
    purchasePrice: 0,
    downPaymentPercent: 0,
    annualInterestPercent: 0,
    loanTermYears: 30,
    propertyTaxPercent: 0,
    insurancePerYear: 0,
    hoaPerMonth: 0,
    gasPerMonth: 0,
    electricityPerMonth: 0,
    waterPerMonth: 0,
    maintenancePercentPerYear: 0,
    ...overrides,
  });
}

function assertEstimateLabels(result) {
  assert.equal(result.lines.every((line) => line.estimate === 'Estimate'), true);
  assert.equal(result.totalEstimate, 'Estimate');
}

test('30-year loan at 6 percent with carrying costs', () => {
  const result = monthly({
    purchasePrice: 240000,
    downPaymentPercent: 20,
    annualInterestPercent: 6,
    propertyTaxPercent: 1.2,
    insurancePerYear: 1200,
    hoaPerMonth: 100,
    gasPerMonth: 40,
    electricityPerMonth: 100,
    waterPerMonth: 30,
    maintenancePercentPerYear: 1,
  });
  assert.equal(result.lines.find((line) => line.id === 'mortgage').monthly, 1151.14);
  assert.equal(result.lines.find((line) => line.id === 'propertyTax').monthly, 240);
  assert.equal(result.lines.find((line) => line.id === 'insurance').monthly, 100);
  assert.equal(result.lines.find((line) => line.id === 'maintenance').monthly, 200);
  assert.equal(result.total, 1961.14);
  assertEstimateLabels(result);
});

test('zero interest is principal divided across the term', () => {
  const result = monthly({ purchasePrice: 100000 });
  assert.equal(result.lines.find((line) => line.id === 'mortgage').monthly, 277.78);
  assert.equal(result.total, 277.78);
  assertEstimateLabels(result);
});

test('higher rate, tax, utilities, and maintenance reserve', () => {
  const result = monthly({
    purchasePrice: 500000,
    downPaymentPercent: 10,
    annualInterestPercent: 7.5,
    propertyTaxPercent: 0.8,
    insurancePerYear: 3600,
    gasPerMonth: 75,
    electricityPerMonth: 180,
    waterPerMonth: 45,
    maintenancePercentPerYear: 1.5,
  });
  assert.equal(result.lines.find((line) => line.id === 'mortgage').monthly, 3146.47);
  assert.equal(result.lines.find((line) => line.id === 'propertyTax').monthly, 333.33);
  assert.equal(result.lines.find((line) => line.id === 'insurance').monthly, 300);
  assert.equal(result.lines.find((line) => line.id === 'maintenance').monthly, 625);
  assert.equal(result.total, 4704.8);
  assertEstimateLabels(result);
});
