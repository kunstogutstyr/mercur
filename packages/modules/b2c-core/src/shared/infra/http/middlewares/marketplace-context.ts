import { NextFunction } from "express";

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export type MarketplaceContext = {
  sales_channel_id?: string;
  region_id?: string;
};

declare module "@medusajs/framework/http" {
  interface MedusaRequest {
    marketplaceContext?: MarketplaceContext;
  }
}

/**
 * Leser valgfrie headere for markedsplass-kontekst og setter req.marketplaceContext.
 * Brukes for multi-marketplace: vendor panel sender f.eks. X-Sales-Channel-Id
 * slik at backend kan bruke riktig sales channel/region per markedsplass.
 */
export function marketplaceContext() {
  return (req: MedusaRequest, _res: MedusaResponse, next: NextFunction) => {
    const salesChannelId =
      (req.headers["x-sales-channel-id"] as string)?.trim() || undefined;
    const regionId =
      (req.headers["x-region-id"] as string)?.trim() || undefined;

    if (salesChannelId || regionId) {
      req.marketplaceContext = {
        sales_channel_id: salesChannelId,
        region_id: regionId,
      };
    }

    return next();
  };
}
