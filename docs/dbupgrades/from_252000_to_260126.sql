# Run this one time to update a version 252000 database to a version 260126 database
# sqlite3 lociterm.db < thisfile.sql
.bail on

# add the dbversion to the table.
INSERT INTO DBVERSION ("VERSION") VALUES ( 260126 );

CREATE INDEX IF NOT EXISTS MSSP_IDX ON MSSP (CREATED);

.print DB updated to 260126.
