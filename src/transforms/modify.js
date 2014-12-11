define(function(require, exports, module) {
  var tuple = require('../core/tuple'),
      util = require('../util/index'),
      constants = require('../util/constants');

  var ADD = constants.MODIFY_ADD, 
      REMOVE = constants.MODIFY_REMOVE, 
      TOGGLE = constants.MODIFY_TOGGLE, 
      CLEAR = constants.MODIFY_CLEAR;

  var filter = function(field, value, src, dest) {
    for(var i = src.length-1; i >= 0; --i) {
      if(src[i][field] == value)
        dest.push.apply(dest, src.splice(i, 1));
    }
  };

  return function parseModify(model, def, ds) {
    var signal = def.signal ? util.field(def.signal) : null, 
        signalName = signal ? signal[0] : null,
        predicate = def.predicate ? model.predicate(def.predicate) : null,
        reeval = (predicate === null);

    var node = new model.Node(function(input) {
      if(predicate !== null) {
        var db = {};
        (predicate.data||[]).forEach(function(d) { db[d] = model.data(d).values(); });

        // TODO: input
        reeval = predicate({}, db, model.signal(predicate.signals||[]), model._predicates);
      }

      util.debug(input, [def.type+"ing", reeval]);
      if(!reeval) return input;

      var datum = {}, 
          value = signal ? model.signalRef(def.signal) : null,
          d = model.data(ds.name),
          t = null;

      datum[def.field] = value;

      // We have to modify ds._data so that subsequent pulses contain
      // our dynamic data. W/o modifying ds._data, only the output
      // collector will contain dynamic tuples. 
      if(def.type == ADD) {
        t = tuple.create(datum);
        input.add.push(t);
        d._data.push(t);
      } else if(def.type == REMOVE) {
        filter(def.field, value, input.add, input.rem);
        filter(def.field, value, input.mod, input.rem);
        d._data = d._data.filter(function(x) { return x[def.field] !== value });
      } else if(def.type == TOGGLE) {
        var add = [], rem = [];
        filter(def.field, value, input.rem, add);
        filter(def.field, value, input.add, rem);
        filter(def.field, value, input.mod, rem);
        if(add.length == 0 && rem.length == 0) add.push(tuple.create(datum));

        input.add.push.apply(input.add, add);
        d._data.push.apply(d._data, add);
        input.rem.push.apply(input.rem, rem);
        d._data = d._data.filter(function(x) { return rem.indexOf(x) === -1 });
      } else if(def.type == CLEAR) {
        input.rem.push.apply(input.rem, input.add);
        input.rem.push.apply(input.rem, input.mod);
        input.add = [];
        input.mod = [];
        d._data  = [];
      } 

      input.fields[def.field] = 1;
      return input;
    });
    
    var deps = node._deps.signals;
    if(signalName) deps.push(signalName);
    if(predicate)  deps.push.apply(deps, predicate.signals);
    
    return node;
  }
});