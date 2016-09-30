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

  var buildCert = function(cert, caCert, publicKey, signKey, name) {
    cert.publicKey = publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    var attrs = [{
      name: 'commonName',
      value: name
    }, {
      name: 'countryName',
      value: 'US'
    }, {
      shortName: 'ST',
      value: 'State'
    }, {
      name: 'localityName',
      value: 'City'
    }, {
      name: 'organizationName',
      value: 'org'
    }, {
      shortName: 'OU',
      value: 'org'
    }];
    cert.setSubject(attrs);
    cert.setIssuer(caCert ? caCert.subject.attributes : attrs);
    cert.sign(signKey, forge.md.sha256.create());
  };

  var loadSecureOptions = function() {
    var caKeyPath = path.join(options.configBasePath, 'cakey.pem');
    var caCertPath = path.join(options.configBasePath, 'cacert.pem');
    var serverKeyPath = path.join(options.configBasePath, 'localhost-key.pem');
    var serverCertPath = path.join(options.configBasePath, 'localhost-cert.pem');
    if (!fs.existsSync(serverKeyPath) || !fs.existsSync(serverCertPath) ||
        !fs.existsSync(caKeyPath) || !fs.existsSync(caCertPath)) {
      console.log('Generating certs');
      var pki = forge.pki;
      var caKeys = pki.rsa.generateKeyPair(2048);
      var serverKeys = pki.rsa.generateKeyPair(2048);
      var caCert = pki.createCertificate();
      var serverCert = pki.createCertificate();

      buildCert(caCert, null, caKeys.publicKey, caKeys.privateKey, 'webrunner');
      buildCert(serverCert, caCert, serverKeys.publicKey, caKeys.privateKey, 'localhost');

      fs.writeFileSync(caKeyPath, pki.privateKeyToPem(caKeys.privateKey));
      fs.writeFileSync(caCertPath,  pki.certificateToPem(caCert));
      fs.writeFileSync(serverKeyPath, pki.privateKeyToPem(serverKeys.privateKey));
      fs.writeFileSync(serverCertPath,  pki.certificateToPem(serverCert));
    }
    return { key: fs.readFileSync(serverKeyPath), cert: fs.readFileSync(serverCertPath) };
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
