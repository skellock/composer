'use strict';

var async = require('async');
var assert = require('assert');
var Task = require('../lib/task');

describe('task', function () {
  it('should throw an error when nothing is passed to Task', function () {
    try {
      var task = new Task();
      throw new Error('Expected `new Task()` to throw an error.');
    } catch (err) {}
  });

  it('should throw an error when `name` is not passed on `task`.', function () {
    try {
      var task = new Task({});
      throw new Error('Expected `new Task({})` to throw an error when `.name` is not passed.');
    } catch (err) {}
  });

  it ('should create a new task with a given `name`', function () {
    var task = new Task({name: 'default'});
    assert.equal(task.name, 'default');
  });

  it('should create a new task with a given task function', function () {
    var fn = function (done) {
      return done();
    };
    var task = new Task({name: 'default', fn: fn});
    assert.equal(task.fn, fn);
  });

  it('should create a new task with the given dependencies', function () {
    var task = new Task({name: 'default', deps: ['foo', 'bar']});
    assert.deepEqual(task.deps, ['foo', 'bar']);
  });

  it('should create a new task with deps from the `options` property', function () {
    var opts = {deps: ['foo', 'bar']};
    var task = new Task({name: 'default', options: opts});
    assert.deepEqual(task.deps, ['foo', 'bar']);
  });

  it('should run a task function when `.run` is called', function (done) {
    var count = 0;
    var fn = function (cb) {
      count++;
      cb();
    };
    var task = new Task({name: 'default', fn: fn});
    task.run(function (err) {
      if (err) return done(err);
      assert.equal(count, 1);
      done();
    });
  });

  it('should emit a `starting` event when the task starts running', function (done) {
    var count = 0;
    var fn = function (cb) {
      count++;
      cb();
    };
    var task = new Task({name: 'default', fn: fn});
    task.on('starting', function (t, run) {
      count++;
    });
    task.run(function (err) {
      if (err) return done(err);
      assert.equal(count, 2);
      done();
    });
  });

  it('should emit a `finished` event when the task finishes running', function (done) {
    var count = 0;
    var fn = function (cb) {
      count++;
      cb();
    };
    var task = new Task({name: 'default', fn: fn});
    task.on('finished', function (t, run) {
      count++;
    });
    task.run(function (err) {
      if (err) return done(err);
      assert.equal(count, 2);
      done();
    });
  });

  it('should emit an `error` event when there is an error during task execution', function (done) {
    var count = 0;
    var fn = function (cb) {
      count++;
      cb(new Error('Expected error'));
    };
    var task = new Task({name: 'default', fn: fn});
    task.on('error', function (err) {
      count++;
    });
    task.run(function (err) {
      if (!err) return done(new Error('Expected an error to be thrown.'));
      assert.equal(count, 2);
      done();
    });
  });

  it('should have a session with the current task value set', function (done) {
    var results = [];
    var fn = function (cb) {
      results.push(this.session.get('task').name);
      cb();
    };
    var tasks = [];
    for (var i = 0; i < 10; i++) {
      tasks.push(new Task({name: 'task-' + i, fn: fn}));
    }
    async.eachSeries(tasks, function (task, next) {
      task.run(next);
    }, function (err) {
      if (err) return done(err);
      assert.equal(results.length, 10);
      assert.deepEqual(results,['task-0', 'task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6', 'task-7', 'task-8', 'task-9']);
      done();
    });
  });
});
