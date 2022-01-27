import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

function isEmptyString(str) {
  return !Boolean(str.trim());
}

function isValidMessageType(type) {
  return type === "message" || type === "private_message";
}

function hasAccessToMessage(user, message) {
  const { type, from, to } = message;

  return (
    type === "status" || type === "message" || from === user || to === user
  );
}

const dbClient = new MongoClient(process.env.MONGO_URI);

function closeDatabaseConnection() {
  if (dbClient) {
    dbClient.close();
  }
}

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
  } finally {
    closeDatabaseConnection();
  }
});

app.get("/participants", async (req, res) => {
  try {
    await dbClient.connect();

    const batePapoDatabase = dbClient.db("bate-papo");

    const participantsCollection = batePapoDatabase.collection("participants");

    const participants = await participantsCollection.find().toArray();

    res.status(200).send(participants);
  } catch (_) {
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection();
  }
});

app.post("/messages", async (req, res) => {
  const newMessage = req.body;
  const { to, text, type } = newMessage;

  const { user: from } = req.headers;
  newMessage.from = from;
  newMessage.time = dayjs().format("HH:mm:ss");

  if (!to || isEmptyString(to)) {
    res.status(422).send("Insira um destinatário não vazio!");
    return;
  }

  if (!text || isEmptyString(text)) {
    res.status(422).send("Insira uma mensagem não vazia!");
    return;
  }

  if (!type || !isValidMessageType(type)) {
    res.status(422).send("O tipo de mensagem deve ser válido");
    return;
  }

  try {
    await dbClient.connect();

    const batePapoDatabase = dbClient.db("bate-papo");

    const participantsCollection = batePapoDatabase.collection("participants");

    const participants = await participantsCollection.find().toArray();

    if (!participants.find((participant) => participant.name === from)) {
      res.status(422).send("Você não está participando do chat!");
      return;
    }

    const messagesCollection = batePapoDatabase.collection("messages");

    await messagesCollection.insertOne(newMessage);

    res.sendStatus(201);
  } catch (_) {
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection();
  }
});

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  const limit = parseInt(req.query.limit);

  try {
    await dbClient.connect();

    const batePapoDatabase = dbClient.db("bate-papo");

    const messagesCollection = batePapoDatabase.collection("messages");

    const messages = await messagesCollection.find().toArray();

    const filteredMessages = messages.filter((message) =>
      hasAccessToMessage(user, message)
    );

    const lastMessages =
      limit && limit > 0
        ? filteredMessages.slice(-parseInt(limit))
        : filteredMessages;

    res.status(200).send(lastMessages);
  } catch (_) {
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection();
  }
});

app.post("/status", (req, res) => {
  res.send("Mock route to POST /status");
});

app.listen(5000, () => {
  console.log("Rodando em http://localhost:5000");
});
