import { Router } from 'express';
import { getAPIToken } from '../middleware/auth';
import {
  listGroups,
  getGroupById,
  createGroup,
  patchGroup,
  deleteGroup,
} from '../controllers/groupsController';

export const groupsRouter = Router();

groupsRouter.use(getAPIToken);

groupsRouter.get('/', listGroups);
groupsRouter.get('/:id', getGroupById);
groupsRouter.post('/', createGroup);
groupsRouter.patch('/:id', patchGroup);
groupsRouter.delete('/:id', deleteGroup);

export default groupsRouter;
