import { Modules } from "@medusajs/framework/utils";

type MedusaContainerLike = {
  resolve: (key: string) => unknown;
};

type ProviderIdentity = {
  provider: string;
  entity_id?: string | null;
};

type AuthIdentityRow = {
  id: string;
  app_metadata?: Record<string, unknown> | null;
  provider_identities?: ProviderIdentity[];
};

type AuthModuleLike = {
  listAuthIdentities: (
    filters: Record<string, never>,
    config?: {
      take?: number;
      skip?: number;
      relations?: string[];
    }
  ) => Promise<AuthIdentityRow[]>;
  deleteAuthIdentities: (ids: string[]) => Promise<void>;
};

const PAGE_SIZE = 200;

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") {
    return null;
  }
  const t = email.trim().toLowerCase();
  return t.length ? t : null;
}

function buildEmailSet(emails: (string | null | undefined)[]): Set<string> {
  const set = new Set<string>();
  for (const e of emails) {
    const n = normalizeEmail(e ?? undefined);
    if (n) {
      set.add(n);
    }
  }
  return set;
}

function matchesMemberMetadata(
  auth: AuthIdentityRow,
  memberIdSet: Set<string>
): boolean {
  if (memberIdSet.size === 0) {
    return false;
  }
  const meta = auth.app_metadata as Record<string, unknown> | undefined;
  if (!meta) {
    return false;
  }
  const value = meta.value ?? meta.actor_id;
  return typeof value === "string" && memberIdSet.has(value);
}

function matchesSellerEmailpass(
  auth: AuthIdentityRow,
  emailSet: Set<string>
): boolean {
  if (emailSet.size === 0) {
    return false;
  }
  const providers = auth.provider_identities ?? [];
  return providers.some(
    (p) =>
      p.provider === "emailpass" &&
      typeof p.entity_id === "string" &&
      emailSet.has(p.entity_id.trim().toLowerCase())
  );
}

/**
 * Finds auth identities linked to seller members (app_metadata) and/or
 * emailpass provider identities for the given emails. Paginates through all
 * auth identities so deletions are not limited to the first N rows.
 */
export async function deleteAuthIdentitiesForSellerEmailsAndMembers(
  container: MedusaContainerLike,
  input: {
    memberIds: string[];
    emails: (string | null | undefined)[];
  }
): Promise<void> {
  const authModuleService = container.resolve(Modules.AUTH) as AuthModuleLike;

  const memberIdSet = new Set(input.memberIds.filter(Boolean));
  const emailSet = buildEmailSet(input.emails);

  if (memberIdSet.size === 0 && emailSet.size === 0) {
    return;
  }

  const toDelete = new Set<string>();
  let skip = 0;

  for (;;) {
    const batch = await authModuleService.listAuthIdentities(
      {},
      {
        take: PAGE_SIZE,
        skip,
        relations: ["provider_identities"],
      }
    );

    if (!batch.length) {
      break;
    }

    for (const auth of batch) {
      if (
        matchesMemberMetadata(auth, memberIdSet) ||
        matchesSellerEmailpass(auth, emailSet)
      ) {
        toDelete.add(auth.id);
      }
    }

    if (batch.length < PAGE_SIZE) {
      break;
    }

    skip += PAGE_SIZE;
  }

  if (toDelete.size > 0) {
    await authModuleService.deleteAuthIdentities([...toDelete]);
  }
}

/**
 * Admin one-off: delete auth identities for given email(s) via emailpass
 * provider (paginated full scan).
 */
export async function deleteAuthIdentitiesByEmails(
  container: MedusaContainerLike,
  emails: string[]
): Promise<void> {
  await deleteAuthIdentitiesForSellerEmailsAndMembers(container, {
    memberIds: [],
    emails,
  });
}
