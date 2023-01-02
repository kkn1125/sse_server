/* A quite detailed WebSockets upgrade example "async" */
const dotenv = require("dotenv");
const path = require("path");
const protobufjs = require("protobufjs");
const { Message, Field } = protobufjs;

Field.d(1, "float", "required")(Message.prototype, "id");
Field.d(2, "float", "required")(Message.prototype, "pox");
Field.d(3, "float", "required")(Message.prototype, "poy");
Field.d(4, "float", "required")(Message.prototype, "poz");
Field.d(5, "float", "required")(Message.prototype, "roy");

const mode = process.env.NODE_ENV;
const MODE = process.env.MODE;
const dirname = path.resolve();
dotenv.config({
  path: path.join(dirname, ".env"),
});
dotenv.config({
  path: path.join(dirname, `.env.${mode}.${MODE}`),
});

const uWs = require("uWebSockets.js");
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
} = require("./services/query.service");
const { dev } = require("./utils/tools");
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
      ws.subscribe(`${ws.space.pk}-${ws.channel.pk}`);
      sended = true;
      // setInterval(async () => {
        // try {
        //   const locations = await queryService.readLocations({
        //     uuid: ws.user.uuid,
        //   });
        //   if (sended !== locations) {
        //     // console.log(locations);
        //     app.publish(
        //       `${ws.space.pk}-${ws.channel.pk}`,
        //       JSON.stringify(locations)
        //     );
        //     sended = locations;
        //   }
        // } catch (e) {}
      // }, 16);
    },
    message: (ws, message, isBinary) => {
      /* Ok is false if backpressure was built up, wait for drain */
      if (isBinary) {
        console.log(message);
        const json = Message.decode(new Uint8Array(message)).toJSON();
        console.log(json);
        Object.assign(json, {
          channel: ws.channel.pk,
          space: ws.space.pk,
        });
        queryService.updateLocation(json).then(() => {
          sended = true;
        });
      }
    },
    drain: (ws) => {
      console.log("WebSocket backpressure: " + ws.getBufferedAmount());
    },
    close: (ws, code, message) => {
      console.log("WebSocket closed");
      queryService.logout(ws.user.pk);
    },
  })
  .any("/*", (res, req) => {
    res.end("Nothing to see here!");
  })
  .listen(port, (token) => {
    if (token) {
      console.log("Listening to port " + port);
    } else {
      console.log("Failed to listen to port " + port);
    }
  });
