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

var defaultWechatConfig = configs.wechat;
wxPayment.init({
    appid: defaultWechatConfig.appId,
    mch_id: defaultWechatConfig.mchId,
    apiKey: defaultWechatConfig.apiKey, //微信商户平台API密钥
    pfx: fs.readFileSync('./cert/apiclient_cert.p12') //微信商户平台证书
});

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
                        res.redirect('/rp/' + redPacketId);
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

module.exports = router;
