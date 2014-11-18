var net = require('net');
var fs = require('fs');
var stream = require('stream');
var assert = require('assert');
var request = require('request');
var Multipart = require('multipart-stream');

var package = JSON.parse(fs.readFileSync(__dirname + '/package.json'));

var API_PATH = "/api/v0/";

module.exports = function(address) {
  assert(address, 'Must specify an address');

  function send(path, args, opts, files, cb) {
    if(Array.isArray(path)) path = path.join('/');

    opts = opts || {};
    if(args && !Array.isArray(args)) args = [args];
    if(args) opts.arg = args;

    return request.post({
      uri: 'http://' + address + API_PATH + path,
      qs: opts,
      useQuerystring: true,
      headers: {
        'User-Agent': '/node-'+package.name+'/'+package.version+'/'
      },
      formData: getFileForm(files)
    }, function(err, res, data) {
      try {
        return cb(JSON.parse(err || 'null'), JSON.parse(data || 'null'));
      } catch(e) {
        return cb(err, data);
      }
    });
  }

  function getFileForm(files) {
    if(!files) return null;

    var output = {};
    if(!Array.isArray(files)) files = [files];

    for(var i in files) {
      var file = files[i];

      if(typeof file === 'string') {
        // TODO: get actual content type
        output[i] = {
          value: fs.createReadStream(file),
          options: {
            contentType: 'application/octet-stream',
            filename: file
          }
        };

      } else if(Buffer.isBuffer(file)) {
        output[i] = {
          value: file,
          options: {
            contentType: 'application/octet-stream',
            filename: ''
          } 
        };
      }
    }

    return output;
  }

  function command(name) {
    return function(cb) {
      send(name, null, null, null, cb);
    }
  }

  function argCommand(name) {
    return function(arg, cb) {
      send(name, arg, null, null, cb);
    }
  }

  return {
    send: send,

    add: function(file, cb) {
      send('add', null, null, file, cb);
    },
    cat: argCommand('cat'),
    ls: argCommand('ls'),

    config: {
      get: argCommand('config'),
      set: function(key, value, cb) {
        send('config', [key, value], null, null, cb)
      },
      show: command('config/show')
    },

    update: {
      apply: command('update'),
      check: command('update/check'),
      log: command('update/log')
    },
    version: command('version'),
    commands: command('commands'),

    mount: function(ipfs, ipns, cb) {
      if(typeof ipfs === 'function') {
        cb = ipfs;
        ipfs = null;
      } else if(typeof ipns === 'function') {
        cb = ipns;
        ipns = null;
      }
      var opts = {};
      if(ipfs) opts.f = ipfs;
      if(ipns) opts.n = ipns;
      send('mount', null, opts, null, cb);
    },

    diag: {
      net: command('diag/net')
    },

    block: {
      get: argCommand('block/get'),
      put: function(file, cb) {
        if(Array.isArray(file))
          return cb(null, new Error('block.put() only accepts 1 file'));
        send('block/put', null, null, file, cb);
      },
    },

    object: {
      get: argCommand('object/get'),
      put: function(file, encoding, cb) {
        if(typeof encoding === 'function')
            return cb(null, new Error('Must specify an object encoding ("json" or "protobuf")'))
        send('block/put', encoding, null, file, cb);
      },
      data: argCommand('object/data'),
      links: argCommand('object/links')
    }
  }
}
