import { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';
import prisma from '../prisma';

function extractToken(auth: string): string | null {
  if (!auth) return null;
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  if (auth.startsWith('SSWS ')) return auth.slice(5).trim(); 
  if(auth === process.env.API_TOKEN_INTEGRATION) return auth
  return null;
}

export async function getAPIToken(req: Request, res: Response, next: NextFunction) {
  try {
    const configuredToken = process.env.API_TOKEN_INTEGRATION;
    if (!configuredToken) {
      return res.status(500).json({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: 'Server misconfiguration: API_TOKEN is not set',
        status: '500',
      });
    }

    const auth = req.headers.authorization || '';
    const token = extractToken(auth);
    if (!token) {
      return res.status(401).json({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: 'Missing or invalid Authorization header',
        status: '401',
      });
    }

    if (token !== configuredToken) {
      return res.status(401).json({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: 'invalid token',
        status: '401',
      });
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    let client = await prisma.apiClient.findUnique({
      where: { tokenHash },
      select: { clientId: true },
    });

    if (!client) {
      const clientId = randomBytes(12).toString('hex'); 
      client = await prisma.apiClient.create({
        data: {
          clientId,
          tokenHash,
          expiresAt: null,
        },
        select: { clientId: true },
      });
    }
    (req as any).incomingAuthHeader = auth;
    (req as any).clientId = client.clientId;

    return next();
  } catch (err) {
    console.error('getAPIToken error:', err);
    return res.status(500).json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: 'internal server error',
      status: '500',
    });
  }
}
