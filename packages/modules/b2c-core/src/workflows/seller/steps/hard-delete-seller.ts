import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk";

import { PAYOUT_MODULE } from "../../../modules/payout";
import { SELLER_MODULE, SellerModuleService } from "../../../modules/seller";
import sellerPayoutAccountLink from "../../../links/seller-payout-account";

export const hardDeleteSellerStep = createStep(
  "hard-delete-seller",
  async (id: string, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const link = container.resolve(ContainerRegistrationKeys.LINK);
    const sellerService = container.resolve<SellerModuleService>(SELLER_MODULE);
    const payoutService = container.resolve(PAYOUT_MODULE);

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
