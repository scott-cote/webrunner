var fs = require('fs');

module.exports = function(info) {

  var replaceBodyCallback = function(request, response, serverResponse) {
    response.statusCode = serverResponse.statusCode;
    Object.keys(serverResponse.headers).forEach((key) => {
      if (!['connection','content-encoding','transfer-encoding'].find(element => key === element)) {
        response.setHeader(key, serverResponse.headers[key]);
      }
    });
    var readStream = fs.createReadStream(info.config.filePath);
    readStream.pipe(response);
  };

  info.handleRequest = function() {
    return this.proxyRequest(replaceBodyCallback);
  };

  return info;
};
