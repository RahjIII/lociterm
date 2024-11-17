# Run this one time to update a version 0 database to 241026
# sqlite3 locitermdb < thisfile.sql
.bail on

INSERT INTO GAMEDBSTATUS ("ID","STATUS") VALUES (6,"Redacted");
DROP TABLE DBVERSION;
CREATE TABLE DBVERSION (
 VERSION INTEGER,
 CREATED DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO DBVERSION ("VERSION") VALUES ( 241026 );

.print DB updated to 241026.