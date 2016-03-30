## Overview
This package implements is a very simple failover for TCP Services.
It connects to a set of TCP services especified by configuration and emits an event when it can connect to one of them.
The first TCP service in the list has the highst priority.
When first service is down, `failover` will connect to the second one. After the first service is up again, `failover` reconnects to it. 


`failover` uses module [reconnect-net](https://github.com/juliangruber/reconnect-net) to reconnect automatically to each TCP service.

## Usage

Create a `failover` instance that will keep reconnecting over tcp agains all servers.

```js
var fo = failover.connect({
  hosts: [
    { hostname: 'localhost', port: 10001 },
    { hostname: 'localhost', port: 10002 },
    { hostname: 'localhost', port: 10003 }
  ],
  reconnect: {
    // reconnect's configuration
  }
})
.on('connected', function(stream) {
  // stream argument is the stream you should consume
})
.on('disconnected', function() {
  // fo is disconnected from all servers
})
.on('error', function(err) {
  
});

// disconnect
fo.disconnect();
```


