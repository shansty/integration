import { Router } from 'express';
import { scimRouter } from './scimRouter';
import usersRouter from './usersRouter';
import groupsRouter from './groupsRouter';
export const rootRouter: Router = Router();

rootRouter.use('/', scimRouter);
rootRouter.use('/Users', usersRouter);
rootRouter.use('/Groups', groupsRouter);

export default rootRouter;
