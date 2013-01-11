var routes = require('./index')
  , company = require('./company')
  , serviceplan = require('./serviceplan')
  , serviceplanbinding = require('./serviceplanbinding')
  , report = require('./report')
  , user = require('./user');
module.exports = function(app){
	app.get('/', routes.index);
	app.get('/report/getrftable', report.getRFTable);
	app.get('/report/GetTop10SeatCountCompany', report.getTop10SeatCountCompany);
	app.get('/report/GetTop10GoingExpiredCompany', report.getTop10GoingExpiredCompany);
	app.post('/user/IsValidUserForiOS', user.IsValid);
	app.post('/company', company.createCompany);
	app.post('/company/FindCompanyByKeyword', company.findCompanyByKeyword);
	app.get('/company/GetCustomerCompanyByGUID/:GUID', company.getCustomerCompanyByGUID);
	app.get('/serviceplan', serviceplan.findAvailableServicePlans);
	app.post('/serviceplanibinding', serviceplanbinding.createServicePlanBinding);
}
