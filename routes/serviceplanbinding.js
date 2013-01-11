/*
 * GET Reference table, Languages, Countries and Type.
 */

var util = require('../lib/util.js');
var Base = require('../lib/base.js');
var TYPES = require('tedious').TYPES;

exports.createServicePlanBinding = function(req, res){

    var tenantid = req.headers['tenantid'];
    var vendorid = req.query.vendor;

    var base = new Base(tenantid);
    base.getConnByTenant(null, CreateServicePlanBinding);

    function CreateServicePlanBinding(config){
        var connection = util.createConnection(config, function(){
            var params = [{
                name: "VendorCompanyID",
                type: TYPES.VarChar,
                value: vendorid
            }];
            var request = util.createRequest(SQL, params, function(data){
                postProcess(data);
            });
            connection.execSql(request);
        });
    }

    function postProcess(data){
        var companys = [];
        
        for(var i=0; i< data.length; i++){
            var ref = data[i];

            var company = {
               CompanyGUID: ref.ID,
               CompanyName: util.decrypt(ref.CompanyName),
               Address: {
                   City: ref.AddressCity,
                   CountryCode: ref.CountryCode,
                   PostalCode: ref.AddressPostalCode,
                   State: ref.AddressState,
                   StreetAddress: util.decrypt(ref.Address)
               },
               Users: '',
               Licenses: ''
            };
            var users = [];
            var refs = util.XmlToJson(ref.Member).Members.Member;
            if(!Array.isArray(refs)) refs = [refs];
            for(var j=0; j < refs.length; j++){
                var ref_user = refs[j];
                var user = {
                    CompanyGUID: ref_user.CompanyID,
                    UserGUID: ref_user.ID,
                    UserLoginID: util.decrypt(ref_user.UserID),
                    FirstName: util.decrypt(ref_user.FirstName),
                    LastName: util.decrypt(ref_user.LastName),
                    TelephoneAreaCode: util.decrypt(ref_user.TelephoneAreaCode),
                    Telephone: util.decrypt(ref_user.Telephone),
                    TelephoneExtension: util.decrypt(ref_user.TelephoneExt),
                    Email: util.decrypt(ref_user.Email),
                    Status: ref_user.Status,
                    UserRole: ref_user.UserRole,
                    LanguageCode: ref_user.LanguageCode,
                    TimeZone: ref_user.TimeZoneCode        
                };
                users.push(user);
            }

            var licenses = [];
            var refs = util.XmlToJson(ref.License).Licenses.License;
            if(!Array.isArray(refs)) refs = [refs];
            for(var j=0; j < refs.length; j++){
                var ref_license = refs[j];
                var license = {
                    CompanyGUID: ref_license.CompanyID,
                    LicenseGUID: ref_license.ID,
                    PolicyName: ref_license.PolicyName,
                    VersionType: ref_license.VersionType,
                    LED: ref_license.LED,
                    Volume: ref_license.Volume,
                    IsAutoReNew: ref_license.IsAutoReNew
                };
                licenses.push(license);
            }
            company.Users = users;
            company.Licenses = licenses;
            companys.push(company);
        }
        res.send(companys);
    };

};

exports.getTop10GoingExpiredCompany = function(req, res){
    var SQL = "\
WITH tmp AS ( \
    SELECT TOP 10 ID AS LicenseGUID, CompanyID, PolicyName, CONVERT(VARCHAR(10), LED, 120) AS LED \
    FROM MBCompanySrv WITH(NOLOCK) \
    WHERE Enabled=1 \
    AND VersionType=1 \
    AND IsActivate=1 \
    AND IsAutoReNew=0 \
    AND LED >= GETUTCDATE() \
    AND CompanyID IN ( \
        SELECT ID \
        FROM MBCompany WITH(NOLOCK) \
        WHERE RoleID=6 AND (PID=@VendorCompanyID OR CreateByCompanyID=@VendorCompanyID) \
    ) \
    ORDER BY LED \
), tmp2 AS ( \
    SELECT ID AS CompanyID \
    , dbo.Decrypt(CompanyName) AS CompanyName \
    , CountryCode \
    , dbo.Decrypt(Address) AS Address \
    , AddressCity, AddressState, AddressPostalCode \
    , (SELECT ID AS UserGUID, CompanyID \
        , dbo.Decrypt(UserID) AS UserID \
        , dbo.Decrypt(FirstName) AS FirstName \
        , dbo.Decrypt(LastName) AS LastName \
        , dbo.Decrypt(TelephoneAreaCode) AS TelephoneAreaCode \
        , dbo.Decrypt(Telephone) AS Telephone \
        , dbo.Decrypt(TelephoneExt) AS TelephoneExt \
        , dbo.Decrypt(Email) AS Email \
        , Status \
        , ISNULL((SELECT TOP 1 AZRoleTypeMapID FROM MBMemberRoleMap WHERE MemberID=MBMember.ID),0) AS UserRole \
        , LanguageCode, TimeZoneCode \
        FROM MBMember WITH(NOLOCK) \
        WHERE CompanyID=MBCompany.ID \
        ORDER BY ISNULL(ModifyTime, CreateTime) DESC \
        FOR XML PATH('Member'), TYPE) AS Members \
    , (SELECT CompanyID, ID AS LicenseGUID, PolicyName, VersionType, CONVERT(VARCHAR(10), LED, 120) AS LED, Volume, IsAutoReNew \
        FROM MBCompanySrv WITH(NOLOCK) \
        WHERE CompanyID=MBCompany.ID \
        AND Enabled=1 \
        ORDER BY ISNULL(ModifyTime, CreateTime) DESC \
        FOR XML PATH('License'), TYPE) AS Licenses \
    FROM MBCompany WITH(NOLOCK) \
    WHERE ID IN (SELECT CompanyID FROM tmp) \
) \
SELECT * \
, (SELECT * FROM tmp2 WHERE tmp2.CompanyID = tmp.CompanyID FOR XML PATH('Company'), TYPE) AS Company \
FROM tmp";
    var tenantid = req.headers['tenantid'];
    var vendorid = req.query.vendor;

    var base = new Base(tenantid);
    base.getConnByTenant(null,GetTop10GoingExpiredCustomerCompany);

    function GetTop10GoingExpiredCustomerCompany(config){
        var connection = util.createConnection(config, function(){
            var params = [{
                name: "VendorCompanyID",
                type: TYPES.VarChar,
                value: vendorid
            }];
            var request = util.createRequest(SQL, params, function(data){
                postProcess(data);
            });
            connection.execSql(request);
        });
    }

    function postProcess(data){
        var companys = [];
        
        for(var i=0; i< data.length; i++){
            var ref = data[i];
            var root = {
                CompanyID: ref.CompanyID,
                LicenseGUID: ref.LicenseGUID,
                PolicyName: ref.PolicyName,
                LED: ref.LED
            };

            var refs_company = util.XmlToJson(ref.Company).Company;
            var company = {
               CompanyGUID: refs_company.CompanyID,
               CompanyName: refs_company.CompanyName,
               Address: {
                   City: refs_company.AddressCity,
                   CountryCode: refs_company.CountryCode,
                   PostalCode: refs_company.AddressPostalCode,
                   State: refs_company.AddressState,
                   StreetAddress: refs_company.Address
               },
               Users: '',
               Licenses: ''
            };
            var users = [];
            var refs = refs_company.Members.Member;
            if(!Array.isArray(refs)) refs = [refs];
            for(var j=0; j < refs.length; j++){
                var ref_user = refs[j];
                var user = {
                    CompanyGUID: ref_user.CompanyID,
                    UserGUID: ref_user.ID,
                    UserLoginID: ref_user.UserID,
                    FirstName: ref_user.FirstName,
                    LastName: ref_user.LastName,
                    TelephoneAreaCode: ref_user.TelephoneAreaCode,
                    Telephone: ref_user.Telephone,
                    TelephoneExtension: ref_user.TelephoneExt,
                    Email: ref_user.Email,
                    Status: ref_user.Status,
                    UserRole: ref_user.UserRole,
                    LanguageCode: ref_user.LanguageCode,
                    TimeZone: ref_user.TimeZoneCode        
                };
                users.push(user);
            }
            
            var licenses = [];
            var refs = refs_company.Licenses.License;
            if(!Array.isArray(refs)) refs = [refs];
            for(var j=0; j < refs.length; j++){
                var ref_license = refs[j];
                var license = {
                    CompanyGUID: ref_license.CompanyID,
                    LicenseGUID: ref_license.ID,
                    PolicyName: ref_license.PolicyName,
                    VersionType: ref_license.VersionType,
                    LED: ref_license.LED,
                    Volume: ref_license.Volume,
                    IsAutoReNew: ref_license.IsAutoReNew
                };
                licenses.push(license);
            }
            company.Users = users;
            company.Licenses = licenses;

            root.Company = company;
            companys.push(root);
        }

        res.send(companys);
    };
};
