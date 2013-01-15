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
SELECT TOP 1 [GCtoken].[GID], [GCtoken].[CID], [Channel].[ID] ,[Channel].[ChannelName] ,[Channel].[ServerName] ,[Channel].[DBName] ,[Channel].[DBUserID] \
,[Channel].[DBPWD] ,[Channel].[ModifyBy] ,[Channel].[ModifyTime] ,[Channel].[DCCode] FROM [Channel] WITH (NOLOCK) \
JOIN [GCtoken] ON [GCtoken].[GID] = [Channel].[ID] \
WHERE [GCtoken].[Token] = @Token",
        queryMyCompany: "\
SELECT TOP 1 [MBMember].[ID] as 'UserGUID',[MBCompany].[ID] as 'CompanyGUID',[PID] ,[CompanyName] ,[CompanyNameUCast] ,[Address] ,[AllowViewDownStream] ,[RoleID] ,[MBCompany].[Status] ,[GC] ,[pfxCertificate] ,[crtCertificate] ,[pwdCertificate] ,[GroupString] ,[WLRefCompanyID] ,[WLTelphone] ,[WLEmail] ,[WLSupportUrl] ,[Note] ,[MBCompany].[CreateBy] ,[MBCompany].[CreateTime] ,[MBCompany].[ModifyBy] ,[MBCompany].[ModifyTime] ,[CountryCode] ,[AddressPostalCode] ,[AddressCity] ,[AddressState] ,[MBCompany].[System] ,[CreateByCompanyID] \
FROM [dbo].[MBCompany] \
JOIN [dbo].[MBMember] ON [MBMember].[CompanyID] = [MBCompany].[ID] \
WHERE [dbo].[MBCompany].[ID]=@CompanyGUID"
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
        var qs = this.SQL.queryConnectionString;
        var nextfn = this.getMyCompany;
        var connection = util.createConnection(XSPDB, function(){
            var params = [{
                name: "Token",
                type: TYPES.VarChar,
                value: queryid
            }];

            var tenantReq = util.createRequest(qs, params, function(data){
                msg1 = data[0];
                var config = {
                    "_MyCompanyGUID": msg1.CID,
                    "_MyChannelGUID": msg1.GID,
                    "server": XSPDB.server,
                    "userName": msg1.DBUserID,
                    "password": msg1.DBPWD,
                    "options": {
                        "database": msg1.DBName
                    }
                };
                nextfn(config, callback);
            });
            connection.execSql(tenantReq); 
        });

    };
    
    Base.prototype.getMyCompany = function(config, callback){
        var qs = "\
SELECT TOP 1 [MBMember].[ID] as 'UserGUID',[MBCompany].[ID] as 'CompanyGUID',[PID] ,[CompanyName] ,[CompanyNameUCast] ,[Address] ,[AllowViewDownStream] ,[RoleID] ,[MBCompany].[Status] ,[GC] ,[pfxCertificate] ,[crtCertificate] ,[pwdCertificate] ,[GroupString] ,[WLRefCompanyID] ,[WLTelphone] ,[WLEmail] ,[WLSupportUrl] ,[Note] ,[MBCompany].[CreateBy] ,[MBCompany].[CreateTime] ,[MBCompany].[ModifyBy] ,[MBCompany].[ModifyTime] ,[CountryCode] ,[AddressPostalCode] ,[AddressCity] ,[AddressState] ,[MBCompany].[System] ,[CreateByCompanyID] \
  FROM [dbo].[MBCompany] \
  JOIN [dbo].[MBMember] ON [MBMember].[CompanyID] = [MBCompany].[ID] \
  WHERE [dbo].[MBCompany].[ID]=@CompanyGUID";
        var connection = util.createConnection(config, function(){
            var params = [{
                name: "CompanyGUID",
                type: TYPES.VarChar,
                value: config._MyCompanyGUID
            }];

            var companyReq = util.createRequest(qs, params, function(data){
                config.MyCompany = data[0];
                config.MyCompany['GID'] = config._MyChannelGUID;
                config.MyCompany['CID'] = config._MyCompanyGUID;
                delete config._MyCompanyGUID;
                delete config._MyChannelGUID;
                callback(config);
            });
            connection.execSql(companyReq); 
        });
    };


    return Base;
})();

module.exports = Base;
