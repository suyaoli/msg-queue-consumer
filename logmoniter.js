var path = require('path');
var all = require('bluebird').all;
var basename = require('path').basename;
// config
var fs = require('fs');
var ini = require('ini');

var severities = process.argv.slice(2);
if (severities.length < 1) {
  console.warn('Usage: %s [queue name]',
               basename(process.argv[1]));
  process.exit(1);
}







var Info = ini.parse(fs.readFileSync(path.resolve('') + "/config.ini", "UTF-8"));

var open = require('amqplib').connect({
    hostname: Info.hostname,
    port: Info.port,
    username: Info.username,
    password: Info.password
});



// Consumer
open.then(function(conn) {
    process.once('SIGINT', function() { conn.close(); });
    return conn.createChannel().then(function(ch) {
      var ex = 'direct_logs';
  
      var ok = ch.assertExchange(ex, 'direct', {durable: true});
  
      ok = ok.then(function() {
        return ch.assertQueue('', {exclusive: true});
      });
  
      ok = ok.then(function(qok) {
        var queue = qok.queue;
        return all(severities.map(function(sev) {
          ch.bindQueue(queue, ex, sev);
        })).then(function() { return queue; });
      });
  
      ok = ok.then(function(queue) {
        return ch.consume(queue, logMessage, {noAck: true});
      });
      return ok.then(function() {
        console.log(' [*] Waiting for logs. To exit press CTRL+C.');
      });
  
      function logMessage(msg) {
        console.log(" [x] %s:'%s'",
                    msg.fields.routingKey,
                    msg.content.toString());
      }
    });
  }).catch(console.warn);