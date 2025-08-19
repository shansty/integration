import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import jsonServer from 'json-server';
import { requireBearer } from './guards/authGuard';
import rootRouter from './routers/rootRouter';


dotenv.config();
const app = express();
const brivoApi = jsonServer.create();
const brivoRouter = jsonServer.router('db.json'); 

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
brivoApi.use(bodyParser.json());
brivoApi.use(bodyParser.urlencoded({ extended: true }));

app.use('/', rootRouter);

brivoApi.use(requireBearer);
brivoApi.use(jsonServer.defaults());
brivoApi.use(brivoRouter);
app.use('/', brivoApi);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));


app.listen(process.env.PORT, () => {
  console.log(`Mock Brivo API running at ${process.env.BRIVO_API_URL}`);
});