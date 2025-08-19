import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import morgan from 'morgan';
// import { errorHandler } from './middleware/error.js';
import { getAPIToken } from './middleware/auth';
import rootRouter from './routers/rootRouter';


dotenv.config();
const app = express();

app.use(express.json({ type: ['application/json', 'application/scim+json'] }));
app.use(morgan('dev'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/scim/v2', getAPIToken);
app.use('/scim/v2', rootRouter);

// app.use(errorHandler);

app.listen(process.env.PORT, () => {
  console.log(`SCIM adapter running at ${process.env.SCIM_API_URL}`);
});