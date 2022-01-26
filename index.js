import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const dbClient = new MongoClient(process.env.MONGO_URI);

const app = express();
app.use(cors());
app.use(json());

app.listen(4000, () => {
  console.log("Rodando em http://localhost:4000");
});
