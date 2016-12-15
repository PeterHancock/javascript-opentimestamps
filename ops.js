'use strict';

const Utils = require('./utils.js');
const crypto = require('crypto');

class Op {

  constructor() {
  }

  call(msg) {
    if (msg.length > this.MAX_MSG_LENGTH()) {
      console.log('Error : Message too long;');
      return;
    }

    const r = this.call(msg);

    if (r.length > this.MAX_RESULT_LENGTH()) {
      console.log('Error : Result too long;');
    }
    return r;
  }

  call(msg) {
    console.log('raise NotImplementedError');
  }

  static MAX_RESULT_LENGTH() {
    return 4096;
  }
  static MAX_MSG_LENGTH() {
    return 4096;
  }

  static deserialize(ctx) {
    this.tag = ctx.read_bytes(1);
    this.tag = String.fromCharCode(this.tag[0]);
    return Op.deserialize_from_tag(ctx, this.tag);
  }

  static deserialize_from_tag(ctx, tag) {
    if (Object.keys(SUBCLS_BY_TAG).indexOf(tag) != -1) {
      return SUBCLS_BY_TAG[tag].deserialize_from_tag(ctx, tag);
    } else {
      console.log('Unknown operation tag: ', Utils.bytesToHex([tag]));
    }
  }
  serialize(ctx, tag) {
    ctx.write_bytes(tag);
  }
}

// BINARY SECTION
class OpBinary extends Op {

  constructor(arg_) {
    super();
    if (arg_ == undefined) {
      this.arg = [];
    } else {
      this.arg = arg_;
    }
  }

  static deserialize_from_tag(cls, ctx, tag) {
        // tag=String.fromCharCode(tag);
    if (Object.keys(SUBCLS_BY_TAG).indexOf(tag) != -1) {
      const arg = ctx.read_varbytes(cls.MAX_RESULT_LENGTH(), 1);
      console.log('read: ' + Utils.bytesToHex(arg));
      return new SUBCLS_BY_TAG[tag](arg);
    } else {
      console.log('Unknown operation tag: ', Utils.bytesToHex([tag.charCodeAt()]));
    }
  }
  serialize(ctx, tag) {
    super.serialize(ctx, tag);
    ctx.write_varbytes(this.arg[0]);
  }
  toString() {
    return this.TAG_NAME() + ' ' + Utils.bytesToHex(this.arg);
  }
}

class OpAppend extends OpBinary {
  constructor(arg_) {
    super(arg_);
    if (arg_ == undefined) {
      this.arg = [];
    } else {
      this.arg = arg_;
    }
  }
  static TAG() {
    return '\xf0';
  }
  TAG_NAME() {
    return 'append';
  }
  call(msg) {
    return msg.concat(this.arg);
  }
  static deserialize_from_tag(ctx, tag) {
    return super.deserialize_from_tag(this, ctx, tag);
  }
  serialize(ctx) {
    return super.serialize(ctx, OpAppend.TAG());
  }
}

class OpPrepend extends OpBinary {
  constructor(arg_) {
    super(arg_);
    if (arg_ == undefined) {
      this.arg = [];
    } else {
      this.arg = arg_;
    }
  }
  static TAG() {
    return '\xf1';
  }
  TAG_NAME() {
    return 'prepend';
  }
  call(msg) {
    return this.arg.concat(msg);
  }
  static deserialize_from_tag(ctx, tag) {
    return super.deserialize_from_tag(this, ctx, tag);
  }
}

// UNARY SECTION
class OpUnary extends Op {
  constructor(arg_) {
    super();
    if (arg_ == undefined) {
      this.arg = [];
    } else {
      this.arg = arg_;
    }
  }
  static deserialize_from_tag(ctx, tag) {
    if (Object.keys(SUBCLS_BY_TAG).indexOf(tag) != -1) {
      return new SUBCLS_BY_TAG[tag]();
    } else {
      console.log('Unknown operation tag: ', Utils.bytesToHex([tag]));
    }
  }
  toString() {
    return this.TAG_NAME() + ' ' + Utils.bytesToHex(this.arg);
  }
}

class OpReverse extends OpUnary {
  constructor(arg_) {
    super(arg_);
    if (arg_ == undefined) {
      this.arg = [];
    } else {
      this.arg = arg_;
    }
  }
  static TAG() {
    return '\xf2';
  }
  TAG_NAME() {
    return 'reverse';
  }
  call(msg) {
    if (msg.length == 0) {
      console.log('Can\'t reverse an empty message');
    }
        // return msg;//[::-1];
  }
  static deserialize_from_tag(ctx, tag) {
    return super.deserialize_from_tag(ctx, tag);
  }
}

class OpHexlify extends OpUnary {
  constructor(arg_) {
    super(arg_);
    if (arg_ == undefined) {
      this.arg = [];
    } else {
      this.arg = arg_;
    }
  }
  static TAG() {
    return '\xf3';
  }
  TAG_NAME() {
    return 'hexlify';
  }
  static MAX_MSG_LENGTH() {
    return UnaryOp.MAX_RESULT_LENGTH(); // 2
  }
  call(msg) {
    if (msg.length == 0) {
      console.log('Can\'t hexlify an empty message');
    }
  }
  static deserialize_from_tag(ctx, tag) {
    return super.deserialize_from_tag(this, ctx, tag);
  }
}

class CryptOp extends OpUnary {

  HASHLIB_NAME() {
    return '';
  }

  call(msg) {
    const shasum = crypto.createHash(this.HASHLIB_NAME()).update(new Buffer(msg));
    const hashDigest = shasum.digest();
        // from buffer to array
    const output = [hashDigest.length];
    for (let i = 0; i < hashDigest.length; i++) {
      output[i] = hashDigest[i];
    }
    return output;
  }
  static deserialize_from_tag(ctx, tag) {
    return super.deserialize_from_tag(ctx, tag);
  }

  hash_fd(ctx) {
    const hasher = crypto.createHash(this.HASHLIB_NAME());
    while (true) {
      const chuck = ctx.read(1048576); // (2**20) = 1MB chunks
      if (chuck != undefined && chuck.length > 0) {
        hasher.update((new Buffer(chuck)));
      } else {
        break;
      }
    }
        // from buffer to array
    const hashDigest = hasher.digest();
    const output = [hashDigest.length];
    for (let i = 0; i < hashDigest.length; i++) {
      output[i] = hashDigest[i];
    }
    return output;
  }
}

class OpSHA1 extends CryptOp {
  static TAG() {
    return '\x02';
  }
  TAG_NAME() {
    return 'sha1';
  }
  HASHLIB_NAME() {
    return 'sha1';
  }
  DIGEST_LENGTH() {
    return 20;
  }
  static deserialize_from_tag(ctx, tag) {
    return super.deserialize_from_tag(this, ctx, tag);
  }
  call(msg) {
    return super.call(msg);
  }
}

class OpRIPEMD160 extends CryptOp {
  static TAG() {
    return '\x03';
  }
  TAG_NAME() {
    return 'ripemd160';
  }
  HASHLIB_NAME() {
    return 'ripemd160';
  }
  DIGEST_LENGTH() {
    return 20;
  }
  static deserialize_from_tag(ctx, tag) {
    return super.deserialize_from_tag(this, ctx, tag);
  }
  call(msg) {
    return super.call(msg);
  }
}

class OpSHA256 extends CryptOp {

  static TAG() {
    return '\x08';
  }
  TAG_NAME() {
    return 'sha256';
  }
  HASHLIB_NAME() {
    return 'sha256';
  }
  DIGEST_LENGTH() {
    return 32;
  }
  static deserialize_from_tag(ctx, tag) {
    return super.deserialize_from_tag(ctx, tag);
  }
  call(msg) {
    return super.call(msg);
  }
}

const SUBCLS_BY_TAG = [];
SUBCLS_BY_TAG[OpAppend.TAG()] = OpAppend;
SUBCLS_BY_TAG[OpPrepend.TAG()] = OpPrepend;
SUBCLS_BY_TAG[OpReverse.TAG()] = OpReverse;
SUBCLS_BY_TAG[OpHexlify.TAG()] = OpHexlify;
SUBCLS_BY_TAG[OpSHA1.TAG()] = OpSHA1;
SUBCLS_BY_TAG[OpRIPEMD160.TAG()] = OpRIPEMD160;
SUBCLS_BY_TAG[OpSHA256.TAG()] = OpSHA256;

module.exports = {
  Op,
  OpAppend,
  OpPrepend,
  OpReverse,
  OpHexlify,
  OpSHA1,
  OpRIPEMD160,
  OpSHA256,
  CryptOp
};
