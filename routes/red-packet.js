var router = require('express').Router();
var AV = require('../av.js');
var utils = require('../utils');
var constants = require('../constants');
var configs = require('../configs.json');
var env = require('../choice.json').env;
var myip = require('quick-local-ip');
var wechatUtils = require('../wechat-utils');

var defaultWechatConfig = configs.wechat;

router.get('/open/:redPacketId', function(req, res, next) {
    var redPacketId = req.params.redPacketId;
    var currentUser = req.currentUser;
    return utils.fetchRedPacket(redPacketId)
        .then(function(redPacket) {
            if (!redPacket || redPacket.status == constants.RED_PACKET_STATUS.REMOVED) {
                return res.render('removed-red-packet', {
                    signature: req.signature
                });
            } else {
                var q2 = new AV.Query('UserRedPacket');
                q2.equalTo('user', currentUser);
                q2.equalTo('redPacket', utils.redPacket(redPacketId));
                return q2.first().then(function(urpRecord) {
                    var share = {
                        title: redPacket.title,
                        link: "https://" + req.domain + "/rp/open/" + redPacketId,
                        imgUrl: redPacket.publisherAvatar
                    };

                    if (redPacket.count == redPacket.leftCount) {
                        share.desc = redPacket.totalMoney / 100.0 + "元的红包等你来拿！";
                    } else {
                        share.desc = "已经有" + (redPacket.count - redPacket.leftCount) + "人抢到了红包，还剩" + redPacket.leftMoney / 100.0 + "元等你来拿！";
                    }

                    return res.render('red-packet', {
                        redPacket: redPacket,
                        money: urpRecord ? urpRecord.get('money') / 100.0 : 'X',
                        preview: false,
                        signature: req.signature,
                        share: share
                    });
                });
            }
        });
});

router.post('/open', function(req, res, next) {
    var redPacketId = req.body.redPacketId;
    var currentUser = req.currentUser;
    return utils.openRedPacket(currentUser, redPacketId)
        .then(function(result) {
            res.json({
                result: result
            });
        });
});

router.get('/create', function(req, res, next) {
    res.render('create-red-packet', {
        redPacket: {},
        signature: req.signature,
        domain: req.domain
    });
});

router.get('/update/:redPacketId', function(req, res, next) {
    var redPacketId = req.params.redPacketId;
    var currentUser = req.currentUser;
    return utils.fetchRedPacket(redPacketId)
        .then(function(redPacket) {
            if (!redPacket || redPacket.status != constants.RED_PACKET_STATUS.NEW) {
                return res.render('removed-red-packet');
            } else {
                return res.render('create-red-packet', {
                    redPacket: redPacket,
                    signature: req.signature,
                    domain: req.domain
                });
            }
        });
});

function getPayNotifyUrl() {
    return "https://{0}/wechat/wxpay".format(configs[env].DOMAIN);
}

router.post('/update-or-create', function(req, res, next) {
    var data = req.body;
    var currentUser = req.currentUser;
    data.count = parseInt(data.count);
    data.totalMoney = parseInt(data.totalMoney);
    return utils.updateOrCreateRedPacket(currentUser, data)
        .then(function(result) {
            if (!result.result) {
                res.json(result);
            } else if (result.redPacket.status != constants.RED_PACKET_STATUS.NEW) {
                result.needPayMoney = 0;
                res.json(result);
            } else if (currentUser.get('availableMoney') >= data.totalMoney) {
                // 余额支付
                var redPacket = result.rawRedPacket;
                return utils.payForRedPacketByLeftMoney(currentUser, redPacket, data.totalMoney)
                    .then(function() {
                        redPacket.set('status', constants.RED_PACKET_STATUS.RUNNING);
                        return redPacket.save()
                            .then(function() {
                                res.json({
                                    result: true,
                                    needPayMoney: 0
                                });
                            });
                    });
            } else {
                // TODO, call wx pay api
                console.log("Call weixin pay");
                var needPayMoney = data.totalMoney - currentUser.get('availableMoney');
                global.wxPayment.createUnifiedOrder({
                    body: '蒸汽动力-' + result.redPacket.title,
                    out_trade_no: utils.encodeOrderId(result.redPacket.id),
                    total_fee: needPayMoney,
                    spbill_create_ip: myip.getLocalIP4(),
                    notify_url: getPayNotifyUrl(),
                    trade_type: 'JSAPI',
                    product_id: '',
                    openid: result.redPacket.creator.openid
                }, function(err, response) {
                    console.log(err);
                    console.log(response);
                    if (response.return_code == 'SUCCESS' && response.result_code == 'SUCCESS') {
                        var signedOrder = wechatUtils.signOrder(response.prepay_id, defaultWechatConfig.apiKey);
                        res.json({
                            result: true,
                            needPayMoney: needPayMoney,
                            signedOrder: signedOrder,
                            wxResponse: response,
                            redPacket: result.redPacket
                        });
                    } else {
                        console.log("%j", response);
                        res.json({
                            result: false,
                            errorMessage: '微信支付失败，请稍后再试'
                        });
                    }

                });
            }
        });
});

router.post('/preview', function(req, res, next) {
    var data = req.body;
    var currentUser = req.currentUser;
    data.count = parseInt(data.count);
    data.totalMoney = parseInt(data.totalMoney);
    return utils.updateOrCreateRedPacket(currentUser, data)
        .then(function(result) {
            res.json({
                result: result
            });
        });
});

router.get('/preview/:redPacketId', function(req, res, next) {
    var redPacketId = req.params.redPacketId;
    var currentUser = req.currentUser;
    return utils.fetchRedPacket(redPacketId)
        .then(function(redPacket) {
            if (!redPacket || redPacket.status == constants.RED_PACKET_STATUS.REMOVED) {
                return res.render('removed-red-packet');
            } else {
                return res.render('red-packet', {
                    redPacket: redPacket,
                    money: 'X',
                    preview: true,
                    signature: req.signature,
                    share: null
                });
            }
        });
});


router.get('/active/:page/:count', function(req, res, next) {
    var page = req.params.page || 0;
    var count = req.params.count || 20;

    return utils.fetchActiveRedPacket(page, count)
        .then(function(redPackets) {
            res.json({
                result: redPackets
            });
        });
});

router.get('/status/:redPacketId', function(req, res, next) {
    var redPacketId = req.params.redPacketId;
    var currentUser = req.currentUser;
    return utils.fetchRedPacket(redPacketId)
        .then(function(redPacket) {
            if (!redPacket || redPacket.status == constants.RED_PACKET_STATUS.REMOVED) {
                res.render('removed-red-packet', {
                    signature: req.signature,
                    domain: req.domain
                });
            } else {
                return utils.fetchRedPacketCashFlow(redPacketId, 0, 60)
                    .then(function(cashFlows) {
                        res.render('red-packet-status', {
                            redPacket: redPacket,
                            cashFlows: cashFlows,
                            signature: req.signature,
                            domain: req.domain
                        });
                    });
            }
        });
});

router.post('/close', function(req, res, next) {
    return utils.updateRedPacketStatus(req.currentUser, req.body.redPacketId, constants.RED_PACKET_STATUS.CLOSED)
        .then(function(result) {
            return res.json({
                result: result
            });
        });
});

router.post('/delete', function(req, res, next) {
    return utils.updateRedPacketStatus(req.currentUser, req.body.redPacketId, constants.RED_PACKET_STATUS.REMOVED)
        .then(function(result) {
            return res.json({
                result: result
            });
        });
});

module.exports = router;