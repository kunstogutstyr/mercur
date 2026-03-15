import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";

import type { AdminDeleteAuthIdentityByEmailBodyType } from "../../validators";

/**
 * One-off admin endpoint: Delete auth identity by email so the email can be used again for registration.
 * Use after a seller was hard-deleted before the hard-delete step was updated to remove auth identities.
 *
 * @oas [post] /admin/auth/delete-identity-by-email
 * operationId: "AdminDeleteAuthIdentityByEmail"
 * summary: "Delete auth identity by email"
 * description: "Deletes the auth identity for the given email (e.g. to re-use email after hard-deleting a seller)."
 * x-authenticated: true
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         required: [email]
 *         properties:
 *           email:
 *             type: string
 *             format: email
 * responses:
 *   "204":
 *     description: No Content - identity deleted or not found
 *   "400":
 *     description: Bad Request
 * tags:
 *   - Admin Auth
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminDeleteAuthIdentityByEmailBodyType>,
  res: MedusaResponse
): Promise<void> {
  const { email } = req.validatedBody;

  const authModuleService = req.scope.resolve(Modules.AUTH) as {
    listAuthIdentities: (
      filters: object,
      config?: { take?: number; relations?: string[] }
    ) => Promise<
      Array<{
        id: string;
        provider_identities?: Array<{
          provider: string;
          entity_id: string;
        }>;
      }>
    >;
    deleteAuthIdentities: (ids: string[]) => Promise<void>;
  };

  const authIdentities = await authModuleService.listAuthIdentities(
    {},
    { take: 500, relations: ["provider_identities"] }
  );

  const toDelete = authIdentities.filter((auth) =>
    (auth.provider_identities ?? []).some(
      (p) =>
        p.provider === "emailpass" &&
        p.entity_id?.toLowerCase() === email.toLowerCase()
    )
  );

  if (toDelete.length > 0) {
    await authModuleService.deleteAuthIdentities(toDelete.map((a) => a.id));
  }

  res.status(204).send();
}
