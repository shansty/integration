import { Router } from 'express';
import {
  getResourceTypes,
  getSchemas,
  getServiceProviderConfig,
} from '../controllers/scimController';

export const scimRouter = Router();

scimRouter.get('/ServiceProviderConfig', getServiceProviderConfig);
scimRouter.get('/Schemas', getSchemas);
scimRouter.get('/ResourceTypes', getResourceTypes);
