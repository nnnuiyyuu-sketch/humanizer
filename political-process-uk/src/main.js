/* Точка входа. */
(function (root) {
  'use strict';
  root.document.addEventListener('DOMContentLoaded', function () {
    root.PP.ui.boot();
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
