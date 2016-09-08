
module.exports = function(info) {

  var proxyCallback = function() {
    return new Promise((resolve, reject) => {
      this.serverResponse.on('end', resolve).on('error', reject);
      this.response.statusCode = this.serverResponse.statusCode;
      Object.keys(this.serverResponse.headers).forEach((key) => {
        if (!['connection'].find(element => key === element)) {
          this.response.setHeader(key, this.serverResponse.headers[key]);
        }
      });
      this.serverResponse.pipe(this.response);
    });
  };

  info.handleRequest = function() {
    return this.proxyRequest(proxyCallback);
  };

  return info;
};
