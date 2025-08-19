import { Router } from 'express';
import { getAPIToken } from '../middleware/auth';
import {
  listUsers,
  getUserById,
  createUser,
  patchUser,
  deleteUser,
} from '../controllers/usersController';

export const usersRouter = Router();

usersRouter.use(getAPIToken);

usersRouter.get('/', listUsers);
usersRouter.get('/:id', getUserById);
usersRouter.post('/', createUser);
usersRouter.patch('/:id', patchUser);
usersRouter.delete('/:id', deleteUser);

export default usersRouter;