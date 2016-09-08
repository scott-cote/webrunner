
module.exports = function(info) {

  var log = !(info.args.verbose) ? () => {} : (msg) => console.log(msg);

  var proxyCallback = function() {
    return new Promise((resolve, reject) => {
      log('proxyCallback started');
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
