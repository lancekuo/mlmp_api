var routes = require('./index')
  , report = require('./report')
  , user = require('./user');
module.exports = function(app){
	app.get('/', routes.index);
	app.get('/report/getrftable', report.getRFTable);
	app.post('/user/IsValidUser', user.IsValid);
}
