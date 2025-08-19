import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    detail: err.message || 'Internal Server Error',
    status: String(status)
  });
}