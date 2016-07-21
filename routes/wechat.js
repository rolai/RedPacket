var router = require('express').Router();
var request = require('request');
var fs = require('fs');
var wechatUtils = require('../wechat-utils');
var utils = require('../utils.js');
var AV = require('../av.js');
var wxPayment = require('wx-payment');
var configs = require('../configs.json');
var env = require('../choice.json').env;
var constants = require('../constants');

if (!global.wxPayment) {
    var defaultWechatConfig = configs.wechat;
    wxPayment.init({
        appid: defaultWechatConfig.appId,
        mch_id: defaultWechatConfig.mchId,
        apiKey: defaultWechatConfig.apiKey, //微信商户平台API密钥
        pfx: fs.readFileSync('./cert/apiclient_cert.p12') //微信商户平台证书
    });
    global.wxPayment = wxPayment;
}


router.get('/', function(req, res, next) {
    var data = {
        url: wechatUtils.getAuthorizeURL('me'),
        signature: req.signature,
        domain: req.domain
    };
    res.render('wechat-entry', data);
});

router.get('/oauth', function(req, res, next) {
    var code = req.query.code;
    var state = req.query.state;
    console.log('state:' + state);
    var redPacketId = "";
    if (state.startWith('rp-')) {
        redPacketId = state.substr(3); // remove the rp-
    }

    wechatUtils.doAllTheWorkWithCode(code)
        .then(function(userFromWechat) {
            return utils.findOrCreateUser(userFromWechat);
        })
        .then(function(wechatUser) {

            return AV.User.logIn(wechatUser.get('username'), wechatUser.get('openid'))
                .then(function(loginedUser) {
                    console.log('signin successfully: nickname: %s, id: %s', loginedUser.get('nickname'), loginedUser.id);
                    res.saveCurrentUser(loginedUser); // 保存当前用户到 Cookie.
                    if (redPacketId.length > 0) {
                        res.redirect('/rp/open/' + redPacketId);
                    } else if (state == 'all-events') {
                        res.redirect('/all-events');
                    } else {
                        res.redirect('/user/me');
                    }
                }, function(error) {
                    //登录失败，跳转到登录页面
                    console.log(error);
                    res.redirect('/user/login');
                });
        })
        .fail(function(err) {
            res.json(err);
        });
});


// 微信支付结果异步通知 api
router.use('/wxpay', global.wxPayment.wxCallback(function(msg, req, res, next) {
    var data = req.wxmessage;
    if (data.return_code == 'SUCCESS' && data.result_code == 'SUCCESS') {
        console.log("Paid: " + data.out_trade_no);
        console.log("%j", data);
        var redPacketId = utils.decodeOrderId(data.out_trade_no);
        var query = new AV.Query('RedPacket');
        query.include('creator');
        query.get(redPacketId)
            .then(function(redPacket) {
                if (redPacket) {

                    if (redPacket.get('status') != constants.RED_PACKET_STATUS.NEW) {
                        console.log("Red Packet already paid: " + data.out_trade_no);
                        return res.success();
                    }

                    console.log("Pay Red Packet: ", data.out_trade_no);
                    var paidFee = parseInt(data.total_fee);
                    var creator = redPacket.get('creator');
                    return utils.payForRedPacketByWechat(creator, redPacket, paidFee, data)
                        .then(function() {
                            var leftMoney = redPacket.get('totalMoney') - paidFee;
                            if (leftMoney > 0) {
                                return utils.payForRedPacketByLeftMoney(creator, redPacket, leftMoney);
                            }
                        })
                        .then(function() {
                            redPacket.set('status', constants.RED_PACKET_STATUS.RUNNING);
                            return redPacket.save();
                        })
                        .then(function() {
                            res.success();
                        }, function(err) {
                            console.log(err);
                        });
                } else {
                    console.log("Red Packet not found: " + data.out_trade_no);
                    res.fail();
                }
            });
    } else {
        res.fail();
    }
}));

module.exports = router;