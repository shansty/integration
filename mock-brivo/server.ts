import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import jsonServer from 'json-server';
import { requireBearer } from './guards/authGuard';
import rootRouter from './routers/rootRouter';


dotenv.config();
const app = express();
const api = jsonServer.create();
const router = jsonServer.router('db.json');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
api.use(bodyParser.json());
api.use(bodyParser.urlencoded({ extended: true }));


api.use((req, res, next) => {
  if (req.header('api-key') !== process.env.API_KEY) {
    return res.status(401).json({ error: 'invalid_api_key' });
  }
  next();
}, requireBearer);

api.use(router);
app.use('/api', api);
app.use('/', rootRouter);

app.listen(process.env.PORT, () => {
  console.log(`Mock Brivo API running at http://localhost:${process.env.PORT}`);
});