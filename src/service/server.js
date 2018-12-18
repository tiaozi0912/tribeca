'use strict';

const http = require('http');
const express = require('express');
const logging_1 = require('./logging');
const path = require('path');
const compression = require('compression');
const mainLog = logging_1.default('tribeca:main');
const process = require('process');

module.exports = config => {
  const app = express();
  const httpServer = http.createServer(app);
  const username = config.GetString('WebClientUsername');
  const password = config.GetString('WebClientPassword');
  if (username !== 'NULL' && password !== 'NULL') {
    mainLog.info('Requiring authentication to web client');
    const basicAuth = require('basic-auth-connect');
    app.use(basicAuth((u, p) => u === username && p === password));
  }
  app.use(compression());
  app.use(express.static(path.join(__dirname, 'admin')));
  const webport = process.env.SERVER_PORT || config.GetNumber('WebClientListenPort');

  httpServer.listen(webport, () => mainLog.info('Listening to admins on *:', webport));

  return {
    app,
    httpServer,
  };
};
