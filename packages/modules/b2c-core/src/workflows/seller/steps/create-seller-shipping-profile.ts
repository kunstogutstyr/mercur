import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk";
import { createShippingProfilesWorkflow } from "@medusajs/medusa/core-flows";
import { SELLER_MODULE } from "../../../modules/seller";
import { SellerDTO } from "@mercurjs/framework";

export const createSellerShippingProfileStep = createStep(
  "create-seller-shipping-profile",
  async ({ id: sellerId }: SellerDTO, { container }) => {
    const link = container.resolve(ContainerRegistrationKeys.LINK);
    const { result } = await createShippingProfilesWorkflow.run({
      container,
      input: {
        data: [
          {
            type: "default",
            name: `${sellerId}:Default shipping profile`,
          },
        ],
      },
    });

    const shippingProfileId = result[0]?.id;
    if (!shippingProfileId) {
      return new StepResponse(undefined, undefined);
    }

    await link.create({
      [SELLER_MODULE]: {
        seller_id: sellerId,
      },
      [Modules.FULFILLMENT]: {
        shipping_profile_id: shippingProfileId,
      },
    });

    return new StepResponse({ sellerId, shippingProfileId }, shippingProfileId);
  },
  async (shippingProfileId: string, { container }) => {
    if (!shippingProfileId) {
      return;
    }

    // Best-effort cleanup: if seller create flow fails later, avoid leaving fulfillment data behind.
    const fulfillment = container.resolve(Modules.FULFILLMENT) as {
      deleteShippingProfiles: (ids: string[]) => Promise<void>;
    };

    await fulfillment.deleteShippingProfiles([shippingProfileId]);
  }
);
