module.exports = function (RED) {
    function GeoPresenceNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        const getValue = (context, type, key) => {
            if (type === "msg") {
                const resolvePath = (obj, path) => {
                    if (!obj || !path) return undefined;
                    return path.split('.').reduce((acc, part) => acc?.[part], obj);
                };
                return resolvePath(context.msg, key);
            }
            if (type === "flow") return context.flow.get(key);
            if (type === "global") return context.global.get(key);
            return undefined;
        };

        const haversine = (lat1, lon1, lat2, lon2) => {
            const toRad = deg => deg * Math.PI / 180;
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 +
                      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                      Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        const parseTypedInput = (type, value) => {
            if (type === "bool") return value === "true";
            return value;
        };

        node.on('input', function (msg, send, done) {
            const context = {
                msg,
                flow: node.context().flow,
                global: node.context().global
            };

            const locationLat = parseFloat(config.locationLat);
            const locationLon = parseFloat(config.locationLon);
            const distance = parseFloat(config.distance);

            let rawLat = getValue(context, config.checkLatType, config.checkLat);
            let rawLon = getValue(context, config.checkLonType, config.checkLon);

            let checkLat = parseFloat(rawLat);
            let checkLon = parseFloat(rawLon);

            // Only persist msg-based values
            if (config.checkLatType === "msg") {
                if (!isNaN(checkLat)) {
                    node.context().set("lastLat", checkLat);
                } else {
                    checkLat = node.context().get("lastLat");
                }
            }

            if (config.checkLonType === "msg") {
                if (!isNaN(checkLon)) {
                    node.context().set("lastLon", checkLon);
                } else {
                    checkLon = node.context().get("lastLon");
                }
            }

            // For flow/global, do NOT use persisted values
            if (config.checkLatType !== "msg" && isNaN(checkLat)) {
                node.status({ fill: "red", shape: "ring", text: "flow/global lat missing or invalid" });
                return;
            }

            if (config.checkLonType !== "msg" && isNaN(checkLon)) {
                node.status({ fill: "red", shape: "ring", text: "flow/global lon missing or invalid" });
                return;
            }

            // Final validation
            const missingParts = [];
            if (isNaN(checkLat)) missingParts.push("lat");
            if (isNaN(checkLon)) missingParts.push("lon");

            if (missingParts.length > 0) {
                node.status({ fill: "yellow", shape: "dot", text: `waiting for ${missingParts.join(" and ")}` });
                return;
            }

            const dist = haversine(locationLat, locationLon, checkLat, checkLon);
            const isPresent = dist <= distance;

            const presenceMsg = isPresent
                ? parseTypedInput(config.presentMsgType, config.presentMsg)
                : parseTypedInput(config.notPresentMsgType, config.notPresentMsg);

            const statusColor = isPresent ? "green" : "gray";
            const statusText = `${config.location}: ${presenceMsg}`;

            if (config.onlySendOnChange) {
                const lastPresence = node.context().get("lastPresence");

                if (lastPresence === isPresent) {
                    // No change — suppress output
                    node.status({ fill: statusColor, shape: "dot", text: `${config.location}: ${presenceMsg} (unchanged)` });
                    if (done) done();
                    return;
                }

                // Presence changed — update context
                node.context().set("lastPresence", isPresent);
            }

            
            node.status({ fill: statusColor, shape: "dot", text: statusText });

            const newMsg = RED.util.cloneMessage(msg);
            newMsg.payload = {
                ...msg.payload,
                name: config.location,
                presence: presenceMsg
            };

            send(newMsg);
            if (done) done();
        });
    }

    RED.nodes.registerType("geopresence", GeoPresenceNode);
};
