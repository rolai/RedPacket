var router = require('express').Router();
var AV = require('../av.js');
var utils = require('../utils.js');
var _ = require('underscore');
var constants = require('../constants');

// 渲染登录页面
router.get('/login', function(req, res, next) {
    res.render('admin/login.ejs', {message: ''});
});

router.post('/login', function(req, res, next) {
    AV.User.logIn(req.body.username, req.body.password)
        .then(function(user) {
            if(user.get('role') != constants.ROLE.ADMIN) {
              res.render('admin/login.ejs', {message: '登录失败！'});
            } else {
              res.saveCurrentUser(user); // 保存当前用户到 Cookie.
              res.redirect('/admin/query-user'); // 跳转到个人资料页面
            }
        }, function(error) {
            //登录失败，跳转到登录页面
            console.log(error);
            res.render('admin/login.ejs', {message: '登录失败！'});
        });
});


router.get('/query-user', function(req, res, next) {
    res.render('admin/query-user.ejs', {message: ''});
});

router.post('/query-user', function(req, res, next) {
    console.log(req.body);
    var query = new AV.Query('_User');
    query.contains('nickname', req.body.username);
    query.find()
      .then(function(rows){
        var users = _.map(rows, utils.userSummary);
        res.render('admin/query-result.ejs', {users: users});
      }, function(err){console.log(err);});
});

router.get('/charge/:userId', function(req, res, next) {
  var query = new AV.Query('_User');
  query.get(req.params.userId)
    .then(function(result){
      var user = utils.userSummary(result);
      res.render('admin/charge.ejs', {user: user});
    });
});

router.post('/charge/:userId', function(req, res, next) {
  var money = parseInt(req.body.money);
  if(money > 0){
    utils.charge(req.params.userId, money)
      .then(function(result){
        var message;
        if(result.result === true) {
          message = "充值成功";
        } else {
          message = result.message;
        }

        res.render('admin/charge-result.ejs', {message: message});
      });
  } else {
    res.render('admin/charge-result.ejs', {message: "充值失败，请输入正确的金额"});
  }
});

module.exports = router;
