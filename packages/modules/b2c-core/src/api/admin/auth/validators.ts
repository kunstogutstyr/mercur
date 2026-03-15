import { z } from "zod";

export const AdminDeleteAuthIdentityByEmailBody = z.object({
  email: z.string().email(),
});

export type AdminDeleteAuthIdentityByEmailBodyType = z.infer<
  typeof AdminDeleteAuthIdentityByEmailBody
>;
