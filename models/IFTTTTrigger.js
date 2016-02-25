/*
 *  IFTTTTrigger.js
 *
 *  David Janes
 *  IOTDB
 *  2016-02-25
 */

var iotdb = require("iotdb");

exports.binding = {
    bridge: require('../IFTTTBridge').Bridge,
    model: require('./ifttt-trigger.json'),
    connectd: {
        data_out: function(paramd) {
            if (paramd.cookd.on !== undefined) {
                paramd.rawd['urn:Belkin:service:basicevent:1'] = {
                    'SetBinaryState': {
                        'BinaryState': paramd.cookd.on ? 1 : 0
                    },
                };
            }
        },
    },
};
