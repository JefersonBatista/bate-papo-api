import express, { json } from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(json());

app.listen(4000, () => {
  console.log("Rodando em http://localhost:4000");
});
