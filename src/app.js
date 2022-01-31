import express, { json } from "express";
import cors from "cors";
import dayjs from "dayjs";

import {
  connectToDatabase,
  closeDatabaseConnection,
  getObjectId,
} from "./dbClient.js";
import { participantSchema, getMessageSchema } from "./schemas.js";
import { hasAccessToMessage, removeInactiveUsers } from "./utils.js";

setInterval(removeInactiveUsers, 15000);

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
  const { user } = req.headers;

  let dbClient, database;
  try {
    const databaseConnection = await connectToDatabase();
    dbClient = databaseConnection.dbClient;
    database = databaseConnection.database;

    const participantsCollection = database.collection("participants");

    const participant = await participantsCollection.findOne({ name: user });
    if (!participant) {
      res.status(404).send("Você não está cadastrado");
      return;
    }

    await participantsCollection.updateOne(
      { name: user },
      { $set: { lastStatus: Date.now() } }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection(dbClient);
  }
});

app.put("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const { user } = req.headers;

  const editedMessage = req.body;
  editedMessage.from = user;

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

    const validation = messageSchema.validate(editedMessage);
    if (validation.error) {
      res.sendStatus(422);
      return;
    }

    const messagesCollection = database.collection("messages");

    const message = await messagesCollection.findOne({ _id: getObjectId(id) });

    if (!message) {
      res.status(404).send("O identificador da mensagem é inválido");
      return;
    }

    if (message.from !== user) {
      res
        .status(401)
        .send("Você não tem autorização para deletar essa mensagem!");
      return;
    }

    editedMessage.time = dayjs().format("HH:mm:ss");

    await messagesCollection.updateOne(
      { _id: message._id },
      { $set: editedMessage }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Houve um erro interno no servidor");
  } finally {
    closeDatabaseConnection(dbClient);
  }
});

app.delete("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const { user } = req.headers;

  let dbClient, database;
  try {
    const databaseConnection = await connectToDatabase();
    dbClient = databaseConnection.dbClient;
    database = databaseConnection.database;

    const messagesCollection = database.collection("messages");

    const message = await messagesCollection.findOne({ _id: getObjectId(id) });

    if (!message) {
      res.status(404).send("O identificador da mensagem é inválido");
      return;
    }

    if (message.from !== user) {
      res
        .status(401)
        .send("Você não tem autorização para deletar essa mensagem!");
      return;
    }

    await messagesCollection.deleteOne({ _id: message._id });

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
