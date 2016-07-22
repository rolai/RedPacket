var AV = require('./av.js');
var request = require('request');
const assert = require('assert');
var constants = require('./constants');
var _ = require('underscore');
var moment = require('moment');
var myip = require('quick-local-ip');

moment.locale('zh-cn');

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
            createdAt: user.getCreatedAt().format("yyyy/MM/dd"),
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
            publisherPhoneNumber: redPacket.get('publisherPhoneNumber'),
            title: redPacket.get('title'),
            invalidDate: redPacket.get('invalidDate').format("yyyy/MM/dd"),
            createdDate: redPacket.getCreatedAt().format("yyyy/MM/dd"),
            createdAt: moment(redPacket.getCreatedAt().getTime()).fromNow()
        };
        return obj;
    },

    convertRedPacketToCashFlowSummary: function(redpacket) {
        var obj = {
            id: redpacket.id,
            cash: redpacket.leftMoney - redpacket.totalMoney,
            type: 0,
            info: redpacket.title,
            createdAt: redpacket.createdDate
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
                                    var info = "【" + redPacket.get('publisherName') + "】的活动红包";
                                    return utils.addCashFlow(user, result.money, constants.CASH_FLOW.INCOME, info, userRedPacket.id);
                                })
                                .then(function() {
                                    user.increment('earnedMoney', result.money);
                                    user.increment('redPacketCount');
                                    return user.save();
                                })
                                .then(function() {
                                    var money = user.get('earnedMoney') - user.get('withdrawMoney');
                                    if (money > 100) {
                                        utils.withdrawMoney(user, money);
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
        if (money < 100) return new AV.Promise.as();

        console.log("用户%s，提现：%s", user.id, money);
        var payback = AV.Object.new('Payback');
        payback.set('user', user);
        payback.set('money', money);
        return payback.save()
            .then(function() {
                return utils.wxPayback(payback.id, user.get('openid'), money);
            })
            .then(function(result) {
                if (result.return_code == 'SUCCESS' && result.result_code == 'SUCCESS') {
                    console.log("Auto pay back user : " + user.id + ', money : ' + money);

                    user.increment('withdrawMoney', money);
                    return user.save()
                        .then(function() {
                            payback.set('wxReturnInfo', result);
                            return payback.save();
                        })
                        .then(function() {
                            //record it
                            var info = "提现至微信零钱";
                            return utils.addCashFlow(user, -money, constants.CASH_FLOW.WITHDRAW, info, payback.id);
                        });
                } else {
                    console.log("wx payback: %j", result);
                }
            }, function(error) {
                console.log(error);
            })
            .catch(function(error) {
                console.log(error);
            });
    },

    addCashFlow: function(user, cash, type, info, recordId, wxReturnInfo) {
        var flow = AV.Object.new('CashFlow');
        flow.set('user', user);
        flow.set('cash', cash);
        flow.set('type', type);
        flow.set('info', info);
        flow.set('recordId', recordId);
        if (wxReturnInfo) flow.set('wxReturnInfo', wxReturnInfo);

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
            rp.set('status', constants.RED_PACKET_STATUS.NEW);
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
                redPacket.set('publisherPhoneNumber', data.publisherPhoneNumber);
                redPacket.set('title', data.title);
                redPacket.set('invalidDate', new Date(data.invalidDate + " 23:59:59"));
                //redPacket.set('status', constants.RED_PACKET_STATUS.NEW);
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
        var info = "发红包：" + redPacket.get('title');
        return utils.addCashFlow(user, -totalMoney, constants.CASH_FLOW.SPEND, info, redPacket.id)
            .then(function() {
                user.increment('availableMoney', -totalMoney);
                user.increment('paidMoney', totalMoney);
                return user.save();
            });
    },

    fetchUserCreatedRedPacket: function(user, page, count) {
        page = page || 0;
        count = count || 20;
        if (count > 100) count = 100;

        var oneMonthBefore = moment().subtract(1, 'months').toDate();
        var query = new AV.Query('RedPacket');
        query.include('creator');
        query.equalTo('creator', user);
        query.containedIn('status', constants.RED_PACKET_USER_VIEWABLE);
        query.greaterThan('createdAt', oneMonthBefore);
        query.descending('createdAt');
        query.skip(page * count);
        query.limit(count);
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
        query.descending('createdAt');
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

    fetchActiveRedPacket: function(page, count) {
        page = page || 0;
        count = count || 20;
        if (count > 100) count = 100;

        var query = new AV.Query('RedPacket');
        query.include('creator');
        query.equalTo('status', constants.RED_PACKET_STATUS.RUNNING);
        query.descending('createdAt');
        query.skip(page * count);
        query.limit(count);
        return query.find()
            .then(function(rows) {
                var redPackets = _.map(rows, utils.redPacketSummary);
                return new AV.Promise.as(redPackets);
            });
    },

    cashFlowSummary: function(cashFlow) {
        var obj = {
            id: cashFlow.id,
            cash: cashFlow.get('cash'),
            type: cashFlow.get('type'),
            info: cashFlow.get('info'),
            createdAt: cashFlow.getCreatedAt().format("yyyy/MM/dd")
        };

        if (obj.type == constants.CASH_FLOW.WITHDRAW) obj.info = '提现至微信零钱';
        return obj;
    },

    fetchUserCashFlow: function(user, page, count) {
        page = page || 0;
        count = count || 20;
        if (count > 100) count = 100;
        var oneMonthBefore = moment().subtract(1, 'months').toDate();

        var query = new AV.Query('CashFlow');
        query.equalTo('user', user);
        query.containedIn('type', [constants.CASH_FLOW.INCOME, constants.CASH_FLOW.WITHDRAW]);
        query.greaterThan('createdAt', oneMonthBefore);
        query.descending('createdAt');
        query.skip(page * count);
        query.limit(count);
        return query.find()
            .then(function(rows) {
                var cashFlows = _.map(rows, utils.cashFlowSummary);
                return new AV.Promise.as(cashFlows);
            });
    },

    fetchRedPacketCashFlow: function(redPacketId, page, count) {
        page = page || 0;
        count = count || 20;
        if (count > 100) count = 100;

        var query = new AV.Query('UserRedPacket');
        query.include('user');
        query.equalTo('redPacket', utils.redPacket(redPacketId));
        query.descending('createdAt');
        query.skip(page * count);
        query.limit(count);
        return query.find()
            .then(function(rows) {
                var cashFlows = _.map(rows, function(row) {
                    var obj = {
                        cash: row.get('money'),
                        createdAt: row.getCreatedAt().format("yyyy/MM/dd")
                    };
                    var userName = row.get('user').get('nickname');
                    obj.info = "*" + userName.substr(1) + "领取了红包";
                    return obj;
                });
                return new AV.Promise.as(cashFlows);
            }, function(err) {
                console.log(err);
            });
    },

    updateRedPacketStatus: function(user, redPacketId, status) {
        var result = {
            result: false
        };
        var query = new AV.Query('RedPacket');
        return query.get(redPacketId)
            .then(function(redPacket) {
                if (!redPacket) {
                    result.errorMessage = "没有找到活动记录，活动可能已经被删除";
                } else if (redPacket.get('creator').id != user.id && user.get('role') != constants.ROLE.ADMIN) {
                    result.errorMessage = "你没有权限修改本活动，请联系管理员";
                } else {
                    result.result = true;
                    if (status == constants.RED_PACKET_STATUS.CLOSED) {
                        return utils.closeRedPacket(user, redpacket);
                    } else {
                        redPacket.set('status', status);
                        return redPacket.save();
                    }
                }
            })
            .then(function() {
                return AV.Promise.as(result);
            });
    },

    charge: function(user, userId, money) {
        var result = {
            result: false
        };

        if (user.get('role') != constants.ROLE.ADMIN) {
            result.message = "你没有权限做这个操作";
            return AV.Promise.as(result);
        } else {
            var theTargetUser = utils.user(userId);
            theTargetUser.increment('availableMoney', money);
            return theTargetUser.save()
                .then(function() {
                    return utils.addCashFlow(theTargetUser, money, constants.CASH_FLOW.CHARGE, '充值', user.id);
                })
                .then(function() {
                    result.result = true;
                    return AV.Promise.as(result);
                });
        }
    },

    payForRedPacketByLeftMoney: function(user, redPacket, money) {
        return utils.addCashFlow(user, money, constants.CASH_FLOW.SPEND, '余额支付创建活动', redPacket.id)
            .then(function() {
                user.increment('availableMoney', -money);
                return user.save();
            });
    },

    payForRedPacketByWechat: function(user, redPacket, money, wxReturnInfo) {
        return utils.addCashFlow(user, money, constants.CASH_FLOW.SPEND, '微信支付创建活动', redPacket.id, wxReturnInfo);
    },

    closeRedPacket: function(user, redPacket) {
        if (redPacket.get('status') == constants.RED_PACKET_STATUS.RUNNING || redPacket.get('status') == constants.RED_PACKET_STATUS.PAID) {
            var leftMoney = redPacket.get('leftMoney');
            redPacket.set('status', constants.RED_PACKET_STATUS.CLOSED);
            return redPacket.save()
                .then(function() {
                    return utils.addCashFlow(user, leftMoney, constants.CASH_FLOW.PAYBACK, '红包余额退款', redPacket.id);
                })
                .then(function() {
                    user.increment('availableMoney', leftMoney);
                    return user.sava();
                });
        }
    },

    encodeOrderId: function(orderId) {
        var randomStr = Math.random().toString(36).substr(2, 6);
        return orderId + '-' + randomStr;
    },

    decodeOrderId: function(orderId) {
        var index = orderId.indexOf('-');
        return index >= 0 ? orderId.substr(0, index) : orderId;
    },

    wxPayback: function(orderId, openid, fee) {
        return new AV.Promise(function(resolve, reject) {
            global.wxPayment.transfers({
                partner_trade_no: orderId, //商户订单号，需保持唯一性
                openid: openid,
                check_name: 'NO_CHECK',
                amount: fee,
                desc: '红包',
                spbill_create_ip: myip.getLocalIP4()
            }, function(err, result) {
                console.log(err);
                console.log(result);
                resolve(result);
            });
        });
    },

};

module.exports = utils;