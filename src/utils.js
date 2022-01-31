import dayjs from "dayjs";
import { stripHtml } from "string-strip-html";

import { connectToDatabase, closeDatabaseConnection } from "./dbClient.js";

function hasAccessToMessage(user, message) {
  const { type, from, to } = message;

  return (
    type === "status" || type === "message" || from === user || to === user
  );
}

async function removeInactiveUsers() {
  let dbClient, database;
  try {
    const databaseConnection = await connectToDatabase();
    dbClient = databaseConnection.dbClient;
    database = databaseConnection.database;

    const participantsCollection = database.collection("participants");

    const inactiveUsers = await participantsCollection
      .find({
        lastStatus: { $lt: Date.now() - 10000 },
      })
      .toArray();

    const messagesCollection = database.collection("messages");

    for (let i = 0; i < inactiveUsers.length; i++) {
      const user = inactiveUsers[i];

      await participantsCollection.deleteOne({ _id: user._id });

      await messagesCollection.insertOne({
        from: user.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      });
    }
  } catch (error) {
    console.error(error);
  } finally {
    closeDatabaseConnection(dbClient);
  }
}

function sanitizeText(text) {
  return stripHtml(text.trim()).result;
}

export { hasAccessToMessage, removeInactiveUsers, sanitizeText };
