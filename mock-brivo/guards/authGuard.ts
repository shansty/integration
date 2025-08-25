import { NextFunction, Response, Request } from "express";
import { isAccessTokenValid } from "../controllers/auth";

export function requireBearer(req: Request, res:Response, next: NextFunction) {
  const auth = (req.header('authorization') || '').trim();
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_bearer' });
  }

  const token = auth.slice(7).trim();

  // A token is valid if it's the static one OR it's a dynamic one.
  const isStaticToken = (token === process.env.API_TOKEN_INTEGRATION);
  const isDynamicToken = isAccessTokenValid(token);

  if (isStaticToken || isDynamicToken) {
    return next();
  }

  // If we reach here, the token is invalid.
  return res.status(401).json({ error: 'invalid_token' });
}