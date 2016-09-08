
module.exports = function(info) {

  var log = !(info.options.verbose) ? () => {} : (msg) => console.log(msg);

  var proxyCallback = function() {
    return new Promise((resolve, reject) => {

      var serverResponseEnd = function() {
        log('serverResponseEnd');
        resolve();
      };

      var serverResponseError = function(e) {
        log('serverResponseError '+e);
        reject(e);
      };

      var responseEnd = function() {
        log('responseEnd');
      };

      var responseError = function(e) {
        log('responseError '+e);
        reject(e);
      };

      log('proxyCallback started');
      this.serverResponse.on('end', serverResponseEnd).on('error', serverResponseError);
      this.response.on('end', responseEnd).on('error', responseError);
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
