import { Request, Response } from 'express';
import prisma from '../prisma';
import { brivo } from '../brivo/client';
import { toScimUser, fromScimUser, toBrivoPerson, fromBrivoPerson, parseEqFilter } from '../mappers/scimUserMapper';
import { connect } from 'http2';
import { configDotenv } from 'dotenv';

function scimError(res: Response, detail: string, status = 400) {
  return res.status(status).json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail,
    status: String(status),
  });
}

function baseUrl(req: Request) {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  return `${proto}://${host}/scim/v2`;
}

export async function listUsers(req: Request, res: Response) {
  try {
    const filterString = req.query.filter as string | undefined;
    const parsedFilter = parseEqFilter(filterString);

    if (parsedFilter) {
      let user = null;
      if (parsedFilter.attribute === 'userName') {
        user = await prisma.user.findUnique({
          where: { userName: parsedFilter.value },
        });
      } else if (parsedFilter.attribute === 'externalId') {
        user = await prisma.user.findFirst({
          where: { externalId: parsedFilter.value },
        });
      }
      if (!user) {
        return res.json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
          totalResults: 0,
          startIndex: 1,
          itemsPerPage: 0,
          Resources: [],
        });
      }
      return res.json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: 1,
        startIndex: 1,
        itemsPerPage: 1,
        Resources: [toScimUser(user)],
      });
    }

    const startIndex = Number(req.query.startIndex ?? 1);
    const count = Number(req.query.count ?? 100);

    const users = await prisma.user.findMany({
      skip: startIndex - 1,
      take: count,
    });

    return res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: users.length,
      startIndex,
      itemsPerPage: users.length,
      Resources: users.map(toScimUser),
    });
  } catch (err) {
    console.error('listUsers error', err);
    return scimError(res, 'Failed to list users', 502);
  }
}


export async function getUserById(req: Request, res: Response) {
  try {
    const scimId = req.params.id;

    const existing = await prisma.user.findUnique({ where: { id: scimId } });
    if (!existing) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }

    if (existing.brivoId) {
      try {
        const person = await brivo.getPerson(req, existing.brivoId);
        await prisma.user.update({
          where: { id: scimId },
          data: {
            userName: person.email,
            givenName: person.firstName ?? null,
            familyName: person.lastName ?? null,
            active: person.status === 'active',
          },
        });
      } catch (e) {
        console.warn('Brivo sync skipped for', existing.brivoId);
      }
    }

    const fresh = await prisma.user.findUnique({ where: { id: scimId } });
    return res.json(toScimUser(fresh!));
  } catch (e) {
    console.error('getUserById error', e);
    return res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Failed to fetch user',
      status: '500',
    });
  }
}


export async function createUser(req: Request, res: Response) {
  try {
    console.dir("req.body", req.body)
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
    res.setHeader('Location', `${baseUrl(req)}/Users/${encodeURIComponent(dbUser.id)}`);
    return res.status(201).json(toScimUser(dbUser));
  } catch (e: any) {
    console.error('createUser error', e?.response?.data || e);
    return scimError(res, 'Failed to create user', 502);
  }
}
const toBoolean = (v: any): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return false;
};

export async function patchUser(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return scimError(res, 'User not found', 404);

    const partial: any = {};

    if (Array.isArray(req.body?.Operations)) {
      // SCIM PatchOp
      for (const op of req.body.Operations) {
        const path = String(op.path || '').toLowerCase();
        const val = op.value;

        if (path === 'active') partial.active = toBoolean(val);
        if (path === 'username') partial.userName = val;
        if (path === 'name.givenname') partial.givenName = val ?? null;
        if (path === 'name.familyname') partial.familyName = val ?? null;

        // (Optional) whole-object replace when no path is provided:
        if (!path && val && typeof val === 'object') {
          if ('active' in val) partial.active = toBoolean(val.active);
          if ('userName' in val) partial.userName = val.userName;
          if (val.name && typeof val.name === 'object') {
            if ('givenName' in val.name) partial.givenName = val.name.givenName ?? null;
            if ('familyName' in val.name) partial.familyName = val.name.familyName ?? null;
          }
        }
      }
    } else {
      // Plain partial body (e.g., { "active": false })
      if ('userName' in req.body) {
        partial.userName = req.body.userName;
      }
      if ('active' in req.body) {
        partial.active = toBoolean(req.body.active);
      }
      if (req.body.name && typeof req.body.name === 'object') {
        if ('givenName' in req.body.name) {
          partial.givenName = req.body.name.givenName;
        }
        if ('familyName' in req.body.name) {
          partial.familyName = req.body.name.familyName;
        }
      }
    }

    // Sync external system (keep your logic)
    if (existing.brivoId) {
      await brivo.updatePerson(req, existing.brivoId, toBrivoPerson({
        userName: partial.userName ?? existing.userName,
        givenName: partial.givenName ?? existing.givenName,
        familyName: partial.familyName ?? existing.familyName,
        active: (typeof partial.active === 'boolean' ? partial.active : existing.active),
      }));
    }

    const updated = await prisma.user.update({
      where: { id },
      data: partial,
    });

    return res.json(toScimUser(updated));
  } catch (e: any) {
    console.error('patchUser error', e?.response?.data || e);
    return scimError(res, 'Failed to update user', 502);
  }
}


export async function putUser(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return scimError(res, 'User not found', 404);

    const incoming = fromScimUser(req.body);

    const dbUser = await prisma.user.update({
      where: { id },
      data: {
        userName: incoming.userName,
        givenName: incoming.givenName ?? null,
        familyName: incoming.familyName ?? null,
        active: incoming.active ?? true,
        externalId: incoming.externalId ?? null,
      },
    });

    if (existing.brivoId) {
      await brivo.updatePerson(req, existing.brivoId, toBrivoPerson({
        userName: dbUser.userName,
        givenName: dbUser.givenName ?? undefined,
        familyName: dbUser.familyName ?? undefined,
        active: dbUser.active,
      }));
    }

    res.setHeader('Location', `${baseUrl(req)}/Users/${encodeURIComponent(id)}`);
    return res.status(200).json(toScimUser(dbUser));
  } catch (e: any) {
    console.error('putUser error', e?.response?.data || e);
    return scimError(res, 'Failed to replace user', 502);
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

