
var util = require('util');
var stream = require('stream');
var Duplex = stream.Duplex;

function DuplexWrapper(inner) {
  if (!(this instanceof DuplexWrapper)) {
    return new DuplexWrapper(inner);
  }
  Duplex.call(this, {});
  this.inner = inner;
};

util.inherits(DuplexWrapper, Duplex);

DuplexWrapper.prototype._read = function() {
  console.log('read');
  console.log(arguments);
  var ret =  this.inner.read.apply(this.inner, arguments);
  console.log(ret);
  return ret;
};

DuplexWrapper.prototype._write = function(chunk, enc, cb)  {
  console.log('write');
};

module.exports = DuplexWrapper;
