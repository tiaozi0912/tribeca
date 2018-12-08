'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const debug = require('debug')('tribeca:init-db');
const Config = require('./service/config');
const config = new Config.ConfigProvider();

/*
const connectDB = () => {
  const port = process.env.db_port || '27017';
  let dbURL = '';
  if (process.env.db_user && process.env.db_pwd) {
    dbURL = `mongodb://${process.env.db_user}:${process.env.db_pwd}@${process.env.db_host}:${port}/${process.env.db}`;
  } else {
    dbURL = `mongodb://${process.env.db_host}:${port}/${process.env.db}`;
  }

  debug('db url:', dbURL);

  mongoose.connect(dbURL);
};
*/

const initDB = async () => {
  const modelsDir = path.join(__dirname, 'models');

  // Bootstrap models
  fs.readdirSync(modelsDir)
    .forEach(file => require(path.join(modelsDir, file)));

  // connectDB();
  mongoose.connect(config.GetString('MongoDbUrl'));

  return new Promise((resolve, reject) => {
    const conn = mongoose.connection;

    conn.on('error', err => {
      console.error(err);
      reject(err);
    })
      .once('open', () => {
        console.log('db connected.');
        resolve(conn);
      });
    // .on('disconnected', connect)
  });
};

module.exports = {
  initDB,
};
