import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const dbClient = new MongoClient(process.env.MONGO_URI);

const app = express();
app.use(cors());
app.use(json());

app.post("/participants", (req, res) => {
  res.send("Mock route to POST /participants");
});

app.get("/participants", (req, res) => {
  res.send("Mock route to GET /participants");
});

app.post("/messages", (req, res) => {
  res.send("Mock route to POST /messages");
});

app.get("/messages", (req, res) => {
  res.send("Mock route to GET /messages");
});

app.post("/status", (req, res) => {
  res.send("Mock route to POST /status");
});

app.listen(4000, () => {
  console.log("Rodando em http://localhost:4000");
});
