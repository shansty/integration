import { Request, Response } from 'express';

export const getServiceProviderConfig = (req: Request, res: Response) => {
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    patch: { supported: true },
    bulk: { supported: false },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: true },
    etag: { supported: false },
    authenticationSchemes: [
      { type: 'httpbasic', name: 'Basic', primary: true },
      { type: 'oauthbearertoken', name: 'Bearer' },
    ],
  });
};

export const getSchemas = (req: Request, res: Response) => {
  res.json({
    Resources: [
      { id: 'urn:ietf:params:scim:schemas:core:2.0:User' },
      { id: 'urn:ietf:params:scim:schemas:core:2.0:Group' },
    ],
    totalResults: 2,
    startIndex: 1,
    itemsPerPage: 2,
  });
};

export const getResourceTypes = (req: Request, res: Response) => {
  res.json({
    Resources: [
      { name: 'User', endpoint: '/Users', schema: 'urn:ietf:params:scim:schemas:core:2.0:User' },
      { name: 'Group', endpoint: '/Groups', schema: 'urn:ietf:params:scim:schemas:core:2.0:Group' },
    ],
    totalResults: 2,
    startIndex: 1,
    itemsPerPage: 2,
  });
};
