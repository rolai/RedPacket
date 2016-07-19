var router = require('express').Router();
var AV = require('../av.js');
var utils = require('../utils.js');
var _ = require('underscore');

// 渲染登录页面
router.get('/login', function(req, res, next) {
    res.render('login.ejs');
});

router.post('/login', function(req, res, next) {
    AV.User.logIn(req.body.username, req.body.password)
        .then(function(user) {
            console.log('signin successfully: %j', user);
            res.saveCurrentUser(user); // 保存当前用户到 Cookie.
            res.redirect('/user/me'); // 跳转到个人资料页面
        }, function(error) {
            //登录失败，跳转到登录页面
            console.log(error);
            res.redirect('/user/login');
        });
});

router.get('/me', function(req, res, next) {
    res.render('user-account', {
        user: utils.userSummary(req.currentUser),
        signature: req.signature,
        domain: req.domain
    });
});

router.get('/company', function(req, res, next) {
    res.render('company-account', {
        user: utils.userSummary(req.currentUser),
        signature: req.signature,
        domain: req.domain
    });
});

router.get('/wallet', function(req, res, next) {
    var redPackets;
    utils.fetchActiveRedPacket(0, 5)
        .then(function(result) {
            redPackets = result;
            return utils.fetchUserCashFlow(req.currentUser, 0, 60);
        })
        .then(function(cashFlows) {
            return res.render('user-wallet', {
                user: utils.userSummary(req.currentUser),
                events: redPackets,
                cashFlows: cashFlows,
                signature: req.signature,
                domain: req.domain
            });
        });
});

router.get('/company-wallet', function(req, res, next) {
    utils.fetchUserCreatedRedPacket(req.currentUser)
        .then(function(redPackets) {
            var events = _.map(redPackets, utils.convertRedPacketToCashFlowSummary);
            res.render('company-wallet', {
                user: utils.userSummary(req.currentUser),
                events: events,
                signature: req.signature,
                domain: req.domain
            });
        });
});

router.get('/events', function(req, res, next) {
    utils.fetchUserCreatedRedPacket(req.currentUser)
        .then(function(redPackets) {
            res.render('user-events', {
                user: utils.userSummary(req.currentUser),
                events: redPackets,
                signature: req.signature,
                domain: req.domain
            });
        });
});

module.exports = router;