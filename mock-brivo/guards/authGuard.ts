import { NextFunction, Response, Request } from "express";
import { isAccessTokenValid } from "../controllers/auth";

export function requireBearer(req: Request, res: Response, next: NextFunction) {
  const auth = (req.header('authorization') || '').trim();
  if (auth === process.env.API_TOKEN_INTEGRATION) return next();

  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_bearer' });
  }
  const token = auth.slice(7);
  if (!isAccessTokenValid(token) || token !== process.env.API_TOKEN_INTEGRATION) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  next();
}