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
                value: config.MyCompany.CompanyGUID
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
                value: config.MyCompany.CompanyGUID 
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
    
    var newCompany = {
        Address: data.Address.StreetAddress,
        AddressPostalCode: data.Address.PostalCode,
        AddressCity: data.Address.City,
        AddressState: data.Address.State,
        CompanyName: data.CompanyName,
        CountryCode: data.Address.CountryCode,
        Note: data.Note,
        RoleID: data.CompanyType
    }

    var newUser = {
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
        var myCompany = config.MyCompany;

        newCompany.PID = myCompany.CompanyGUID;
        newCompany.Status = 1;
        newCompany.AllowViewDownStream = 'true';
        newCompany.WLEmail = myCompany.WLEmail;
        newCompany.WLSupportUrl = myCompany.WLSupportUrl;
        newCompany.WLTelphone = myCompany.WLTelphone;
        newCompany.WLRefCompanyID = myCompany.CompanyGUID;
        newCompany.CreateBy = myCompany.UserGUID;
        newCompany.CreateByCompanyID = myCompany.CompanyGUID;

        newUser.CreateBy = myCompany.UserGUID;
        newUser.Status = 1;

        var companyEntity = {
                ID : require('node-uuid').v4().toUpperCase(),
                PID : newCompany.PID,
                RoleID : newCompany.RoleID,
                GC : require('util').format('?G=%s&C=%s&T=%s', myCompany.GID, myCompany.CID, tenantid),
                AllowViewDownStream : newCompany.AllowViewDownStream,
                Status : newCompany.Status,
                WLEmail : newCompany.WLEmail,
                WLSupportUrl : newCompany.WLSupportUrl,
                WLTelphone : newCompany.WLTelphone,
                WLRefCompanyID : newCompany.WLRefCompanyID,
                Address : util.encrypt(newCompany.Address),
                AddressPostalCode : newCompany.AddressPostalCode,
                AddressCity : newCompany.AddressCity,
                AddressState : newCompany.AddressState,
                CountryCode : newCompany.CountryCode,
                CompanyName : util.encrypt(newCompany.CompanyName),
                CompanyNameUCast : util.encrypt(newCompany.CompanyName.toUpperCase()),
                Note : '', //util.encrypt(newCompany.Note),
                CreateBy : newCompany.CreateBy,
                CreateByCompanyID : newCompany.CreateByCompanyID,
                CreateTime : new Date().toISOString().replace(/T/,' ').replace(/Z/,''),
                System : 'PLX'
        };
        genGroupString(config, companyEntity);
    };

    function genGroupString(config, company){
        SQL = "\
SELECT (SELECT count([ID]) \
FROM [xSPV30_MonkeyD].[dbo].[MBCompany] \
WHERE PID=@CompanyGUID) as 'Count', \
(SELECT GroupString \
FROM [xSPV30_MonkeyD].[dbo].[MBCompany] \
WHERE ID=@CompanyGUID) as 'GroupString'";
        var connection = util.createConnection(config, function(){
            var params = [{
                name: "CompanyGUID",
                type: TYPES.VarChar,
                value: config.MyCompany.CompanyGUID
            }];
            var request = util.createRequest(SQL, params, function(data){
                company.GroupString = function(){
                    var str = '00000000'+data[0].Count;

                    return str.substring(data[0].Count.toString().length, str.length)+data[0].GroupString;
                }();
                CreateMember(config, company);
            });
            connection.execSql(request);
        });
    };
    function CreateMember(config, company){
        var userEntity = {
            ID : require('node-uuid').v4().toUpperCase(),
            CompanyID: company.ID,
            UserPWD: util.encrypt(newUser.Password),
            UserID: util.encrypt(newUser.UserID),
            UserIDUCast: util.encrypt(newUser.UserID.toUpperCase()),
            Status: newUser.Status,
            IsViewPrivacy: false,

            LanguageCode: newUser.LanguageCode,
            TimeZoneCode: newUser.TimeZoneCode,

            TelephoneAreaCode: util.encrypt(newUser.TelephoneAreaCode),
            Telephone: util.encrypt(newUser.Telephone),
            TelephoneExt: util.encrypt(newUser.TelephoneExt),

            FirstName: util.encrypt(newUser.FirstName),
            LastName: util.encrypt(newUser.LastName),
            Email: util.encrypt(newUser.Email),
            EmailLCast: util.encrypt(newUser.Email.toLowerCase()),

            CreateBy: newUser.CreateBy,
            CreateTime: new Date().toISOString().replace(/T/,' ').replace(/Z/,''),
            System: 'PLX'
        };

        var roleMapEntity = {
            ID: require('node-uuid').v4().toUpperCase(),
            AZRoleTypeMapID: 61,
            CreateBy: userEntity.CreateBy,
            CreateTime: new Date().toISOString().replace(/T/,' ').replace(/Z/,''),
            System: 'PLX',
            MemberID: userEntity.ID
        };

        var roleMapHistoryEntity = {
            GID: require('node-uuid').v4().toUpperCase(),
            MemberID: userEntity.ID,
            AZRoleTypeMapID: 61,
            CreateBy: userEntity.CreateBy,
            CreateTime: new Date().toISOString().replace(/T/,' ').replace(/Z/,''),
            System: 'PLX'
        };
        
        var CompanySQL = "INSERT INTO MBCompany (%s) VALUES (%s);";
        var MemberSQL = "INSERT INTO MBMember (%s) VALUES (%s);";
        var RoleMapSQL = "INSERT INTO MBMemberRoleMap (%s) VALUES (%s);";
        var RoleMapHistorySQL = "INSERT INTO MBMemberRoleMapHistory (%s) VALUES (%s);";

        var f = '', v = '';
        for (var key in company){
            f += "["+key+"] ,";
            v += "'"+company[key]+"' ,";
        }
        CompanySQL = require('util').format(CompanySQL, f.substr(0, f.length-1), v.substr(0, v.length-1));
        var f = '', v = '';
        for (var key in userEntity){
            f += "["+key+"] ,";
            v += "'"+userEntity[key]+"' ,";
        }
        MemberSQL = require('util').format(MemberSQL, f.substr(0, f.length-1), v.substr(0, v.length-1));
        var f = '', v = '';
        for (var key in roleMapEntity){
            f += "["+key+"] ,";
            v += "'"+roleMapEntity[key]+"' ,";
        }
        RoleMapSQL = require('util').format(RoleMapSQL, f.substr(0, f.length-1), v.substr(0, v.length-1));
        var f = '', v = '';
        for (var key in roleMapHistoryEntity){
            f += "["+key+"] ,";
            v += "'"+roleMapHistoryEntity[key]+"' ,";
        }
        RoleMapHistorySQL = require('util').format(RoleMapHistorySQL, f.substr(0, f.length-1), v.substr(0, v.length-1));
        var connection = util.createConnection(config, function(){
            var sql = CompanySQL+MemberSQL+RoleMapSQL+RoleMapHistorySQL;
            connection.beginTransaction(function(err){
                
                var tranReq = util.createRequest(sql, [], function(data){

                    connection.commitTransaction(function(){
                        findCompanyByGUID(config, userEntity);
                    });
                }, function(err){
                    console.log(err);
                    connection.rollbackTransaction(function(err){console.log(err);});
                });
                connection.execSql(tranReq); 
            });
        });
    };
    function findCompanyByGUID(config, member){

        var SQL = "SELECT [ID], [GC] FROM MBCompany WHERE ID=@CompanyID";
        var connection = util.createConnection(config, function(){
            var params = [{
                name: "CompanyID",
                type: TYPES.VarChar,
                value: member.CompanyID 
            }];
            var request = util.createRequest(SQL, params, function(data){
                var rtn = {
                    CompanyGUID: member.CompanyID,
                    UserGUID: member.ID,
                    TenantID: data[0].GC.match(/T=(.*)$/)[1]
                };
                res.json(rtn);
            });
            connection.execSql(request);
        });
    };
};
