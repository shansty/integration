import { Request, Response } from 'express';
import prisma from '../prisma';
import { brivo } from '../brivo/client';
import { toScimGroup, fromScimGroup, ScimMember } from '../mappers/scimGroupMapper';
import {
  extractUserIdsFromMembersFilterPath,
  extractUserIdsFromPatchValue,
  findGroupByAnyId,
  scimError,
} from './helpers/groupHelpers';

export async function listGroups(req: Request, res: Response) {
  try {
    const startIndex = Number(req.query.startIndex ?? 1);
    const count = Number(req.query.count ?? 100);
    brivo.listPeople(req);
    const groups = await prisma.group.findMany({
      skip: Math.max(0, startIndex - 1),
      take: count,
      orderBy: { createdAt: 'desc' },
      include: { members: true },
    });
    const totalResults = await prisma.group.count();
    return res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults,
      startIndex,
      itemsPerPage: groups.length,
      Resources: groups.map((groupRecord) => toScimGroup(groupRecord, groupRecord.members)),
    });
  } catch (error) {
    console.error('listGroups error', error);
    return scimError(res, 'Failed to list groups', 500);
  }
}

export async function getGroupById(req: Request, res: Response) {
  try {
    const groupIdParam = req.params.id;
    let groupRecord = await prisma.group.findUnique({
      where: { id: groupIdParam },
      include: { members: true },
    });
    if (!groupRecord) {
      groupRecord = await prisma.group.findFirst({
        where: { OR: [{ brivoId: groupIdParam }, { externalId: groupIdParam }] },
        include: { members: true },
      });
    }
    if (!groupRecord) return scimError(res, 'Group not found', 404);
    return res.json(toScimGroup(groupRecord, groupRecord.members));
  } catch (error) {
    console.error('getGroupById error', error);
    return scimError(res, 'Failed to fetch group', 500);
  }
}

export async function createGroup(req: Request, res: Response) {
  try {
    const localGroup = fromScimGroup(req.body);
    const brivoGroup = await brivo.createGroup(req, { name: localGroup.displayName });
    const brivoId = String(brivoGroup.id ?? brivoGroup.groupId ?? '');
    const newGroup = await prisma.group.create({
      data: {
        displayName: localGroup.displayName,
        externalId: localGroup.externalId ?? null,
        brivoId: brivoId || null,
      },
    });
    if (localGroup.members.length > 0) {
      await prisma.groupMember.createMany({
        data: localGroup.members.map((userId: string) => ({
          groupId: newGroup.id,
          userId,
        })),
      });
    }
    const savedGroup = await prisma.group.findUnique({
      where: { id: newGroup.id },
      include: { members: { include: { user: true } } },
    });
    if (!savedGroup) {
      return scimError(res, 'Failed to fetch saved group', 404);
    }
    if (savedGroup.brivoId) {
      const brivoUserIds = savedGroup.members
        .map((memberRecord) => memberRecord.user.brivoId)
        .filter(Boolean) as string[];
      if (brivoUserIds.length > 0) {
        await brivo.updateGroup(req, savedGroup.brivoId, { users: brivoUserIds });
      }
    }
    return res.status(201).json(toScimGroup(savedGroup, savedGroup.members));
  } catch (error: any) {
    console.error('createGroup error', error?.response?.data || error);
    return scimError(res, 'Failed to create group', 502);
  }
}

export async function patchGroup(req: Request, res: Response) {
  try {
    const groupId = req.params.id;
    const existingGroup = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!existingGroup) return scimError(res, 'Group not found', 404);
    const groupFieldUpdates: Partial<{ displayName: string }> = {};
    const userIdsToAdd: string[] = [];
    const userIdsToRemove: string[] = [];
    const operations = Array.isArray(req.body?.Operations) ? req.body.Operations : [];
    for (const operation of operations) {
      const operationType = String(operation.op || '').toLowerCase();
      const rawPath = String(operation.path || '');
      const normalizedPath = rawPath.toLowerCase();
      // (1) Rename: replace displayName (path form)
      if (normalizedPath === 'displayname' && operationType === 'replace') {
        groupFieldUpdates.displayName = operation.value;
        continue;
      }
      // (2) Add members
      if (operationType === 'add' && normalizedPath === 'members') {
        userIdsToAdd.push(...extractUserIdsFromPatchValue(operation.value));
        continue;
      }
      // (3) Remove members
      if (operationType === 'remove') {
        if (normalizedPath.startsWith('members[')) {
          userIdsToRemove.push(...extractUserIdsFromMembersFilterPath(rawPath));
        } else if (normalizedPath === 'members') {
          const explicitIds = extractUserIdsFromPatchValue(operation.value);
          if (explicitIds.length > 0) {
            userIdsToRemove.push(...explicitIds);
          } else {
            userIdsToRemove.push(
              ...existingGroup.members.map((memberRecord) => memberRecord.userId),
            );
          }
        }
        continue;
      }
      // (4) Replace membership list (diff vs. current)
      if (operationType === 'replace' && normalizedPath === 'members') {
        const newMemberIds = new Set(extractUserIdsFromPatchValue(operation.value));
        const existingMemberIds = new Set(
          existingGroup.members.map((memberRecord) => memberRecord.userId),
        );
        for (const userId of newMemberIds)
          if (!existingMemberIds.has(userId)) userIdsToAdd.push(userId);
        for (const userId of existingMemberIds)
          if (!newMemberIds.has(userId)) userIdsToRemove.push(userId);
        continue;
      }
      // (5) Whole-object replace: {"value":{"displayName":"...","members":[...]}}
      if (operationType === 'replace' && !rawPath) {
        const groupPayload = operation.value || {};
        if (groupPayload.displayName !== undefined) {
          groupFieldUpdates.displayName = groupPayload.displayName;
        }
        if (Array.isArray(groupPayload.members)) {
          const newMemberIds = new Set(extractUserIdsFromPatchValue(groupPayload.members));
          const existingMemberIds = new Set(
            existingGroup.members.map((memberRecord) => memberRecord.userId),
          );
          for (const userId of newMemberIds)
            if (!existingMemberIds.has(userId)) userIdsToAdd.push(userId);
          for (const userId of existingMemberIds)
            if (!newMemberIds.has(userId)) userIdsToRemove.push(userId);
        }
        continue;
      }
    }
    // De-duplicate; and avoid trying to add and remove the same user in one patch
    const uniqueAdds = Array.from(new Set(userIdsToAdd));
    const uniqueRemoves = Array.from(new Set(userIdsToRemove)).filter(
      (userId) => !uniqueAdds.includes(userId),
    );
    // Apply field updates (e.g., displayName) and reflect to Brivo if present
    if (groupFieldUpdates.displayName !== undefined) {
      await prisma.group.update({
        where: { id: groupId },
        data: { displayName: groupFieldUpdates.displayName },
      });
      if (existingGroup.brivoId) {
        await brivo.updateGroup(req, existingGroup.brivoId, {
          name: groupFieldUpdates.displayName,
        });
      }
    }
    // Apply membership changes
    if (uniqueAdds.length > 0) {
      await prisma.groupMember.createMany({
        data: uniqueAdds.map((userId) => ({ groupId, userId })),
        skipDuplicates: true,
      });
    }
    if (uniqueRemoves.length > 0) {
      await prisma.groupMember.deleteMany({
        where: { groupId, userId: { in: uniqueRemoves } },
      });
    }
    // Return updated SCIM group and mirror to mock Brivo
    const updatedGroup = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: true } } },
    });
    if (!updatedGroup) {
      return scimError(res, 'Failed to fetch unique updated group', 404);
    }
    if (updatedGroup.brivoId) {
      const brivoUserIds = updatedGroup.members
        .map((memberRecord) => memberRecord.user.brivoId)
        .filter(Boolean) as string[];
      await brivo.updateGroup(req, updatedGroup.brivoId, { users: brivoUserIds });
    }
    return res.json(toScimGroup(updatedGroup, updatedGroup.members));
  } catch (error: any) {
    console.error('patchGroup error', error?.response?.data || error);
    return scimError(res, 'Failed to update group', 502);
  }
}

export async function deleteGroup(req: Request, res: Response) {
  try {
    const rawIdentifier = req.params.id;
    const identifier = decodeURIComponent(rawIdentifier);
    const existingGroup = await findGroupByAnyId(identifier);
    if (!existingGroup) {
      return res.status(204).send();
    }
    if (existingGroup.brivoId) {
      try {
        await brivo.deleteGroup(req, existingGroup.brivoId);
      } catch (externalError) {
        console.warn(
          'deleteGroup: brivo.deleteGroup failed (continuing):',
          existingGroup.brivoId,
          externalError,
        );
      }
    }
    await prisma.$transaction([
      prisma.groupMember.deleteMany({ where: { groupId: existingGroup.id } }),
      prisma.group.delete({ where: { id: existingGroup.id } }),
    ]);
    return res.status(204).send();
  } catch (error) {
    console.error('deleteGroup error', error);
    return scimError(res, 'Failed to delete group', 500);
  }
}
