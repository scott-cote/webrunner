var fs = require('fs');
var path = require('path');
var url = require('url');
var http = require('http');
var https = require('https');

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
    if (plugin.matchType === 'urlPath') {
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
  var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
  var configPath = path.join(homePath, '.plsqlrunner', 'config.json');
  config = require(configPath);
  profile = config.profiles[0];
  plugins = (profile.plugins || []).map(plugin => require('./pluginTypes/'+plugin.type+'.js')(plugin));
  defaultPlugin = require('./pluginTypes/proxy.js')({ matchType: 'default', type: 'proxy' });
  http.createServer(handleRequest).listen(5150, function() {
    console.log("PLSQLRunner listening on: http://localhost:5150");
  });
})();
