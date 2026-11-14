import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  computePosition,
  PortfolioError,
  type AssetKind,
  type Position,
  type Txn,
} from "~/lib/portfolio";
import { db } from "~/server/db";
import {
  asset,
  assetTxn,
  type Asset,
  type AssetTxn,
} from "~/server/db/schema";

export type Db = typeof db;
/** A database handle or a transaction on it. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export type AssetView = { asset: Asset; position: Position };

export function toTxn(row: AssetTxn): Txn {
  return {
    id: row.id,
    kind: row.kind,
    date: row.date,
    units: row.units,
    amount: row.amount,
    fees: row.fees,
  };
}

/** Turns a portfolio rule violation into a readable API error. */
export function positionOrThrow(
  kind: AssetKind,
  lastPrice: number | null,
  txns: readonly Txn[],
): Position {
  try {
    return computePosition(kind, lastPrice, txns);
  } catch (error) {
    if (error instanceof PortfolioError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    throw error;
  }
}

export async function loadAssetViews(
  database: DbOrTx,
  userId: string,
  kind?: AssetKind,
): Promise<AssetView[]> {
  const assets = await database
    .select()
    .from(asset)
    .where(and(eq(asset.userId, userId), kind ? eq(asset.kind, kind) : undefined))
    .orderBy(asc(asset.name));
  if (assets.length === 0) return [];

  const txns = await database
    .select()
    .from(assetTxn)
    .where(
      and(
        eq(assetTxn.userId, userId),
        inArray(
          assetTxn.assetId,
          assets.map((a) => a.id),
        ),
      ),
    );

  const byAsset = new Map<number, Txn[]>();
  for (const row of txns) {
    const list = byAsset.get(row.assetId) ?? [];
    list.push(toTxn(row));
    byAsset.set(row.assetId, list);
  }

  return assets.map((a) => ({
    asset: a,
    position: computePosition(a.kind, a.lastPrice, byAsset.get(a.id) ?? []),
  }));
}

export async function getOwnedAsset(
  database: DbOrTx,
  userId: string,
  assetId: number,
): Promise<Asset> {
  const [row] = await database
    .select()
    .from(asset)
    .where(and(eq(asset.id, assetId), eq(asset.userId, userId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Not found." });
  return row;
}

export function notFound(what: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `${what} not found.` });
}
