'use strict';

const net = require('net');

module.exports = function echo(port) {
  
  const instance = {
    clients: [],
    port: () => {
      return port;
    },
    status: () => {
      return !!instance.server;
    },
    start: function(cb) {

      var p = new Promise((resolve, reject) => {
        if (instance.server) {
          return reject(new Error('echo already running'));
        }

        instance.server = net.createServer((socket) => {
          instance.clients.push(socket);
          socket.on('data', (data) => {
            socket.write(JSON.stringify({ port: port, data: data.toString() }));
          });
        })
        .once('error', (err) => {
          reject(err);
        })
        .once('listening', () => {
          resolve();
        })
        .listen(port);
      });

      if (typeof cb === 'function') {
        p.then(() => { cb(); }, cb);
        p = null;
      }

      return p;
    },

    stop: function(cb) {
      var p =  new Promise((resolve) => {
        if (instance.server) {
          instance.clients.forEach((client) => {
            client.destroy();
          });
          instance.clients = [];
          instance.server.close();
          instance.server = null;
          resolve();
        } else {
          resolve();
        }
      });

      if (typeof cb === 'function') {
        p.then(() => { cb(); }, cb);
        p = null;
      }

      return p;      
    }      
  };

  return instance;
};
