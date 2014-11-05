
require.config({
  paths: {
    debug:    '/bower_components/debug/dist/debug',
    mezure:    '/dist/mezure'
  }
});

requirejs(['mezure', 'debug'], function(mezure, debug) {
  Debug = debug;
  mezure.__debug = debug('mezure');
  mezure.configure({ license: '475b13c0-642b-11e4-a0e0-a39afb34eabf',
                     sessionTimeout: 30e3 });
  mezure.record('users', 1, function(e, id) {
    console.log('response id', e, id);
  });

  mezure.session({ age: 7 }, { user: '77ab8ab8a' });
  mezure.activity('home');
  mezure.activity('nextpage');
});

