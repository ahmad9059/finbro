import type { Metadata } from "next";
import { CandlestickChart } from "lucide-react";

import {
  positionsCopy,
  type PositionsKind,
} from "~/features/investments/config";
import { PositionsPage } from "~/features/investments/positions-page";

export const metadata: Metadata = { title: "PSX Stocks" };

const kind: PositionsKind = "stock";

export default function Page() {
  return (
    <PositionsPage
      kind={kind}
      copy={positionsCopy[kind]}
      icon={CandlestickChart}
      title="Holdings"
    />
  );
}
