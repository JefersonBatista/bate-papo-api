import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

function isEmptyString(str) {
  return !Boolean(str.trim());
}

const dbClient = new MongoClient(process.env.MONGO_URI);

const app = express();
app.use(cors());
app.use(json());

app.post("/participants", async (req, res) => {
  const newParticipant = req.body;
  const { name } = newParticipant;
  newParticipant.lastStatus = Date.now();

  if (!name || isEmptyString(name)) {
    res.status(422).send("Insira um nome não vazio!");
    return;
  }

  try {
    await dbClient.connect();

    const batePapoDatabase = dbClient.db("bate-papo");

    const participantsCollection = batePapoDatabase.collection("participants");

    const participants = await participantsCollection.find().toArray();

    if (participants.find((participant) => participant.name === name)) {
      res.status(409).send("Esse nome de usuário já está sendo usado");
      return;
    }

    await participantsCollection.insertOne(newParticipant);

    const messagesCollection = batePapoDatabase.collection("messages");

    await messagesCollection.insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (_) {
    res.status(500).send("Houve um erro interno no servidor");
  }
});

app.get("/participants", async (req, res) => {
  try {
    await dbClient.connect();

    const batePapoDatabase = dbClient.db("bate-papo");

    const participantsCollection = batePapoDatabase.collection("participants");

    const participants = await participantsCollection.find().toArray();

    res.status(200).send(participants.map((participant) => participant.name));
  } catch (_) {
    res.status(500).send("Houve um erro interno no servidor");
  }
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
