/*
 * GET ServicePlan relative.
 */

var util = require('../lib/util.js');
var Base = require('../lib/base.js');
var TYPES = require('tedious').TYPES;

exports.findAvailableServicePlans = function(req, res){
    var SQL = "\
SELECT ID ,PolicyName ,ServiceID ,BUCode ,LicensePeriodM ,DaysToExpire ,IsAutoReNew \
FROM vwPLSubscriptionPolicyALL \
WHERE CompanyID=@VendorCompanyID \
AND ActivationType=1 \
AND Enabled=1 \
AND ContractType='Saas'";

    var tenantid = req.headers['tenantid'];

    var base = new Base(tenantid);
    base.getConnByTenant(null, FindAvailableServicePlans);

    function FindAvailableServicePlans(config){
        var connection = util.createConnection(config, function(){
            var params = [{
                name: "VendorCompanyID",
                type: TYPES.VarChar,
                value: config.MyCompany.CompanyGUID
            }];
            var request = util.createRequest(SQL, params, function(data){
                postProcess(data);
            });
            connection.execSql(request);
        });
    }

    function postProcess(data){
        
        var list = [];
        for(var i=0; i<data.length; i++){
            var serviceplan = {
                ServicePlanGUID: data[i].ID,
                Name: data[i].PolicyName,
                ServiceGUID: data[i].ServiceID,
                BUCode: data[i].BUCode,
                LicensePeriod: data[i].LicensePeriodM,
                DaysToExpire: data[i].DaysToExpire,
                IsAutoRenew: (data[i].IsAutoReNew)?1:0
            };
            list.push(serviceplan);
        }
        var serviceplans = {
            ServicePlans: list
        };

        res.send(serviceplans);
    }
};
