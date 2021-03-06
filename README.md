# homestar-ifttt
[IOTDB](https://github.com/dpjanes/node-iotdb) Bridge for [IFTTT](https://ifttt.com/maker).

<img src="https://raw.githubusercontent.com/dpjanes/iotdb-homestar/master/docs/HomeStar.png" align="right" />

# About

* [Read about Bridges](https://github.com/dpjanes/node-iotdb/blob/master/docs/bridges.md)

# Installation and Configuration

* [Read this first](https://github.com/dpjanes/node-iotdb/blob/master/docs/install.md)
* [Read about installing Home☆Star](https://github.com/dpjanes/node-iotdb/blob/master/docs/homestar.md) 

Then:

    $ npm install -g homestar    ## may require sudo
    $ npm install homestar-ifttt

Go to the [Maker Page on IFTTT](https://ifttt.com/maker) and copy your API Key.
Then save

    $ homestar set /bridges/IFTTTBridge/initd/key XXXXXXXXXXXYourKeyXXX

# Use

## Send a Trigger to IFTTT

The Trigger Event Name will be "magic"

    const iotdb = require('iotdb');
    iotdb.use("homestar-ifttt");

    const things = iotdb.connect('IFTTTOut', {
        event: "magic",
    });
    things.set("value1", "some value");

or if you need multiple values

    const things = iotdb.connect('IFTTTOut', {
        event: "magic",
    });
    things.update({
        value1: "some value",
        value2: "some value",
        value3: "some value",
    });

## Receive an Action from IFTTT

If you're at home, you'll have to Tunnel through your
router to your computer. 

Here's the node code - the "state" will trigger when new messages
arrive from IFTTT on port 22099 (there's no restriction on the
port you use).

    var things = iotdb.connect('IFTTTIn', {
        event: "magic",
        port: 22099,
    });
    things.on("state", function(thing) {
        console.log("+", "state", thing.thing_id(), "\n ", thing.state("istate"));
    });

The setup on IFTTT is a little complicated. 
You have to configure an **Action** with the following values

* Event Name: `magic` (or whatever - it has to match the `connect`)
* URL: `http://myhost-or-ip:22099/`
* Method: `POST`
* Content-Type: `application/json`
* Body: `{ "event": "<<<{{EventName}}>>>", "value1": "<<<{{Value1}}>>>", "value2": "<<<{{Value2}}>>>", "value3": "<<<{{Value3}}>>>", "when": "<<<{{OccurredAt}}>>>" }`
