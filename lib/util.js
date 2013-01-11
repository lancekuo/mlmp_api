
var crypto = require('crypto');
var AESCrypt = {};
var cryptkey = "RAcwQ1yr7U3FOiDI8DOPrUdu8Twu3fYIicbyynZWJnk=",
    iv = 'j/YotoUJbq5dsle84JCp7w==';

module.exports = {
        decrypt: function(encryptdata) {
                        encryptdata = new Buffer(encryptdata, 'base64').toString('binary');
                        var decipher = crypto.createDecipheriv('aes-256-cbc', new Buffer(cryptkey, 'base64').toString('binary'), new Buffer(iv, 'base64').toString('binary')),
                        decoded = decipher.update(encryptdata, 'binary', 'utf8');
                        decoded += decipher.final('utf8');
                        return decoded;
                },
        encrypt: function(cleardata) {
                        var encipher = crypto.createCipheriv('aes-256-cbc', new Buffer(cryptkey, 'base64').toString('binary'), new Buffer(iv, 'base64').toString('binary')),
                        encryptdata = encipher.update(cleardata);
                //        encipher.setAutoPadding(false);
                         
                        encryptdata += encipher.final();
                        encode_encryptdata = new Buffer(encryptdata, 'binary').toString('base64');
                        return encode_encryptdata;
                },
        createRequest: function(sql, params, callback){
            var Request = require('tedious').Request;
//console.log(sql);
            var data = [];  
            var request = new Request(sql, function(err, rowCount) {
                if (err) {
                    console.log(err);
                } else {
                    return callback(data);
                }
            });
            
            for(var i=0; i<params.length; i++){
                var name = params[i].name, 
                    type = params[i].type, 
                    value = params[i].value; 
                request.addParameter(name, type, value);
            }
            request.on('row', function(columns) {
                var row = {};
                columns.forEach(function(column) {
                        row[column.metadata.colName] = column.value;
                });
                data.push(row);
            });

            return request;
        },
        createConnection: function(config, callback, debug){
            var Connection = require('tedious').Connection;
            var connection = new Connection(config);

            connection.on('connect', function(err) {
                if(err){
                    console.log(err);
                }else{
                    return callback();
                }
            });

            if(debug == true){
                connection.on('debug', function(text) {
                    console.log(text);
                });
            }

            return connection;
        },

        
        XmlToJson: function(xml, _options){
            var parser = require('xml2json');
            var options = {
                object: true,
                sanitize: false
            };
    
            for (var opt in _options) {
                options[opt] = _options[opt];
            }

            return parser.toJson(xml, options);
        }
}
