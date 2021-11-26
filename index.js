// The MIT License (MIT)
//
// Copyright (c) 2014 Jonas Finnemann Jensen
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var _           = require('lodash');
var debug       = require('debug')('json-parameterization');


if (!String.prototype.startsWith) {
  Object.defineProperty(String.prototype, 'startsWith', {
    value: function(search, rawPos) {
      var pos = rawPos > 0 ? rawPos|0 : 0;
      return this.substring(pos, pos + search.length) === search;
    }
  });
}

var defaultIgnoreList = ['#', '/'];

/** Parameterize input with params */
var parameterize = function(input, params, ignoreList = defaultIgnoreList) {

  // Evaluate an expression
  var evalExpr = function(expr, fallback) {
    var ignore = false;

    ignoreList.forEach(item => {
      if (expr.startsWith(item)) ignore = true;
    });

    if (ignore) return fallback;


    // Find parts of the expression
    var parts = expr.split(/\|/);

    var value = parts.shift();
    // Check if first value is on a "string" format
    var match = /\s*"([^"]*)"\s*|\s*'([^']*)'\s*/.exec(value);
    if (match) {
      value = match[1] || match[2] || '';
    } else {
      // Otherwise, trim and look up in parameters
      var result = params[value.trim()];
      if (result instanceof Function) {
        // if it's a function then we call it, without parameters
        value = result();
      } else if (result !== undefined) {
        // if it's defined we return the value substituted in
        value = _.cloneDeep(result);
      } else {
        // If we didn't get a value, function or string
        debug("Couldn't find parameter: '%s' used in '%s'",
              value, expr);
        return fallback;
      }
    }

    // While there are parts of the expression remaining
    while (parts.length > 0) {
      // Find next part and trim it
      var part = parts.shift().trim();
      // Look up in params
      var result = params[part];
      if (result instanceof Function) {
        // Modify value if we got a function
        value = result(value);
      } else {
        // If we didn't get a function, then this is done
        debug("Couldn't find modify: '%s' used in '%s'", part, expr);
        return fallback;
      }
    }

    // Return value
    return value;
  };

  // Parameterize a string
  var parameterizeString = function(str) {
    // Handle special case where the entire string is an expression
    if (/^{{[^}]+}}$/.test(str)) {
      return evalExpr(str.substr(2, str.length - 4), str);
    }

    // Otherwise treat {{...}} as string interpolations
    return str.replace(/{{([^}]*)}}/g, function(originalText, expression) {
      return evalExpr(expression, originalText);
    });
  };

  // Substitute objects that needs this
  var substitute = function(obj) {
    // Parameterized strings
    if (typeof(obj) == 'string') {
      return parameterizeString(obj);
    }

    // Parameterize keys of objects
    if (typeof(obj) == 'object') {
      if (obj instanceof Array) {
        return undefined;
      }
      var clone = {};
      for(var k in obj) {
        var key = parameterizeString(k);
        if (typeof(key) !== 'string') {
          key = k;
        }
        clone[key] = _.cloneDeepWith(obj[k], substitute);
      }
      return clone;
    }

    // Clone all other values as lodash normally would
    return undefined;
  };

  // Create clone while substituting objects that need it
  return _.cloneDeepWith(input, substitute);
};


// Export parameterize
module.exports = parameterize;
