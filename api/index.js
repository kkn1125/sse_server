import express from "express";
import queryController from "./src/controller/query.controller.js";

import cors from "cors";
import { port } from "./src/utils/tools.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  console.log(`[LOG/${req.method}] ${req.url}`);
  next();
});
app.use("/query", queryController);

const server = app.listen(port, () => {
  console.log("server listening on port" + port);
});
