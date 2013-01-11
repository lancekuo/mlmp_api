var Base;

Base = (function(){

    var util = require('./util');
    var XSPDB = require('../db/XSPDB.json');
    var TYPES = require('tedious').TYPES;

    Base.prototype.setConfigObject = function(config){
        this.ConnectObject = config;
    };
    
    Base.prototype.getConfigObject = function(){
        return this.ConnectObject;
    };

    Base.prototype.SQL = {
        queryConnectionString: "\
SELECT TOP 1 [GCtoken].[CID], [Channel].[ID] ,[Channel].[ChannelName] ,[Channel].[ServerName] ,[Channel].[DBName] ,[Channel].[DBUserID] \
,[Channel].[DBPWD] ,[Channel].[ModifyBy] ,[Channel].[ModifyTime] ,[Channel].[DCCode] FROM [Channel] WITH (NOLOCK) \
JOIN [GCtoken] ON [GCtoken].[GID] = [Channel].[ID] \
WHERE [GCtoken].[Token] = @Token"
    };
    
    Base.prototype.TENANTID = null;
    Base.prototype.ConnectObject = null;

    function Base(tenantid){
        this.TENANTID = tenantid;
    }
    
    Base.prototype.getConnByTenant = function(tenantid, callback){
        if(tenantid != null && tenantid != undefined){
            var queryid = tenantid;
        }else{
            var queryid = this.TENANTID;
        }
        var sqlReq = this._createRequest(queryid, callback);
        this._queryConnectionStringByTenant(sqlReq);

    };

    Base.prototype._queryConnectionStringByTenant = function(req){

        var connection = util.createConnection(XSPDB, function(){
            connection.execSql(req);
        }, false);

    };

    Base.prototype._createRequest = function(tenantid, callback){
        var params = [{
            name: "Token",
            type: TYPES.VarChar,
            value: tenantid
        }];

        return util.createRequest(this.SQL.queryConnectionString, params, function(data){
            msg1 = data[0];
            var config = {
                "_MyCompanyGUID": msg1.CID,
                "server": XSPDB.server,
                "userName": msg1.DBUserID,
                "password": msg1.DBPWD,
                "options": {
                        "database": msg1.DBName
                }
            };

            return callback(config);
        });

    };

    return Base;
})();

module.exports = Base;
