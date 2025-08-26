import { Router } from 'express';
import { authorize, token } from '../controllers/auth';

const authRouter: Router = Router();
authRouter.get('/authorize', authorize);
authRouter.post('/token', token);
export default authRouter;
