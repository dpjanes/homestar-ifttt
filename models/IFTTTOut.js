/*
 *  IFTTTOut.js
 *
 *  David Janes
 *  IOTDB
 *  2016-02-25
 */

var iotdb = require("iotdb");

exports.binding = {
    bridge: require('../IFTTTBridge').Bridge,
    model: require('./ifttt-out.json'),
    connectd: {
        data_out: function(paramd) {
        },
    },
};
