'use strict';
var express = require('express');
var timeout = require('connect-timeout');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var AV = require('leanengine');
var extension = require('./extension');
var wechatUtils = require('./wechat-utils');
var wechat = require('./routes/wechat');
var rootRoutes = require('./routes/root');
var userRoutes = require('./routes/user');
var redPacket = require('./routes/red-packet');
var adminRoutes = require('./routes/admin');
var constants = require('./constants');
var cloud = require('./cloud');

var app = express();

// 加载 cookieSession 以支持 AV.User 的会话状态
app.use(AV.Cloud.CookieSession({
    secret: 'ss007luck',
    maxAge: 3600000,
    fetchUser: true
}));

// 设置模板引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/public', express.static(path.join(__dirname, 'public')));

// 设置默认超时时间
app.use(timeout('60s'));

// 加载云代码方法
app.use(cloud);
// 加载云引擎中间件
app.use(AV.express());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());


// ask for login
app.use(function(req, res, next) {
    if (req.originalUrl == '/user/login' || req.originalUrl == '/admin/login' || req.originalUrl.startWith('/wechat') || req.currentUser) {
        next();
    } else {
        // console.log("url: %j", req.originalUrl);
        var reg = /^\/rp\/open\/(\w{10,})/;
        var result = reg.exec(req.originalUrl);
        if (result) {
            return res.redirect(wechatUtils.getAuthorizeURL('rp-' + result[1]));
        }

        if (req.originalUrl.startWith('/all-events')) {
            return res.redirect(wechatUtils.getAuthorizeURL('all-events'));
        }

        res.redirect(wechatUtils.getAuthorizeURL('me'));
    }
});

// ask for admin rights
app.use(function(req, res, next) {
    if (req.originalUrl != '/admin/login' && req.originalUrl.startWith('/admin') && req.currentUser.get('role') != constants.ROLE.ADMIN) {
        res.redirect('/admin/login');
    } else {
        next();
    }
});


// weixin signature
app.use(function(req, res, next) {
    if (req.method == 'GET' && req.originalUrl != '/user/login') {
        wechatUtils.getWechatTicket()
            .then(function(jsTicket) {
                //console.log("jsTicket: %j", jsTicket);
                // console.log(req.protocol);
                var fullUrl = 'https://' + req.get('host') + req.originalUrl;
                //console.log(fullUrl);
                var signature = wechatUtils.signTicket(jsTicket.ticket, fullUrl);
                //console.log("url %s, signature: %j", fullUrl, signature);
                req.signature = signature;
                req.domain = req.get('host');
                next();
            });
    } else {
        next();
    }
});

// 可以将一类的路由单独保存在一个文件中
app.use('/', rootRoutes);
app.use('/wechat', wechat);
app.use('/rp', redPacket);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);


app.use(function(req, res, next) {
    // 如果任何一个路由都没有返回响应，则抛出一个 404 异常给后续的异常处理器
    if (!res.headersSent) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }
});

// error handlers
app.use(function(err, req, res, next) { // jshint ignore:line
    var statusCode = err.status || 500;
    if (statusCode === 500) {
        console.error(err.stack || err);
    }
    if (req.timedout) {
        console.error('请求超时: url=%s, timeout=%d, 请确认方法执行耗时很长，或没有正确的 response 回调。', req.originalUrl, err.timeout);
    }
    res.status(statusCode);
    // 默认不输出异常详情
    var error = {}
    if (app.get('env') === 'development') {
        // 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
        error = err;
    }
    res.render('error', {
        message: err.message,
        error: error
    });
});

module.exports = app;