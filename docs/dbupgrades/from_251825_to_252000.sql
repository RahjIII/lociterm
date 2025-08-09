# Run this one time to update a version 251825 database to a version 252000 database
# (I have no idea why I blew the db version format. 251825 is not in YYMMDD format)
# sqlite3 lociterm.db < thisfile.sql
.bail on

ALTER TABLE SCAN ADD COLUMN SINCE DATETIME;

# add the dbversion to the table.
INSERT INTO DBVERSION ("VERSION") VALUES ( 252000 );

.print DB updated to 252000.
