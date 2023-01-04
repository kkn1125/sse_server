const { convertRegionName, dev } = require("../utils/tools.js");
const { sql } = require("../database/mariadb.js");
const Query = require("../models/Query.js");

const playersQueries = `SELECT 
  users.id,
  users.uuid,
  users.nickname,
  locations.space_id,
  locations.channel_id,
  locations.pox,
  locations.poy,
  locations.poz,
  locations.roy
FROM
  allocation
    LEFT JOIN
  users ON allocation.user_id = users.id
    LEFT JOIN
  locations ON allocation.user_id = locations.user_id
WHERE
  allocation.space_id = ?
AND 
  allocation.channel_id = ?
AND allocation.type = 'player'`;

Query.updateLocation = async (req) => {
  try {
    const { pox, poy, poz, roy, id, channel, space } = req;
    await sql.promise().query(
      `UPDATE locations
      SET pox=?, poy=?, poz=?, roy=?
      WHERE
        user_id = ?
      AND
        channel_id = ?
      AND
        space_id = ?`,
      [pox, poy, poz, roy, id, channel, space]
    );
  } catch (e) {
    console.log(e);
  }
};

Query.logout = async (id, sid, cid) => {
  try {
    await sql.promise().query(`DELETE FROM users WHERE id = ?`, [id]);
  } catch (e) {
    console.log(e);
  }
};

Query.readLocations = async (req) => {
  const data = req;
  const [user] = await sql
    .promise()
    .query(`SELECT id FROM users WHERE uuid = ?`, [data.uuid]);
  const [space] = await sql.promise().query(
    `SELECT spaces.* FROM spaces
      LEFT JOIN allocation
      ON allocation.space_id = spaces.id
      WHERE allocation.user_id = ?`,
    [user[0].id]
  );
  const [channel] = await sql.promise().query(
    `SELECT channels.* FROM channels
      LEFT JOIN allocation
      ON allocation.channel_id = channels.id
      WHERE allocation.user_id = ?`,
    [user[0].id]
  );
  const [locations] = await sql
    .promise()
    .query(playersQueries, [space[0].id, channel[0].id]);
  console.log(locations);
  return locations;
};

/* upgrade intial informations */
const getUser = (uuid) =>
  sql.promise().query(
    `SELECT
    id AS pk,
    uuid,
    email,
    nickname
  FROM users
  WHERE deletion = 0
  AND uuid = ?`,
    [uuid]
  );

const getSpace = (pk) =>
  sql.promise().query(
    `SELECT
    spaces.id AS pk,
    spaces.name,
    spaces.volume,
    spaces.owner,
    spaces.limit_amount
  FROM spaces
  LEFT JOIN allocation
  ON allocation.space_id = spaces.id
  LEFT JOIN users
  ON users.id = allocation.user_id
  WHERE users.id = ?`,
    [pk]
  );
const getChannel = (pk) =>
  sql.promise().query(
    `SELECT
    channels.id AS pk,
    channels.name,
    channels.limit_amount
  FROM channels
  LEFT JOIN allocation
  ON allocation.channel_id = channels.id
  LEFT JOIN users
  ON users.id = allocation.user_id
  WHERE users.id = ?`,
    [pk]
  );
const getLocale = (pk) =>
  sql.promise().query(
    `SELECT
    locales.id AS pk,
    locales.region,
    locales.limit_amount
  FROM locales
  LEFT JOIN connection
  ON connection.locale_id = locales.id
  LEFT JOIN users
  ON users.id = connection.user_id
  WHERE users.id = ?`,
    [pk]
  );
const getSocket = (pk) =>
  sql.promise().query(
    `SELECT
    pool_sockets.id AS pk,
    pool_sockets.ip,
    pool_sockets.port,
    pool_sockets.cpu_usage,
    pool_sockets.memory_usage,
    pool_sockets.is_live,
    pool_sockets.limit_amount
  FROM pool_sockets
  LEFT JOIN connection
  ON connection.socket_id = pool_sockets.id
  LEFT JOIN users
  ON users.id = connection.user_id
  WHERE users.id = ?`,
    [pk]
  );
const getPulisher = (pk) =>
  sql.promise().query(
    `SELECT
    pool_publishers.id AS pk,
    pool_publishers.ip,
    pool_publishers.port,
    pool_publishers.is_live,
    pool_publishers.limit_amount
  FROM pool_publishers
  LEFT JOIN connection
  ON connection.publisher_id = pool_publishers.id
  LEFT JOIN users
  ON users.id = connection.user_id
  WHERE users.id = ?`,
    [pk]
  );
const getConnection = (pk) =>
  sql.promise().query(
    `SELECT
    user_id,
    socket_id,
    publisher_id,
    locale_id,
    connected
  FROM connection
  WHERE user_id = ?`,
    [pk]
  );
const getAllocation = (pk) =>
  sql.promise().query(
    `SELECT
    user_id,
    space_id,
    channel_id,
    type,
    status
  FROM allocation
  WHERE user_id = ?`,
    [pk]
  );

const queryService = Query;

module.exports = {
  queryService,
  getUser,
  getSpace,
  getChannel,
  getLocale,
  getSocket,
  getPulisher,
  getConnection,
  getAllocation,
};
