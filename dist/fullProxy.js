var http = require('http');
var url = require('url');
var net = require('net');

var runFullProxy = function() {
  var options = { port: 5150 };

  var handleRequest = function(request, response) {
    try {
      throw "handleRequest not implemented";
    } catch (e) {
      console.log(e);
    }
  };

  var proxy = http.createServer(handleRequest).listen(options.port, function() {
    console.log("WebRunner listening on: http://localhost:"+options.port);
  });

  proxy.on('connect', (request, clientSocket, data) => {
    try {
      var originUrl = url.parse(`https://${request.url}`);
      var originSocket = net.connect(originUrl.port, originUrl.hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n'+'Proxy-agent: WebRunner\r\n'+'\r\n');
        originSocket.write(data);
        originSocket.pipe(clientSocket);
        clientSocket.pipe(originSocket);
      });
    } catch(e) {
      console.log(e);
    }
  });
};

module.exports = runFullProxy;
