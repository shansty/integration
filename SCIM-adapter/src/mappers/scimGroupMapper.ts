import type { Group, GroupMember } from '@prisma/client';

export interface ScimGroupInput {
  displayName: string;
  externalId?: string;
  members: string[];
}

export interface ScimMember {
  value: string;
  display?: string;
}

export function toScimGroup(g: Group, members: GroupMember[] = []) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    id: g.id,
    displayName: g.displayName,
    members: members.map(m => ({ value: m.userId, type: 'User' })),
    meta: { resourceType: 'Group' }
  };
}

export function fromScimGroup(payload: any): ScimGroupInput {
  const members = (payload.members || []).map((m: any) => m.value).filter(Boolean);
  return {
    displayName: payload.displayName,
    externalId: payload.externalId,
    members: members
  };
}