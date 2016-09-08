var fs = require('fs');

module.exports = function(info) {

  var replaceBodyCallback = function() {
    return new Promise((resolve, reject) => {
      this.serverResponse.on('end', resolve).on('error', reject);
      this.response.statusCode = this.serverResponse.statusCode;
      Object.keys(this.serverResponse.headers).forEach((key) => {
        if (!['connection','content-encoding','transfer-encoding'].find(element => key === element)) {
          this.response.setHeader(key, this.serverResponse.headers[key]);
        }
      });
      var readStream = fs.createReadStream(info.config.filePath);
      readStream.pipe(this.response);
    });
  };

  info.handleRequest = function() {
    return this.proxyRequest(replaceBodyCallback);
  };

  return info;
};
