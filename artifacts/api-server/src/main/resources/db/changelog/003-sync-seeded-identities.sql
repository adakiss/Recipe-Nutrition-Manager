--liquibase formatted sql

--changeset recipe-nutrition:003-sync-seeded-identities-h2 dbms:h2
alter table app_user alter column id restart with 3;
alter table ingredient alter column id restart with 5;
alter table recipe alter column id restart with 2;

--changeset recipe-nutrition:003-sync-seeded-identities-postgresql dbms:postgresql
select setval(pg_get_serial_sequence('app_user', 'id'), coalesce((select max(id) from app_user), 1), true);
select setval(pg_get_serial_sequence('ingredient', 'id'), coalesce((select max(id) from ingredient), 1), true);
select setval(pg_get_serial_sequence('recipe', 'id'), coalesce((select max(id) from recipe), 1), true);