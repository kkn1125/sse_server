import express from "express";
import queryService from "../services/query.service.js";
const queryRouter = express.Router();

const blocklist = new Set();

queryRouter.post("/attach", (req, res, next) => {
  queryService.attach(req, res, next);
});

queryRouter.post("/login", (req, res, next) => {
  queryService.login(req, res, next);
});

queryRouter.post("/logout", (req, res, next) => {
  queryService.logout(req, res, next);
});

queryRouter.post("/locations", (req, res, next) => {
  queryService.updateLocation(req, res, next);
});

queryRouter.get("/sse", (req, res, next) => {
  const data = req.query;
  console.log("data", data);
  if (blocklist.has(data.uuid)) {
    res.status(400).json({
      ok: false,
      message: `you already listening this api.`,
    });
  } else {
    blocklist.add(data.uuid);
    queryService.readLocations(req, res, next);
  }
});

export default queryRouter;
