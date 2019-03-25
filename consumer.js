var http = require('http');
const { URL } = require('url');
var log4js = require("log4js");
var querystring = require('querystring');
var yargs = require('yargs');
var path = require('path');
var validator = require('validator');
var shell = require('shelljs');


var argv = yargs.reset().option("c", {
  alias: "config_file_path",
  demand: true,
  default: path.resolve(''),
  description: "config file path"
}).help("h").alias("h", "help").argv;

// config
var fs = require('fs');
var ini = require('ini');




var Info = ini.parse(fs.readFileSync(argv.c + "/config.ini", "UTF-8"));

// log
log4js.configure({
  appenders: {
    out: { type: 'stdout' },
    day: {
      type: 'dateFile', filename: argv.c + "/logs/date", alwaysIncludePattern: true, pattern: "-yyyy-MM-dd.log"
    },
    mq: {
      type: '@log4js-node/rabbitmq',
      host: Info.hostname,
      port: Info.port,
      username: Info.username,
      password: Info.password,
      routing_key: 'info',
      exchange: 'direct_logs',
      mq_type: 'direct',
      durable: true
    }
  },
  categories: {
    default: { appenders: ['out', 'day', 'mq'], level: Info.log },
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


// util
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

// doing 
function do_msg(msgs, index, end_callback) {

  var msg = '';
  if (index < msgs.length) {
    msg = msgs[index];
  }

  if (msg !== null) {

    var arr = msg.split("|");

    var content = "";

    if (arr.length >= 2) {

      content = arr[1];
    }

    if (arr[0].indexOf("http") == -1) {

      var line = arr[0];

      var child = shell.exec(line, { silent: true }, function (code, stdout, stderr) {

        if (code == 0) {



          log.info('execute success');

        } else {

          log.info('execute fail,error info:' + stderr.trim());

        }

        if (index == msgs.length - 1) { //last msg
          if (end_callback) {
            end_callback();
          }
        } else {
          do_msg(msgs, index + 1, end_callback);
        }

        return;

      });

      child.stdout.on('data', function (data) {

        log.info('output:' + data.trim());


      });




    } else {




      var url = new URL(arr[0]);

      request(url, "POST", {

        'Content-Type': 'application/json',

        'Content-Length': content.length

      }, content, function (statusCode, data) {

        log.info("request url:", arr[0]);
        log.info("request params:", arr[1]);
        log.info("response status: ", statusCode);
        log.info("response data:", data);
        var ret = {};
        try {

          if (validator.isJSON(data)) {

            ret = JSON.parse(data);

          }



        } catch (e) {

          log.error(e);

          return;


        }




        if (arr.length > 2) {      //include callback



          url = new URL(arr[2]);
          var content = url.searchParams.toString() + '&' + querystring.stringify({
            retrun_json: JSON.stringify({ code: ret.ret })
          });
          request(url, "POST", {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': content.length
          }, content, function (statusCode, data) {

            log.info("callabck request  url:", arr[2]);
            log.info("callabck request  params:", content);
            log.info("callabck response status: ", statusCode);
            log.info("callabck response data:", data);

            if (index == msgs.length - 1) { //last msg
              if (end_callback) {
                end_callback();
              }
            } else {
              do_msg(msgs, index + 1, end_callback);
            }


          });


        } else {

          if (index == msgs.length - 1) { //last msg
            if (end_callback) {
              end_callback();
            }
          } else {
            do_msg(msgs, index + 1, end_callback);
          }

        }


      })
    }





  }
}


// Consumer
open.then(function (conn) {
  log.info('ready...');
  return conn.createChannel();
}).then(function (ch) {
  return ch.assertQueue(q).then(function (ok) {
    return ch.consume(q, function (msg) {            // msg format:{url1}|{params1}|[callback1],{url2}|{params2}|[callback2],{url3}|{params3}|[callback3],.....

      log.info('consume new msg:', msg.content.toString());

      try {




        var msgs = msg.content.toString().split("||");

        do_msg(msgs, 0, function () {

          ch.ack(msg);           // send ask after do last msg
          log.info('consume end, send ack');
        });

      } catch (err) {

        log.info(err);

      }

    });
  });
}).catch(console.warn);


process.on('uncaughtException', function (err) {
  log.info(err);
})


process.on('unhandledRejection', function (err, promise) {

  log.info(err);

})