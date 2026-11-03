'use server';

import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';

/**
 * Ensures the signed-in user has an organization.
 * If they have no memberships, automatically creates one for them
 * so they are never asked to create an organization manually.
 */
export async function ensureUserOrganization(): Promise<{ orgId: string; created: boolean }> {
  const { userId, orgId } = await auth.protect();

  // If already active in session, return it
  if (orgId) {
    return { orgId, created: false };
  }

  const client = await clerkClient();

  // Check existing memberships
  const memberships = await client.users.getOrganizationMembershipList({ userId });
  if (memberships.data && memberships.data.length > 0) {
    return { orgId: memberships.data[0].organization.id, created: false };
  }

  // Create a default organization for the user
  const user = await currentUser();
  const userName = user?.firstName || user?.username || 'My';
  const orgName = `${userName}'s Team`;

  const newOrg = await client.organizations.createOrganization({
    name: orgName,
    createdBy: userId,
  });

  return { orgId: newOrg.id, created: true };
}

