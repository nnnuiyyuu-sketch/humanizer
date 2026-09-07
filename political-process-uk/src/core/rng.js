/* Детерминированный генератор случайных чисел (mulberry32) + утилиты. */
(function (root) {
  'use strict';

  function hashString(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function Rng(seed) {
    if (typeof seed === 'string') seed = hashString(seed);
    this.s = (seed >>> 0) || 1;
  }

  Rng.prototype.next = function () {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* Равномерное на [a, b). */
  Rng.prototype.range = function (a, b) {
    return a + (b - a) * this.next();
  };

  /* Целое на [a, b]. */
  Rng.prototype.int = function (a, b) {
    return Math.floor(this.range(a, b + 1));
  };

  /* Нормальное распределение (Бокс — Мюллер). */
  Rng.prototype.normal = function (mean, sd) {
    var u = 1 - this.next();
    var v = this.next();
    var z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return (mean || 0) + (sd === undefined ? 1 : sd) * z;
  };

  Rng.prototype.pick = function (arr) {
    return arr[Math.floor(this.next() * arr.length)];
  };

  Rng.prototype.chance = function (p) {
    return this.next() < p;
  };

  Rng.prototype.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

  root.PP = root.PP || {};
  root.PP.Rng = Rng;
  root.PP.hashString = hashString;
  root.PP.clamp = clamp;
})(typeof globalThis !== 'undefined' ? globalThis : this);
