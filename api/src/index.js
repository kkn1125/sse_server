import express from "express";
import queryController from "./controller/query.controller.js";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import SSE from "sse";
import queryService from "./services/query.service.js";

const app = express();

const mode = process.env.NODE_ENV;
const MODE = process.env.MODE;
const __dirname = path.resolve();

if (mode === "development") {
  dotenv.config({
    path: path.join(__dirname, `.env`),
  });
  dotenv.config({
    path: path.join(__dirname, `.env.${mode}.${MODE}`),
  });
}

const host = process.env.HOST;
const port = process.env.PORT;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
