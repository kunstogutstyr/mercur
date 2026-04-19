import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";

import { deleteAuthIdentitiesByEmails } from "../../../../lib/delete-seller-auth-identities";
import type { AdminDeleteAuthIdentityByEmailBodyType } from "../validators";

/**
 * One-off admin endpoint: Delete auth identity by email so the email can be used again for registration.
 * Use for legacy rows or manual cleanup; hard delete now removes auth via the same paginated logic.
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

  await deleteAuthIdentitiesByEmails(req.scope, [email]);

  res.status(204).send();
}
