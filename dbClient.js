import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function connectToDatabase() {
  const dbClient = new MongoClient(process.env.MONGO_URI);
  await dbClient.connect();

  const database = dbClient.db("bate-papo");
  return { dbClient, database };
}

function closeDatabaseConnection(dbClient) {
  if (dbClient) {
    dbClient.close();
  }
}

export { connectToDatabase, closeDatabaseConnection };
