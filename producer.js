
var yargs = require('yargs');
var path = require('path');


var argv = yargs.reset().option("c", {
    alias: "config_file_path",
    demand: true,
    default: path.resolve(''),
    description: "config file path"
}).option("e", {
    alias: "exec",
    demand: true,
    default: 'ls',
    description: "exec cmd"
}).help("h").alias("h", "help").argv;

// config
var fs = require('fs');
var ini = require('ini');




var Info = ini.parse(fs.readFileSync(argv.c + "/config.ini", "UTF-8"));


var open = require('amqplib').connect({
    hostname: Info.hostname,
    port: Info.port,
    username: Info.username,
    password: Info.password
});

open.then(function (conn) {
    return conn.createChannel().then(function (ch) {
        var q = Info.queue;
        var msg = argv.e;

        var ok = ch.assertQueue(q, { durable: true });

        return ok.then(function (_qok) {
            // NB: `sentToQueue` and `publish` both return a boolean
            // indicating whether it's OK to send again straight away, or
            // (when `false`) that you should wait for the event `'drain'`
            // to fire before writing again. We're just doing the one write,
            // so we'll ignore it.
            ch.sendToQueue(q, Buffer.from(msg));
            console.log(" [x] Sent '%s'", msg);
            return ch.close();
        });
    }).finally(function () { conn.close(); });
}).catch(console.warn);