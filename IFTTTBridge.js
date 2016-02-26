/*
 *  IFTTTBridge.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-02-25
 *
 *  Copyright [2013-2016] [David P. Janes]
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict";

var iotdb = require('iotdb');
var _ = iotdb._;

var unirest = require('unirest');
var express = require('express');

var logger = iotdb.logger({
    name: 'homestar-ifttt',
    module: 'IFTTTBridge',
});

/**
 *  See {iotdb.bridge.Bridge#Bridge} for documentation.
 *  <p>
 *  @param {object|undefined} native
 *  only used for instances, should be 
 */
var IFTTTBridge = function (initd, native) {
    var self = this;

    self.initd = _.defaults(initd,
        iotdb.keystore().get("bridges/IFTTTBridge/initd"), {
            key: null,
            host: null,
            port: null,
            action: null,
            uuid: null,
        }
    );

    if (_.is.Empty(self.initd.key)) {
        throw new Error("IFTTTBridge: expected 'key' or /bridges/IFTTTBridge/initd/key");
    }

    // stop the key from leaking into logs
    self.key = self.initd.key;
    delete self.initd.key;

    self.native = native;   // the thing that does the work - keep this name

    if (self.initd.port && (!self.initd.host || (self.initd.host === "0.0.0.0"))) {
        self.initd.host = _.net.ipv4();
    }

    if (!self.initd.uuid) {
        logger.error({
            method: "IFTTTBridge",
            initd: self.initd,
            cause: "caller should initialize with an 'uuid', used to uniquely identify things over sessions",
        }, "missing initd.uuid - problematic");
    }

    if (self.native) {
        self.queue = _.queue("IFTTTBridge");
    }
};

IFTTTBridge.prototype = new iotdb.Bridge();

IFTTTBridge.prototype.name = function () {
    return "IFTTTBridge";
};

/* --- lifecycle --- */

/**
 *  See {iotdb.bridge.Bridge#discover} for documentation.
 */
IFTTTBridge.prototype.discover = function () {
    var self = this;

    logger.info({
        method: "discover",
        initd: self.initd,
    }, "called");

    if (self.initd.port) {
        self._app(function (error, native) {
            if (error) {
                logger.error({
                    method: "discover",
                    initd: self.initd,
                    error: _.error.message(error),
                }, "no way to connect");

                return;
            }

            native.get("/", function(request, response) {
                console.log("GET", "talking to me!", request.query, request.body);
                response.send("ok");
                // self.discovered(new KNXBridge(self.initd, native));
            });
            native.post("/", function(request, response) {
                console.log("POST", "talking to me!", request.query, request.body);
                response.send("ok");
                // self.discovered(new KNXBridge(self.initd, native));
            });

        });
        
    } else {
        self.discovered(new IFTTTBridge(_.d.compose.shallow({}, self.initd), {}));
    }
};

/**
 *  See {iotdb.bridge.Bridge#connect} for documentation.
 */
IFTTTBridge.prototype.connect = function (connectd) {
    var self = this;
    if (!self.native) {
        return;
    }

    self._validate_connect(connectd);
};

IFTTTBridge.prototype._forget = function () {
    var self = this;
    if (!self.native) {
        return;
    }

    logger.info({
        method: "_forget"
    }, "called");

    self.native = null;
    self.pulled();
};

/**
 *  See {iotdb.bridge.Bridge#disconnect} for documentation.
 */
IFTTTBridge.prototype.disconnect = function () {
    var self = this;
    if (!self.native || !self.native) {
        return;
    }

    self._forget();
};

/* --- data --- */

/**
 *  See {iotdb.bridge.Bridge#push} for documentation.
 */
IFTTTBridge.prototype.push = function (pushd, done) {
    var self = this;
    if (!self.native) {
        done(new Error("not connected"));
        return;
    }

    self._validate_push(pushd, done);

    logger.info({
        method: "push",
        pushd: pushd
    }, "push");

    var _push = function () {
        if (!pushd.action) {
            logger.error({
                method: "_push",
                cause: "all IFTTT Triggers must have an 'action' associated with them",
            }, "expected 'action'");

            return done(new Error("missing action"), null);
        }

        unirest
            .post('https://maker.ifttt.com/trigger/' + pushd.action + '/with/key/' + self.key)
            .json()
            .send(pushd)
            .end(function (result) {
                if (!result.ok) {
                    logger.error({
                        method: "push/_push",
                        error: result.error,
                    }, "network error");
                    return done(new Error(result.error), null);
                } else {
                    console.log(result.body);
                    return done(null, null);
                }
            });
    };

    var qitem = {
        id: pushd.action,
        run: function () {
            _push();
            self.queue.finished(qitem);
        }
    };
    self.queue.add(qitem);
};

/**
 *  See {iotdb.bridge.Bridge#pull} for documentation.
 */
IFTTTBridge.prototype.pull = function () {
    var self = this;
    if (!self.native) {
        return;
    }
};

/* --- state --- */

/**
 *  See {iotdb.bridge.Bridge#meta} for documentation.
 */
IFTTTBridge.prototype.meta = function () {
    var self = this;
    if (!self.native) {
        return;
    }

    return {
        "iot:thing-id": _.id.thing_urn.unique("IFTTT", self.native.uuid, self.initd.number),
        "schema:name": self.native.name || "IFTTT",

        // "iot:thing-number": self.initd.number,
        // "iot:device-id": _.id.thing_urn.unique("IFTTT", self.native.uuid),
        // "schema:manufacturer": "",
        // "schema:model": "",
    };
};

/**
 *  See {iotdb.bridge.Bridge#reachable} for documentation.
 */
IFTTTBridge.prototype.reachable = function () {
    return this.native !== null;
};

/**
 *  See {iotdb.bridge.Bridge#configure} for documentation.
 */
IFTTTBridge.prototype.configure = function (app) {};

/* -- internals -- */
var __singleton;

/**
 *  If you need a singleton to access the library
 */
IFTTTBridge.prototype._ifttt = function () {
    var self = this;

    if (!__singleton) {
        __singleton = ifttt.init();
    }

    return __singleton;
};

/* -- internals -- */
var __appd = {};
var __pendingsd = {};

/**
 *  This returns a connection object per ( host, port, tunnel_host, tunnel_port )
 *  tuple, ensuring the correct connection object exists and is connected.
 *  It calls back with the connection object
 *
 *  The code is complicated because we have to keep callbacks stored 
 *  in '__pendingsd' until the connection is actually made
 */
IFTTTBridge.prototype._app = function (callback) {
    var self = this;

    var app_key = "http://" + self.initd.host + ":" + self.initd.port;

    // app existings
    var app = __appd[app_key];
    if (app) {
        return callback(null, app);
    }

    // queue exists
    var pendings = __pendingsd[app_key];
    if (pendings) {
        pendings.push(callback);
        return;
    }

    // brand new queue
    pendings = [];
    __pendingsd[app_key] = pendings;

    pendings.push(callback);

    // create web server
    logger.info({
        method: "_app",
        npending: pendings.length,
        host: self.initd.host,
        port: self.initd.port,
    }, "creating web server");

    var app = express();
    app.listen(self.initd.port, self.initd.host, function (error) {
        delete __pendingsd[app_key];

        if (error) {
            pendings.map(function (pending) {
                pending(error, null);
            });
            return;
        }

        __appd[app_key] = app;

        pendings.map(function (pending) {
            pending(null, app);
        });
    });
};

/*
 *  API
 */
exports.Bridge = IFTTTBridge;
