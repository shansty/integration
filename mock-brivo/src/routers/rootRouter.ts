import { Router } from 'express';
import authRouter from './auth';
import callbackRouter from './callbackRouter';

const rootRouter: Router = Router();

rootRouter.use('/oauth', authRouter);
rootRouter.use('/', callbackRouter);

export default rootRouter;
