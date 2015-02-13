;(function(root) {
  var root = root || {},
      mezure = {
        enabled: true
      },
      config = {
        url: 'http://analytics.uhray.com/api/v1',
        sessionReset: 5 * 60 * 1e3,
        sessionTimeout: 10e3
      },
      session = {
        isActive: true,
        metadata: {},
        identifiers: {}
      },
      localStorage = checkLocalStorage();

  root.onfocus = function () {
    mezure.__debug('active window');
    session.isActive = true;
  };

  root.onblur = function () {
    session.isActive = false;
    mezure.__debug('inactive window');
  };

  mezure.VERSION = '1.0.0';
  mezure.__config = config;
  mezure.__debug = root.debug ? root.debug('mezure') : noop;
  mezure.__started_session = false;
  mezure.__initialized_activity = false;

  mezure.configure = function(cfg) {
    merge(config, cfg);
    mezure.__debug('set config %j --> %j', cfg, config);
    getItem('license');  // force clear if license changed
    if (cfg.license) {
      setItem('license', cfg.license);
    }
  }

  mezure.session = function(meta, ids) {
    session.metadata = meta || {};
    session.identifiers = ids || {};
    if (!mezure.__started_session) handleSession();
    mezure.__started_session = true;
  }

  mezure.activity = function(name, meta, ids) {
    var fn = arguments.callee,
        name = name && ('-mezure-activity-' + name),
        prep = prepArgs(name, 1, meta, ids, null);

    // invalid args
    if (!prep) return;

    // set up queuer
    fn.queue = fn.queue || [];
    fn.queue.push(prep);
    mezure.__debug('queueing activity', name);

    // start queueing
    if (fn.going) return;
    else go(fn.queue.shift());

    function go(prep) {
      var refData;

      if (!prep) return fn.going = false;
      refData = getActivityReferrer();

      fn.going = true;
      prep.obj.metadata.referrer = refData.referrer;
      mezure.__debug('activity referrer data: %j', refData);
      mezure.__debug('going to create activity %s --> %j', prep.name, prep.obj);
      sendRecord(prep.name, 'activity', prep.obj, function(e, id) {
        fn.going = false;
        if (!e && id) {
          refData.referrer = id;
          refData.time = new Date().getTime();
          setObject('activity_streams', refData.name, refData);
          mezure.__debug('activited created at %s', id);
        }
        go(fn.queue.shift());
      });
    }
  }

  mezure.record = function(name, value, meta, ids, cb) {
    var prep = prepArgs(name, value, meta, ids, cb);
    if (!prep) return;
    mezure.__debug('going to create record %s --> %j', name, prep.obj);
    sendRecord(name, 'custom', prep.obj, prep.cb);
  }

  // Expose Mezure =============================================================

  if (typeof define !== 'undefined' && define.amd) {
    define('mezure', [], function() { return mezure; });
  } else {
    root.mezure = mezure;
  }

  // Private Functions =========================================================

  function noop() { }

  function prepArgs(name, value, meta, ids, cb) {
    var create;

    // required
    if (!name || value == undefined) return cb('invalid args');

    // if no meta or ids
    if ('function' === typeof meta) {
      cb = meta;
      meta = {};
      ids = {};
    }

    // if no ids
    if ('function' === typeof ids) {
      cb = ids;
      ids = {};
    }

    // defaults
    meta = (meta && copy(meta)) || {};
    ids = (ids && copy(ids)) || {};
    cb = cb || noop;

    // make object
    create = {
      value: value,
      metadata: meta,
      identifiers: ids
    };

    return { obj: create, cb: cb, name: name };
  }

  function copy(d) {
    return JSON.parse(JSON.stringify(d));
  }

  function getActivityReferrer(cb) {
    var docRef = root.document && root.document.referrer,
        wname = root.name,
        streams = getObject('activity_streams'),
        data = streams[wname],
        streams, sameOrigin, m, diff;

    // need to figure out of continued or old stream
    if (!mezure.__initialized_activity || !data) {
      mezure.__initialized_activity = true;
      m = docRef && docRef.match(/:\/\/(.[^/:]+)/)
      sameOrigin = m && m[1] && m[1] == root.location.hostname;
      mezure.__initialized_activity;

      // same origin, same name, has data -- continued stream
      if (docRef && sameOrigin && wname && data) return data;

      // clear out old data
      for (m in streams) {
        diff = Math.abs(new Date(streams[m].time).getDay() -
                        new Date().getDay());
        if (diff > 2) clearKey('activity_streams', m);
      }

      // start new stream
      wname = root.name = uuid();
      mezure.__debug('activity init - new window', wname);
      m = { referrer: null, time: new Date().getTime(), name: wname };
      setObject('activity_streams', wname, m);
      return m;
    }

    // should always have data now that it's a continuation
    mezure.__initialized_activity = true;
    return data;
  }

  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
  };

  function uuid() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  }

  function merge(a, b) {
    a = a || {};
    b = b || {};
    for (var k in b) a[k] = b[k];
    return a;
  }

  function handleSession() {
    var isActive = session.isActive,
        meta = JSON.parse(JSON.stringify(session.metadata)),
        ids = session.identifiers,
        timeStamp = getItem('session_timestamp') || new Date().getTime(),
        id = getItem('session_id');

    if (!isActive) return setTimeout(handleSession, config.sessionTimeout),
                          mezure.__debug('inactive session', new Date());

    if (!id || !timeStamp ||
        (new Date() - timeStamp > config.sessionReset)) {
      mezure.__debug('creating new session', id, timeStamp, getItem('session_id'));
      meta.startTime = meta.endTime = new Date().getTime();
      sendRecord('-mezure-session-', 'session',
                 { value: 1, metadata: meta, identifiers: ids }, callback);
    } else {
      mezure.__debug('updating old id %s', id);
      meta.endTime = new Date().getTime();
      updateRecord(id, { metadata: meta, identifiers: ids }, callback);
    }

    function callback(e, id) {
      var d = new Date().getTime();
      setItem('session_timestamp', d);
      if (!e && id) setItem('session_id', id);
      mezure.__debug('session logged: (%s, %s)', id, d);
      setTimeout(handleSession, config.sessionTimeout);
    }
  }

  function getMetrics(name, type, cb) {
    var mid = getObject('metric_store', {})[name];

    if (mid) return cb(null, mid);

    request('GET', config.url + '/metrics?fields=name', {},
            function(e, body) {
      var metrics = {};

      // logging result
      mezure.__debug('getting metrics: %j --> %j', e, body);

      // quit if error
      if (e || !body || !(body instanceof Array)) return cb(e);

      // get id
      body.forEach(function(m) { metrics[m.name] = m._id; });
      mid = metrics[name];
      setObject('metric_store', metrics);

      if (mid) return cb(null, mid);

      mezure.__debug('creating new metric (name=%s, type=%s)', name, type);
      request('POST', config.url + '/metrics', { name: name, type: type },
              function(e, d) {
        var obj = {};

        // log result
        mezure.__debug('created metric: %j --> %j', e, d);

        // handle error
        if (e || !d || !d._id) return cb(e || 'failure to create metric');

        // store and return
        obj[name] = d._id;
        setObject('metric_store', obj);
        cb(null, d._id);
      });
    });
  }

  function updateRecord(id, data, cb) {
    cb = cb || noop;

    // log debug info
    mezure.__debug('Going to update record: ' +
                   '\n   id=%j' +
                   '\n   updates=%j',
                   id, data);

    // send request
    request('PUT', config.url + '/records/' + id, data, function(e, d) {
      if (e || !d) cb(e || 'failure');
      else cb(null, d && d._id);
    });
  }

  function sendRecord(name, type, obj, cb) {
    getMetrics(name, type, function(e, mid) {
      if (e || !mid) return cb(e || 'problem finding metric');

      // set data
      obj.metric = mid;

      // log debug info
      mezure.__debug('Going to send data: ' +
                     '\n   name=%j' +
                     '\n   metricid=%s' +
                     '\n   data=%j',
                     name, mid, obj);

      // send request
      request('POST', config.url + '/records', obj, function(e, d) {
        var id = d && d._id;
        if (e) cb(e);
        else cb(id ? null : 'falure', id);
      });
    });
  }

  function getObject(d) {
    var str = getItem(d);
    if (!str) return {};
    try { return JSON.parse(str); }
    catch(e) { return {}; };
  }

  function getItem(d, or) {
    var ls = localStorage,
        license, str;

    if (!ls) return or;
    license = ls.getItem('mezure-license');
    if (license !== config.license) clearStorage();
    str = ls.getItem('mezure-' + d);
    return str;
  }

  function setItem(s, d) {
    var ls = localStorage;
    if (!d || !ls) return;
    ls.setItem('mezure-' + s, d);
  }

  function clearStorage() {
    var ls = localStorage,
        k;

    if (!ls) return or;
    for (k in ls) if (k.match(/^mezure/)) ls.removeItem(k);
  }

  function clearKey(n, k) {
    var data = getObject(n);
    if (data.hasOwnProperty(k)) delete data[k];
    setItem(n, JSON.stringify(data));
  }

  function setObject(s, d, v) {
    var old = getObject(s),
        x;

    if (arguments.length == 3) {
      x = {};
      x[d] = v;
      d = x;
    }

    setItem(s, JSON.stringify(merge(old, d)));
  }

  function request(method, url, data, cb) {
    try {
      var req = typeof(XMLHttpRequest) != 'undefined'
                  ? new XMLHttpRequest()
                  : new ActiveXObject('Microsoft.XMLHTTP');

      req.open(method, url, true);
      req.setRequestHeader('Content-type', 'application/json');
      req.setRequestHeader('-mezure-license-', config.license);
      req.onreadystatechange = function() {
        var status, data, error;
        if (req.readyState == 4) {  // done
          status = req.status;
          if (status == 200) {
            try {
              data = JSON.parse(req.responseText);
              error = data && data.error;
              data = data && data.data;
            } catch (e) { error = 'invalid json response' };
          } else {
            error = { code: status, message: 'invalid status code' };
          }
          return cb && cb(error, data);
        }
      }

      if (data) req.send(JSON.stringify(data));
      else req.send();
    } catch (e) {
      mezure.enabled = false;
    }
  }

  function checkLocalStorage() {
    try {
      localStorage.setItem(mod, mod);
      localStorage.removeItem(mod);
      return localStorage;
    } catch(e) {
      return root.localStorage = {
        setItem: function(k, v) { localStorage._store[k] = v; },
        getItem: function(k) { return localStorage._store[k]; },
        _store: {}
      }
    }
  }

})(this);
