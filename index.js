import express, { json } from "express";
import cors from "cors";
import dayjs from "dayjs";

import { connectToDatabase, closeDatabaseConnection } from "./dbClient.js";
import { participantSchema, getMessageSchema } from "./schemas.js";

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
    console.error(error);
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
    console.error(error);
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection(dbClient);
  }
});

app.post("/messages", async (req, res) => {
  const newMessage = req.body;

  const { user: from } = req.headers;
  newMessage.from = from;

  let dbClient, database;
  try {
    const databaseConnection = await connectToDatabase();
    dbClient = databaseConnection.dbClient;
    database = databaseConnection.database;

    const participantsCollection = database.collection("participants");

    const participants = await participantsCollection.find().toArray();

    const messageSchema = getMessageSchema(
      participants.map((participant) => participant.name)
    );

    const validation = messageSchema.validate(newMessage);
    if (validation.error) {
      res.sendStatus(422);
      return;
    }

    newMessage.time = dayjs().format("HH:mm:ss");

    const messagesCollection = database.collection("messages");

    await messagesCollection.insertOne(newMessage);

    res.sendStatus(201);
  } catch (error) {
    console.error(error);
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
    console.error(error);
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection(dbClient);
  }
});

app.post("/status", async (req, res) => {
  const { user: username } = req.headers;

  let dbClient, database;
  try {
    const databaseConnection = await connectToDatabase();
    dbClient = databaseConnection.dbClient;
    database = databaseConnection.database;

    const participantsCollection = database.collection("participants");

    const user = await participantsCollection.findOne({ name: username });
    if (!user) {
      res.status(404).send("Você não está cadastrado");
      return;
    }

    user.lastStatus = Date.now();
    await participantsCollection.updateOne({ name: username }, { $set: user });

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection(dbClient);
  }
});

app.listen(5000, () => {
  console.log("Rodando em http://localhost:5000");
});
