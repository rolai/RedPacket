var router = require('express').Router();
var AV = require('../av.js');
var request = require('request');
var fs = require('fs');
var wechatUtils = require('../wechat-utils.js');
var utils = require('../utils.js');

router.post('/uploadFile', function(req, res, next) {
    var data = req.body;
    var imgUrl = wechatUtils.getMediaUrl(data.mediaId);
    var imgName = 'wxdownloadtemp' + data.mediaId + '.jpg';
    console.log(imgUrl);
    var r = request(imgUrl, function(error, response, body) {
        var buffer = fs.readFileSync(imgName);
        var avFile = new AV.File(imgName, buffer);
        avFile.save().then(function(obj) {
            // 数据保存成功
            res.json({
                result: {
                    result: true,
                    fileId: obj.id,
                    fileUrl: obj.url()
                }
            });
            promise.resolve(obj.url());
        }, function(err) {
            // 数据保存失败
            res.json({
                result: {
                    result: false,
                    errorMessage: err
                }
            });
            console.log(err);
        });
    }).pipe(fs.createWriteStream(imgName));
});

router.get('/all-events', function(req, res, next) {
    var share = {
        title: "所有活动",
        desc: "参加活动，赢得红包，等你来玩",
        link: "https://" + req.domain + "/all-events",
        imgUrl: "https://" + req.domain + "/public/images/wallet-icon.png"
    };

    utils.fetchActiveRedPacket(0, 10)
        .then(function(redPackets) {
            res.render('all-events', {
                user: utils.userSummary(req.currentUser),
                events: redPackets,
                signature: req.signature,
                share: share
            });
        });
});

router.post('/all-events', function(req, res, next) {
    var data = req.body;
    var page = parseInt(data.page);

    utils.fetchActiveRedPacket(page, 10)
        .then(function(redPackets) {
            res.json({
                redPackets: redPackets
            });
        });
});

module.exports = router;