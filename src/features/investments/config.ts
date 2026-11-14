import type { TxnKind } from "~/lib/portfolio";

export type PositionsKind = "stock" | "mutual_fund" | "money_market";

export type PositionsCopy = {
  units: string;
  avgCost: string;
  price: string;
  value: string;
  addLabel: string;
  addTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  institutionLabel: string;
  lookup: "stock" | "fund";
  /** Decimals for unit prices and average cost. */
  priceDecimals: number;
  moneyMarket: boolean;
  hint: string;
  txns: { kind: TxnKind; label: string; description: string }[];
};

const UNIT_TXNS: PositionsCopy["txns"] = [
  { kind: "buy", label: "Buy", description: "Units bought, and what you paid." },
  { kind: "sell", label: "Sell", description: "Units sold, and what you received." },
  {
    kind: "bonus",
    label: "Bonus units",
    description: "Extra units at no cost, including reinvested dividends.",
  },
  {
    kind: "dividend",
    label: "Dividend",
    description: "Cash received without selling anything.",
  },
];

export const positionsCopy: Record<PositionsKind, PositionsCopy> = {
  stock: {
    units: "Shares",
    avgCost: "Avg cost",
    price: "Price",
    value: "Market value",
    addLabel: "Add holding",
    addTitle: "Add holding",
    nameLabel: "Company",
    namePlaceholder: "Search the symbol to fill this in",
    institutionLabel: "Broker",
    lookup: "stock",
    priceDecimals: 2,
    moneyMarket: false,
    hint: "Prices come from the PSX data portal. Refresh after the market closes.",
    txns: UNIT_TXNS,
  },
  mutual_fund: {
    units: "Units",
    avgCost: "Avg NAV",
    price: "NAV",
    value: "Market value",
    addLabel: "Add fund",
    addTitle: "Add mutual fund",
    nameLabel: "Fund",
    namePlaceholder: "Search by fund or asset manager",
    institutionLabel: "Asset manager",
    lookup: "fund",
    priceDecimals: 4,
    moneyMarket: false,
    hint: "NAVs come from MUFAP's daily fund directory, updated each business evening.",
    txns: UNIT_TXNS,
  },
  money_market: {
    units: "Units",
    avgCost: "Avg NAV",
    price: "NAV",
    value: "Market value",
    addLabel: "Add fund",
    addTitle: "Add money market fund",
    nameLabel: "Fund",
    namePlaceholder: "Search money market funds",
    institutionLabel: "Asset manager",
    lookup: "fund",
    priceDecimals: 4,
    moneyMarket: true,
    hint: "NAVs come from MUFAP's daily fund directory, updated each business evening.",
    txns: UNIT_TXNS,
  },
};

/** Savings accounts reuse the asset dialogs with their own wording. */
export const savingsCopy: PositionsCopy = {
  units: "Amount",
  avgCost: "Rate",
  price: "",
  value: "Balance",
  addLabel: "Add account",
  addTitle: "Add account",
  nameLabel: "Account",
  namePlaceholder: "e.g. Meezan Savings",
  institutionLabel: "Bank",
  lookup: "stock",
  priceDecimals: 2,
  moneyMarket: false,
  hint: "Balances are what you deposited plus profit, minus withdrawals.",
  txns: [
    { kind: "deposit", label: "Deposit", description: "Money paid into the account." },
    { kind: "withdrawal", label: "Withdrawal", description: "Money taken out." },
    { kind: "profit", label: "Profit", description: "Profit credited by the bank, after tax." },
  ],
};
