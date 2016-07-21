var utils = require('../utils');
var constants = require('../constants');
var AV = require('../av.js');

exports.autoCloseRedPacket = function(data, result) {
    var q1 = new AV.Query('RedPacket');
    q1.include('creator');
    q1.containedIn('status', [constants.RED_PACKET_STATUS.PAID, constants.RED_PACKET_STATUS.RUNNING]);
    q1.lessThanOrEqualTo('invalidDate', new Date());
    return q1.find()
        .then(function(redPackets) {
            var promises = [];
            redPackets.forEach(function(redPacket) {
                promises.push(utils.closeRedPacket(redpPacket.get('creator'), redPacket));
            });
            return AV.Promise.when(promises);
        });
};