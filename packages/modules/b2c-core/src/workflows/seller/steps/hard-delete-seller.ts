import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk";

import { PAYOUT_MODULE, PayoutModuleService } from "../../../modules/payout";
import { SELLER_MODULE, SellerModuleService } from "../../../modules/seller";
import sellerPayoutAccountLink from "../../../links/seller-payout-account";

export const hardDeleteSellerStep = createStep(
  "hard-delete-seller",
  async (id: string, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const link = container.resolve(ContainerRegistrationKeys.LINK);
    const sellerService = container.resolve<SellerModuleService>(SELLER_MODULE);
    const payoutService = container.resolve<PayoutModuleService>(PAYOUT_MODULE);

    const {
      data: [seller],
    } = await query.graph({
      entity: "seller",
      fields: ["id", "deleted_at"],
      filters: { id },
      withDeleted: true,
    });

    if (!seller) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Seller not found");
    }

    if (!seller.deleted_at) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Seller must be soft-deleted before permanent deletion"
      );
    }

    // Get members for this seller before any deletion (members are cascade-deleted with seller)
    const members = await sellerService.listMembers({ seller_id: id });
    const memberIds = members.map((m) => m.id);

    // Delete auth identities linked to these members so the email can be re-used for registration
    if (memberIds.length > 0) {
      const authModuleService = container.resolve(Modules.AUTH) as {
        listAuthIdentities: (filters: object, config?: { take?: number }) => Promise<Array<{ id: string; app_metadata?: Record<string, unknown> }>>;
        deleteAuthIdentities: (ids: string[]) => Promise<void>;
      };
      const authIdentities = await authModuleService.listAuthIdentities(
        {},
        { take: 500 }
      );
      const toDelete = authIdentities.filter((auth) => {
        const meta = auth.app_metadata as Record<string, unknown> | undefined;
        const value = meta?.value ?? meta?.actor_id;
        return typeof value === "string" && memberIds.includes(value);
      });
      if (toDelete.length > 0) {
        await authModuleService.deleteAuthIdentities(toDelete.map((a) => a.id));
      }
    }

    // Restore temporarily so link.dismiss() can resolve the seller (Link excludes soft-deleted)
    await sellerService.restoreSellers(id);

    const {
      data: [payoutLink],
    } = await query.graph({
      entity: sellerPayoutAccountLink.entryPoint,
      fields: ["payout_account_id"],
      filters: { seller_id: id },
    });

    if (payoutLink?.payout_account_id) {
      await link.dismiss({
        [SELLER_MODULE]: { seller_id: id },
        [PAYOUT_MODULE]: { payout_account_id: payoutLink.payout_account_id },
      });
      await payoutService.deletePayoutAccounts(payoutLink.payout_account_id);
    }

    const [sellerOnboarding] = await sellerService.listSellerOnboardings({
      seller_id: id,
    });
    if (sellerOnboarding) {
      await sellerService.deleteSellerOnboardings([sellerOnboarding.id]);
    }

    await sellerService.deleteSellers([id]);

    return new StepResponse(id);
  }
);
