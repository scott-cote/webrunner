var http = require('http');
var https = require('https');
var url = require('url');
var net = require('net');
var fs = require('fs');
var path = require('path');
var forge = require('node-forge');

/*

To generate a self-signed certificate, run the following in your shell:

openssl genrsa -out key.pem 2048
openssl req -new -key key.pem -out csr.pem
openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
rm csr.pem

*/

/*

openssl genrsa -out rootCA.key 2048
openssl req -x509 -new -nodes -key rootCA.key -sha256 -days 1024 -out rootCA.pem
openssl genrsa -out device.key 2048
openssl req -new -key device.key -out device.csr
openssl x509 -req -in device.csr -CA rootCA.pem -CAkey rootCA.key -CAcreateserial -out device.crt -days 500 -sha256

*/

var runFullProxy = function(options) {

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

  var handleRequest = function(clientRequest, clientResponse, host) {
    try {
      var originUrl = url.parse(clientRequest.url);
      var options = {
        hostname: host || originUrl.hostname,
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
      if (originUrl.hostname === 'www.scottcote.com') {
        originUrl = url.parse('https://localhost:8000');
      }
      var originSocket = net.connect(originUrl.port, originUrl.hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n'+'Proxy-agent: WebRunner\r\n'+'\r\n');
        originSocket.write(data);
        originSocket.pipe(clientSocket);
        clientSocket.pipe(originSocket);
      });
      originSocket.on('connect', e=> console.log(originSocket));
      clientRequest.on('error', e => logError('clientRequest (connect)', e, originUrl));
      clientSocket.on('error', e => logError('clientSocket', e, originUrl, ['ECONNRESET']));
      originSocket.on('error', e => logError('originSocket', e, originUrl));
    } catch(e) {
      console.log(e);
    }
  };

  var loadSecureOptions = function() {
    var keyPath = path.join(options.configBasePath, 'key.pem');
    var certPath = path.join(options.configBasePath, 'cert.pem');
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      console.log('Generating cert');
      var pki = forge.pki;
      var keys = pki.rsa.generateKeyPair(2048);
      var cert = pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
      var attrs = [{
        name: 'commonName',
        value: 'example.org'
      }, {
        name: 'countryName',
        value: 'US'
      }, {
        shortName: 'ST',
        value: 'Virginia'
      }, {
        name: 'localityName',
        value: 'Blacksburg'
      }, {
        name: 'organizationName',
        value: 'Test'
      }, {
        shortName: 'OU',
        value: 'Test'
      }];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey);
      fs.writeFileSync(keyPath, pki.privateKeyToPem(keys.privateKey));
      fs.writeFileSync(certPath,  pki.certificateToPem(cert));
    }
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  };

  http.createServer(handleRequest).on('connect', handleConnect)
    .listen(options.port, function() {
      console.log("WebRunner listening on: http://localhost:"+options.port);
    }).on('error', e => logError('httpServer', e));

  https.createServer(loadSecureOptions(), function (req, res) {
    res.end('it works');
    //handleRequest(req, res, "www.yahoo.com");
  }).listen(8000, () => console.log('SSL test listening on port 8000'));
};

module.exports = runFullProxy;
