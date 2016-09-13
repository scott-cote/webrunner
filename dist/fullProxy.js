var http = require('http');
var url = require('url');
var net = require('net');

var runFullProxy = function() {
  var options = { port: 5150 };

  var handleRequest = function(clientRequest, clientResponse) {
    try {
      var originUrl = url.parse(clientRequest.url);
      var options = {
        hostname: originUrl.hostname,
        port: originUrl.port,
        path: originUrl.path,
        method: clientRequest.method,
        headers: clientRequest.headers
      };
      var originRequest = http.request(options, (originResponse) => {
        originResponse.on('error', e => console.log(e));
        originResponse.pipe(clientResponse);
      })
      clientRequest.on('error', e => console.log(e));
      clientResponse.on('error', e => console.log(e));
      originRequest.on('error', e => console.log(e));
      clientRequest.pipe(originRequest);
    } catch (e) {
      console.log(e);
    }
  };

  var handleConnect = function(clientRequest, clientSocket, data) {
    try {
      var originUrl = url.parse(`https://${clientRequest.url}`);
      var originSocket = net.connect(originUrl.port, originUrl.hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n'+'Proxy-agent: WebRunner\r\n'+'\r\n');
        originSocket.write(data);
        originSocket.pipe(clientSocket);
        clientSocket.pipe(originSocket);
      });
      clientRequest.on('error', e => console.log(e));
      clientSocket.on('error', e => console.log(e));
      originSocket.on('error', e => console.log(e));
    } catch(e) {
      console.log(e);
    }
  };

  http.createServer(handleRequest).on('connect', handleConnect)
    .listen(options.port, function() {
      console.log("WebRunner listening on: http://localhost:"+options.port);
    }).on('error', e => console.log(e));
};

module.exports = runFullProxy;
