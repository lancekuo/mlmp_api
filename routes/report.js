
/*
 * GET Reference table, Languages, Countries and Type.
 */

exports.getRFTable = function(req, res){
  var msg = [];
  var XSPDB = require('../db/XSPDB.json');
  
  var SQL = "SELECT 'MemberRoleMap' AS RFItem \
, (SELECT AZRoleTypeMapID AS 'key', RoleName AS 'string' \
FROM AZCompanyMemberRoleMap WITH(NOLOCK) \
ORDER BY AZRoleID, OrderNum \
FOR XML PATH(''), ROOT('dict'), TYPE) AS MapItem \
UNION ALL \
SELECT 'LicenseVersionTypeMap' AS RFItem \
, (SELECT VersionType AS 'key', DisplayName AS 'string' \
FROM VersionType WITH(NOLOCK) \
FOR XML PATH(''), ROOT('dict'), TYPE) AS MapItem \
UNION ALL \
SELECT 'LanguageMap' AS RFItem \
, (SELECT LanguageCode AS 'key', DisplayName AS 'string' \
FROM LCLanguage WITH(NOLOCK) \
ORDER BY DisplayName \
FOR XML PATH(''), ROOT('dict'), TYPE) AS MapItem";
  
  var Request = require('tedious').Request;
  var Connection = require('tedious').Connection;
  
  var connection = new Connection(XSPDB);
  connection.on('connect', function(err) {
    executeStatement();
  });

  connection.on('debug', function(text) {
    console.log(text);
  });

  function executeStatement() {
    request = new Request(SQL, function(err, rowCount) {
      if (err) {
        console.log(err);
      } else {
        console.log(rowCount + ' rows');
        res.send(msg);
      }
      connection.close();
    });

    request.on('row', function(columns) {
      var row = [];
      columns.forEach(function(column) {
        console.log(column.value);
        row.push(column.value);
      });
      msg.push(row);
    });
    request.on('done', function(rowCount, more) {
        console.log(rowCount + ' rows returned');
        conosle.log('done');
    })

    connection.execSql(request);
  };
};
