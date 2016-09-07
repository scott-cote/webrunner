#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var url = require('url');
var http = require('http');
var https = require('https');
var argv = require('minimist')(process.argv.slice(2));

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
      serverResponse.on('end', resolve).on('error', reject);
      callback(this.request, this.response, serverResponse)
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

(function() {
  if (argv.version) {
    var package = require('../package.json')
    console.log(package.version);
    return;
  }
  var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
  var configPath = path.join(homePath, '.webrunner', 'config.json');
  try {
    config = require(configPath);
    profile = config.profiles.find(profile => {
      if (!argv.profile) return true;
      return profile.name === argv.profile;
    });
    plugins = (profile.plugins || []).map(plugin => require('./pluginTypes/'+plugin.type+'.js')(plugin));
    defaultPlugin = require('./pluginTypes/proxy.js')({ matchType: 'default', type: 'proxy' });
  } catch(e) {
    console.log('WebRunner was unable to start. Configuration file may be missing or incorrect.')
    return;
  }
  http.createServer(handleRequest).listen(5150, function() {
    console.log("WebRunner listening on: http://localhost:5150");
  });
})();
