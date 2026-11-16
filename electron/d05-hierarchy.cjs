'use strict';
// D05 E1: additive, transactional migration. Never infers subcategories for historic rows.
const { randomUUID } = require('node:crypto');
const taxonomy = require('./d05-taxonomy.json');

function normalizedName(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR').replace(/\s+/g, ' ').trim();
}
function tableExists(db, table) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
}
function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column);
}
function addColumn(db, table, column, definition) {
  if (tableExists(db, table) && !columnExists(db, table, column))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
function assertCatalog() {
  if (taxonomy.parents.length !== 14 || taxonomy.parents.reduce((n, p) => n + p.subcategories.length, 0) !== 61)
    throw new Error('D05: catálogo aprovado 14x61 inválido');
  const parentIds = new Set(), subIds = new Set();
  for (const parent of taxonomy.parents) {
    if (parentIds.has(parent.id) || !/^cat:[a-z0-9-]+$/.test(parent.id)) throw new Error('D05: ID de pai duplicado/inválido');
    parentIds.add(parent.id);
    for (const sub of parent.subcategories) {
      if (subIds.has(sub.id) || sub.parentId !== parent.id || !sub.id.startsWith('sub:'))
        throw new Error('D05: subcategoria órfã/duplicada');
      subIds.add(sub.id);
    }
  }
}
function ensureRelationshipTriggers(db, table) {
  if (!tableExists(db, table)) return;
  for (const action of ['INSERT', 'UPDATE']) {
    const triggerName='d05_'+table+'_'+action.toLowerCase()+'_relationship';
    const prior=db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name=?").get(triggerName);
    // The legacy SQLite table rename also rewrites this generated trigger.
    // Regenerate only our known D05 trigger, never arbitrary trigger SQL.
    if(prior && /\bcategories_old\b/i.test(prior.sql))
      db.exec('DROP TRIGGER "'+triggerName+'"');
    db.exec(`CREATE TRIGGER IF NOT EXISTS d05_${table}_${action.toLowerCase()}_relationship
      BEFORE ${action} ON ${table}
      WHEN (NEW.category_id IS NOT NULL AND NOT EXISTS
              (SELECT 1 FROM categories c WHERE c.id=NEW.category_id AND c.name=NEW.category COLLATE NOCASE))
        OR (NEW.subcategory_id IS NOT NULL AND
              (NEW.category_id IS NULL OR NOT EXISTS
                (SELECT 1 FROM subcategories s WHERE s.id=NEW.subcategory_id
                 AND s.parent_category_id=NEW.category_id AND s.active=1)))
      BEGIN SELECT RAISE(ABORT, 'D05: categoria/subcategoria incompatível'); END;`);
  }
}
// Repair only proven legacy foreign-key metadata from an old SQLite
// categories -> categories_old table rename. Rebuild the real child table;
// never fabricate the missing parent or discard its records/rules.
const LEGACY_FK_TABLES=Object.freeze([
 'category_rules','bank_category_overrides','bank_transaction_splits',
 'transactions','budgets','planned_items','subcategories'
]);
function legacyFKTables(db){
 return LEGACY_FK_TABLES.filter(table=>tableExists(db,table)&&
  db.prepare('PRAGMA foreign_key_list('+table+')').all().some(ref=>ref.table==='categories_old'));
}
// SQLite parses every active trigger while ALTER TABLE rebuilds a child.
// A legacy table rename may have rewritten *other* D05 relationship triggers
// to categories_old. Drop only verified, generated D05 triggers inside the
// same transaction before touching any table; ensureRelationshipTriggers()
// reinstalls them from canonical code after all child tables are repaired.
function removeGhostD05Triggers(db){
 const supported=['transactions','bank_category_overrides',
  'bank_transaction_splits','category_rules','planned_items'];
 const actions=['insert','update'];
 for(const table of supported)for(const action of actions){
  const name='d05_'+table+'_'+action+'_relationship';
  const row=db.prepare("SELECT tbl_name AS tableName,sql FROM sqlite_master WHERE type='trigger' AND name=?").get(name);
  if(!row||!/\bcategories_old\b/i.test(row.sql))continue;
  const canonical=row.tableName===table&&
   /D05: categoria\/subcategoria incompatível/.test(row.sql)&&
   /NEW\.category_id/.test(row.sql)&&/NEW\.subcategory_id/.test(row.sql);
  if(!canonical)throw Error('D05: trigger legado não reconhecido: '+name);
  db.exec('DROP TRIGGER "'+name+'"');
 }
}
function repairLegacyFKTable(db,table){
 if(!LEGACY_FK_TABLES.includes(table))throw Error('D05: tabela FK não permitida');
 const sqlRow=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table);
 const original=sqlRow?.sql;
 if(typeof original!=='string'||!/^CREATE\s+TABLE\s+/i.test(original))
  throw Error('D05: definição da tabela legada indisponível: '+table);
 const temporary='d05_fk_rebuild_'+table;
 if(tableExists(db,temporary))throw Error('D05: reparação anterior incompleta: '+temporary);
 const prefix=/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w]+)/i;
 const reference=/\bREFERENCES\s+(?:"categories_old"|`categories_old`|\[categories_old\]|categories_old)(?=\s*\()/gi;
 if(!prefix.test(original)||!reference.test(original))
  throw Error('D05: FK legada requer reparação manual: '+table);
 const newSQL=original.replace(prefix,'CREATE TABLE '+temporary).replace(reference,'REFERENCES categories');
 if(/\bcategories_old\b/i.test(newSQL))
  throw Error('D05: há referências legadas adicionais não verificadas: '+table);
 const objects=db.prepare("SELECT type,name,sql FROM sqlite_master WHERE tbl_name=? AND type IN ('index','trigger') AND sql IS NOT NULL").all(table);
 // Only known generated relationship triggers may be recreated from
 // canonical code. Preserve custom triggers/indexes exactly or fail closed.
 const generatedNames=new Set(['d05_'+table+'_insert_relationship',
  'd05_'+table+'_update_relationship']);
 if(objects.some(o=>/\bcategories_old\b/i.test(o.sql)&&
   !(o.type==='trigger'&&generatedNames.has(o.name))))
  throw Error('D05: índice/trigger legado requer revisão: '+table);
 const columns=db.prepare('PRAGMA table_xinfo('+table+')').all().filter(c=>c.hidden===0);
 if(!columns.length||columns.some(c=>!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c.name)))
  throw Error('D05: colunas legadas não verificadas: '+table);
 const names=columns.map(c=>'"'+c.name+'"').join(',');
 const before=db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n;
 db.exec(newSQL);
 db.exec('INSERT INTO '+temporary+'('+names+') SELECT '+names+' FROM '+table);
 const after=db.prepare('SELECT COUNT(*) AS n FROM '+temporary).get().n;
 if(after!==before)throw Error('D05: contagem de linhas divergente em '+table);
 db.exec('DROP TABLE '+table);
 db.exec('ALTER TABLE '+temporary+' RENAME TO '+table);
 for(const object of objects){
  if(object.type==='trigger'&&generatedNames.has(object.name))continue;
  db.exec(object.sql);
 }
 const links=db.prepare('PRAGMA foreign_key_list('+table+')').all();
 if(links.some(ref=>ref.table==='categories_old')||!links.some(ref=>ref.table==='categories'))
  throw Error('D05: referência legada não reparada: '+table);
 if(db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n!==before)
  throw Error('D05: registros alterados durante reparação: '+table);
}
function migrateHierarchy(db) {
  assertCatalog();
  // The host opens the connection with PRAGMA foreign_keys=ON before this migration.
  if (!db.prepare('PRAGMA foreign_keys').get().foreign_keys) throw new Error('D05: foreign_keys desabilitadas');
  const orphaned=legacyFKTables(db),repairing=orphaned.length>0;
  // SQLite cannot change a foreign-key parent in place. Temporarily suspend
  // enforcement ONLY for the transactional table rebuild; PRAGMA
  // foreign_key_check validates every row before COMMIT, then restore ON.
  let inTransaction=false;
  if(repairing)db.exec('PRAGMA foreign_keys=OFF');
  try {
    db.exec('BEGIN IMMEDIATE');inTransaction=true;
    if(repairing)removeGhostD05Triggers(db);
    for(const table of orphaned)repairLegacyFKTable(db,table);
    addColumn(db, 'categories', 'emoji', "TEXT NOT NULL DEFAULT '✨'");
    addColumn(db, 'categories', 'kind',
      "TEXT NOT NULL DEFAULT 'expense' CHECK(kind IN ('expense','income','both'))");
    addColumn(db, 'categories', 'id', 'TEXT');
    addColumn(db, 'categories', 'icon_key', 'TEXT');
    addColumn(db, 'categories', 'hue', 'INTEGER');
    const getParent = db.prepare('SELECT name,id,icon_key,hue FROM categories WHERE name=? COLLATE NOCASE');
    const assign = db.prepare('UPDATE categories SET id=?,icon_key=COALESCE(icon_key,?),hue=COALESCE(hue,?) WHERE name=?');
    const seedParent = db.prepare("INSERT OR IGNORE INTO categories(name,color,built_in,emoji,kind) VALUES(?, '#87929c', 1, '✨', ?)");
    for (const parent of taxonomy.parents) {
      seedParent.run(parent.name, parent.kind);
      const existing = getParent.get(parent.name);
      if (!existing) throw new Error('D05: categoria-pai ausente: ' + parent.name);
      if (existing.id && existing.id !== parent.id) throw new Error('D05: ID de categoria-pai divergente: ' + parent.name);
      assign.run(parent.id, parent.iconKey, parent.hue, existing.name);
    }
    // Preserve custom category IDs across reopens; assign only to rows without IDs.
    const custom = db.prepare('SELECT name FROM categories WHERE id IS NULL').all();
    for (const item of custom) assign.run('cat:custom:' + randomUUID(), null, null, item.name);
    if (db.prepare('SELECT 1 FROM categories WHERE id IS NULL LIMIT 1').get()) throw new Error('D05: categoria sem ID');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS d05_categories_id_unique ON categories(id)');
    db.exec(`CREATE TRIGGER IF NOT EXISTS d05_categories_autofill_id AFTER INSERT ON categories
      WHEN NEW.id IS NULL BEGIN UPDATE categories SET id='cat:custom:' || lower(hex(randomblob(16))) WHERE name=NEW.name; END;`);
    db.exec(`CREATE TRIGGER IF NOT EXISTS d05_categories_id_immutable BEFORE UPDATE OF id ON categories
      WHEN OLD.id IS NOT NULL AND NEW.id IS NOT OLD.id BEGIN SELECT RAISE(ABORT, 'D05: ID de categoria imutável'); END;`);
    db.exec(`CREATE TABLE IF NOT EXISTS subcategories (
      id TEXT PRIMARY KEY NOT NULL,
      parent_category_id TEXT NOT NULL REFERENCES categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
      normalized_name TEXT NOT NULL CHECK(length(trim(normalized_name)) BETWEEN 1 AND 80),
      icon_key TEXT NOT NULL, hue INTEGER NOT NULL CHECK(hue BETWEEN 0 AND 359),
      kind TEXT NOT NULL CHECK(kind IN ('expense','income','both')),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      built_in INTEGER NOT NULL DEFAULT 0 CHECK(built_in IN (0,1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(parent_category_id,normalized_name)
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS d05_subcategories_parent ON subcategories(parent_category_id,sort_order)');
    const insertSub = db.prepare(`INSERT OR IGNORE INTO subcategories
      (id,parent_category_id,name,normalized_name,icon_key,hue,kind,built_in,sort_order)
      VALUES(?,?,?,?,?,?,?,1,?)`);
    const fetchSub = db.prepare('SELECT id,parent_category_id,normalized_name FROM subcategories WHERE id=?');
    for (const parent of taxonomy.parents) {
      for (const [i, sub] of parent.subcategories.entries()) {
        const norm = normalizedName(sub.name);
        insertSub.run(sub.id,parent.id,sub.name,norm,sub.iconKey,sub.hue,parent.kind,i);
        const persisted = fetchSub.get(sub.id);
        if (!persisted || persisted.parent_category_id !== parent.id || persisted.normalized_name !== norm)
          throw new Error('D05: conflito no catálogo aprovado: ' + sub.id);
      }
    }
    db.exec(`CREATE TRIGGER IF NOT EXISTS d05_subcategories_identity_immutable
      BEFORE UPDATE OF id,parent_category_id ON subcategories
      WHEN NEW.id IS NOT OLD.id OR NEW.parent_category_id IS NOT OLD.parent_category_id
      BEGIN SELECT RAISE(ABORT, 'D05: reparenting requer contrato E2'); END;`);
    db.exec(`CREATE TRIGGER IF NOT EXISTS d05_categories_protect_children
      BEFORE DELETE ON categories WHEN EXISTS(SELECT 1 FROM subcategories WHERE parent_category_id=OLD.id)
      BEGIN SELECT RAISE(ABORT, 'D05: categoria-pai possui filhos'); END;`);
    for (const table of ['transactions','bank_category_overrides','bank_transaction_splits','category_rules','planned_items']) {
      addColumn(db, table, 'category_id', 'TEXT REFERENCES categories(id)');
      addColumn(db, table, 'subcategory_id', 'TEXT REFERENCES subcategories(id)');
      ensureRelationshipTriggers(db, table);
    }
    db.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES('d05_hierarchy_e1','1')").run();
    db.prepare("UPDATE app_meta SET value='7' WHERE key='schema_version'").run();
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length) throw new Error('D05: foreign_key_check falhou (' + violations.length + ')');
    const ghosts=db.prepare("SELECT type,name FROM sqlite_master WHERE type IN ('table','trigger','view','index') AND sql LIKE '%categories_old%'").all();
    if(ghosts.length)throw Error('D05: referências categories_old remanescentes em '+ghosts.map(x=>x.type+':'+x.name).join(', '));
    const integrity=db.prepare('PRAGMA integrity_check').all();
    if(integrity.length!==1||integrity[0].integrity_check!=='ok')
      throw Error('D05: integrity_check falhou; transação revertida');
    db.exec('COMMIT');inTransaction=false;
    if(repairing)db.exec('PRAGMA foreign_keys=ON');
    return {parents:14,subcategories:61,version:7};
  } catch (error) {
    try{if(inTransaction)db.exec('ROLLBACK');}
    finally{if(repairing)db.exec('PRAGMA foreign_keys=ON');}
    throw error;
  }
}
module.exports = { migrateHierarchy, normalizedName };
