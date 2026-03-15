import {
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework";

import { AdminDeleteAuthIdentityByEmailBody } from "./validators";

export const authMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/auth/delete-identity-by-email",
    middlewares: [validateAndTransformBody(AdminDeleteAuthIdentityByEmailBody)],
  },
];
