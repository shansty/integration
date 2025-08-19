import { Request, Response } from 'express';
import prisma from '../prisma';
import { brivo } from '../brivo/client';
import { toScimGroup, fromScimGroup } from '../mappers/scimGroupMapper';

function scimError(res: Response, detail: string, status = 400) {
  return res.status(status).json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail,
    status: String(status),
  });
}

export async function listGroups(req: Request, res: Response) {
  try {
    const startIndex = Number(req.query.startIndex ?? 1);
    const count = Number(req.query.count ?? 100);

    const brivoPeople = await brivo.listPeople(req);

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
      Resources: groups.map(g => toScimGroup(g, g.members)),
    });
  } catch (e) {
    console.error('listGroups error', e);
    return scimError(res, 'Failed to list groups', 500);
  }
}

export async function getGroupById(req: Request, res: Response) {
  try {
    const g = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: { members: true },
    });
    if (!g) return scimError(res, 'Group not found', 404);
    return res.json(toScimGroup(g, g.members));
  } catch (e) {
    console.error('getGroupById error', e);
    return scimError(res, 'Failed to fetch group', 500);
  }
}

export async function createGroup(req: Request, res: Response) {
  try {
    const local = fromScimGroup(req.body);

    const brivoPeople = await brivo.createGroup(req, { name: local.displayName });
    const brivoId: string = String(brivoPeople.id ?? brivoPeople.groupId ?? '');

    const saved = await prisma.group.create({
      data: {
        displayName: local.displayName,
        externalId: local.externalId ?? null,
        brivoId: brivoId || null,
      },
      include: { members: true },
    });

    return res.status(201).json(toScimGroup(saved, saved.members));
  } catch (e: any) {
    console.error('createGroup error', e?.response?.data || e);
    return scimError(res, 'Failed to create group', 502);
  }
}

export async function patchGroup(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing) return scimError(res, 'Group not found', 404);

    let displayName: string | undefined;
    if (Array.isArray(req.body?.Operations)) {
      for (const op of req.body.Operations) {
        const path = String(op.path || '').toLowerCase();
        if (path === 'displayname') displayName = op.value;
      }
    } else if (req.body?.displayName) {
      displayName = req.body.displayName;
    }

    if (displayName !== undefined && existing.brivoId) {
      await brivo.updateGroup(req, existing.brivoId, { name: displayName });
    }

    const saved = await prisma.group.update({
      where: { id },
      data: displayName !== undefined ? { displayName } : {},
      include: { members: true },
    });

    return res.json(toScimGroup(saved, saved.members));
  } catch (e: any) {
    console.error('patchGroup error', e?.response?.data || e);
    return scimError(res, 'Failed to update group', 502);
  }
}


export async function deleteGroup(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing) return res.status(204).send();

    if (existing.brivoId) {
      try { await brivo.deleteGroup(req, existing.brivoId); } catch (e) { }
    }

    await prisma.group.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    console.error('deleteGroup error', e);
    return scimError(res, 'Failed to delete group', 500);
  }
}
