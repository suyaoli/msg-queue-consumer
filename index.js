var q = 'msg';
 
var open = require('amqplib').connect({
    hostname:'106.15.40.167',
    port:5672,
    username:'admin',
    password:'sfewcd123s'
});
 
// Consumer
open.then(function(conn) {
  return conn.createChannel();
}).then(function(ch) {
  return ch.assertQueue(q).then(function(ok) {
    return ch.consume(q, function(msg) {
      if (msg !== null) {
        console.log(msg.content.toString());
        ch.ack(msg);
      }
    });
  });
}).catch(console.warn);