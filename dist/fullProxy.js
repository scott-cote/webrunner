var http = require('http');
var https = require('https');
var url = require('url');
var net = require('net');
var fs = require('fs');
var path = require('path');
var forge = require('node-forge');
var tls = require('tls');

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

  var caKey;
  var caCert;

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
    //console.log('running handleRequest');
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

  /*
  //function Server([options], listener ) {
    var options, listener;

    if (arguments[0] !== null && typeof arguments[0] === 'object') {
      options = arguments[0];
      listener = arguments[1];
    } else if (typeof arguments[0] === 'function') {
      options = {};
      listener = arguments[0];
    }

    if (!(this instanceof Server)) return new Server(options, listener);

    this._contexts = [];

    var self = this;

    // Handle option defaults:
    this.setOptions(options);

    var sharedCreds = tls.createSecureContext({
      pfx: self.pfx,
      key: self.key,
      passphrase: self.passphrase,
      cert: self.cert,
      ca: self.ca,
      ciphers: self.ciphers,
      ecdhCurve: self.ecdhCurve,
      dhparam: self.dhparam,
      secureProtocol: self.secureProtocol,
      secureOptions: self.secureOptions,
      honorCipherOrder: self.honorCipherOrder,
      crl: self.crl,
      sessionIdContext: self.sessionIdContext
    });
    this._sharedCreds = sharedCreds;

    var timeout = options.handshakeTimeout || (120 * 1000);

    if (typeof timeout !== 'number') {
      throw new TypeError('handshakeTimeout must be a number');
    }

    if (self.sessionTimeout) {
      sharedCreds.context.setSessionTimeout(self.sessionTimeout);
    }

    if (self.ticketKeys) {
      sharedCreds.context.setTicketKeys(self.ticketKeys);
    }

    // constructor call
    net.Server.call(this, function(raw_socket) {
      var socket = new TLSSocket(raw_socket, {
        secureContext: sharedCreds,
        isServer: true,
        server: self,
        requestCert: self.requestCert,
        rejectUnauthorized: self.rejectUnauthorized,
        handshakeTimeout: timeout,
        NPNProtocols: self.NPNProtocols,
        SNICallback: options.SNICallback || SNICallback
      });

      socket.on('secure', function() {
        if (socket._requestCert) {
          var verifyError = socket._handle.verifyError();
          if (verifyError) {
            socket.authorizationError = verifyError.code;

            if (socket._rejectUnauthorized)
              socket.destroy();
          } else {
            socket.authorized = true;
          }
        }

        if (!socket.destroyed && socket._releaseControl())
          self.emit('secureConnection', socket);
      });

      var errorEmitted = false;
      socket.on('close', function(err) {
        // Closed because of error - no need to emit it twice
        if (err)
          return;

        // Emit ECONNRESET
        if (!socket._controlReleased && !errorEmitted) {
          errorEmitted = true;
          var connReset = new Error('socket hang up');
          connReset.code = 'ECONNRESET';
          self.emit('clientError', connReset, socket);
        }
      });

      socket.on('_tlsError', function(err) {
        if (!socket._controlReleased && !errorEmitted) {
          errorEmitted = true;
          self.emit('clientError', err, socket);
        }
      });
    });

    if (listener) {
      this.on('secureConnection', listener);
    }
  }
  */

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

  /*
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
  */

  var createSecureContextFor = function(hostname) {
    console.log('createSecureContextFor '+hostname);
    var hostFilename = hostname.replace('.', '-');
    var serverKeyPath = path.join(options.configBasePath, hostFilename+'-key.pem');
    var serverCertPath = path.join(options.configBasePath, hostFilename+'-cert.pem');
    if (!fs.existsSync(serverKeyPath) || !fs.existsSync(serverCertPath)) {
      console.log('Generating cert for '+hostname);
      var pki = forge.pki;
      var serverKeys = pki.rsa.generateKeyPair(2048);
      var serverCert = pki.createCertificate();
      buildCert(serverCert, caCert, serverKeys.publicKey, caKeys.privateKey, '*.'+hostname);
      fs.writeFileSync(serverKeyPath, pki.privateKeyToPem(serverKeys.privateKey));
      fs.writeFileSync(serverCertPath,  pki.certificateToPem(serverCert));
    }
    console.log('Loading cert for '+hostname);
    var secureContextOptions = {
      key: fs.readFileSync(serverKeyPath),
      cert: fs.readFileSync(serverCertPath)
    };
    return tls.createSecureContext(secureContextOptions)
  };

  var normalizeHostname  = function(hostname) {
    return hostname.split('.').slice(-2).join('.');
  };

  var isDebugOrigin = function(hostname) {
    return normalizeHostname(hostname) === 'yahoo.com';
  };

  var inspectSecureTraffic = function(originUrl, clientRequest, clientSocket, data) {
    var hostname = normalizeHostname(originUrl.hostname);
    var options = {
      secureContext: createSecureContextFor(hostname),
      isServer: true,

      //server: self,
      //requestCert: self.requestCert,
      //rejectUnauthorized: self.rejectUnauthorized,
      //handshakeTimeout: timeout,
      //NPNProtocols: self.NPNProtocols,
      //SNICallback: options.SNICallback || SNICallback
    };
    /*
    clientSocket.push(data);
    var clientTlsSocket = new tls.TLSSocket(clientSocket, options);
    clientTlsSocket.on('secure', () => console.log('secure'));
    */
    bypassDebugger(originUrl, clientRequest, clientSocket, data);
  };

  var bypassDebugger = function(originUrl, clientRequest, clientSocket, data) {
    var originSocket = net.connect(originUrl.port, originUrl.hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n'+'Proxy-agent: WebRunner\r\n'+'\r\n');
      originSocket.write(data);
      originSocket.pipe(clientSocket);
      clientSocket.pipe(originSocket);
    });
    //originSocket.on('connect', e => console.log(originSocket));
    clientRequest.on('error', e => logError('clientRequest (connect)', e, originUrl));
    clientSocket.on('error', e => logError('clientSocket', e, originUrl, ['ECONNRESET']));
    originSocket.on('error', e => logError('originSocket', e, originUrl));
  };

  var handleConnect = function(clientRequest, clientSocket, data) {
    //console.log('running handleConnect');
    try {
      var originUrl = url.parse(`https://${clientRequest.url}`);
      if (isDebugOrigin(originUrl.hostname)) {
        inspectSecureTraffic(originUrl, clientRequest, clientSocket, data);
      } else {
        bypassDebugger(originUrl, clientRequest, clientSocket, data);
      }
    } catch(e) {
      console.log(e);
    }
  };

  var initCa = function() {
    var caKeyPath = path.join(options.configBasePath, 'cakey.pem');
    var caCertPath = path.join(options.configBasePath, 'cacert.pem');
    if (!fs.existsSync(caKeyPath) || !fs.existsSync(caCertPath)) {
      console.log('Generating CA');
      var pki = forge.pki;
      var caKeys = pki.rsa.generateKeyPair(2048);
      var caCert = pki.createCertificate();
      buildCert(caCert, null, caKeys.publicKey, caKeys.privateKey, 'webrunner');
      fs.writeFileSync(caKeyPath, pki.privateKeyToPem(caKeys.privateKey));
      fs.writeFileSync(caCertPath,  pki.certificateToPem(caCert));
    }
    console.log('Loading CA');
    caKey  = fs.readFileSync(caKeyPath);
    caCert = fs.readFileSync(caCertPath);
  };

  initCa();

  http.createServer(handleRequest).on('connect', handleConnect)
    .listen(options.port, function() {
      console.log("WebRunner (full proxy) listening on: http://localhost:"+options.port);
    }).on('error', e => logError('httpServer', e));
};

module.exports = runFullProxy;
