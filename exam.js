var WebSocketServer = new require('ws');

var webSocketServer = new WebSocketServer.Server({
    port: 8081
});

webSocketServer.on('connection', function(ws) {

    var id = Math.random();
    console.log("new connection " + id);

    ws.on('message', function(data) {
        console.log('new message :: ' + data);
        ws.send(JSON.parse(data).message);
    });

    ws.on('close', function() {
        console.log('connection close ' + id);
    });

    ws.on("error", function () {
        console.log("error");
    })

});