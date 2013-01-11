/*
 * GET Reference table, Languages, Countries and Type.
 */

var util = require('../lib/util.js');
var Base = require('../lib/base.js');
var faultInfo = require('../lib/faultinfo.js');
var TYPES = require('tedious').TYPES;

exports.findCompanyByKeyword = function(req, res){
    var SQL = "\
WITH tmp AS ( \
    SELECT ID, dbo.Decrypt(CompanyName) AS CompanyName, CountryCode, dbo.Decrypt(Address) AS Address, AddressCity, AddressState, AddressPostalCode \
    , (SELECT CompanyID, ID, UserID, FirstName, LastName, TelephoneAreaCode, Telephone, TelephoneExt, Email, Status \
        , ISNULL((SELECT TOP 1 AZRoleTypeMapID FROM MBMemberRoleMap WHERE MemberID=MBMember.ID),0) AS UserRole \
        , LanguageCode, TimeZoneCode \
        FROM MBMember WITH(NOLOCK) \
        WHERE CompanyID=MBCompany.ID \
        FOR XML PATH('Member'), ROOT('Members'), TYPE) AS Member \
    , (SELECT CompanyID, ID, PolicyName, VersionType, CONVERT(VARCHAR(10), LED, 120) AS LED, Volume, IsAutoReNew \
        FROM MBCompanySrv WITH(NOLOCK) \
        WHERE CompanyID=MBCompany.ID \
        AND Enabled=1 \
        ORDER BY \
            CASE WHEN VersionType=1 AND IsActivate=1 AND LED >= GETUTCDATE() \
            THEN \
                Volume \
            ELSE \
                -2147483648 \
            END DESC \
        FOR XML PATH('License'), ROOT('Licenses'), TYPE) AS License \
    , ROW_NUMBER() OVER(ORDER BY dbo.Decrypt(CompanyName)) AS Row \
    FROM MBCompany WITH(NOLOCK) \
    WHERE RoleID=6 AND (PID=@VendorCompanyID OR CreateByCompanyID=@VendorCompanyID) \
    AND (dbo.Decrypt(CompanyName) LIKE @Keyword \
    OR ID IN (SELECT CompanyID FROM MBMember WITH(NOLOCK) WHERE dbo.Decrypt(FirstName) LIKE @Keyword OR dbo.Decrypt(LastName) LIKE @Keyword)) \
) \
SELECT * FROM tmp \
WHERE Row BETWEEN @StartNum AND @EndNum \
";
    var tenantid = req.headers['tenantid'];
    var startnum = req.body.StartNum;
    var endnum = req.body.EndNum;
    var keyword = req.body.Keyword;

    var base = new Base(tenantid);
    base.getConnByTenant(null, FindCompanyByKeyword);

    function FindCompanyByKeyword(config){
        var connection = util.createConnection(config, function(){
            var params = [{
                name: "VendorCompanyID",
                type: TYPES.VarChar,
                value: config._MyCompanyGUID 
            },{
                name: "StartNum",
                type: TYPES.Int,
                value: startnum
            },{
                name: "EndNum",
                type: TYPES.Int,
                value: endnum
            },{
                name: "Keyword",
                type: TYPES.VarChar,
                value: '%'+keyword+'%'
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
               CompanyName: ref.CompanyName,
               Address: {
                   CountryCode: ref.CountryCode,
                   StreetAddress: ref.Address,
                   City: ref.AddressCity,
                   State: ref.AddressState,
                   PostalCode: ref.AddressPostalCode
               },
               Note: null,
               Users: '',
               Licenses: ''
            };

            var refs_users = util.XmlToJson(ref.Member);
            var users = [];
            var refs = refs_users.Members.Member;
            if(!Array.isArray(refs)) refs = [refs];
            for(var j=0; j < refs.length; j++){
                var ref_user = refs[j];
                var user = {
                    UserGUID: ref_user.ID,
                    FirstName: util.decrypt(ref_user.FirstName),
                    LastName: util.decrypt(ref_user.LastName),
                    TelephoneAreaCode: util.decrypt(ref_user.TelephoneAreaCode),
                    Telephone: util.decrypt(ref_user.Telephone),
                    TelephoneExtension: util.decrypt(ref_user.TelephoneExt),
                    UserLoginID: util.decrypt(ref_user.UserID),
                    Email: util.decrypt(ref_user.Email),
                    LanguageCode: ref_user.LanguageCode,
                    TimeZone: ref_user.TimeZoneCode,       
                    CompanyGUID: ref_user.CompanyID,
                    Status: ref_user.Status.toString(),
                    UserRole: ref_user.UserRole,
                };
                users.push(user);
            }

            var licenses = [];
            if(ref.License != null && ref.License != undefined){
                var refs_licenses = util.XmlToJson(ref.License);
                var refs = refs_licenses.Licenses.License;
                if(!Array.isArray(refs)) refs = [refs];
                for(var j=0; j < refs.length; j++){
                    var ref_license = refs[j];
                    var license = {
                        LicenseGUID: ref_license.ID,
                        CompanyGUID: ref_license.CompanyID,
                        PolicyName: ref_license.PolicyName,
                        VersionType: ref_license.VersionType,
                        LED: ref_license.LED+'T00:00:00',
                        Volume: ref_license.Volume,
                        IsAutoReNew: ref_license.IsAutoReNew
                    };
                    licenses.push(license);
                }
            }
            company.Users = users;
            company.Licenses = licenses;
            companys.push(company);
        }
        res.json(companys);
    };

};

exports.getCustomerCompanyByGUID = function(req, res){
    var SQL = "\
WITH tmp AS ( \
SELECT ID, dbo.Decrypt(CompanyName) AS CompanyName, CountryCode, dbo.Decrypt(Address) AS Address, AddressCity, AddressState, AddressPostalCode \
, (SELECT CompanyID, ID, UserID, FirstName, LastName, TelephoneAreaCode, Telephone, TelephoneExt, Email, Status \
    , ISNULL((SELECT TOP 1 AZRoleTypeMapID FROM MBMemberRoleMap WHERE MemberID=MBMember.ID),0) AS UserRole \
    , LanguageCode, TimeZoneCode \
    FROM MBMember \
    WHERE CompanyID=MBCompany.ID \
    FOR XML PATH('Member'), ROOT('Members'), TYPE) AS Member \
, (SELECT CompanyID, ID, PolicyName, VersionType, CONVERT(VARCHAR(10), LED, 120) AS LED, Volume, IsAutoReNew \
    FROM MBCompanySrv \
    WHERE CompanyID=MBCompany.ID \
    AND Enabled=1 \
    ORDER BY CreateTime DESC \
    FOR XML PATH('License'), ROOT('Licenses'), TYPE) AS License \
FROM MBCompany \
WHERE RoleID=6 AND (PID=@VendorCompanyID OR CreateByCompanyID=@VendorCompanyID) AND ID=@CustomerCompanyID \
) \
SELECT * FROM tmp"; 
    var tenantid = req.headers['tenantid'];

    var guid = req.params.GUID;

    var base = new Base(tenantid);
    base.getConnByTenant(null, FindCompanyByKeyword);

    function FindCompanyByKeyword(config){
        var connection = util.createConnection(config, function(){
            var params = [{
                name: "VendorCompanyID",
                type: TYPES.VarChar,
                value: config._MyCompanyGUID 
            },{
                name: "CustomerCompanyID",
                type: TYPES.VarChar,
                value: guid
            }];
            var request = util.createRequest(SQL, params, function(data){
                postProcess(data);
            });
            connection.execSql(request);
        }, true);
    }

    function postProcess(data){
        var companys = [];
        
        for(var i=0; i< data.length; i++){
            var ref = data[i];

            var company = {
               CompanyGUID: ref.ID,
               CompanyName: ref.CompanyName,
               Address: {
                   City: ref.AddressCity,
                   CountryCode: ref.CountryCode,
                   PostalCode: ref.AddressPostalCode,
                   State: ref.AddressState,
                   StreetAddress: ref.Address
               },
               Users: '',
               Licenses: ''
            };

            var refs_users = util.XmlToJson(ref.Member);
            var users = [];
            var refs = refs_users.Members.Member;
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
            if(ref.License != null && ref.License != undefined){
                var refs_licenses = util.XmlToJson(ref.License);
                var refs = refs_licenses.Licenses.License;
                if(!Array.isArray(refs)) refs = [refs];
                for(var j=0; j < refs.length; j++){
                    var ref_license = refs[j];
                    var license = {
                        CompanyGUID: ref_license.CompanyID,
                        LicenseGUID: ref_license.ID,
                        PolicyName: ref_license.PolicyName,
                        VersionType: ref_license.VersionType,
                        LED: ref_license.LED,
                        Volumn: ref_license.Volumn,
                        IsAutoReNew: ref_license.IsAutoReNew
                    };
                    licenses.push(license);
                }
            }
            company.Users = users;
            company.Licenses = licenses;
            companys.push(company);
        }
        res.send(companys);
    };
};

exports.createCompany = function(req, res) {
    var tenantid = req.headers['tenantid'];
    var data = req.body;

    var base = new Base(tenantid);
    base.getConnByTenant(null, CreateCompany);
    
    var company = {
        Address: data.Address.StreetAddress,
        AddressPostalCode: data.Address.PostalCode,
        AddressCity: data.Address.City,
        AddressState: data.Address.State,
        CompanyName: data.CompanyName,
        CountryCode: data.Address.CountryCode,
        Note: data.Note,
        RoleID: data.CompanyType
    }

    var user = {
        FirstName: data.User.FirstName,
        LastName: data.User.LastName,
        TelephoneAreaCode: data.User.TelephoneAreaCode,
        Telephone: data.User.Telephone,
        TelephoneExt: data.User.TelephoneExtension,
        UserID: data.User.UserLoginID,
        Password: data.User.Password,
        Email: data.User.Email,
        LanguageCode: data.User.LanguageCode,
        TimeZoneCode: data.User.TimeZone
    };

    // Validation
    // - CountryCode
    
    function CreateCompany(config){
        company.PID = config._MyCompanyGUID;
        company.Status = 1;
        company.AllowViewDownStream = 'true';
        company.WLEmail = config._WLEmail;
        company.WLSupportUrl = config._WLSupportUrl;
        company.WLTelphone = config._WLTelphone;
        company.WLRefCompanyID = config._MyCompanyGUID;
        company.CreateBy = config._MyGUID;
        company.CreateByCompanyID = config._MyCompanyGUID;

        user.CreateBy = config._MyGUID;
        user.Status = 1;
        console.log(company, user);
    };
};
