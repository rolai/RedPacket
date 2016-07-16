var AV = require('leanengine');
var env = require('./choice.json').env;
var configs = require('./configs.json');

var keys = AV.keys = configs[env];
AV.init(keys.APP_ID, keys.APP_KEY, keys.MASTER_KEY);
AV.setProduction(1);
AV.Cloud.useMasterKey();

module.exports = AV;