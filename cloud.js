var AV = require('./av.js');
var _ = require('underscore');

function convertToFuncUserDataResult(func) {
    return function(request, response) {
        var user = request.user;
        if (!user) {
            response.error('i18n.not_logged_in');
            return;
        }

        var result = {};
        var data = request.params;

        // don't write 'result = xxx' in side the implementation of func
        return func(user, data, result)
            .then(function() {
                response.success(result)
            })
            .catch(function(err) {
                response.error(err);
            });
    }
}

var sections = [
    // require('./buffer'),
];

_.each(sections, function(section) {
    _.each(section, function(func, name) {
        AV.Cloud.define(name, convertToFuncUserDataResult(func));
    });
});

function convertToGuestFunc(func) {
    return function(request, response) {
        var result = {};
        var data = request.params;

        return func(data, result)
            .then(function() {
                response.success(result)
            })
            .catch(function(err) {
                response.error(err);
            });
    }
}

sections = [
    require('./functions/cron'),
];

_.each(sections, function(section) {
    _.each(section, function(func, name) {
        AV.Cloud.define(name, convertToGuestFunc(func));
    })
});


module.exports = AV.Cloud;