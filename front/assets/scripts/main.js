import axios from "axios";
import protobufjs from "protobufjs";
import { dev } from "../../src/utils/tools";

/** @type {HTMLCanvasElement} */
const app = document.querySelector("#app");
/** @type {CanvasRenderingContext2D} */
const ctx = app.getContext("2d");

const { Message, Field } = protobufjs;

Field.d(1, "float", "required")(Message.prototype, "id");
Field.d(2, "float", "required")(Message.prototype, "pox");
Field.d(3, "float", "required")(Message.prototype, "poy");
Field.d(4, "float", "required")(Message.prototype, "poz");
Field.d(5, "float", "required")(Message.prototype, "roy");

const host = import.meta.env.VITE_API_HOST;
const port = import.meta.env.VITE_API_PORT;
const attachUserData = {};
const packetLength = 25;
const sockets = new Map();
const SPEED = 5;
const direction = {
  w: false,
  s: false,
  a: false,
  d: false,
};
app.width = innerWidth;
app.height = innerHeight;

const users = new Map();
// for (let i = 0; i < 50; i++) {
//   users.set(i, {
//     nickname: "123",
//     pox: 1,
//     poy: 1,
//     poz: 0,
//     roy: 1,
//   });
// }
const size = 30;
const userDataMap = {};

function attachUser() {
  axios
    .post(`/query/attach`, {
      locale: navigator.language,
    })
    .then((result) => {
      const { data } = result;
      Object.assign(userDataMap, data);
      sockets.set(data.user.uuid, connectSocket(userDataMap));
    });
}

function connectSocket(connectionData) {
  const {
    locale,
    socket,
    publisher,
    connection,
    space,
    channel,
    allocation,
    user,
  } = connectionData;
  const q = encodeURI(
    JSON.stringify({
      uuid: connectionData.user.uuid,
    }).trim()
  );
  const ws = new WebSocket(`ws://localhost:${socket.port}/?q=${q}`);
  ws.binaryType = "arraybuffer";
  ws.onopen = (e) => {
    dev.alias("Socket").log("open");
  };
  ws.onmessage = (message) => {
    const { data } = message;
    if (data instanceof ArrayBuffer) {
      for (let i = 0; i < Math.round(data.byteLength / packetLength); i++) {
        try {
          const json = Message.decode(
            new Uint8Array(data.slice(i * packetLength, (i + 1) * packetLength))
          ).toJSON();
          users.set(json.id, Object.assign(users.get(json.id) || {}, json));
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      const json = JSON.parse(data);
      // console.log(json);
      if (json instanceof Array) {
        // console.log("받음", json);
        for (let u of json) {
          // if (users.has(u.id)) continue;
          users.set(u.id, Object.assign(users.get(u.id) || {}, u));
        }
        // console.log(users)
      } else if (json.type === "login") {
        for (let u of json.players) {
          if (users.has(u.id)) continue;
          users.set(u.id, Object.assign(users.get(u.id) || {}, u));
        }
      } else if (json.type === "logout") {
        console.log("logout", json);
        for (let u of users.values()) {
          users.delete(u.id);
        }
        for (let u of json.players) {
          users.set(u.id, u);
        }
      }
    }
  };
  ws.onerror = (e) => {
    dev.alias("Socket").log("error");
    try {
      throw e;
    } catch (e) {
      dev.alias("Socket Error Message").log(e);
    }
  };
  ws.onclose = (e) => {
    dev.alias("Socket").log("close");
  };
  return ws;
}

function createLogin() {
  const loginModal = document.createElement("div");
  loginModal.innerHTML = `
    <div id="login">
      <input name="nickname" type="text" />
      <input name="password" type="password" />
      <button id="processLogin">login</button>
    </div>
  `;
  document.body.insertAdjacentElement("beforeend", loginModal);
  function login(e) {
    const target = e.target;
    if (target.id !== "processLogin") return;

    const nicknameEl = document.querySelector('input[name="nickname"]');
    const passwordEl = document.querySelector('input[name="password"]');

    const nickname = nicknameEl.value;
    const password = passwordEl.value;
    if (nickname && password) {
      axios
        .post(`/query/login`, {
          type: "login",
          pk: userDataMap.user.pk,
          nickname: nickname,
          password: password,
          pox: app.width / 2 - size / 2,
          poy: app.height / 2 - size / 2,
          poz: 0,
          roy: (Math.PI / 180) * 90,
        })
        .then((result) => {
          console.log(result.data);
          window.removeEventListener("click", login);
          loginModal.remove();

          // const source = new EventSource(
          //   `http://localhost:5000/query/sse?uuid=${userDataMap.user.uuid}`,
          //   {
          //     withCredentials: false,
          //   }
          // );

          // source.addEventListener("open", (root, e) => {
          //   console.log(root, e);
          // });

          // source.addEventListener("message", (message) => {
          //   const { data } = message;
          //   const userList = JSON.parse(data);
          //   for (let user of userList) {
          //     users.set(user.id, user);
          //   }

          //   // Display the event data in the `content` div
          //   // document.querySelector("#content").innerHTML = event.data;
          // });
          // axios
          //   .post("/query/sse", {
          //     user: userDataMap.user,
          //     space: userDataMap.space,
          //     channel: userDataMap.channel,
          //   })
          //   .then((result) => {
          //     console.log(result);
          //   });
        });
    }
  }
  window.addEventListener("click", login);
}

window.addEventListener("load", () => {
  attachUser();
  createLogin();
});

/* Gaming Parts */
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key == "w" || key == "s" || key == "a" || key == "d" || key == "shift") {
    direction[key] = true;
  }
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (key == "w" || key == "s" || key == "a" || key == "d" || key == "shift") {
    direction[e.key.toLowerCase()] = false;
  }
});

app.width = innerWidth;
app.height = innerHeight;
window.addEventListener("resize", (e) => {
  app.width = innerWidth;
  app.height = innerHeight;
});

function clearScene() {
  ctx.clearRect(0, 0, app.width, app.height);
}

function userUpdate() {
  for (let u of users.values()) {
    ctx.fillStyle = "black";
    console.log(u.pox, u.poy);
    ctx.fillRect(u.pox, u.poy, size, size);
    ctx.fillStyle = "orange";
    ctx.fillText(u.nickname, u.pox + size / 2, u.poy - 5, size, size);
    ctx.textAlign = "center";
  }
}

function moving(time) {
  for (let u of users.values()) {
    console.log(userDataMap);
    if (u.id === userDataMap.user?.pk) {
      if (direction.w || direction.s || direction.a || direction.d) {
        if (direction.w) {
          Object.assign(u, { poy: u.poy - SPEED });
          // u.poy -= SPEED;
        }
        if (direction.s) {
          Object.assign(u, { poy: u.poy + SPEED });
          // u.poy += SPEED;
        }
        if (direction.a) {
          Object.assign(u, { pox: u.pox - SPEED });
          // u.pox -= SPEED;
        }
        if (direction.d) {
          Object.assign(u, { pox: u.pox + SPEED });
          // u.pox += SPEED;
        }
        updateLocation(u);
      }
      break;
    }
  }
}

function updateLocation(user) {
  sockets.get(userDataMap.user.uuid).send(
    Message.encode(
      new Message({
        id: user.id,
        // space: user.space_id,
        // channel: user.channel_id,
        pox: user.pox,
        poy: user.poy,
        poz: user.poz,
        roy: user.roy,
      })
    ).finish()
  );
}

function update(time) {
  userUpdate(time);
}

function render(time) {
  time *= 0.001;
  clearScene();
  moving(time);
  update(time);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
/* Gaming Parts */

// setInterval(() => {
//   for (let i = 0; i < 10000; i++) {
//     users.set(i, {
//       nickname: "123",
//       pox: Math.random() * 1500,
//       poy: Math.random() * 1500,
//       poz: 0,
//       roy: 1,
//     });
//   }
// }, 16);
