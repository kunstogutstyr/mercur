import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStep } from "@medusajs/framework/workflows-sdk";
import {
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows";

import { IntermediateEvents } from "@mercurjs/framework";
import { SellerDTO } from "@mercurjs/framework";

import { SELLER_MODULE } from "../../../modules/seller";
import { createLocationFulfillmentSetAndAssociateWithSellerWorkflow } from "../../fulfillment-set/create-location-fulfillment-set-and-associate-with-seller";
import sellerShippingProfile from "../../../links/seller-shipping-profile";

const DEFAULT_SHIPPING_COUNTRIES = ["no"];
const DEFAULT_FULFILLMENT_PROVIDER = "manual_manual";

/**
 * Oppretter standard lokasjon, fulfillment set, service zone og fraktalternativ
 * for en ny vendor ved onboarding, slik at sluttbrukeren ikke må sette opp
 * tekniske innstillinger manuelt.
 */
export const createDefaultSellerLocationStep = createStep(
  "create-default-seller-location",
  async (seller: SellerDTO, { container }) => {
    const sellerId = seller.id;
    const sellerName = seller.name || "Vendor";

    const link = container.resolve(ContainerRegistrationKeys.LINK);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const eventBus = container.resolve(Modules.EVENT_BUS);

    const regionService = container.resolve(Modules.REGION);
    const [region] = await regionService.listRegions();
    const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
    const [salesChannel] = await salesChannelService.listSalesChannels();

    if (!region || !salesChannel) {
      return;
    }

    const {
      result: [stockLocation],
    } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: `Standard lager - ${sellerName}`,
            address: {
              address_1: "Oppdater adresse i Innstillinger",
              city: "",
              country_code: DEFAULT_SHIPPING_COUNTRIES[0],
            },
          },
        ],
      },
    });

    await link.create([
      {
        [SELLER_MODULE]: { seller_id: sellerId },
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      },
      {
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: {
          fulfillment_provider_id: DEFAULT_FULFILLMENT_PROVIDER,
        },
      },
      {
        [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannel.id },
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      },
    ]);

    await createLocationFulfillmentSetAndAssociateWithSellerWorkflow.run({
      container,
      input: {
        location_id: stockLocation.id,
        seller_id: sellerId,
        fulfillment_set_data: {
          name: `Standard frakt - ${sellerName}`,
          type: "shipping",
        },
      },
    });

    await eventBus.emit({
      name: IntermediateEvents.STOCK_LOCATION_CHANGED,
      data: { id: stockLocation.id },
    });

    const {
      data: [stockLocationWithSets],
    } = await query.graph({
      entity: "stock_location",
      fields: ["id", "fulfillment_sets.id"],
      filters: { id: stockLocation.id },
    });

    const fulfillmentSetId = stockLocationWithSets?.fulfillment_sets?.[0]?.id;
    if (!fulfillmentSetId) {
      return;
    }

    await createServiceZonesWorkflow.run({
      container,
      input: {
        data: [
          {
            fulfillment_set_id: fulfillmentSetId,
            name: "Standard leveringssone",
            geo_zones: DEFAULT_SHIPPING_COUNTRIES.map((country_code) => ({
              type: "country" as const,
              country_code,
            })),
          },
        ],
      },
    });

    const fulfillmentService = container.resolve(Modules.FULFILLMENT);
    const [serviceZone] = await fulfillmentService.listServiceZones({
      fulfillment_set: { id: fulfillmentSetId },
    });

    if (!serviceZone) {
      return;
    }

    await link.create({
      [SELLER_MODULE]: { seller_id: sellerId },
      [Modules.FULFILLMENT]: { service_zone_id: serviceZone.id },
    });

    await eventBus.emit({
      name: IntermediateEvents.SERVICE_ZONE_CHANGED,
      data: { id: serviceZone.id },
    });

    const {
      data: [shippingProfileLink],
    } = await query.graph({
      entity: sellerShippingProfile.entryPoint,
      fields: ["shipping_profile_id"],
      filters: { seller_id: sellerId },
    });

    if (!shippingProfileLink?.shipping_profile_id) {
      return;
    }

    const {
      result: [shippingOption],
    } = await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Standard frakt",
          shipping_profile_id: shippingProfileLink.shipping_profile_id,
          service_zone_id: serviceZone.id,
          provider_id: DEFAULT_FULFILLMENT_PROVIDER,
          type: {
            label: "Standard frakt",
            code: "standard",
            description: "Standard levering",
          },
          rules: [
            { value: "true", attribute: "enabled_in_store", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
          prices: [
            { currency_code: region.currency_code?.toLowerCase() || "nok", amount: 0 },
            { amount: 0, region_id: region.id },
          ],
          price_type: "flat",
          data: { id: "manual-fulfillment" },
        },
      ],
    });

    await link.create({
      [SELLER_MODULE]: { seller_id: sellerId },
      [Modules.FULFILLMENT]: { shipping_option_id: shippingOption.id },
    });

    await eventBus.emit({
      name: IntermediateEvents.SHIPPING_OPTION_CHANGED,
      data: { id: shippingOption.id },
    });
  }
);
