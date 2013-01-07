/*
 * GET Reference table, Languages, Countries and Type.
 */

exports.IsValid = function(req, res){
    var util = require('../lib/util.js');
    var XSPDB = require('../db/XSPDB.json');
    var TYPES = require('tedious').TYPES;
    var SQL = "\
SELECT TOP 1 [Channel].[ID] ,[Channel].[ChannelName] ,[Channel].[ServerName] ,[Channel].[DBName] ,[Channel].[DBUserID] \
,[Channel].[DBPWD] ,[Channel].[ModifyBy] ,[Channel].[ModifyTime] ,[Channel].[DCCode] FROM [Channel] WITH (NOLOCK) \
JOIN [GCtoken] ON [GCtoken].[GID] = [Channel].[ID] \
WHERE [GCtoken].[Token] = @Token";
  
    var tenantid = req.headers['tenantid'];
    var connection = util.createConnection(XSPDB, function(){
        var params = [{
            name: "Token",
            type: TYPES.VarChar,
            value: tenantid
        }];

        var request = util.createRequest(SQL, params, function(data){
            msg1 = data[0];
            findUserByUserIDAndPassword({
                "server": XSPDB.server,
                "userName": msg1.DBUserID,
                "password": msg1.DBPWD,
                "options": {
                        "database": msg1.DBName
                }
            });
        });
        connection.execSql(request);
    }, true);

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
        SQL = "SELECT * FROM MBMember WHERE UserID = @userid and UserPWD = @passwd and Status=1";
            
        var xsp_connection = util.createConnection(config, function(){
            xsp_request = util.createRequest(SQL, params, function(data){
                getUserRoleMappingByMemberID(config, data);
            });
            xsp_connection.execSql(xsp_request);
        }, true);
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
                data[0].RoleID = roleData[0];
                res.send(data[0]);
            });
            map_connection.execSql(map_request);
        }, true);
    }
};
