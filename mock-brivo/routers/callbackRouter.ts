import { Router } from 'express';
import { redirect } from '../controllers/auth';

const callbackRouter: Router = Router();
callbackRouter.get('/dev/callback', redirect);
export default callbackRouter;