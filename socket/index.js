/* A quite detailed WebSockets upgrade example "async" */
const dotenv = require("dotenv");
const path = require("path");
const protobufjs = require("protobufjs");
const zmq = require("zeromq");
const Queue = require("./src/models/Queue");
const axios = require("axios");
const uWs = require("uWebSockets.js");
const pm2 = require("pm2");
const {
  getUser,
  getSpace,
  getChannel,
  getLocale,
  getSocket,
  getPulisher,
  getConnection,
  getAllocation,
  queryService,
} = require("./src/services/query.service");
const { dev } = require("./src/utils/tools");

const locationQueue = new Queue();
const { Message, Field } = protobufjs;

Field.d(1, "float", "required")(Message.prototype, "id");
Field.d(2, "float", "required")(Message.prototype, "pox");
Field.d(3, "float", "required")(Message.prototype, "poy");
Field.d(4, "float", "required")(Message.prototype, "poz");
Field.d(5, "float", "required")(Message.prototype, "roy");

/**
 * @typedef {Object}
 */
const relay = {};
const mode = process.env.NODE_ENV;
const MODE = process.env.MODE;
const dirname = path.resolve();
dotenv.config({
  path: path.join(dirname, ".env"),
});
dotenv.config({
  path: path.join(dirname, `.env.${mode}.${MODE}`),
});

const API_HOST = process.env.API_HOST;
const API_PORT = process.env.API_PORT;
const SERVER_HOST = process.env.SERVER_HOST;
const SERVER_PORT = Number(process.env.SERVER_PORT);
const PORT_GAP = Number(process.env.PORT_GAP);
const userSockets = new Set();

let sendFlag = false;
const port = Number(process.env.PORT);
let sended = null;
const app = uWs
  .App()
  .ws("/*", {
    /* Options */
    compression: uWs.SHARED_COMPRESSOR,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 64,
    /* Handlers */
    upgrade: (res, req, context) => {
      /* Keep track of abortions */
      const upgradeAborted = { aborted: false };
      console.log(
        "An Http connection wants to become WebSocket, URL: " +
          req.getUrl() +
          "!"
      );

      const url = req.getUrl();
      const secWebSocketKey = req.getHeader("sec-websocket-key");
      const secWebSocketProtocol = req.getHeader("sec-websocket-protocol");
      const secWebSocketExtensions = req.getHeader("sec-websocket-extensions");

      const q = req.getQuery("q");
      const json = {};
      try {
        Object.assign(json, JSON.parse(decodeURI(q)));
      } catch (e) {
        dev.alias("getQuery Error").log(e);
      }
      async function asyncUpgrade() {
        try {
          const [user] = await getUser(json.uuid);
          const userPk = user[0].pk;
          const [space] = await getSpace(userPk);
          const [channel] = await getChannel(userPk);
          const [locale] = await getLocale(userPk);
          const [socket] = await getSocket(userPk);
          const [pulisher] = await getPulisher(userPk);
          const [connection] = await getConnection(userPk);
          const [allocation] = await getAllocation(userPk);
          dev.alias("User informations").log(user);

          if (upgradeAborted.aborted) {
            console.log(
              "Ouch! Client disconnected before we could upgrade it!"
            );
            /* You must not upgrade now */
            return;
          }
          res.upgrade(
            {
              url,
              // db user info
              user: user[0],
              space: space[0],
              channel: channel[0],
              locale: locale[0],
              socket: socket[0],
              publisher: pulisher[0],
              connection: connection[0],
              allocation: allocation[0],
            },
            /* Spell these correctly */
            secWebSocketKey,
            secWebSocketProtocol,
            secWebSocketExtensions,
            context
          );
        } catch (e) {
          dev.alias("Upgrade error").log(e.message);
        }
      }
      asyncUpgrade();

      res.onAborted(() => {
        /* We can simply signal that we were aborted */
        upgradeAborted.aborted = true;
      });
      /* This immediately calls open handler, you must not use res after this call */
    },
    open: (ws) => {
      console.log("A WebSocket connected with URL: " + ws.url);
      ws.subscribe("broadcast");
      ws.subscribe(`${ws.space.pk}-${ws.channel.pk}`);
      userSockets.add(ws);
    },
    message: async (ws, message, isBinary) => {
      /* Ok is false if backpressure was built up, wait for drain */
      // console.log(ws.user.pk);
      if (isBinary) {
        const json = Message.decode(new Uint8Array(message)).toJSON();
        Object.assign(json, {
          channel: ws.channel.pk,
          space: ws.space.pk,
        });
        queryService.updateLocation(json);
        locationQueue.enter(message);
      } else {
        const decode = new TextDecoder().decode(message);
        const { type, ...user } = JSON.parse(decode);
        if (type === "login") {
          axios
            .post(`http://${API_HOST}:${API_PORT}/query/login`, user)
            .then(({ data }) => {
              // app.publish(
              //   `${ws.space.pk}-${ws.channel.pk}`,
              //   JSON.stringify(data.players)
              // );
              sendMessage(0);
            });
        }
      }
    },
    drain: (ws) => {
      console.log("WebSocket backpressure: " + ws.getBufferedAmount());
    },
    close: (ws, code, message) => {
      console.log("WebSocket closed");
      queryService.logout(ws.user.pk, ws.space.pk, ws.channel.pk);
      sendMessage(ws.user.pk);
      userSockets.delete(ws);
    },
  })
  .listen(port, (token) => {
    if (token) {
      console.log("Listening to port " + port);
    } else {
      console.log("Failed to listen to port " + port);
    }
  });

setInterval(() => {
  if (locationQueue.count > 0) {
    sendMessage(locationQueue.get());
  }
}, 2);

async function sendMessage(message) {
  if (!sendFlag) {
    sendFlag = true;
    relay.client.send(message);
    await relay.client.receive();
    sendFlag = false;
  }
}

async function startClient() {
  relay.client = new zmq.Request();
  relay.client.connect(`tcp://${SERVER_HOST}:${SERVER_PORT}`);
  console.log("relay client listening on port", SERVER_PORT);
  relay.puller = new zmq.Pull();
  relay.puller.connect(`tcp://${SERVER_HOST}:${SERVER_PORT + PORT_GAP}`);
  console.log("relay puller listening on port", SERVER_PORT + PORT_GAP);

  for await (const [msg] of relay.puller) {
    // for (let socket of userSockets.values()) {
    const decode = new TextDecoder().decode(msg);
    // console.log("puller", decode);
    sendBroadCast(msg);
    // if (isNaN(decode)) {
    //   app.publish(`${socket.space.pk}-${socket.channel.pk}`, msg, true, true);
    // } else {
    //   app.publish(`${socket.space.pk}-${socket.channel.pk}`, msg);
    // }
    // }
  }
}
startClient();

pm2.launchBus((err, bus) => {
  if (err) {
    console.log("launch bus error", err);
  }
  bus.on("process:msg", (packet) => {
    // console.log("packet", packet);
    for (let socket of userSockets.values()) {
      const decode = new TextDecoder().decode(new Uint8Array(packet.data.data));
      // console.log("parsed!!!", decode);
      if (isNaN(decode)) {
        if (decode.startsWith("[")) {
          const json = JSON.parse(decode);
          // console.log(json instanceof Array);
          if (json instanceof Array) {
            app.publish(`${socket.space.pk}-${socket.channel.pk}`, decode);
          }
        } else {
          app.publish(
            `${socket.space.pk}-${socket.channel.pk}`,
            new Uint8Array(packet.data.data),
            true,
            true
          );
        }
      } else {
        console.log(packet.data.data);
        app.publish(
          `${socket.space.pk}-${socket.channel.pk}`,
          packet.data.data[0] === 48 ? "0" : String(packet.data.data[0])
        );
      }
      // if (packet.data.type === "Buffer") {
      //   app.publish(
      //     `${socket.space.pk}-${socket.channel.pk}`,
      //     new Uint8Array(packet.data.data, 0),
      //     true,
      //     true
      //   );
      // } else {
      //   const decode = new TextDecoder().decode(packet.data.data);
      //   console.log(decode);
      //   app.publish(
      //     `${socket.space.pk}-${socket.channel.pk}`,
      //     packet.data.data
      //   );
      // }
    }
    // if (isNaN(decode)) {
    //   app.publish(`${socket.space.pk}-${socket.channel.pk}`, msg, true, true);
    // } else {
    //   app.publish(`${socket.space.pk}-${socket.channel.pk}`, msg);
    // }
  });
});
function sendBroadCast(data) {
  process.send({
    type: "process:msg",
    data: data,
  });
}
