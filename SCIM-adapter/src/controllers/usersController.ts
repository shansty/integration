import { Request, Response } from 'express';
import prisma from '../prisma';
import { brivo } from '../brivo/client';
import { toScimUser, fromScimUser, toBrivoPerson, fromBrivoPerson } from '../mappers/scimUserMapper';

function scimError(res: Response, detail: string, status = 400) {
  return res.status(status).json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail,
    status: String(status),
  });
}

export async function listUsers(req: Request, res: Response) {
  try {
    const startIndex = Number(req.query.startIndex ?? 1);
    const brivoPeople = await brivo.listPeople(req);
    const prismaUsers = await Promise.all(brivoPeople.map(syncBrivoPerson));

    return res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: prismaUsers.length,
      startIndex,
      itemsPerPage: prismaUsers.length,
      Resources: prismaUsers.map(toScimUser),
    });
  } catch (err) {
    console.error('listUsers error', err);
    return scimError(res, 'Failed to list users', 502);
  }
}

export async function getUserById(req: Request, res: Response) {
  try {
    const brivoPerson = await brivo.getPerson(req, req.params.id);
    if (!brivoPerson) return scimError(res, 'User not found', 404);

    const dbUser = await syncBrivoPerson(brivoPerson);
    return res.json(toScimUser(dbUser));
  } catch (e) {
    console.error('getUserById error', e);
    return scimError(res, 'Failed to fetch user', 500);
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const scimUser = fromScimUser(req.body);
    const brivoPerson = await brivo.createPerson(req, toBrivoPerson(scimUser));
    const brivoId: string = String(brivoPerson.id ?? brivoPerson.brivoId ?? brivoPerson.personId ?? '');

    const dbUser = await prisma.user.create({
      data: {
        userName: scimUser.userName,
        givenName: scimUser.givenName ?? null,
        familyName: scimUser.familyName ?? null,
        active: scimUser.active ?? true,
        externalId: scimUser.externalId ?? null,
        brivoId: brivoId || null,
      },
    });

    return res.status(201).json(toScimUser(dbUser));
  } catch (e: any) {
    console.error('createUser error', e?.response?.data || e);
    return scimError(res, 'Failed to create user', 502);
  }
}

export async function patchUser(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return scimError(res, 'User not found', 404);

    let partial: any = {};
    if (Array.isArray(req.body?.Operations)) {
      for (const op of req.body.Operations) {
        const path = String(op.path || '').toLowerCase();
        const val = op.value;
        if (path === 'active') partial.active = Boolean(val);
        if (path === 'username' || path === 'username') partial.userName = val;
        if (path === 'name.givenname') partial.givenName = val;
        if (path === 'name.familyname') partial.familyName = val;
      }
    } else {
      const incoming = fromScimUser(req.body);
      partial = {
        userName: incoming.userName,
        active: incoming.active,
        givenName: incoming.givenName,
        familyName: incoming.familyName,
      };
    }

    if (existing.brivoId) {
      await brivo.updatePerson(req, existing.brivoId, toBrivoPerson({
        userName: partial.userName ?? existing.userName,
        givenName: partial.givenName ?? existing.givenName,
        familyName: partial.familyName ?? existing.familyName,
        active: partial.active ?? existing.active,
      }));
    }

    const dbUser = await prisma.user.update({
      where: { id },
      data: partial,
    });

    return res.json(toScimUser(dbUser));
  } catch (e: any) {
    console.error('patchUser error', e?.response?.data || e);
    return scimError(res, 'Failed to update user', 502);
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(204).send();

    if (existing.brivoId) {
      try { await brivo.deletePerson(req, existing.brivoId); } catch (e) { }
    }

    await prisma.user.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    console.error('deleteUser error', e);
    return scimError(res, 'Failed to delete user', 500);
  }
}

async function syncBrivoPerson(person: any) {
  return prisma.user.upsert({
    where: { brivoId: String(person.id) },
    update: fromBrivoPerson(person),
    create: fromBrivoPerson(person),
  });
}

