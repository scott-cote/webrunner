var http = require('http');
var url = require('url');
var net = require('net');

var runFullProxy = function() {
  var options = { port: 5150 };

  var handleRequest = function(request, response) {
    try {
      var originUrl = url.parse(request.url);

      var options = {
        hostname: originUrl.host,
        port: originUrl.port,
        path: originUrl.path,
        method: request.method
      };

      var serverRequest = http.request(options, function (serverResponse) {
        serverResponse.pipe(response, { end: true });
      });

      request.pipe(serverRequest, { end: true });

    } catch (e) {
      console.log(e);
    }
  };

  var handleConnect = function(request, clientSocket, data) {
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
  };

  http.createServer(handleRequest).on('connect', handleConnect)
    .listen(options.port, function() {
      console.log("WebRunner listening on: http://localhost:"+options.port);
    });
};

module.exports = runFullProxy;
