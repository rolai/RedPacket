var configs = require('./configs.json');
var AV = require('./av.js');
var utils = require('./utils.js');
var crypto = require('crypto');
var myip = require('quick-local-ip');
var env = require('./choice.json').env;
var defaultWechatConfig = configs.wechat;

function createNonceStr() {
    //return 'jDnLwXkOQmiUmB';
    return Math.random().toString(36).substr(2, 15);
}

function createTimestamp() {
    return parseInt(new Date().getTime() / 1000) + '';
}

function createQueryString(options) {
    // console.log("%j", options);
    return Object.keys(options).filter(function(key) {
        return ['pfx', 'partner_key', 'sign', 'key'].indexOf(key) < 0;
    }).sort().map(function(key) {
        return key + '=' + options[key];
    }).join("&");
}

function createTicketQueryString(options) {
    var result = "jsapi_ticket=" + options['jsapi_ticket'] + "&noncestr=" + options['noncestr'] +
        "&timestamp=" + options['timestamp'] + "&url=" + options['url'];
    return result;
}

function createOrderQueryString(options) {
    var result = "appId=" + options['appId'] + "&noncestr=" + options['noncestr'] +
        "&package=" + options['package'] + "&signType=" + options['signType'] + "&timestamp=" + options['timestamp'];
    return result;
}

var wechatUtils = {
    getAuthorizeURL: function(state, scope, wechatConfig) {
        state = state || '';
        scope = scope || 'snsapi_userinfo';
        wechatConfig = wechatConfig || defaultWechatConfig;
        var domain = configs[env].DOMAIN;
        var redirectUrl = 'https://' + domain + '/wechat/oauth';
        var url = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + wechatConfig.appId + '&redirect_uri=' + encodeURIComponent(redirectUrl) + '&response_type=code&scope=' + scope + '&state=' + encodeURIComponent(state) + '#wechat_redirect';

        return url;
    },

    // https://coderwall.com/p/9cifuw/scraping-web-pages-using-node-js-using-request-promise
    getAccessTokenWithCode: function(code, wechatConfig) {
        wechatConfig = wechatConfig || defaultWechatConfig;
        var url = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + wechatConfig.appId + '&secret=' + wechatConfig.appSecret + '&code=' + code + '&grant_type=authorization_code';

        return utils.requestToJSONAsPromise(url);
    },

    getUserInfoWithAccessToken: function(openid, access_token) {
        var url = 'https://api.weixin.qq.com/sns/userinfo?access_token=' + access_token + '&openid=' + openid + '&lang=zh_CN';

        return utils.requestToJSONAsPromise(url);
    },

    doAllTheWorkWithCode: function(code, wechatConfig) {
        wechatConfig = wechatConfig || defaultWechatConfig;
        var theUser;
        var userInfo;
        var tokenInfo;
        var accessToken;

        return wechatUtils.getAccessTokenWithCode(code, wechatConfig)
            .then(function(data) {
                tokenInfo = data;
                accessToken = tokenInfo.access_token;
                return wechatUtils.getUserInfoWithAccessToken(tokenInfo.openid, accessToken);
            });
    },

    getWechatTicket: function(wechatConfig) {
        console.log('getWechatTicket');
        wechatConfig = wechatConfig || defaultWechatConfig;
        var timestamp = parseInt(new Date().getTime() / 1000);
        if (global.ticket && timestamp < global.ticket.timestamp + global.ticket.expires_in) {
            return AV.Promise.as(global.ticket);
        }

        var url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={{APPID}}&secret={{APPSECRET}}".format({
            APPID: wechatConfig.appId,
            APPSECRET: wechatConfig.appSecret
        });
        return utils.requestToJSONAsPromise(url)
            .then(function(response) {
                global.accessToken = response.access_token;
                console.log('ACCESS_TOKEN: ' + response.access_token);
                var url = "https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token={{ACCESS_TOKEN}}&type=jsapi".format({
                    ACCESS_TOKEN: response.access_token
                });
                return utils.requestToJSONAsPromise(url);
            }, function(err){console.log(err);})
            .then(function(response) {
                global.ticket = response;
                global.ticket.timestamp = parseInt(new Date().getTime() / 1000);
                console.log('js ticket: ' + JSON.stringify(global.ticket));
                return AV.Promise.as(global.ticket);
            }, function(err){console.log(err);});
    },

    getMediaUrl: function(mediaId) {
        return "http://file.api.weixin.qq.com/cgi-bin/media/get?access_token=" + global.accessToken + "&media_id=" + mediaId;
    },

    /**
     * 生成统一下单签名
     * @param  prepay_id  通过微信API申请的订单id
     * @param  key  微商号的API key
     * @return  签名之后的订单
     */
    signOrder: function(prepay_id, key) {
        var order = {
            "appId": defaultWechatConfig.appId, //公众号名称，由商户传入
            "timeStamp": createTimestamp(), //时间戳，自1970年以来的秒数
            "nonceStr": createNonceStr(), //随机串
            "package": "prepay_id=" + prepay_id,
            "signType": "MD5" //微信签名方式：
        };
        var querystring = createQueryString(order) + "&key=" + key;
        order.paySign = crypto.createHash('md5').update(querystring).digest('hex').toUpperCase();

        return order;
    },

    /**
     * @synopsis 签名算法
     *
     * @param jsapi_ticket 用于签名的 jsapi_ticket
     * @param url 用于签名的 url ，注意必须动态获取，不能 hardcode
     *
     * @returns
     */
    signTicket: function(jsapi_ticket, url) {
        var ticket = {
            jsapi_ticket: jsapi_ticket,
            noncestr: createNonceStr(),
            timestamp: createTimestamp(),
            url: url
        };
        var string = createTicketQueryString(ticket);
        var jsSHA = require('jssha');
        var shaObj = new jsSHA(string, 'TEXT');
        ticket.signature = shaObj.getHash('SHA-1', 'HEX');

        // console.log("sign: " + string);
        // console.log("signature: " + ticket.signature);
        return ticket;
    },

    wxPayback: function(orderId, openid, fee) {
        return new AV.Promise(function(resolve, reject) {
            wxPayment.transfers({
                partner_trade_no: orderId, //商户订单号，需保持唯一性
                openid: openid,
                check_name: 'NO_CHECK',
                amount: fee,
                desc: '红包',
                spbill_create_ip: myip.getLocalIP4()
            }, function(err, result) {
                resolve(result);
            });
        });
    },
};

module.exports = wechatUtils;
