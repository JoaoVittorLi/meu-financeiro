'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { FinanceDB } = require('../electron/db.cjs');
const { migrateHierarchy, normalizedName } = require('../electron/d05-hierarchy.cjs');

function legacy630() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'mf2-d05-e1-'));
  const file = path.join(dir,'legacy.sqlite');
  const raw = new DatabaseSync(file);
  raw.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE categories(name TEXT PRIMARY KEY COLLATE NOCASE,color TEXT NOT NULL,built_in INTEGER NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO categories(name,color,built_in) VALUES('Moradia','#3e9a85',1),('Personalizada','#87929c',0);
    CREATE TABLE profiles(profile TEXT PRIMARY KEY, initialized_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO profiles(profile) VALUES('real'),('demo');
    CREATE TABLE transactions(profile TEXT NOT NULL,id TEXT NOT NULL,date TEXT NOT NULL,description TEXT NOT NULL,kind TEXT NOT NULL,amount_cents INTEGER NOT NULL,category TEXT NOT NULL,origin TEXT NOT NULL,PRIMARY KEY(profile,id));
    CREATE TABLE budgets(profile TEXT NOT NULL,category TEXT NOT NULL,amount_cents INTEGER NOT NULL,PRIMARY KEY(profile,category));
    INSERT INTO budgets VALUES('real','Moradia',150000);
    CREATE TABLE planned_items(id TEXT PRIMARY KEY,category TEXT);
    INSERT INTO planned_items VALUES('future-1','Moradia');`);
  const stmt=raw.prepare('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?)');
  for(let i=0;i<630;i++)stmt.run(i<315?'real':'demo','t-'+String(i).padStart(3,'0'),'2026-11-01',
    'Movimento sintético '+i,'expense',i+1,'Moradia','manual');
  raw.close();
  return {dir,file};
}
function cleanup(f, db) {
  try { db?.close(); } finally { fs.rmSync(f.dir,{recursive:true,force:true}); }
}
test('D05 E1 migra 630 movimentos legados, preserva dinheiro, perfis e NULL dos filhos',()=> {
  const f=legacy630();let db;
  try {
    db=new FinanceDB(f.file);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n,630);
    assert.equal(db.db.prepare('SELECT SUM(amount_cents) AS n FROM transactions').get().n,630*631/2);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE subcategory_id IS NOT NULL').get().n,0);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM subcategories').get().n,61);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM categories WHERE id LIKE ?').get('cat:%').n>=14,true);
    assert.equal(db.db.prepare("SELECT id FROM categories WHERE name='Moradia'").get().id,'cat:moradia');
    assert.equal(db.db.prepare("SELECT amount_cents FROM budgets WHERE profile='real'").get().amount_cents,150000);
    assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE profile='real'").get().n,315);
    assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE profile='demo'").get().n,315);
    assert.equal(db.db.prepare("SELECT subcategory_id FROM planned_items WHERE id='future-1'").get().subcategory_id,null);
    assert.equal(db.db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value,'7');
    assert.deepEqual(db.integrity(),['ok']);
    assert.equal(db.db.prepare('PRAGMA foreign_key_check').all().length,0);
    assert.equal(fs.existsSync(f.file+'.d05-before-v7.sqlite'),true);
    const before=db.db.prepare("SELECT id FROM categories WHERE name='Personalizada'").get().id;
    migrateHierarchy(db.db); migrateHierarchy(db.db);
    assert.equal(db.db.prepare("SELECT id FROM categories WHERE name='Personalizada'").get().id,before);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM subcategories').get().n,61);
  } finally { cleanup(f,db); }
});
test('D05 E1 rejeita filhos cruzados, duplicatas normalizadas, IDs alterados e deleção de pai',()=> {
  const f=legacy630();let db;
  try {
    db=new FinanceDB(f.file);const sql=db.db;
    assert.equal(normalizedName('  Água e Saneamento  '),'AGUA E SANEAMENTO');
    assert.throws(()=>sql.prepare(`INSERT INTO subcategories(id,parent_category_id,name,normalized_name,icon_key,hue,kind)
      VALUES('sub:custom:dup','cat:moradia','ALUGUEL','ALUGUEL','key',25,'expense')`).run());
    assert.throws(()=>sql.prepare("UPDATE subcategories SET parent_category_id='cat:alimentacao' WHERE id='sub:moradia/aluguel'").run(),/reparenting/);
    assert.throws(()=>sql.prepare("UPDATE categories SET id='cat:evil' WHERE name='Moradia'").run(),/imutável/);
    assert.throws(()=>sql.prepare("DELETE FROM categories WHERE name='Moradia'").run(),/possui filhos/);
    assert.throws(()=>sql.prepare(`UPDATE transactions SET category_id='cat:alimentacao',
      subcategory_id='sub:moradia/aluguel' WHERE profile='real' AND id='t-000'`).run(),/incompatível/);
    assert.equal(sql.prepare(`UPDATE transactions SET category_id='cat:moradia',
      subcategory_id='sub:moradia/aluguel' WHERE profile='real' AND id='t-000'`).run().changes,1);
    // The flat legacy renderer must not erase a reviewed child on save.
    db.save('real',db.load('real'));
    assert.equal(sql.prepare("SELECT subcategory_id FROM transactions WHERE profile='real' AND id='t-000'").get().subcategory_id,'sub:moradia/aluguel');
    assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
  } finally { cleanup(f,db); }
});
test('D05 E1 SQLite backup/restauração preserva associação e retrocompatibilidade',async()=> {
  const f=legacy630();let db, restored;
  try {
    db=new FinanceDB(f.file);
    db.db.prepare(`UPDATE transactions SET category_id='cat:moradia',
      subcategory_id='sub:moradia/aluguel' WHERE profile='real' AND id='t-000'`).run();
    const backup=path.join(f.dir,'snapshot.sqlite');
    await db.backupTo(backup);db.close();db=null;
    restored=new FinanceDB(backup);
    assert.equal(restored.db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n,630);
    assert.equal(restored.db.prepare("SELECT subcategory_id FROM transactions WHERE profile='real' AND id='t-000'").get().subcategory_id,'sub:moradia/aluguel');
    assert.equal(restored.db.prepare("SELECT subcategory_id FROM transactions WHERE profile='demo' AND id='t-315'").get().subcategory_id,null);
    assert.equal(restored.db.prepare('PRAGMA foreign_key_check').all().length,0);
  } finally { restored?.close();cleanup(f,db); }
});
test('D05 E1 rollback atômico quando catálogo aprovado colide com dados anteriores',()=> {
  const f=legacy630();let raw;
  try {
    raw=new DatabaseSync(f.file);raw.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE subcategories(id TEXT PRIMARY KEY,parent_category_id TEXT NOT NULL,name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,icon_key TEXT NOT NULL,hue INTEGER NOT NULL,kind TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,built_in INTEGER NOT NULL DEFAULT 0,sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(parent_category_id,normalized_name));
      INSERT INTO subcategories(id,parent_category_id,name,normalized_name,icon_key,hue,kind)
        VALUES('sub:conflict','cat:moradia','Aluguel','ALUGUEL','key',20,'expense');`);
    assert.throws(()=>migrateHierarchy(raw),/conflito no catálogo aprovado/);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM subcategories").get().n,1);
    assert.equal(raw.prepare('PRAGMA table_info(categories)').all().some(x=>x.name==='id'),false);
    assert.equal(raw.prepare('PRAGMA table_info(transactions)').all().some(x=>x.name==='subcategory_id'),false);
  } finally {cleanup(f,raw);}
});
