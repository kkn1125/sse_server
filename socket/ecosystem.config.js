const dotenv = require("dotenv");
const path = require("path");

const mode = process.env.NODE_ENV;
const MODE = process.env.MODE;

dotenv.config({
  path: path.join(__dirname, ".env"),
});
if (mode === "development") {
  dotenv.config({
    path: path.join(__dirname, `.env.${mode}.${MODE}`),
  });
}

const HOST = process.env.HOST;
const PORT = process.env.PORT;
const MARIADB_PORT = process.env.MARIADB_PORT;
const MARIADB_HOST = process.env.MARIADB_HOST;
const MARIADB_USERNAME = process.env.MARIADB_USERNAME;
const MARIADB_PW = process.env.MARIADB_PW;
const MARIADB_DATABASE = process.env.MARIADB_DATABASE;
const API_HOST = process.env.API_HOST;
const API_PORT = process.env.API_PORT;
const SERVER_HOST = process.env.SERVER_HOST;
const SERVER_PORT = process.env.SERVER_PORT;
const PORT_GAP = process.env.PORT_GAP;
const IP_ADDRESS = process.env.IP_ADDRESS;

console.log(
  HOST,
  PORT,
  MARIADB_PORT,
  MARIADB_HOST,
  MARIADB_USERNAME,
  MARIADB_PW,
  MARIADB_DATABASE,
  API_HOST,
  API_PORT,
  SERVER_HOST,
  SERVER_PORT,
  PORT_GAP,
  IP_ADDRESS
);

module.exports = {
  apps: [
    {
      script: "index.js",
      watch: ".",
      exec_mode: "cluster",
      instances: "max",
      env: {
        NODE_ENV: "development",
        MODE: "local",
        HOST: HOST,
        PORT: PORT,
        MARIADB_PORT: MARIADB_PORT,
        MARIADB_HOST: MARIADB_HOST,
        MARIADB_USERNAME: MARIADB_USERNAME,
        MARIADB_PW: MARIADB_PW,
        MARIADB_DATABASE: MARIADB_DATABASE,
        API_HOST: API_HOST,
        API_PORT: API_PORT,
        SERVER_HOST: SERVER_HOST,
        SERVER_PORT: SERVER_PORT,
        PORT_GAP: PORT_GAP,
        IP_ADDRESS: IP_ADDRESS,
      },
    },
  ],

  deploy: {
    production: {
      user: "SSH_USERNAME",
      host: "SSH_HOSTMACHINE",
      ref: "origin/master",
      repo: "GIT_REPOSITORY",
      path: "DESTINATION_PATH",
      "pre-deploy-local": "",
      "post-deploy":
        "npm install && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
    },
  },
};
