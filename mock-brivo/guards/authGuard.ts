import { NextFunction, Response, Request } from "express";
import { isAccessTokenValid } from "../controllers/auth";

export function requireBearer(req: Request, res:Response, next: NextFunction) {
  const auth = (req.header('authorization') || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'missing_bearer' });
  }
  const token = auth.slice(7);
  if (!isAccessTokenValid(token)) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  next();
}