'use strict';

const _             = require('lodash');
const reconnect     = require('reconnect-net');
const EventEmitter  = require('events').EventEmitter; 

const defaults = {
  reconnect: {},
  hosts: []
};

function connect(options) {

  var failover = new EventEmitter();

  // validate configuration
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

  // keep a reference to the client that is active
  failover._currentClient = null;

  // evaluates if active client must change
  failover._updateCurrent = function() {

    // find first client in the list with an active strram
    const client = _.find(failover._clients, (client) => {
      return !!client.stream;
    }) || null;

    // if no changes, done
    if (failover._currentClient===client) {
      return;
    }

    // set new active client
    failover._currentClient = client;
    if (client) {
      // emit event of new conection
      setImmediate(failover.emit.bind(failover), 'connected', client.stream);
    } else {
      // all clients are disconnected
      setImmediate(failover.emit.bind(failover), 'disconnected');
    }
  };

  // array that keeps a reference to each client.
  failover._clients = _.map(failover._options.hosts, (host) => {

    var client = {
      host: host,   // host configuration
      stream: null  // disconnected
    };

    // create a reconnect instance for the host
    client.socket = reconnect(failover._options.reconnect, (stream) => {
      // the client connected to the TCP service
      // keep a reference to the stream connection
      client.stream = stream;
      // check if this client has more priority and should emit connect event      
      failover._updateCurrent();
    })
    .on('disconnect', function() {
      // a client was disconnected from TCP service or it couldn't connect to it.
      if (client.stream) {
        client.stream.destroy();
        client.stream = null;
      }

      // check if there are another client connect and emit a new connect event or a disconnect one.      
      failover._updateCurrent();
    })
    .on('error', _.noop); // ignore any error because we do not need to raise it up

    // start the reconnect instance
    client.socket.connect(client.host.port, client.host.address || client.host.hostname || client.host.host);  

    return client;
  });

  // stops the automatic reconnection and disconnects all clients
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
