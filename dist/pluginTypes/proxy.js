
module.exports = function(info) {

  var proxyCallback = function(request, response, serverResponse) {
    return new Promise((resolve, reject) => {
      serverResponse.on('end', resolve).on('error', reject);
      response.statusCode = serverResponse.statusCode;
      Object.keys(serverResponse.headers).forEach((key) => {
        if (!['connection'].find(element => key === element)) {
          response.setHeader(key, serverResponse.headers[key]);
        }
      });
      serverResponse.pipe(response);
    });
  };

  info.handleRequest = function() {
    return this.proxyRequest(proxyCallback);
  };

  return info;
};
