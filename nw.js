let Service = require('node-windows').Service;
var path = require('path');

let svc = new Service({
    name: 'MsgQueueConsumerService',    //服务名称
    description: 'MsgQueueConsumerService', //描述
    script: path.resolve('') + '/consumer.js' //nodejs项目要启动的文件路径
});

svc.on('install', () => {
    svc.start();
});

svc.install();