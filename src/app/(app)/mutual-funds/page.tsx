import type { Metadata } from "next";
import { PieChart } from "lucide-react";

import {
  positionsCopy,
  type PositionsKind,
} from "~/features/investments/config";
import { PositionsPage } from "~/features/investments/positions-page";

export const metadata: Metadata = { title: "Mutual Funds" };

const kind: PositionsKind = "mutual_fund";

export default function Page() {
  return (
    <PositionsPage
      kind={kind}
      copy={positionsCopy[kind]}
      icon={PieChart}
      title="Funds"
    />
  );
}
