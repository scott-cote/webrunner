
var util = require('util');
var stream = require('stream');
var Duplex = stream.Duplex;
var PassThrough = stream.PassThrough;

function DuplexThrough(options) {
  if (!(this instanceof DuplexThrough)) {
    return new DuplexThrough(options);
  }
  Duplex.call(this, options);
  this.inStream = new PassThrough();
  this.outStream = new PassThrough();
}

util.inherits(DuplexThrough, Duplex);

DuplexThrough.prototype.readOutStream = function(n) {
  var chunk;
  while (null !== (chunk = this.outStream.read(n))) {
    // if push returns false, stop writing
    if (!this.push(chunk)) break;
  }
};

DuplexThrough.prototype._write = function(chunk, enc, cb) {
  console.log('** write');
  this.inStream.write(chunk, enc, cb);
};

DuplexThrough.prototype._read = function(n) {
  console.log('** read');
  if (this.handlersSetup) {
    this.readOutStream(n);
  } else {
    this.handlersSetup = true;
    var self = this;
    self.outStream
      .on('readable', () => { self.readOutStream(n) })
      .on('end', () => { self.push(null) });
  }
};

module.exports = DuplexThrough;
