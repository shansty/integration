import express from 'express';
import dotenv from 'dotenv';
import path from "node:path";
import bodyParser from 'body-parser';
import jsonServer from 'json-server';
import { requireBearer } from './guards/authGuard';
import rootRouter from './routers/rootRouter';

dotenv.config();
const app = express();
const brivoApi = jsonServer.create();
// const dbPath = path.join(__dirname, "..", "data", "db.json");
const dbPath = path.resolve(process.cwd(), "data", "db.json");
const brivoRouter = jsonServer.router(dbPath);

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
