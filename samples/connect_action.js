/*
 *  This will RECEIVE an Action message from IFTTT.
 *  Prefer the iotdb_* versions
 */

"use strict";

var iotdb = require('iotdb');
var _ = iotdb._;

var Bridge = require('../IFTTTBridge').Bridge;

var exemplar = new Bridge({
    port: 22099,
});
exemplar.discovered = function (bridge) {
    console.log("+", "got one", bridge.meta());
    bridge.pulled(function(pulld) {
        console.log("+", "pulled", pulld);
    });
};
exemplar.discover();
