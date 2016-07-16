var AV = require('./av.js');
var request = require('request');
const assert = require('assert');
var constants = require('./constants');
var _ = require('underscore');

var utils = {
    requestToJSONAsPromise: function(url) {
        return utils.requestToPromise(url).then(function(body) {
            var data = JSON.parse(body);
            return data;
        });
    },

    requestToPromise: function(options) {
        return new AV.Promise(function(resolve, reject) {
            request(options, function(err, res, body) {
                if (err) {
                    return reject(err);
                } else if (res.statusCode !== 200) {
                    err = new Error("Unexpected status code: " + res.statusCode);
                    err.res = res;
                    return reject(err);
                }
                resolve(body);
            });
        });
    },

    user: function(userId) {
        return AV.Object.createWithoutData('_User', userId);
    },

    file: function(fileId) {
        return AV.File.createWithoutData(fileId);
    },

    redPacket: function(redPacketId) {
        return AV.Object.createWithoutData('RedPacket', redPacketId);
    },

    fetchUser: function(userId) {
        var query = new AV.Query('_User');
        return query.get(userId).then(function(user) {
            return AV.Promise.as(utils.userSummary(user));
        });
    },

    userSummary: function(user) {
        var obj = {
            id: user.id,
            nickname: user.get('nickname') || '',
            role: user.get('role'),
            avatar: user.get('avatar') || '',
            openid: user.get('openid') || '',
            earnedMoney: user.get('earnedMoney'),
            withdrawMoney: user.get('withdrawMoney'),
            paidMoney: user.get('paidMoney'),
            availableMoney: user.get('availableMoney'),
        };

        return obj;
    },

    findOrCreateUser: function(userInfo) {
        var query = new AV.Query('_User');
        query.equalTo('openid', userInfo.openid);
        return query.first().then(function(user) {
            if (user) return AV.Promise.as(user);

            var newUser = new AV.User(); // 新建 AVUser 对象实例
            newUser.set("openid", userInfo.openid);
            newUser.set("username", userInfo.openid);
            newUser.set("nickname", userInfo.nickname);
            newUser.set("gender", userInfo.sex);
            newUser.set('avatar', userInfo.headimgurl);
            newUser.set('password', userInfo.openid);
            newUser.set('userInfo', userInfo);
            return newUser.signUp();
        });
    },

    fetchRedPacket: function(redPacketId) {
        var query = new AV.Query('RedPacket');
        query.include('creator');
        query.equalTo('objectId', redPacketId);
        return query.first()
            .then(function(redPacket) {
                if (redPacket) {
                    return AV.Promise.as(utils.redPacketSummary(redPacket));
                } else {
                    return AV.Promise.as(null);
                }
            });
    },

    redPacketSummary: function(redPacket) {
        var obj = {
            id: redPacket.id,
            creator: utils.userSummary(redPacket.get('creator')),
            totalMoney: redPacket.get('totalMoney'),
            count: redPacket.get('count'),
            leftMoney: redPacket.get('leftMoney'),
            leftCount: redPacket.get('leftCount'),
            status: redPacket.get('status'),
            publisherAvatar: redPacket.get('publisherAvatar').get('url'),
            publisherAvatarFileId: redPacket.get('publisherAvatar').id,
            adLink: redPacket.get('adLink'),
            adImage: redPacket.get('adImage').get('url'),
            adImageFileId: redPacket.get('adImage').id,
            publisherName: redPacket.get('publisherName'),
            title: redPacket.get('title'),
            invalidDate: redPacket.get('invalidDate').format("yyyy-MM-dd"),
            createdAt: redPacket.getCreatedAt().format("yyyy-MM-dd hh:mm:ss")
        };
        return obj;
    },

    /*
     * 用户打开红包
     * 1. 检查红包状态是否为RUNNING
     * 2. 随机产生红包额
     * 3. 更新红包状态
     * 4. 添加用户抢红包记录
     * 5. 添加用户现金流记录
     * 6. 更新用户余额
     * 7. 放回打开红包结果
     * 8. 检查是否满1元，提现到用户微信钱包
     */
    openRedPacket: function(user, redPacketId) {
        var result = {};
        var query = new AV.Query('RedPacket');
        query.include('creator');
        query.equalTo('objectId', redPacketId);
        return query.first()
            .then(function(redPacket) {
                if (!redPacket) {
                    result.result = false;
                    result.errorMessage = "此红包已经不存在了！";
                    return new AV.Promise.as(result);
                }

                var q2 = new AV.Query('UserRedPacket');
                q2.equalTo('user', user);
                q2.equalTo('redPacket', redPacket);
                return q2.first()
                    .then(function(urpRecord) {
                        if (urpRecord) {
                            result.result = true;
                            result.reopen = true;
                            result.money = urpRecord.get('money');
                            result.redPacket = utils.redPacketSummary(redPacket);
                            return new AV.Promise.as(result);
                        } else if (redPacket.get('status') != constants.RED_PACKET_STATUS.RUNNING) {
                            result.result = false;
                            result.errorMessage = "此红包已经被抢光！";
                            return new AV.Promise.as(result);
                        } else {
                            result.result = true;
                            result.reopen = false;
                            result.money = utils.luckMoney(redPacket.get('totalMoney'), redPacket.get('count'), redPacket.get('leftMoney'), redPacket.get('leftCount'));
                            if (redPacket.get('leftCount') <= 1) redPacket.set('status', constants.RED_PACKET_STATUS.FINISHED);
                            redPacket.increment('leftCount', -1);
                            redPacket.increment('leftMoney', -result.money);
                            return redPacket.save()
                                .then(function() {
                                    var userRedPacket = new AV.Object('UserRedPacket');
                                    userRedPacket.set('user', user);
                                    userRedPacket.set('redPacket', redPacket);
                                    userRedPacket.set('money', result.money);
                                    userRedPacket.set('leftMoney', redPacket.get('leftMoney'));
                                    userRedPacket.set('leftCount', redPacket.get('leftCount'));
                                    return userRedPacket.save();
                                })
                                .then(function(userRedPacket) {
                                    return utils.addCashFlow(user, result.money, constants.CASH_FLOW.INCOME, userRedPacket.id);
                                })
                                .then(function() {
                                    user.increment('earnedMoney', result.money);
                                    user.increment('redPacketCount');
                                    return user.save();
                                })
                                .then(function() {
                                    if (user.get('earnedMoney') - user.get('withdrawMoney') > 1) {
                                        utils.withdrawMoney(user);
                                    }
                                    result.redPacket = utils.redPacketSummary(redPacket);

                                    return new AV.Promise.as(result);
                                });
                        }
                    });
            });
    },

    luckMoney: function(totalMoney, count, leftMoney, leftCount) {
        if (leftCount == 1) return leftMoney;

        var minMoney = 0.2;
        var maxRandomMoney = 2.0 * (leftMoney - minMoney * leftCount) / leftCount;
        var luckMoney = Math.random() * maxRandomMoney + minMoney;
        luckMoney = Math.floor(luckMoney);

        return luckMoney;
    },

    withdrawMoney: function(user, money) {
        money = money || user.get('earnedMoney') - user.get('withdrawMoney');
        if (money < 1) return new AV.Promise.as();

        var payback = AV.Object.new('Payback');
        payback.set('user', user);
        payback.set('money', money);
        return payback.save()
            .then(function() {
                return wechatUtils.wxPayback(payback.id, user.get('openid'), money);
            })
            .then(function(result) {
                if (result.return_code == 'SUCCESS' && result.result_code == 'SUCCESS') {
                    console.log("Auto pay back user : " + user.id + ', money : ' + fee);

                    user.increment('withdrawMoney', money);
                    return user.save()
                        .then(function() {
                            payback.set('wxReturnInfo', result);
                            return payback.save();
                        })
                        .then(function() {
                            //record it
                            return utils.addCashFlow(user, -money, constants.CASH_FLOW.WITHDRAW, payback.id);
                        });
                }
            });
    },

    addCashFlow: function(user, cash, type, recordId) {
        var flow = AV.Object.new('CashFlow');
        flow.set('user', user);
        flow.set('cash', cash);
        flow.set('type', type);
        flow.set('recordId', recordId);

        return flow.save();
    },


    // update or create depends on whether contains data.redPacketId
    updateOrCreateRedPacket: function(user, data) {
        var result = {
            result: false
        };

        var promise;
        if (data.redPacketId) {
            var query = new AV.Query('RedPacket');
            promise = query.get(data.redPacketId);
        } else {
            var rp = new AV.Object('RedPacket');
            promise = AV.Promise.as(rp);
        }

        return promise.then(function(redPacket) {
            if (!redPacket) {
                result.errorMessage = "没有相应红包记录";
                return AV.Promise.as(result);
            } else {
                result.result = true;
                redPacket.set('creator', user);
                redPacket.set('count', data.count);
                redPacket.set('totalMoney', data.totalMoney);
                redPacket.set('leftMoney', data.totalMoney);
                redPacket.set('leftCount', data.count);
                redPacket.set('adLink', data.adLink);
                redPacket.set('adImage', utils.file(data.adImageFileId == 'null' ? '5784d9798ac24700604435ee' : data.adImageFileId));
                redPacket.set('publisherAvatar', utils.file(data.publisherAvatarFileId == 'null' ? '5784d95fc4c971005c41acbb' : data.publisherAvatarFileId));
                redPacket.set('publisherName', data.publisherName);
                redPacket.set('title', data.title);
                redPacket.set('invalidDate', new Date(data.invalidDate + " 23:59:59"));
                redPacket.set('status', constants.RED_PACKET_STATUS.NEW);
                return redPacket.save()
                    .then(function() {
                        result.redPacket = utils.redPacketSummary(redPacket);
                        result.rawRedPacket = redPacket;
                        return new AV.Promise.as(result);
                    })
                    .then(null, function(error) {
                        console.log(error);
                        result.result = false;
                        result.errorMessage = "服务端错误";
                        return new AV.Promise.as(result);
                    })
                    .catch(function(error) {
                        console.log(error);
                        result.result = false;
                        result.errorMessage = "服务端错误";
                        return new AV.Promise.as(result);
                    });
            }
        });
    },

    paidForRedPacket: function(user, redPacket) {
        return utils.addCashFlow(user, -totalMoney, constants.CASH_FLOW.SPEND, redPacket.id)
            .then(function() {
                user.increment('availableMoney', -totalMoney);
                user.increment('paidMoney', totalMoney);
                return user.save();
            });
    },

    fetchUserCreatedRedPacket: function(user) {
        var query = new AV.Query('RedPacket');
        query.include('creator');
        query.equalTo('creator', user);
        query.containedIn('status', constants.RED_PACKET_USER_VIEWABLE);
        return query.find()
            .then(function(rows) {
                var redPackets = _.map(rows, utils.redPacketSummary);
                return new AV.Promise.as(redPackets);
            }, function(err) {
                console.log(err);
            });
    },

    fetchUserOpenedRedPacket: function(user) {
        var query = new AV.Query('UserRedPacket');
        query.equalTo('user', user);
        return query.find()
            .then(function(rows) {
                var redPacketIds = _.map(rows, function(row) {
                    return row.get('redPacket').id;
                });

                var q2 = new AV.Query('RedPacket');
                q2.include('creator');
                q2.containedIn('objectId', redPacketIds);
                return q2.find();
            })
            .then(function(rows) {
                var redPackets = _.map(rows, utils.redPacketSummary);
                return new AV.Promise.as(redPackets);
            });
    },

    fetchAllActiveRedPacket: function() {
        var date = new Date();
        var query = new AV.Query('RedPacket');
        query.include('creator');
        query.equalTo('status', constants.RED_PACKET_STATUS.RUNNING);
        return query.find()
            .then(function(rows) {
                var redPackets = _.map(rows, utils.redPacketSummary);
                return new AV.Promise.as(redPackets);
            });
    },
};

module.exports = utils;