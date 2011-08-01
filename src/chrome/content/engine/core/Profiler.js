/***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Tilt: A WebGL-based 3D visualization of a webpage.
 *
 * The Initial Developer of the Original Code is Victor Porof.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the LGPL or the GPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 ***** END LICENSE BLOCK *****/
"use strict";

var Tilt = Tilt || {};
var EXPORTED_SYMBOLS = ["Tilt.Profiler"];

/**
 * Handy way of profiling functions in Tilt.
 */
Tilt.Profiler = {

  /**
   * Set this to true to enable profiling.
   */
  enabled: true,

  /**
   * Array containing information about all the intercepted functions.
   */
  functions: [],

  /**
   * Intercepts a function, issuing calls for appropriate methods before and
   * after the execution of that function. The interception method can be
   * overridden by specifying a custom duringCall function.
   *
   * Pass null instead of the function name to intercept all the functions
   * from an object.
   *
   * @param {String} ns: optional, the namespace for the function
   * @param {Object} object: the object containing the function
   * @param {String} name: the name of the function
   * @param {Function} beforeCall: optional, custom logic before the function
   * @param {Function} afterCall: optional, custom logic after the function
   * @param {Function} duringCall: optional, custom logic for interception
   */
  intercept: function(ns, object, name, beforeCall, afterCall, duringCall) {
    if (!this.enabled) {
      return;
    }

    // if the function name is falsy, intercept all the object functions
    if (!name) {
      for (var i in object) {
        if ("function" === typeof object[i]) {
          this.intercept(ns, object, i, beforeCall, afterCall, duringCall);
        }
      }
      return;
    }

    // set the appropriate before, after and during call functions
    if ("undefined" === typeof beforeCall) {
      beforeCall = this.beforeCall.bind(this);
    }
    if ("undefined" === typeof afterCall) {
      afterCall = this.afterCall.bind(this);
    }
    if ("undefined" === typeof duringCall) {
      duringCall = this.duringCall.bind(this);
    }

    // get the function from the object
    var f = object[name];

    if ("function" === typeof f) {
      var index = this.functions.length;

      // save some information about this function in an array for profiling
      this.functions[index] = {
        name: ((ns + ".") || "") + name,
        calls: 0,
        averageTime: 0,
        longestTime: 0,
        totalTime: 0
      };

      // overwrite the function to handle before, after and during calls
      object[name] = function() {
        try {
          beforeCall(index);
          return duringCall(object, f, arguments);
        }
        finally {
          afterCall(index);
        }
      };
    }
  },

  /**
   * Default beforeCall function.
   * @param {Number} index: the index of the function in the profile array
   */
  beforeCall: function(index) {
    this.functions[index].currentTime = new Date().getTime();
  },

  /**
   * Default afterCall function.
   * @param {Number} index: the index of the function in the profile array
   */
  afterCall: function(index) {
    var f = this.functions[index],
      beforeTime = f.currentTime,
      afterTime = new Date().getTime(),
      currentDuration = afterTime - beforeTime;

    f.calls++;
    f.longestTime = Math.max(f.longestTime, currentDuration);
    f.averageTime = (f.longestTime + currentDuration) / 2;
    f.totalTime += currentDuration;
  },

  /**
   * Default duringCall function.
   *
   * @param {Object} object: the object to be used as "this" for the function
   * @param {Function} method: the function called
   * @param {Number} args: arguments for the called function
   */
  duringCall: function(object, method, args) {
    if (args.length === 0) {
      return eval("arguments[1].call(arguments[0]);");
    }

    for (var i = 0, len = args.length, $ = ""; i < len; i++) {
      $ += "arguments[2][" + i + "]" + ((i !== len - 1) ? "," : "");
    }
    return eval("arguments[1].call(arguments[0], " + $ + ");");
  },

  /**
   * Logs information about the currently profiled functions.
   */
  log: function() {
    var functions = this.functions.slice(0), f, f2, i, j, len;

    functions.sort(function(a, b) {
      return a.totalTime < b.totalTime ? 1 : -1;
    });

    for (i = 0; i < functions.length; i++) {
      f = functions[i];

      for (j = i + 1; j < functions.length; j++) {
        f2 = functions[j];

        if (f.name === f2.name) {
          f.calls += f2.calls;
          f.longestTime = Math.max(f.longestTime, f2.longestTime);
          f.averageTime = (f.averageTime + f2.averageTime) / 2;
          f.totalTime += f2.totalTime;

          functions.splice(j, 1);
          j--;
        }
      }

      // only log information about a function if it was called at least once
      if (f.calls === 0) {
        continue;
      }

      if ("undefined" !== typeof f2 && f2.name === f.name) {
        f2.calls += f.calls;
        continue;
      }

      Tilt.Console.log(
        "function " + f.name + "\n" +
        "calls    " + f.calls + "\n" +
        "average  " + f.averageTime + "ms\n" +
        "longest  " + f.longestTime + "ms\n" +
        "total    " + f.totalTime + "ms");
    }
  },

  /**
   * Clears the profiled functions array.
   */
  reset: function() {
    this.functions = [];
  }
};