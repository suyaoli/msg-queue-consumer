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
    default: { appenders: ['out', 'day'], level: Info.log },
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


function request(url, method, headers, content, callback) {

  var options = {

    host: url.hostname,

    port: url.port,

    path: url.pathname,

    method: method,

    headers: headers

  };

  log.debug("post options:", options);

  log.debug("content:", content);



  var req = http.request(options, function (res) {


    log.debug("headers: ", res.headers);

    var _data = '';

    res.on('data', function (chunk) {

      _data += chunk;

    });

    res.on('end', function () {

      if (callback) {

        callback(res.statusCode, _data.trim());
      }

    });

  });



  req.write(content);

  req.end();
}


// Consumer
open.then(function (conn) {
  log.info('ready...');
  return conn.createChannel();
}).then(function (ch) {
  return ch.assertQueue(q).then(function (ok) {
    return ch.consume(q, function (msg) {
      if (msg !== null) {

        var arr = msg.content.toString().split("|");

        var content = arr[1];

        var url = new URL(arr[0]);

        request(url, "POST", {

          'Content-Type': 'application/json',

          'Content-Length': content.length

        }, content, function (statusCode, data) {

          log.info("request url:", arr[0]);
          log.info("request params:", arr[1]);
          log.info("response status: ", statusCode);
          log.info("response data:", data);


          if (arr.length > 2) {

            url = new URL(arr[2]);

            request(url, "GET", {

            }, "", function (statusCode, data) {

              log.info("callabck request  url:", arr[2]);
              log.info("callabck response status: ", statusCode);
              log.info("callabck response data:", data);
              ch.ack(msg);


            });


          } else {



            ch.ack(msg);

          }


        })





      }
    });
  });
}).catch(console.warn);