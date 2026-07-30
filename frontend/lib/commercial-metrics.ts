export type CurrencyTotal = {
  currency: string;
  amount: number;
  clientCount: number;
};

export function groupMonthlyRevenueByCurrency(
  accounts: Array<{ monthlyPrice?: number | string | null; currency?: string | null }>,
): CurrencyTotal[] {
  const totals = new Map<string, CurrencyTotal>();

  for (const account of accounts) {
    const currency = String(account.currency || "GBP").trim().toUpperCase() || "GBP";
    const current = totals.get(currency) || { currency, amount: 0, clientCount: 0 };
    current.amount += Number(account.monthlyPrice || 0);
    current.clientCount += 1;
    totals.set(currency, current);
  }

  return Array.from(totals.values()).sort((left, right) =>
    left.currency.localeCompare(right.currency),
  );
}
