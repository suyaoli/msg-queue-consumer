var http = require('http');
const { URL } = require('url');
var log4js = require("log4js");



var fs = require('fs');
var ini = require('ini');
var Info = ini.parse(fs.readFileSync("config.ini", "UTF-8"));


log4js.configure({
  appenders: {
    out: { type: 'stdout' },
    day: {
      type: 'dateFile', filename: "./logs/date", alwaysIncludePattern: true, pattern: "-yyyy-MM-dd.log"
    }
  },
  categories: {
    default: { appenders: ['out','day'], level: Info.log},
  }
});

var log = log4js.getLogger();

var q = Info.queue;

var open = require('amqplib').connect({
  hostname: Info.hostname,
  port: Info.port,
  username: Info.username,
  password: Info.password
});



// Consumer
open.then(function (conn) {
  return conn.createChannel();
}).then(function (ch) {
  return ch.assertQueue(q).then(function (ok) {
    return ch.consume(q, function (msg) {
      if (msg !== null) {
        log.info(msg.content.toString());

        var arr = msg.content.toString().split("|");

        var content = arr[1];

        var url = new URL(arr[0]);



        var options = {

          host: url.hostname,

          port: url.port,

          path: url.pathname,

          method: 'POST',

          headers: {

            'Content-Type': 'application/json',

            'Content-Length': content.length

          }

        };

        log.debug("post options:\n", options);

        log.debug("content:", content);

        log.debug("\n");



        var req = http.request(options, function (res) {

          log.info("statusCode: ", res.statusCode);

          log.debug("headers: ", res.headers);

          var _data = '';

          res.on('data', function (chunk) {

            _data += chunk;

          });

          res.on('end', function () {

            log.debug("\n--->>\nresult:", _data)

          });

        });



        req.write(content);

        req.end();



        ch.ack(msg);
      }
    });
  });
}).catch(console.warn);