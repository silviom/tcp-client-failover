const assert  = require('assert');
const echo    = require('./echo');

const failover = require('../index');

const PORT = 5656;

describe ('index.js', () => {

  describe('connect method', () => {
    
    describe('when options is an array', () => {
      it ('should set the array as config.hosts', ()=>{
        var foInstance = failover.connect([ 'foo', 'bar' ]);
        assert.deepEqual(foInstance._options, { hosts: ['foo', 'bar'], reconnect: {} });
      });
    });

    describe('when there is one host only', function() {

      this.timeout(5000);

      const servers = [ echo(PORT) ];
      const server = servers[0];

      var foConfig = {
        hosts: [{ hostname: 'localhost', port: PORT }],
        reconnect: {
          initialDelay: 100
        }
      };        

      var foInstance = failover.connect(foConfig);

      beforeEach(() => {
        return server.stop();
      });

      after(() => {
        return server.stop();
      });

      it('should connect when host is up', (done) => {
        
        foInstance
        .once('connected', (cn) => {
          assert.ok(cn);
          testConnectionAndClose(cn, server.port(), done);
        });

        // start service
        server.start();
      });

      it('should disconnect when host is down', (done) => {
        var server = servers[0];

        foInstance
        .once('connected', (cn) => {
          assert.ok(cn);
          server.stop();
        })
        .once('disconnected', () => {
          done();
        });
        
        // start service
        server.start();
      });

      it('should reconnect when host is up again', (done) => {
        var server = servers[0];

        // first connect, ignore it and stop server
        foInstance.once('connected', () => {

          // stop service
          server.stop();

          // subscribe for second connection (reconnection)
          foInstance.once('connected', () => {
            done();
          });
        });

        // restart server after it is down
        foInstance.once('disconnected', () => {
          // start service for a second time
          server.start();
        });
        
        // start service for the first time
        server.start();
      });
    });
 
    describe('when there is more then one host', function() {

      this.timeout(5000);

      const servers = [ echo(PORT), echo(PORT + 1), echo(PORT + 2) ];
      const foConfig = {
        hosts: [
          { hostname: 'localhost', port: PORT },
          { hostname: 'localhost', port: PORT + 1 },
          { hostname: 'localhost', port: PORT + 2 }
        ],
        reconnect: {
          initialDelay: 100
        }
      };

      var foInstance = failover.connect(foConfig);

      beforeEach(() => {
        // stop all services
        return Promise.all([
          servers[0].stop(),
          servers[1].stop(),
          servers[2].stop()
        ]);
      });

      after(() => {
        // stop all services
        return Promise.all([
          servers[0].stop(),
          servers[1].stop(),
          servers[2].stop()
        ]);
      });

      it('should connect to first host when all are up', () => {

       return Promise.all([
          servers[0].start(),
          servers[1].start(),
          servers[2].start()
        ])
        .then(() => {
          return new Promise((resolve) => {
             foInstance
            .once('connected', (cn) => {
              assert.ok(cn);
              testConnectionAndClose(cn, servers[0].port(), resolve);
            });
          });
        });
      });

      it('should connect to second host when first is down', () => {
        // start second and third services
        return Promise.all([
          servers[1].start(),
          servers[2].start()
        ])
        .then(() => {
          return new Promise((resolve) => {
            foInstance = failover
            .connect(foConfig)
            .once('connected', (cn) => {
              assert.ok(cn);
              testConnectionAndClose(cn, servers[1].port(), resolve);
            });
          });
        });
      });

      it('should connect to third host when first and second are down', () => {
        // start third service only
        return servers[2].start()
        .then(() => {
          return new Promise((resolve) => {
            foInstance = failover
            .connect(foConfig)
            .once('connected', (cn) => {
              assert.ok(cn);
              testConnectionAndClose(cn, servers[2].port(), resolve);
            });
          });
        });
      });

      it('should reconnect to first host after fit is up again', () => {
        // start third service only
        return servers[2].start()
        .then(() => {
          return new Promise((resolve) => {
            foInstance = failover
            .connect(foConfig)
            .once('connected', (cn) => {
              assert.ok(cn);
              testConnection(cn, servers[2].port(), () => {
                foInstance.once('connected', (cn2) => {
                  testConnectionAndClose(cn2, servers[0].port(), resolve);
                });
                servers[0].start();
              });
            });
          });
        });
      });
    });
  });
});

function testConnection(cn, port, cb) {
  cn.once('data', (data) => {
    var response = JSON.parse(data.toString());
    assert.deepEqual({ port: port, data: 'foo' }, response);
    if(cb) {
      cb();
    }
  });
  cn.write('foo');
}

function testConnectionAndClose(cn, port, cb) {

  cn.once('close', () => {
    if (cb) cb();
  });

  testConnection(cn, port, () => {
    cn.end();
  });
}