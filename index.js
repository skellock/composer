'use strict';

var Run = require('./lib/run');
var Task = require('./lib/task');
var noop = require('./lib/noop');
var utils = require('./lib/utils');
var map = require('./lib/map-deps');
var flowFactory = require('./lib/flow');
var Emitter = require('component-emitter');
var builds = [];

/**
 * Composer constructor. Create an instance of `Composer`
 *
 * ```js
 * var composer = new Composer();
 * ```
 */

function Composer(name) {
  Emitter.call(this);
  this.tasks = {};
  utils.define(this, '_appname', name || 'composer');
  utils.define(this, 'buildHistory', {
    get: function() {
      return builds;
    }
  });
}

/**
 * Mix in `Emitter` methods
 */

Emitter(Composer.prototype);

/**
 * Register a new task with it's options and dependencies. To
 * return the task object of an already registered task, pass
 * the name of the task without any additional parameters.
 *
 * Dependencies may also be specified as a glob pattern. Be aware that
 * the order cannot be guarenteed when using a glob pattern.
 *
 * ```js
 * // register task "site" with composer
 * app.task('site', ['styles'], function() {
 *   return app.src('templates/pages/*.hbs')
 *     .pipe(app.dest('_gh_pages'));
 * });
 *
 * // get the "site" task object
 * var task = app.task('site');
 * ```
 * @param {String} `name` Name of the task to register
 * @param {Object} `options` Options to set dependencies or control flow.
 * @param {Object} `options.deps` array of dependencies
 * @param {Object} `options.flow` How this task will be executed with it's dependencies (`series`, `parallel`, `settleSeries`, `settleParallel`)
 * @param {String|Array|Function} `deps` Additional dependencies for this task.
 * @param {Function} `fn` Final function is the task to register.
 * @return {Object} Return the instance for chaining
 * @api public
 */

Composer.prototype.task = function(name/*, options, deps, task */) {
  if (typeof name !== 'string') {
    throw new TypeError('expected `name` to be a string');
  }

  var deps = [].concat.apply([], [].slice.call(arguments, 1));
  if (!deps.length) {
    return this.tasks[name];
  }

  var options = {};
  var fn = noop;
  if (typeof deps[deps.length - 1] === 'function') {
    fn = deps.pop();
  }

  if (deps.length && utils.isobject(deps[0])) {
    options = deps.shift();
  }

  options.deps = utils.unique(deps
    .concat(options.deps || [])
    .map(map.bind(this)));

  var task = new Task({
    name: name,
    options: options,
    fn: fn,
    app: this
  });

  // bubble up events from tasks
  task.on('starting', this.emit.bind(this, 'task:starting'));
  task.on('finished', this.emit.bind(this, 'task:finished'));
  task.on('error', this.emit.bind(this, 'task:error'));

  this.tasks[name] = task;
  this.emit('task', this.name, task);
  return this;
};

/**
 * Build a task or array of tasks.
 *
 * ```js
 * app.build('default', function(err, results) {
 *   if (err) return console.error(err);
 *   console.log(results);
 * });
 * ```
 *
 * @param {String|Array|Function} `tasks` List of tasks by name, function, or array of names/functions. (Defaults to `[default]`).
 * @param {Function} `cb` Callback function to be called when all tasks are finished building.
 * @api public
 */

Composer.prototype.build = function(/* tasks, callback */) {
  var args = [].concat.apply([], [].slice.call(arguments));
  var done = args.pop();
  if (typeof done !== 'function') {
    throw new TypeError('Expected the last argument to be a callback function, but got `' + typeof done + '`.');
  }

  if (args.length === 0) {
    args = ['default'];
  }

  // gather total build time information
  var self = this;
  var build = new Run(builds.length);
  builds.push(build);
  build.start();
  this.emit('starting', this, build);
  function finishBuild(err) {
    build.end();
    if (err) {
      err.app = self;
      err.build = build;
      self.emit('error', err);
    } else {
      self.emit('finished', self, build);
    }
    return done.apply(null, arguments);
  };

  var fn = this.series.apply(this, args);
  return fn(finishBuild);
};

/**
 * Compose task or list of tasks into a single function that runs the tasks in series.
 *
 * ```js
 * app.task('foo', function(done) {
 *   console.log('this is foo');
 *   done();
 * });
 *
 * var fn = app.series('foo', function bar(done) {
 *   console.log('this is bar');
 *   done();
 * });
 *
 * fn(function(err) {
 *   if (err) return console.error(err);
 *   console.log('done');
 * });
 * //=> this is foo
 * //=> this is bar
 * //=> done
 * ```
 * @param {String|Array|Function} `tasks` List of tasks by name, function, or array of names/functions.
 * @return {Function} Composed function that may take a callback function.
 * @api public
 */

Composer.prototype.series = flowFactory('series');

/**
 * Compose task or list of tasks into a single function that runs the tasks in parallel.
 *
 * ```js
 * app.task('foo', function(done) {
 *   setTimeout(function() {
 *     console.log('this is foo');
 *     done();
 *   }, 500);
 * });
 *
 * var fn = app.parallel('foo', function bar(done) {
 *   console.log('this is bar');
 *   done();
 * });
 *
 * fn(function(err) {
 *   if (err) return console.error(err);
 *   console.log('done');
 * });
 * //=> this is bar
 * //=> this is foo
 * //=> done
 * ```
 *
 * @param {String|Array|Function} `tasks` List of tasks by name, function, or array of names/functions.
 * @return {Function} Composed function that may take a callback function.
 * @api public
 */

Composer.prototype.parallel = flowFactory('parallel');

/**
 * Expose Composer
 */

module.exports = Composer;
