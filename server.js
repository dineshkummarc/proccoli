var http = require('http');
var fs = require('fs');
var querystring = require('querystring');
var url = require('url');
var mime = require('mime');
var NodeStatic = require('node-static');
var LinkedList = require('./lib/LinkedList');

var proxyPort = 8888;
var adminPort = 8889;

console.log('Proxy @ http://localhost:' + proxyPort);
console.log('Admin @ http://localhost:' + adminPort);

// Process no die, por favor
process.on('uncaughtException', function(e) {
  console.log('Uncaught error: ' + util.inspect(e) + '\n' + e.stack);
});

//
// The admin interface
//

// ReadyStates
var UNSENT            = 0;
var OPENED            = 1;
var HEADERS_RECEIVED  = 2;
var LOADING           = 3;
var DONE              = 4;

var staticServer = new NodeStatic.Server('./webroot');

var listeners = new LinkedList();

// Move this to a prefs file?
var filters = [
  {
    name: 'Filter template',
    regex: /./,
    beforeRequest: function(request, response) {
    },
    beforeResponse: function(request, response) {
      response.headers['x-proccoli'] = 'heart healthy';
    }
  }
];

http.createServer(function(req, res) {
  var parts = url.parse(req.url, true);
  var query = parts.query = parts.query || {};

  switch (parts.pathname) {
    // Endpoint for pushing proxy activity back to client
    case '/listen':
      res.writeHead(200, {
        'Content-Type': 'octet/binary-stream',
        'Content-Encoding': 'chunked'
      });
      res.write('ready\n');
      listeners.push(res);

      // Clean up any listeners that go away
      res.socket.on('end', function(e) {
        listeners.remove(res);
      });
      break;

    default:
      // Everything else gets treated as a static file
      staticServer.serve(req, res);
  }
}).listen(adminPort);

//
// The proxy interface
//

http.createServer(function(req, res) {
  // Write the url to any listeners
  var url = req.url.replace(/http:\/\/[^\/]*/, '');

  // Assign a unique id
  var uid = ((Math.random() * 0x7fffff) | 0).toString(36);
  req.notify = function(msg) {
    msg.uid = uid;
    msg.ts = Date.now();

    listeners.forEach(function(res) {
      res.write(JSON.stringify(msg) + '\n');
    });
  };

  req.notify({
    url: req.url,
    host: req.headers.host,
    readyState: UNSENT
  });

  // Proxy the request
  var client = http.createClient('80', req.headers.host);

  // Client errors include host-not-found, etc.
  client.on('error', function(err) {
    console.log('client error - ' + err.message);
    req.notify({readyState: DONE});
    res.writeHead(400);
    res.end(err.message);
  });

  var clientRequest = client.request(req.method, url, req.headers);
  clientRequest.on('error', function(err) {
    console.log('client request error (' + url + ') - ' + err.message);
  });
  clientRequest.end();

  var clientResponse = null;
  req.notify({readyState: OPENED});

  // Clean up request and response
  function cleanup() {
    if (clientRequest) {
      clientRequest = null;
    }
    if (clientResponse) {
      clientResponse.end();
      clientResponse = null;
    }
  }

  clientRequest.on('response', function(ares) {
    clientResponse = ares;
    clientResponse.on('error', function(err) {
      console.log('client response error (' + url + ') - ' + err.message);
    });

    req.notify({readyState: HEADERS_RECEIVED});

    'connect secure !data !end timeout drain !error close'.
    split(' ').forEach(function(event) {
      if (/!/.test(event)) return;
      clientResponse.on(event, function() {
        console.log(event + ' - ' + url);
      });
    });

    // Apply response filters
    filters.forEach(function(filter) {
      if (filter.regex.test(req.url) && filter.beforeResponse) {
        filter.beforeResponse(req, clientResponse);
      }
    });

    res.writeHead(clientResponse.statusCode, clientResponse.headers);
    req.notify({statusCode: clientResponse.statusCode});

    clientResponse.on('data', function(chunk) {
      req.notify({readyState: LOADING});
      // TODO: We'd like to send this to listeners. but what's
      // the best format... base64?
      res.write(chunk);
    });
    clientResponse.on('end', function() {
      req.notify({readyState: DONE});
      res.end();
    });
  });
}).listen(proxyPort);
