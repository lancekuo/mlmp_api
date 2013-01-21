/*
 * GET Reference table, Languages, Countries and Type.
 */

var util = require('../lib/util.js');
var Base = require('../lib/base.js');
var TYPES = require('tedious').TYPES;

exports.createServicePlanBinding = function(req, res){

    var tenantid = req.headers['tenantid'];
    var post = req.body;

    var base = new Base(tenantid);
    base.getConnByTenant(null, endCustomerCompany);

    function endCustomerCompany(config){
        this.config = config;

        var connection = util.createConnection(config, function(){
            var SQL = "SELECT ID FROM MBCompany WHERE ID=@CompanyID";
            var params = [{
                name: "CompanyID",
                type: TYPES.VarChar,
                value: post.CompanyGUID
            }];
            var request = util.createRequest(SQL, params, function(data){
                this.endCustomerCompany = data[0];
                servicePlan(data);
            });
            connection.execSql(request);
        });
    };

    function servicePlan(data){
        var connection = util.createConnection(this.config, function(){
            var SQL = "\
SELECT ID as GUID, ServiceID, LicensePeriodM, ActivationType, BUCode, AutoExtensionM, IsAutoReNew, DaysToExpire, PolicyName, ContractType, ChargeableMonth, IsDelegation \
FROM vwPLSubscriptionPolicyALL \
WHERE CompanyID=@CompanyID \
AND ActivationType=1 \
AND Enabled=1 \
AND ContractType='SaaS' \
AND ID=@ServiceID";
            var params = [{
                name: "CompanyID",
                type: TYPES.VarChar,
                value: this.config.MyCompany.CompanyGUID
            }, {
                name: "ServiceID",
                type: TYPES.VarChar,
                value: post.ServicePlanGUID
            }];
            var request = util.createRequest(SQL, params, function(data){
                // throw new FaultInfoException(FaultInfo.SERVICEPLAN_BINDING_BINDING_RECORD_EXISTS);
                this.servicePlan = data[0];
                serviceProfile(data);
            });
            connection.execSql(request);
        });
    };

    function serviceProfile(data){
        var connection = util.createConnection(this.config, function(){
            var SQL = "\
SELECT ServiceID, GracePeriod \
FROM PSServiceProfile \
WHERE ServiceID=@ServiceID";
            var params = [{
                name: "ServiceID",
                type: TYPES.VarChar,
                value: this.servicePlan.ServiceID
            }];
            var request = util.createRequest(SQL, params, function(data){
                this.serviceProfile = data[0];
                postProcess(data);
            });
            connection.execSql(request);
        });

    };

    function updateAC(){
        var SQL = "\
WITH tmp as( \
SELECT TOP 1 ID, ACCode, ProductID, ServiceID, PriceType, SalesType, VersionType, LEF, Status \
FROM MBCompanyAC \
WHERE OwnerID=@CompanyID \
AND ServiceID=@ServiceID \
AND VersionType=1 \
AND Status=1 \
ORDER BY CreateTime Desc) \
UPDATE tmp \
SET Status=2 \
output inserted.ID, inserted.ACCode, inserted.ProductID, inserted.ServiceID, inserted.PriceType, inserted.SalesType, inserted.VersionType, inserted.LEF, inserted.Status";
        var params = [{
            name: "CompanyID",
            type: TYPES.VarChar,
            value: this.config.MyCompany.CompanyGUID
        }, {
            name: "ServiceID",
            type: TYPES.VarChar,
            value: this.servicePlan.ServiceID
        }];
        return util.createRequest(SQL, params, function(data){
            if(data.length == 1){
                this.companyAC = data[0];
                this.tranConn.execSql(createBinding());
            }else{
                this.tranConn.rollbackTransaction(function(err){console.log('Rollback: ', err);});
                res.json(490,{Code: "0x00045009",Message: "Not enough Activation Code in Stock to perform binding.",AdditionalMessage:""});
            }
        }, function(err){
            console.log(err);
            this.tranConn.rollbackTransaction(function(err){console.log(err);});
        });
    };

    function createBinding(){

        var licensePeriodM = (this.servicePlan.LicensePeriodM != undefined && this.servicePlan.LicensePeriodM != null) ? this.servicePlan.LicensePeriodM : 0;
        var autoExtensionM = (this.servicePlan.autoExtensionM != undefined && this.servicePlan.autoExtensionM != null) ? this.servicePlan.autoExtensionM : 0;
        var isAutoRenew = (this.servicePlan.isAutoRenew != undefined && this.servicePlan.isAutoRenew != null) ? this.servicePlan.isAutoRenew : 0;
        var lsd = new Date(post.LicenseStartDate);
        var led = new Date(post.LicenseStartDate);
        led.setMonth(lsd.getMonth()+1);
        led.setDate(lsd.getDate()-1);

        var newBinding = {
            ID : require('node-uuid').v4().toUpperCase(),
            Functional : 1,
            CompanyID : this.endCustomerCompany.ID,
            VenderID : this.config.MyCompany.CompanyGUID, //sellerCompany,
            ACCode : this.companyAC.ACCode,
            IsViewEula : 0,
            ProductID : this.companyAC.ProductID,
            ServiceID : this.companyAC.ServiceID,    //BUCode : companyAC.BUCode,
            BUCode : this.servicePlan.BUCode,
            PriceType : this.companyAC.PriceType,
            SalesType : this.companyAC.SalesType,
            VersionType : this.companyAC.VersionType,    //Volume : companyAC.Volume,
            Volume : post.SeatCount,
            LEF : this.companyAC.LEF,    //LSD : licenseStartDate ?? DateTime.UtcNow, 
            LSD : lsd.toISOString().replace('T', ' ').replace('Z', ''), //DateTime.UtcNow.ConvertTimeFromUtc(timeZoneCodeForLSD),     //LED : companyAC.LED,
            LED : led.toISOString().replace('T', ' ').replace('Z', ''),
            ActivationType : this.servicePlan.ActivationType,
            SubscriptionID : this.servicePlan.GUID,
            PolicyName : "N'"+this.servicePlan.PolicyName+"'",
            LicensePeriodM : licensePeriodM,    //GracePeriod : '1',
            GracePeriod : this.serviceProfile.GracePeriod,   //psserviceProfile.GracePeriod.
            DaysToExpire : this.servicePlan.DaysToExpire,
            AutoExtensionM : autoExtensionM,
            IsAutoReNew : isAutoRenew,
            Enabled : 1,
            IsActivate : 1,
            ContractType : this.servicePlan.ContractType,
            ChargeableMonth : this.servicePlan.ChargeableMonth,
            CreateBy : this.config.MyCompany.UserGUID,
            CreateTime : new Date().toISOString().replace(/T/,' ').replace(/Z/,''),
            System : 'PAPI',
            CreateByCompanyID : this.config.MyCompany.CompanyGUID,
            IsDelegation : this.servicePlan.IsDelegation
        };
        var f = '', v = '';
        for (var key in newBinding){
            f += "["+key+"] ,";
            if(/^N'(.*)'/.test(newBinding[key]) == true){
                v += newBinding[key]+" ,";
            }else{
                v += "'"+newBinding[key]+"' ,";
            }
        }
        var CompanysrvSQL = "INSERT INTO MBCompanySrv (%s) VALUES (%s);";
        CompanysrvSQL = require('util').format(CompanysrvSQL, f.substr(0, f.length-1), v.substr(0, v.length-1));

        return util.createRequest(CompanysrvSQL, [], function(data){
            console.log('CompanySrv record created.');
            this.newBinding = newBinding;
            this.tranConn.execSql(deleteAC());

        }, function(err){
            console.log(err);
            this.tranConn.rollbackTransaction(function(err){console.log(err);});
        });
    };

    function deleteAC(){
        var SQL = "DELETE FROM MBCompanyAC WHERE ID=@GUID AND Status=2";
        var params = [{
            name: "GUID",
            type: TYPES.VarChar,
            value: this.companyAC.ID
        }];
        return util.createRequest(SQL, params, function(data){
            console.log('Deleted AC code record.');
            this.tranConn.execSql(DCSelectionRecord());
        }, function(err){
            console.log(err);
            this.tranConn.rollbackTransaction(function(err){console.log(err);});
        });
    }

    function DCSelectionRecord(){
        var SQL = "SELECT BUCode FROM PSDCSelectionResult WHERE ServiceID=@ServiceID AND CompanyID=@CompanyID";
        var params = [{
            name: "ServiceID",
            type: TYPES.VarChar,
            value: this.servicePlan.ServiceID
        }, {
            name: "CompanyID",
            type: TYPES.VarChar,
            value: this.endCustomerCompany.ID
        }];
        return util.createRequest(SQL, params, function(data){
            console.log('has DCSelection result, skipping creation.');
            this.tranConn.execSql(writeHistory());
        }, function(err){
            console.log(err);
            this.tranConn.rollbackTransaction(function(err){console.log(err);});
        });
    };

    function writeHistory(){
        var hist = {
            ACCode : this.newBinding.ACCode,
            BUCode : this.newBinding.BUCode,
            ChargeableMonth : this.newBinding.ChargeableMonth,
            ComboProductID : null,
            ComboTransactionID : null,
            CompanyID : this.newBinding.CompanyID,
            ContractType : this.newBinding.ContractType,
            ConvertFromACCode : null,
            CreateBy : this.config.MyCompany.UserGUID,
            CreateByCompanyID : this.config.MyCompany.CompanyGUID,
            CreateTime : new Date().toISOString().replace(/T/,' ').replace(/Z/,''),
            Functional : this.newBinding.Functional,
            ID : this.newBinding.ID,
            IsDelegation_NEW : (this.newBinding.IsDelegation == true)? 1: 0,
            IsDelegation_OLD : null,
            Enabled_NEW : (this.newBinding.Enabled == true)? 1: 0,
            Enabled_OLD : null,
            LCD_NEW : null,
            LCD_OLD : null,
            LED_NEW : this.newBinding.LED,
            LED_OLD : null,
            LEF_NEW : (this.newBinding.LEF == true)? 1: 0,
            LEF_OLD : null,
            LSD_NEW : this.newBinding.LSD,
            LSD_OLD : null,
            MBSrvHGID : require('node-uuid').v4().toUpperCase(),
            ModifyBy : null,
            ModifyTime : null,
            PolicyName_NEW : this.newBinding.PolicyName,
            PolicyName_OLD : null,
            Volume_NEW : this.newBinding.Volume,
            Volume_OLD : null,
            SubscriptionID_NEW : this.newBinding.SubscriptionID,
            SubscriptionID_OLD : null,
            PreviousTrancID : null,
            PriceType : this.newBinding.PriceType,
            ProductID : this.newBinding.ProductID,
            SalesType : this.newBinding.SalesType,
            ServiceID : this.newBinding.ServiceID,
            SyncFlag : -1,
            System : this.newBinding.System,
            TransactionID : require('node-uuid').v4().toUpperCase(),
            TransactionType : 1,
            VenderID : this.newBinding.VenderID,
            VersionType : this.newBinding.VersionType
        };
        var f = '', v = '';
        for (var key in hist){
            f += "["+key+"] ,";
            if(hist[key] == 'null' || hist[key] == null ){
                v += "null ,";
            }else if(/^N'(.*)'/.test(hist[key]) == true){
                v += hist[key]+" ,";
            }else{
                v += "'"+hist[key]+"' ,";
            }
        }
        var CompanysrvhistorySQL = "INSERT INTO MBCompanySrvHistory (%s) VALUES (%s);";
        CompanysrvhistorySQL = require('util').format(CompanysrvhistorySQL, f.substr(0, f.length-1), v.substr(0, v.length-1));
        return util.createRequest(CompanysrvhistorySQL, [], function(data){
            this.tranConn.execSql(FindBindingRecordByGUID());

        }, function(err){
            console.log('HistorySQL:',err);
            this.tranConn.rollbackTransaction(function(err){console.log(err);});
        });
    };
    function postProcess(data){
        
        this.tranConn = util.createConnection(this.config, function(){
            this.tranConn.beginTransaction(function(err){
                var tranReq1 = updateAC();
                this.tranConn.execSql(tranReq1);
            });
        });
    };

    function FindBindingRecordByGUID(){
        var SQL = "SELECT * FROM MBCompanySrv WHERE ID=@BindingID";
        var params = [{
            name: "BindingID",
            type: TYPES.VarChar,
            value: this.newBinding.ID
        }];
        return util.createRequest(SQL, params, function(data){
            this.bindingRecord = data[0];
            this.tranConn.execSql(FindServiceByServiceGUID());
        }, function(err){
            console.log(err);
            this.tranConn.rollbackTransaction(function(err){console.log(err);});
        }); 
    };

    function FindServiceByServiceGUID(){
        var SQL = "SELECT * FROM PSServiceProfile WHERE ServiceID=@ServiceID";
        var params = [{
            name: "ServiceID",
            type: TYPES.VarChar,
            value: this.bindingRecord.ServiceID
        }];
        return util.createRequest(SQL, params, function(data){
            this.serviceProfile = data[0];
            var response = {
                ServicePlanBindingGUID : this.newBinding.ID,
                ACCode : this.bindingRecord.ACCode,
                ExpNotification : this.bindingRecord.DaysToExpire,
                IsAutoRenew : (this.bindingRecord.IsAutoReNew == true)? 1: 0,
                LicenseExpirationDate : this.bindingRecord.LED,
                LicenseStartDate : this.bindingRecord.LSD,
                SeatCount : this.bindingRecord.Volume,
                ServicePlanName : this.bindingRecord.PolicyName,
                ServiceStatus : (this.bindingRecord.IsActivate == true)? 1: 0,
                ServiceID : this.serviceProfile.ServiceID,
                LicenseChargeDate : (this.bindingRecord.LCD != null) ? this.bindingRecord.LCD : null,
                ServiceName : this.serviceProfile.ServiceName
            };
            this.tranConn.commitTransaction(function(){
//            this.tranConn.rollbackTransaction(function(err){console.log('Rollbacked. Test purpose.');});
                res.json(response);
            });

        }, function(err){
            console.log(err);
            this.tranConn.rollbackTransaction(function(err){console.log(err);});
        });
    };
};
