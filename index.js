import express, { json } from "express";
import cors from "cors";
import dayjs from "dayjs";

import { connectToDatabase, closeDatabaseConnection } from "./dbClient.js";
import { participantSchema } from "./schemas.js";

function isEmptyString(str) {
  return !str.trim();
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

const app = express();
app.use(cors());
app.use(json());

app.post("/participants", async (req, res) => {
  const newParticipant = req.body;
  const { name } = newParticipant;

  const validation = participantSchema.validate(newParticipant);
  if (validation.error) {
    res.status(422).send("Insira um nome não vazio!");
    return;
  }

  newParticipant.lastStatus = Date.now();

  let dbClient, database;
  try {
    const databaseConnection = await connectToDatabase();
    dbClient = databaseConnection.dbClient;
    database = databaseConnection.database;

    const participantsCollection = database.collection("participants");

    const participants = await participantsCollection.find().toArray();

    if (participants.find((participant) => participant.name === name)) {
      res.status(409).send("Esse nome de usuário já está sendo usado");
      return;
    }

    await participantsCollection.insertOne(newParticipant);

    const messagesCollection = database.collection("messages");

    await messagesCollection.insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection(dbClient);
  }
});

app.get("/participants", async (req, res) => {
  let dbClient, database;
  try {
    const databaseConnection = await connectToDatabase();
    dbClient = databaseConnection.dbClient;
    database = databaseConnection.database;

    const participantsCollection = database.collection("participants");

    const participants = await participantsCollection.find().toArray();

    res.status(200).send(participants);
  } catch (error) {
    console.log(error);
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection(dbClient);
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

  let dbClient, database;
  try {
    const databaseConnection = await connectToDatabase();
    dbClient = databaseConnection.dbClient;
    database = databaseConnection.database;

    const participantsCollection = database.collection("participants");

    const participants = await participantsCollection.find().toArray();

    if (!participants.find((participant) => participant.name === from)) {
      res.status(422).send("Você não está participando do chat!");
      return;
    }

    const messagesCollection = database.collection("messages");

    await messagesCollection.insertOne(newMessage);

    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection(dbClient);
  }
});

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  const limit = parseInt(req.query.limit);

  let dbClient, database;
  try {
    const databaseConnection = await connectToDatabase();
    dbClient = databaseConnection.dbClient;
    database = databaseConnection.database;

    const messagesCollection = database.collection("messages");

    const messages = await messagesCollection.find().toArray();

    const filteredMessages = messages.filter((message) =>
      hasAccessToMessage(user, message)
    );

    const lastMessages =
      limit && limit > 0
        ? filteredMessages.slice(-parseInt(limit))
        : filteredMessages;

    res.status(200).send(lastMessages);
  } catch (error) {
    console.log(error);
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection(dbClient);
  }
});

app.post("/status", (req, res) => {
  res.send("Mock route to POST /status");
});

app.listen(5000, () => {
  console.log("Rodando em http://localhost:5000");
});
