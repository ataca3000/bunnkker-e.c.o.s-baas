-- ECOS ERP — MySQL initialization: create test database
-- Runs automatically on the FIRST start of a fresh MySQL container
-- (docker-entrypoint-initdb.d). Safe to re-run: CREATE DATABASE IF NOT EXISTS.
--
-- The 'ecos' user is created by docker-compose environment variables
-- (MYSQL_USER / MYSQL_PASSWORD). We only need to create the extra DB and grant.

CREATE DATABASE IF NOT EXISTS `ecos_erp_test`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `ecos_erp_test`.* TO 'ecos'@'%';
FLUSH PRIVILEGES;
