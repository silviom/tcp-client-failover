'use strict';

const _ = require('lodash');
const reconnect     = require('reconnect-net');
const EventEmitter  = require('events').EventEmitter; 

const defaults = {
  reconnect: {},
  hosts: []
};

function connect(options) {

  var failover = new EventEmitter();

  if (_.isArray(options )) {
    failover._options = _.defaultsDeep({ hosts: options } || {}, defaults);
  } else {
    failover._options = _.defaultsDeep(options || {}, defaults);
  }

  if (_.isEmpty(failover._options.hosts)) {
    setImmediate(failover.emit, 'error', new Error('hosts property is empty'));
    return failover;
  }

  // delete onConnect from reconnect option in order to prevent intrusion.
  delete failover._options.reconnect.onConnect;

  failover._currentClient = null;

  failover._updateCurrent = function() {

    // find first client in the list with an 
    const client = _.find(failover._clients, (client) => {
      return !!client.stream;
    });

    if (failover._currentClient!==client) {
      failover._currentClient = client;
      if (client) {
        setImmediate(failover.emit.bind(failover), 'connected', client.stream);
      } else {
        setImmediate(failover.emit.bind(failover), 'disconnected');
      }
    }
  };

  // create a client instance for each host
  failover._clients = _.map(failover._options.hosts, (host) => {

    var client = {
      host: host,
      stream: null
    };

    client.socket = reconnect(failover._options.reconnect, (stream) => {
      client.stream = stream;      
      failover._updateCurrent();
    })
    .on('disconnect', function() {
      if (client.stream) {
        client.stream.destroy();
        client.stream = null;
      }
      failover._updateCurrent();
    })
    .on('error', _.noop);

    client.socket.connect(client.host.port, client.host.address || client.host.hostname || client.host.host);  

    return client;
  });

  failover.disconnect = function disconnect() {
    failover._clients.forEach((client) => {
      client.socket.reconnect = false;
      client.socket.disconnect();
    });
    failover._clients = [];
  };

  return failover;
}

module.exports = {
  connect: connect
};
