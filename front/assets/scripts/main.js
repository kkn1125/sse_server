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

let users = new Map();
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
let ws = null;

function attachUser() {
  axios
    .post(`/query/attach`, {
      locale: navigator.language,
    })
    .then((result) => {
      const { data } = result;
      Object.assign(userDataMap, data);
      sockets.set(data.user.uuid, connectSocket(userDataMap));
      for (let user of userDataMap.players) {
        users.set(user.id, {
          id: user.id,
          nickname: user.nickname,
          pox: user.pox,
          poy: user.poy,
          poz: user.poz,
          roy: user.roy,
        });
      }
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
  ws = new WebSocket(`ws://localhost:${socket.port}/?q=${q}`);
  ws.binaryType = "arraybuffer";
  ws.onopen = (e) => {
    dev.alias("Socket").log("open");
  };
  ws.onmessage = (message) => {
    const { data } = message;
    if (data instanceof ArrayBuffer) {
      // locations
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
    } else if (!isNaN(data)) {
      if (Number(data) !== 0) {
        // logout
        console.log("logout", Number(data));
        users.delete(Number(data));
      } else {
        axios
          .post("/query/login", {
            pk: userDataMap.user.pk,
            nickname: userDataMap.user.nickname,
            password: userDataMap.user.password,
            pox: app.width / 2 - size / 2,
            poy: app.height / 2 - size / 2,
            poz: 0,
            roy: (Math.PI / 180) * 90,
          })
          .then(({ data }) => {
            for (let user of data.players) {
              if (!users.has(user.id)) {
                users.set(user.id, user);
              }
            }
          });
      }
    } else {
      // login, players
      const json = JSON.parse(data);
      if (json instanceof Array) {
        for (let u of json) {
          // if (users.has(u.id)) continue;
          users.set(u.id, Object.assign(users.get(u.id) || {}, u));
        }
      } /* else if (json.type === "login") {
        for (let u of json.players) {
          if (users.has(u.id)) continue;
          users.set(u.id, Object.assign(users.get(u.id) || {}, u));
        }
      } */
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
      ws.send(
        JSON.stringify({
          type: "login",
          pk: userDataMap.user.pk,
          nickname: nickname,
          password: password,
          pox: app.width / 2 - size / 2,
          poy: app.height / 2 - size / 2,
          poz: 0,
          roy: (Math.PI / 180) * 90,
        })
      );

      window.removeEventListener("click", login);
      loginModal.remove();
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
    // console.log(u.pox, u.poy);
    ctx.fillRect(u.pox, u.poy, size, size);
    ctx.fillStyle = "orange";
    ctx.fillText(u.nickname, u.pox + size / 2, u.poy - 5, size, size);
    ctx.textAlign = "center";
  }
}

function moving(time) {
  for (let u of users.values()) {
    // console.log(userDataMap);
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

// DataView.prototype.getUint64 = function (byteOffset, littleEndian) {
//   // split 64-bit number into two 32-bit parts
//   const left = this.getUint32(byteOffset, littleEndian);
//   const right = this.getUint32(byteOffset + 4, littleEndian);

//   // combine the two 32-bit values
//   const combined = littleEndian
//     ? left + 2 ** 32 * right
//     : 2 ** 32 * left + right;

//   if (!Number.isSafeInteger(combined))
//     console.warn(combined, "exceeds MAX_SAFE_INTEGER. Precision may be lost");

//   return combined;
// };

// // [byteArray, littleEndian, expectedValue]
// const testValues = [
//   // big-endian
//   [
//     new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff]),
//     false,
//     255,
//   ],
//   [
//     new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff]),
//     false,
//     65535,
//   ],
//   [
//     new Uint8Array([0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff]),
//     false,
//     4294967295,
//   ],
//   [
//     new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]),
//     false,
//     4294967296,
//   ],
//   [
//     new Uint8Array([0x00, 0x1f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
//     false,
//     9007199254740991,
//   ], // maximum precision
//   [
//     new Uint8Array([0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
//     false,
//     9007199254740992,
//   ], // precision lost
//   [
//     new Uint8Array([0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]),
//     false,
//     9007199254740992,
//   ], // precision lost

//   // little-endian
//   [new Uint8Array([0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), true, 255],
//   [
//     new Uint8Array([0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
//     true,
//     65535,
//   ],
//   [
//     new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00]),
//     true,
//     4294967295,
//   ],
//   [
//     new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]),
//     true,
//     4294967296,
//   ],
//   [
//     new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00]),
//     true,
//     1099511627776,
//   ],
//   [
//     new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00]),
//     true,
//     281474976710656,
//   ],
//   [
//     new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1f, 0x00]),
//     true,
//     9007199254740991,
//   ], // maximum precision
// ];

// testValues.forEach(testGetUint64);

// function testGetUint64([bytes, littleEndian, expectedValue]) {
//   const val = new DataView(bytes.buffer).getUint64(0, littleEndian);
//   console.log(val)
//   console.log(
//     val === expectedValue
//       ? "pass"
//       : "FAIL. expected " + expectedValue + ", received " + val
//   );
// }

function updateLocation(user) {
  // const a = new Uint32Array(9);
  const encode = Message.encode(
    new Message({
      id: user.id,
      // space: user.space_id,
      // channel: user.channel_id,
      pox: user.pox,
      poy: user.poy,
      poz: user.poz,
      roy: user.roy,
    })
  ).finish();
  const poxL = parseInt(user.pox).toString().length;
  const poyL = parseInt(user.poy).toString().length;
  const pozL = parseInt(user.poz).toString().length;
  const royL = parseInt(user.roy).toString().length;
  // a.set([
  //   user.id,
  //   user.pox,
  //   (user.pox - parseInt(user.pox)) * 10 * (poxL - 1),
  //   user.poy,
  //   (user.poy - parseInt(user.poy)) * 10 * (poyL - 1),
  //   user.poz,
  //   (user.poz - parseInt(user.poz)) * 10 * (pozL - 1),
  //   user.roy,
  //   (user.roy - parseInt(user.roy)) * 10 * (royL - 1),
  // ]);
  // console.log(a);
  const a = new Uint32Array([
    '0x'+user.id.toString(36),
    '0x'+user.pox.toString(36),
    // (user.pox - parseInt(user.pox)) * 10 * (poxL - 1).toString(36),
    '0x'+user.poy.toString(36),
    // (user.poy - parseInt(user.poy)) * 10 * (poyL - 1).toString(36),
    '0x'+user.poz.toString(36),
    // (user.poz - parseInt(user.poz)) * 10 * (pozL - 1).toString(36),
    '0x'+user.roy.toString(36),
    // (user.roy - parseInt(user.roy)) * 10 * (royL - 1).toString(36),
  ]);
  console.log(a);
  console.log(a.buffer);
  // console.log(
  //   new TextEncoder().encode(
  //     user.id.toString(36),
  //     user.pox.toString(36),
  //     (user.pox - parseInt(user.pox)) * 10 * (poxL - 1).toString(36),
  //     user.poy.toString(36),
  //     (user.poy - parseInt(user.poy)) * 10 * (poyL - 1).toString(36),
  //     user.poz.toString(36),
  //     (user.poz - parseInt(user.poz)) * 10 * (pozL - 1).toString(36),
  //     user.roy.toString(36),
  //     (user.roy - parseInt(user.roy)) * 10 * (royL - 1).toString(36)
  //   )
  // );
  console.log();

  sockets.get(userDataMap.user.uuid).send(new Uint32Array(a.buffer));
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
