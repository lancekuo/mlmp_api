/*
 * GET Reference table, Languages, Countries and Type.
 */
var util = require('../lib/util.js');
var Base = require('../lib/base.js');
var TYPES = require('tedious').TYPES;

exports.IsValid = function(req, res){
    var SQL = "SELECT * FROM MBMember WHERE UserID = @userid and UserPWD = @passwd and Status=1";
    var tenantid = req.headers['tenantid'];

    var base = new Base(tenantid);
    base.getConnByTenant(null, findUserByUserIDAndPassword);

    function findUserByUserIDAndPassword(config){
        var userid = util.encrypt(req.body.UserLoginID),
            passwd = util.encrypt(req.body.Password);
        var params = [{
            name: "userid",
            type: TYPES.VarChar,
            value: userid
        },{
            name: "passwd",
            type: TYPES.VarChar,
            value: passwd       
        }];
                    
        var connection = util.createConnection(config, function(){
            request = util.createRequest(SQL, params, function(data){
                getUserRoleMappingByMemberID(config, data);
            });
            connection.execSql(request);
        });
    }

    function getUserRoleMappingByMemberID(config, data){
        
        SQL = "SELECT * \
FROM [xSPV30_MonkeyD].[dbo].[MBMemberRoleMap] AS rm \
JOIN [xSPV30_MonkeyD].[dbo].[AZCompanyMemberRoleMap] AS az ON rm.AZRoleTypeMapID = az.AZRoleTypeMapID \
WHERE MemberID = @memberid";
        
        var params = [{
            name: "memberid",
            type: TYPES.VarChar,
            value: data[0].ID
        }];

        var map_connection = util.createConnection(config, function(){
            map_request = util.createRequest(SQL, params, function(roleData){
                var rtn = {
                        "UserGUID" : data[0]["ID"],
                        "FirstName" : util.decrypt(data[0]["FirstName"]),
                        "LastName" : util.decrypt(data[0]["LastName"]),
                        "TelephoneAreaCode" : util.decrypt(data[0]["TelephoneAreaCode"]),
                        "Telephone" : util.decrypt(data[0]["Telephone"]),
                        "TelephoneExtension" : util.decrypt(data[0]["TelephoneExt"]),
                        "UserLoginID" : util.decrypt(data[0]["UserID"]),
                        "Email" : util.decrypt(data[0]["Email"]),
                        "LanguageCode" : data[0]["LanguageCode"],
                        "TimeZone" : data[0]["TimeZoneCode"],
                        "CompanyGUID" : data[0]["CompanyID"],
                        "Status" : data[0]["Status"],
                        "UserRole" : roleData[0].AZRoleID
                };
                res.send(rtn);
            });
            map_connection.execSql(map_request);
        });
    }
};
