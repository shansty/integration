import type { User } from '@prisma/client';

// Prisma → SCIM
export function toScimUser(user: User) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: user.id,
    userName: user.userName,
    externalId: user.externalId ?? undefined,
    active: user.active,
    name: {
      givenName: user.givenName,
      familyName: user.familyName,
    },
    meta: { resourceType: 'User' },
  };
}

// SCIM → Prisma
export function fromScimUser(payload: any) {
  return {
    userName: payload.userName,
    externalId: payload.externalId,
    active: payload.active ?? true,
    givenName: payload.name?.givenName,
    familyName: payload.name?.familyName,
  };
}

// Prisma/SCIM → Brivo
export function toBrivoPerson(user: any) {
  return {
    email: user.userName,
    firstName: user.givenName,
    lastName: user.familyName,
    status: user.active ? 'active' : 'inactive',
  };
}

// Brivo → SCIM (optional helper)
export function fromBrivoPerson(person: any) {
  return {
    userName: person.email,
    givenName: person.firstName ?? null,
    familyName: person.lastName ?? null,
    active: person.status === 'active',
    brivoId: String(person.id),
  };
}
