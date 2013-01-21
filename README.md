## mLMP API - NodeJS ![build status](http://10.1.185.2/projects/1/status?ref=master)
===
This is the minimalist version of PartnetAPI_iOS, rewritten in [node.js](http://www.nodejs.org) for proof of concept.

### Prerequisite
1.   libxml2-devel, make, gcc, gcc-c++
*    nodejs 0.8.16 or above
    +    Modules in package.json
           >`npm update`
    
            express,    web framework
            jade,       template engine
            tedious,    Communicating with SQL Server using TDS 7.1/7.2 protocol
            node-uuid,  RFC4122 UUID generator
            xml2json,   SAX-based XML parser
            
        
            
### APIs
1.   **[POST]**Company/
+    **[POST]**Company/FindCompanyByKeyword
+    **[GET]**Company/GetCustomerCompanyByGUID/:GUID
+    **[POST]**User/IsValidUserForiOS
+    **[GET]**Report/GetRFTable
+    **[GET]**Report/GetTop10SeatCountCompany
+    **[GET]**Report/GetTop10GoingExpiredCompany
+    **[GET]**ServicePlan/
+    **[POST]**ServicePlanBinding/


