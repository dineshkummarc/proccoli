function LinkedList(data) {
  this.first = null;
  this.last = null;
}
LinkedList.prototype = {
  _link: function linkit(before, item, after) {
    if (before) {
      before._after = item || after;
    }
    if (item) {
      item._before = before;
      item.after = after;
    }
    if (after) {
      after._before = item || before;
    }
    if (!this.first) this.first = before || item || after;
    if (!this.last) this.last = after || item || before;
  },
  push: function(item) {
    var was = this.last;
    this.last = null;
    this._link(was, item);
    return this;
  },
  pop: function() {
    var item = this.last;
    if (item) this.remove(item);
    return item;
  },
  unshift: function(item) {
    var was = this.first;
    this.first = null;
    this._link(null, item, was);
    return this;
  },
  shift: function() {
    var item = this.first;
    if (item) this.remove(item);
    return item;
  },
  remove: function(item) {
    if (this.first == item) this.first = null;
    if (this.last == item) this.last = null;
    this._link(item._before, null, item._after);
    delete item._before;
    delete item._after;
    return this;
  },
  size: function() {
    for (var t = this.first, i = 0; t; t = t._after, i++);
    return i;
  },
  forEach: function(f) {
    var t = this.first, n;
    while (t) {
      var n = t._after;
      f(t);
      t = t._after;
    }
  }
};

module.exports = LinkedList;
