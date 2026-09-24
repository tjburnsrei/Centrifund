import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
let db: PGlite;
let migration: string;
beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role;
        create schema crm;
        grant usage on schema crm to anon;
        create table crm.existing_records(id int primary key, label text);
        insert into crm.existing_records values(1,'Existing app fixture');
        grant select on crm.existing_records to anon;
        create function public.crm_request() returns text language sql as $$select 'existing'::text$$;
        create schema storage;
        grant usage on schema storage to anon,authenticated;
        create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        insert into storage.buckets values('existing-files','existing-files',true,123,null);
        create table storage.objects(id int primary key,bucket_id text);
        alter table storage.objects enable row level security;
        grant select,insert,update,delete on storage.objects to anon,authenticated;
        create policy existing_broad_policy on storage.objects for all to anon,authenticated using(true) with check(true);
        insert into storage.objects values(1,'existing-files'),(2,'centrifund-call-audio');`);
    migration = await readFile(new URL('../supabase/migrations/001_calling.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(await readFile(new URL('../supabase/migrations/002_private_audio.sql', import.meta.url), 'utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });
describe('existing Supabase project isolation', () => {
    it('preserves existing tables, functions, grants, buckets, and policies', async () => {
        await db.exec('set role anon');
        try {
            expect((await db.query('select label from crm.existing_records')).rows).toEqual([{ label: 'Existing app fixture' }]);
            expect((await db.query('select public.crm_request() result')).rows).toEqual([{ result: 'existing' }]);
            await expect(db.query('select * from centrifund_crm.contacts')).rejects.toThrow('permission denied');
        } finally { await db.exec('reset role'); }
        expect((await db.query("select public,file_size_limit from storage.buckets where id='existing-files'")).rows).toEqual([{ public: true, file_size_limit: 123 }]);
        expect((await db.query("select * from pg_policies where policyname='existing_broad_policy'")).rows).toHaveLength(1);
    });
    it('blocks existing broad Storage policies from granting access to calling audio', async () => {
        for (const role of ['anon', 'authenticated']) {
            await db.exec('set role ' + role);
            try {
                expect((await db.query('select id from storage.objects order by id')).rows).toEqual([{ id: 1 }]);
                await expect(db.query("insert into storage.objects values(3,'centrifund-call-audio')")).rejects.toThrow('row-level security');
                expect((await db.query('delete from storage.objects where id=2 returning id')).rows).toHaveLength(0);
            } finally { await db.exec('reset role'); }
        }
    });
    it('refuses reapplication instead of overwriting an occupied namespace', async () => {
        await expect(db.exec(migration)).rejects.toThrow('already exists');
        await db.exec('rollback');
        expect((await db.query<{n:number}>('select count(*)::int n from crm.existing_records')).rows[0].n).toBe(1);
        expect((await db.query<{n:number}>('select count(*)::int n from centrifund_crm.workspaces')).rows[0].n).toBe(3);
    });
});
