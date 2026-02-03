# Run this one time to update a version 260126 database to a version 260202 database
# sqlite3 lociterm.db < thisfile.sql
.bail on

# add the dbversion to the table.
INSERT INTO DBVERSION ("VERSION") VALUES ( 260202 );

CREATE TABLE IF NOT EXISTS GREETING (
  GAME INTEGER NOT NULL PRIMARY KEY,
  LASTSCAN DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  SPLASH BLOB,
  FOREIGN KEY(GAME) REFERENCES GAMEDB(ID)
);

.print DB updated to 260202.
