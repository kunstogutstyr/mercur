import { createWorkflow } from "@medusajs/workflows-sdk";

import { hardDeleteSellerStep } from "../steps";

export const hardDeleteSellerWorkflow = createWorkflow(
  "hard-delete-seller",
  function (id: string) {
    hardDeleteSellerStep(id);
  }
);
