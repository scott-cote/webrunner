#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var url = require('url');
var http = require('http');
var https = require('https');
var minimist = require('minimist');
var runFullProxy = require('./fullProxy.js');

var buildRequestHeaders = function(headers) {
  var newHeaders = {};
  Object.keys(headers).forEach((key) => {
    if (!['host','connection','referer'].find(element => key === element)) {
      newHeaders[key] = headers[key];
    }
  });
  newHeaders.host = profile.host;
  if (headers.referer) {
    var protocol = profile.secureHost ? 'https://' : 'http://';
    newHeaders.referer = protocol+profile.host+url.parse(headers.referer).path;
  }
  return newHeaders;
};

var proxyRequest = function(callback) {
  return new Promise((resolve, reject) => {
    var protocol = profile.secureHost ? https : http;
    protocol.request({
      host: profile.host,
      path: url.parse(this.request.url).path,
      headers: buildRequestHeaders(this.request.headers)
    }, (serverResponse) => {
      callback.call({ request: this.request, response: this.response, serverResponse: serverResponse })
        .then(resolve).catch(reject);
    }).on('error', reject).end();
  });
};

var pluginMatcher = function(request) {
  return function(plugin) {
    if (plugin.enabled === false) {
      return false;
    } else if (plugin.matchType === 'urlPath') {
      return url.parse(request.url).path === plugin.matchValue;
    } else if (plugin.matchType === 'urlPathname') {
      return url.parse(request.url).pathname === plugin.matchValue;
    } else if (plugin.matchType === 'function' && plugin.matchFunction) {
      return plugin.matchFunction(request);
    } else {
      return false;
    }
  };
}

var handleRequest = function(request, response) {
  var plugin = plugins.find(pluginMatcher(request)) || defaultPlugin;
  plugin.handleRequest.call({ request: request, response: response, proxyRequest: proxyRequest })
    .catch((e) => console.log('Error: '+e));
};

var parseOptions = function() {
  options = minimist(process.argv.slice(2), {
    unknown: () => false,
    boolean: ['verbose','version','x-full-proxy','x-ssl-test'],
    string: ['port','profile'],
  });
  if (options.port && parseInt(options.port) != options.port) {
    throw "Invalid port command line option";
  }
  options.port = parseInt(options.port) || 5150;
};

(function() {
  parseOptions();
  if (options.version) {
    var package = require('../package.json')
    console.log(package.version);
    return;
  }
  var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
  var configBasePath = path.join(homePath, '.webrunner');
  var configPath = path.join(configBasePath, 'config.json');
  if (!fs.existsSync(configPath)) {
    if (!fs.existsSync(configBasePath)) {
      fs.mkdirSync(configBasePath);
    }
    var defaultConfig = '{ "profiles": [ { "name": "yahoo", "host": "www.yahoo.com", "secureHost": true } ] }';
    fs.writeFileSync(configPath, defaultConfig);
  }
  try {
    config = require(configPath);
    profile = config.profiles.find(profile => {
      if (!options.profile) return true;
      return profile.name === options.profile;
    });
    plugins = (profile.plugins || []).map(plugin => require('./pluginTypes/'+plugin.type+'.js')(plugin));
    defaultPlugin = require('./pluginTypes/proxy.js')({ matchType: 'default', type: 'proxy', options: options });
  } catch(e) {
    console.log('WebRunner was unable to start. Configuration file may be incorrect.')
    return;
  }
  if (options['x-full-proxy']) {
    runFullProxy();
  } else {
    http.createServer(handleRequest).listen(options.port, function() {
      console.log("WebRunner listening on: http://localhost:"+options.port);
    });
  }
})();
