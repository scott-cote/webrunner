var http = require('http');
var https = require('https');
var url = require('url');
var net = require('net');
var fs = require('fs');

/*

To generate a self-signed certificate, run the following in your shell:

openssl genrsa -out key.pem
openssl req -new -key key.pem -out csr.pem
openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
rm csr.pem

*/

var runFullProxy = function() {
  var options = { port: 5150 };

  var buildRequestHeaders = function(headers) {
    var newHeaders = {};
    Object.keys(headers).forEach((key) => {
      if (!['connection','proxy-connection'].find(element => key === element)) {
        newHeaders[key] = headers[key];
      }
    });
    return newHeaders;
  };

  var logError = function(source, error, url, allowedErrno) {
    if (!(allowedErrno||[]).find(errno => error.errno === errno)) {
      if (!!url) {
        console.log(url.hostname+' - '+source+' - '+error);
      } else {
        console.log(source+' - '+error);
      }
    }
  };

  var handleRequest = function(clientRequest, clientResponse) {
    try {
      var originUrl = url.parse(clientRequest.url);
      var options = {
        hostname: originUrl.hostname,
        port: originUrl.port,
        path: originUrl.path,
        method: clientRequest.method,
        headers: buildRequestHeaders(clientRequest.headers)
      };
      var originRequest = http.request(options, (originResponse) => {
       originResponse.on('error', e => logError('originResponse', e, originUrl));
        clientResponse.statusCode = originResponse.statusCode;
        Object.keys(originResponse.headers).forEach((key) => {
          clientResponse.setHeader(key, originResponse.headers[key]);
        });
        originResponse.pipe(clientResponse);
      })
      clientRequest.on('error', e => logError('clientRequest', e, originUrl));
      clientResponse.on('error', e => logError('clientResponse', e, originUrl));
      originRequest.on('error', e => logError('originRequest', e, originUrl));
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
      clientRequest.on('error', e => logError('clientRequest (connect)', e, originUrl));
      clientSocket.on('error', e => logError('clientSocket', e, originUrl, ['ECONNRESET']));
      originSocket.on('error', e => logError('originSocket', e, originUrl));
    } catch(e) {
      console.log(e);
    }
  };

  http.createServer(handleRequest).on('connect', handleConnect)
    .listen(options.port, function() {
      console.log("WebRunner listening on: http://localhost:"+options.port);
    }).on('error', e => logError('httpServer', e));

    /*
    var secureOptions = {
      key: fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem'),
      requestCert: true,
      rejectUnauthorized: false
    };
    */
    /*
    require('ssl-root-cas').addFile('cert.pem');

    https.createServer(secureOptions, function (req, res) {
      res.end("hello world\n");
    }).listen(8000, () => console.log('READY'));
    */
};

module.exports = runFullProxy;
