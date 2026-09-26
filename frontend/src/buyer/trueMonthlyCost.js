export const LOAN_TERM_YEARS = 30;

function roundCents(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function mortgagePayment(principal, annualInterestPercent, years) {
  const monthlyRate = annualInterestPercent / 100 / 12;
  const months = years * 12;
  if (monthlyRate === 0) return principal / months;
  const growth = (1 + monthlyRate) ** months;
  return principal * (monthlyRate * growth) / (growth - 1);
}

export function estimateMonthlyCost(input) {
  const purchasePrice = input.purchasePrice;
  const downPaymentPercent = input.downPaymentPercent;
  const annualInterestPercent = input.annualInterestPercent;
  const loanTermYears = input.loanTermYears;
  const propertyTaxPercent = input.propertyTaxPercent;
  const insurancePerYear = input.insurancePerYear;
  const hoaPerMonth = input.hoaPerMonth;
  const gasPerMonth = input.gasPerMonth;
  const electricityPerMonth = input.electricityPerMonth;
  const waterPerMonth = input.waterPerMonth;
  const maintenancePercentPerYear = input.maintenancePercentPerYear;
  const values = [
    purchasePrice,
    downPaymentPercent,
    annualInterestPercent,
    loanTermYears,
    propertyTaxPercent,
    insurancePerYear,
    hoaPerMonth,
    gasPerMonth,
    electricityPerMonth,
    waterPerMonth,
    maintenancePercentPerYear,
  ];
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return null;
  if (downPaymentPercent > 100 || loanTermYears <= 0) return null;

  const loan = purchasePrice * (1 - downPaymentPercent / 100);
  const lines = [
    {
      id: 'mortgage',
      label: `Mortgage, ${loanTermYears}-year fixed`,
      monthly: roundCents(mortgagePayment(loan, annualInterestPercent, loanTermYears)),
    },
    {
      id: 'propertyTax',
      label: 'Property tax',
      monthly: roundCents(purchasePrice * (propertyTaxPercent / 100) / 12),
    },
    {
      id: 'insurance',
      label: 'Insurance',
      monthly: roundCents(insurancePerYear / 12),
    },
    { id: 'hoa', label: 'HOA', monthly: roundCents(hoaPerMonth) },
    { id: 'gas', label: 'Gas', monthly: roundCents(gasPerMonth) },
    { id: 'electricity', label: 'Electricity', monthly: roundCents(electricityPerMonth) },
    { id: 'water', label: 'Water', monthly: roundCents(waterPerMonth) },
    {
      id: 'maintenance',
      label: 'Maintenance reserve',
      monthly: roundCents(purchasePrice * (maintenancePercentPerYear / 100) / 12),
    },
  ].map((line) => ({ ...line, estimate: 'Estimate' }));

  return {
    lines,
    total: roundCents(lines.reduce((sum, line) => sum + line.monthly, 0)),
    totalEstimate: 'Estimate',
  };
}
