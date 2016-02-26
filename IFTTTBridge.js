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

    // probe - we can ignore
    if (initd === undefined) {
        return;
    }

    self.initd = _.defaults(initd,
        iotdb.keystore().get("bridges/IFTTTBridge/initd"), {
            key: null,
            host: null,
            port: null,
            event: null,
            uuid: null,
        }
    );

    if (_.is.Empty(self.initd.key)) {
        logger.error({
            method: "IFTTTBridge",
            initd: self.initd,
            cause: "caller must initialize with an 'key', to connect to IFTTT",
        }, "missing initd.key");

        throw new Error("IFTTTBridge: expected 'initd.key'");
    }

    // stop the key from leaking into logs
    self.key = self.initd.key;
    delete self.initd.key;

    if (!self.initd.event) {
        logger.error({
            method: "IFTTTBridge",
            initd: self.initd,
            cause: "caller must initialize with an 'event', used to uniquely the Thing to IOTDB and IFTTT",
        }, "missing initd.event");

        throw new Error("IFTTTBridge: expected 'initd.event'");
    }

    if (self.initd.port && (!self.initd.host || (self.initd.host === "0.0.0.0"))) {
        self.initd.host = _.net.ipv4();
    }

    self.native = native;
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
        self._discover_in();
    } else {
        self._discover_out();
    }
};

IFTTTBridge.prototype._discover_in = function () {
    var self = this;
    var thing = new IFTTTBridge(_.d.compose.shallow({}, self.initd), {});

    self._app(function (error, app) {
        if (error) {
            logger.error({
                method: "discover",
                initd: self.initd,
                error: _.error.message(error),
            }, "no way to connect");

            return;
        }

        self.discovered(thing);

        var _handle = function(request, response) {
            console.log("GET", "talking to me!", request.query, request.body);
            response.send("ok");
        };

        app.get("/", _handle);
        app.post("/", _handle);
    });
};
        
IFTTTBridge.prototype._discover_out = function () {
    var self = this;
    self.discovered(new IFTTTBridge(_.d.compose.shallow({}, self.initd), {}));
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

    var _run = function(q, qitem) {
        unirest
            .post('https://maker.ifttt.com/trigger/' + self.initd.event + '/with/key/' + self.key)
            .json()
            .send(pushd)
            .end(function (result) {
                if (!result.ok) {
                    logger.error({
                        method: "push/_push",
                        error: result.error,
                        event: self.initd.event,
                    }, "network error");

                    self.queue.finished(qitem);
                    return done(new Error(result.error), null);
                }

                logger.info({
                    method: "push/_push",
                    event: self.initd.event,
                    pushd: pushd,
                }, "IFTTT called successfully");

                self.queue.finished(qitem);
                return done(null, null);
            });
    };

    self.queue.add({
        id: pushd.action,
        run: _run,
    });
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
        "iot:thing-id": _.id.thing_urn.unique_hash("IFTTT", self.initd.event),
        "iot:vendor.event": self.initd.event,
        "schema:name": self.native.name || "IFTTT",
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
