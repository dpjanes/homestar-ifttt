/*
 *  This will send a Trigger message to IFTTT.
 *  Prefer the iotdb_* versions
 */

"use strict";

var iotdb = require('iotdb');
var _ = iotdb._;

var Bridge = require('../IFTTTBridge').Bridge;

var exemplar = new Bridge({
    event: "magic",
});
exemplar.discovered = function (bridge) {
    console.log("+", "got one", bridge.meta());
    bridge.push({
        "value1": "the first",
        "value2": "la deuxième",
        "value3": "der dritte",
    }, _.noop);
};
exemplar.discover();
