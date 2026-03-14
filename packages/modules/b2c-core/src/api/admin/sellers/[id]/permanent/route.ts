import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'

import { hardDeleteSellerWorkflow } from '../../../../../workflows/seller/workflows'

/**
 * @oas [delete] /admin/sellers/{id}/permanent
 * operationId: "AdminHardDeleteSeller"
 * summary: "Delete Seller (permanent)"
 * description: "Permanently deletes a soft-deleted seller from the database."
 * x-authenticated: true
 * parameters:
 *   - name: id
 *     in: path
 *     required: true
 *     schema:
 *       type: string
 * responses:
 *   "204":
 *     description: No Content
 *   "400":
 *     description: Bad Request - Seller must be soft-deleted first
 * tags:
 *   - Admin Sellers
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await hardDeleteSellerWorkflow(req.scope).run({
    input: req.params.id
  })
  res.status(204).send()
}
