import type { Metadata } from "next";

import {
  positionsCopy,
  type PositionsKind,
} from "~/features/investments/config";
import { PositionsPage } from "~/features/investments/positions-page";

export const metadata: Metadata = { title: "Money Market" };

const kind: PositionsKind = "money_market";

export default function Page() {
  return (
    <PositionsPage
      kind={kind}
      copy={positionsCopy[kind]}
      title="Money market funds"
    />
  );
}
