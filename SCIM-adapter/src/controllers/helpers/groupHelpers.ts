import { Request, Response } from 'express';
import prisma from '../../prisma';

export function scimError(res: Response, detail: string, status = 400) {
  return res.status(status).json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail,
    status: String(status),
  });
}

// Extract the SCIM User id from a $ref URL (absolute or relative). 
export function parseUserIdFromRefUrl(refUrl: string): string | null {
  try {
    const lowered = refUrl.toLowerCase();
    const marker = '/users/';
    const at = lowered.lastIndexOf(marker);
    if (at === -1) return null;

    const after = refUrl.slice(at + marker.length);
    const id = after.split(/[?#]/)[0].trim();
    return id || null;
  } catch {
    return null;
  }
}

/** Normalize one "member" element into a user id string if possible. */
export function parseUserIdFromMemberElement(memberElement: any): string | null {
  if (!memberElement) return null;

  if (memberElement.value) {
    return String(memberElement.value);
  }

  if (typeof memberElement.$ref === 'string') {
    const parsed = parseUserIdFromRefUrl(memberElement.$ref);
    if (parsed) return parsed;
  }

  if (typeof memberElement === 'string') {
    return memberElement;
  }

  return null;
}

/**
 * Extract user ids from the Patch "value" field which may be:
 *  - a single member object
 *  - an array of member objects
 *  - undefined/null (=> empty list; special-cased elsewhere for "clear all")
 */
export function extractUserIdsFromPatchValue(patchValue: any): string[] {
  if (!patchValue) return [];
  const arrayValue = Array.isArray(patchValue) ? patchValue : [patchValue];

  const userIds = arrayValue
    .map(parseUserIdFromMemberElement)
    .filter((id): id is string => Boolean(id));

  return Array.from(new Set(userIds));
}

/** Extract user ids from filtered remove paths like: members[value eq "abc"]. */
export function extractUserIdsFromMembersFilterPath(rawPath: string): string[] {
  const userIds: string[] = [];
  // Handles single/double quotes and extra predicates
  const regex = /members\[[^\]]*?value\s+eq\s+(['"])([^'"]+)\1[^\]]*?\]/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawPath)) !== null) {
    userIds.push(match[2]);
  }
  return Array.from(new Set(userIds));
}


export async function findGroupByAnyId(identifier: string) {
  // Try primary key first (recommended: your SCIM id should be this)
  const byPrimary = await prisma.group.findUnique({
    where: { id: identifier },
    include: { members: true },
  });
  if (byPrimary) return byPrimary;

  // Fallbacks: brivoId or externalId
  const byAlt = await prisma.group.findFirst({
    where: { OR: [{ brivoId: identifier }, { externalId: identifier }] },
    include: { members: true },
  });
  return byAlt;
}
