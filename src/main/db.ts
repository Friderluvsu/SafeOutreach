// @ts-nocheck
import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'


export let db;


export function initDB() {
  
  const dbPath = path.join(app.getPath('userData'), 'database.sqlite')
  
  
  db = new Database(dbPath, { verbose: console.log })

  
  db.exec(`
    CREATE TABLE IF NOT EXISTS Inboxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      app_password TEXT NOT NULL,
      smtp_host TEXT DEFAULT 'smtp.zoho.com',
      smtp_port INTEGER DEFAULT 465,
      daily_limit INTEGER DEFAULT 20,
      sent_today INTEGER DEFAULT 0,
      status TEXT DEFAULT 'GREEN'
    );

    CREATE TABLE IF NOT EXISTS Campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'DRAFT'
    );

CREATE TABLE IF NOT EXISTS Leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      email TEXT NOT NULL,
      name TEXT,
      custom_data TEXT,
      status TEXT DEFAULT 'PENDING',
      sent_at DATETIME,
      FOREIGN KEY (campaign_id) REFERENCES Campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      content TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS SystemData (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS SystemLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)
  
  
  const checkCol = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('Campaigns') WHERE name='scheduled_at'").get() as any;
  
  if (checkCol.cnt === 0) {
    console.log('[DB] Запуск миграции: добавление новых колонок в Campaigns...');
    db.exec(`
      ALTER TABLE Campaigns ADD COLUMN scheduled_at DATETIME;
      ALTER TABLE Campaigns ADD COLUMN min_pause INTEGER DEFAULT 60;
      ALTER TABLE Campaigns ADD COLUMN max_pause INTEGER DEFAULT 150;
      ALTER TABLE Campaigns ADD COLUMN selected_inboxes TEXT DEFAULT '[]';
    `);
    console.log('[DB] Миграция успешно завершена!');
  }

 
  const checkTplCol = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('Templates') WHERE name='is_random'").get() as any;
  if (checkTplCol.cnt === 0) {
    db.exec(`ALTER TABLE Templates ADD COLUMN is_random BOOLEAN DEFAULT 1;`);
  }

  
  const checkGroupCol = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('Templates') WHERE name='group_name'").get() as any;
  if (checkGroupCol.cnt === 0) {
    db.exec(`ALTER TABLE Templates ADD COLUMN group_name TEXT DEFAULT 'General';`);
  }


const checkProxyCol = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('Inboxes') WHERE name='proxy'").get() as any;
if (checkProxyCol.cnt === 0) {
  console.log('[DB] Запуск миграции: добавление колонки proxy в Inboxes...');
  db.exec(`ALTER TABLE Inboxes ADD COLUMN proxy TEXT DEFAULT '';`);
  console.log('[DB] Миграция (Прокси) успешно завершена!');
}


const checkImapCol = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('Inboxes') WHERE name='imap_host'").get() as any;
if (checkImapCol.cnt === 0) {
  console.log('[DB] Запуск миграции: добавление колонок IMAP и Ramp-up в Inboxes...');
  db.exec(`
    ALTER TABLE Inboxes ADD COLUMN imap_host TEXT DEFAULT '';
    ALTER TABLE Inboxes ADD COLUMN imap_port INTEGER DEFAULT 993;
    ALTER TABLE Inboxes ADD COLUMN warmup_target_limit INTEGER DEFAULT 40;
    ALTER TABLE Inboxes ADD COLUMN warmup_current_limit INTEGER DEFAULT 2;
    ALTER TABLE Inboxes ADD COLUMN warmup_increment INTEGER DEFAULT 2;
  `);
  console.log('[DB] Миграция (IMAP и Прогрев) успешно завершена!');
}

const checkWarmupSent = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('Inboxes') WHERE name='warmup_sent_today'").get() as any;
if (checkWarmupSent.cnt === 0) {
  db.exec(`ALTER TABLE Inboxes ADD COLUMN warmup_sent_today INTEGER DEFAULT 0;`);
}


const checkImapUid = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('Inboxes') WHERE name='last_imap_uid'").get() as any;
if (checkImapUid.cnt === 0) {
  console.log('[DB] Запуск миграции: добавление last_imap_uid в Inboxes...');
  db.exec(`ALTER TABLE Inboxes ADD COLUMN last_imap_uid INTEGER DEFAULT 1;`);
}


const checkSenderName = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('Inboxes') WHERE name='sender_name'").get() as any;
if (checkSenderName.cnt === 0) {
  console.log('[DB] Запуск миграции: добавление sender_name в Inboxes...');
  db.exec(`ALTER TABLE Inboxes ADD COLUMN sender_name TEXT DEFAULT '';`);
}


db.exec(`
  CREATE TABLE IF NOT EXISTS Blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    reason TEXT DEFAULT 'UNSUBSCRIBED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// === ЭТАП 12: Обнуление суточных лимитов (Daily Reset) ===
const today = new Date().toISOString().split('T')[0]; // Получаем дату YYYY-MM-DD
const lastDateRow = db.prepare(`SELECT value FROM SystemData WHERE key = 'last_reset_date'`).get();

// Если записи нет, или дата не совпадает с сегодняшней — обнуляем лимиты
if (!lastDateRow || lastDateRow.value !== today) {
  console.log(`[Daily Reset] Наступил новый день (${today}). Обнуляем лимиты ящиков...`);
  
  // Обнуляем счетчик
  db.prepare(`UPDATE Inboxes SET sent_today = 0, warmup_sent_today = 0`).run();

  // Записываем новую дату в систему
  if (!lastDateRow) {
    db.prepare(`INSERT INTO SystemData (key, value) VALUES ('last_reset_date', ?)`).run(today);
  } else {
    db.prepare(`UPDATE SystemData SET value = ? WHERE key = 'last_reset_date'`).run(today);
  }
}

console.log('✅ База данных SQLite успешно инициализирована по пути:', dbPath)
}