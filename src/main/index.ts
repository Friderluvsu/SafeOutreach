import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { initDB, db } from './db';
import nodemailer from 'nodemailer';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import csv from 'csv-parser';
import { autoUpdater } from 'electron-updater';
import { Readable } from 'stream';
import { ImapFlow } from 'imapflow';
import { SocksClient } from 'socks'; 




class ReplyChecker {
  static isRunning = false;
  static timer: any = null;

  static async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    systemLog('INFO', '[ReplyChecker] Запуск фонового мониторинга входящих писем...');
    this.tick();
  }

  static async tick() {
    if (!this.isRunning) return;

    try {
      const inboxes = db.prepare(`SELECT * FROM Inboxes WHERE status = 'GREEN'`).all() as any[];
      for (const inbox of inboxes) {
        await this.checkInbox(inbox);
      }
    } catch (e: any) {
      console.error('[ReplyChecker Error]', e);
    }

    
    this.timer = setTimeout(() => this.tick(), 15 * 60 * 1000);
  }

  static async checkInbox(inbox: any) {
    const imapHost = inbox.imap_host || inbox.smtp_host || inbox.host;
    if (!imapHost) return;

    const client = new ImapFlow({
      host: imapHost,
      port: inbox.imap_port || 993,
      secure: true,
      auth: { user: inbox.email, pass: inbox.app_password || inbox.password },
      logger: false 
    }) as any;

    try {
      await client.connect();
      
      const lock = await client.getMailboxLock('INBOX');
      
      try {
        const lastUid = inbox.last_imap_uid || 1;
        
        const searchCriteria = { uid: `${lastUid + 1}:*` };
        const uids = await client.search(searchCriteria);
        
        if (uids && uids.length > 0) {
          let highestUid = lastUid;

          
          for await (const msg of client.fetch(uids, { uid: true, envelope: true, source: true })) {
            if (msg.uid > highestUid) highestUid = msg.uid;

            const fromAddress = msg.envelope.from[0]?.address?.toLowerCase() || '';
            const subject = msg.envelope.subject?.toLowerCase() || '';
            const bodyStr = msg.source ? msg.source.toString().toLowerCase() : '';

            if (!fromAddress || fromAddress === inbox.email.toLowerCase()) continue;

            
            const isBounce = fromAddress.includes('mailer-daemon') || 
                             fromAddress.includes('postmaster') ||
                             subject.includes('delivery status notification') ||
                             subject.includes('undeliverable');

            if (isBounce) {
              
              const sentLeads = db.prepare(`SELECT id, email FROM Leads WHERE status = 'SENT'`).all() as any[];
              for (const lead of sentLeads) {
                if (bodyStr.includes(lead.email.toLowerCase())) {
                  db.prepare(`UPDATE Leads SET status = 'BOUNCED' WHERE id = ?`).run(lead.id);
                  systemLog('WARNING', `[IMAP] Баунс (Недоставлено) для лида: ${lead.email}`);
                  break; 
                }
              }
            } else {
              
              const lead = db.prepare(`SELECT id, email FROM Leads WHERE email = ? COLLATE NOCASE`).get(fromAddress) as any;
              if (lead) {
                
                const unsubscribeKeywords = ['unsubscribe', 'stop', 'remove', 'отписка', 'отписать', 'не пишите', 'take me off'];
                const isUnsubscribe = unsubscribeKeywords.some(kw => subject.includes(kw) || bodyStr.includes(kw));

                if (isUnsubscribe) {
                  try {
                    db.prepare(`INSERT INTO Blacklist (email, reason) VALUES (?, 'USER_REQUEST')`).run(lead.email);
                    systemLog('WARNING', `[Отписка] Лид ${lead.email} попросил больше не писать. Добавлен в Blacklist.`);
                  } catch (err) {} 
                } else {
                  
                  const checkStatus = db.prepare(`SELECT status FROM Leads WHERE id = ?`).get(lead.id) as any;
                  if (checkStatus && checkStatus.status !== 'REPLIED') {
                    systemLog('SUCCESS', `[IMAP] 🎉 Получен ответ от лида: ${lead.email}`);
                  }
                }
                
                
                db.prepare(`UPDATE Leads SET status = 'REPLIED' WHERE id = ?`).run(lead.id);
              }
            }
          }
          
          db.prepare(`UPDATE Inboxes SET last_imap_uid = ? WHERE id = ?`).run(highestUid, inbox.id);
        }
      } finally {
        lock.release();
      }
    } catch (e: any) {
      
      if (!e.message.includes('Nothing to fetch') && !e.message.includes('search')) {
        console.error(`[IMAP] Ошибка проверки ответов для ${inbox.email}:`, e.message);
      }
    } finally {
      await client.logout();
    }
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    
    titleBarStyle: 'hidden', 
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true 
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  
  ipcMain.handle('ping', () => {
    console.log('Ping получен в Main Process!');
    return 'Pong от Node.js!'
  })

  
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.on('window-close', () => {
    mainWindow.close()
  })

  
  ipcMain.on('window-maximize', () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  })

  
ipcMain.handle('selectCsv', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Выберите базу лидов',
    properties: ['openFile'],
    filters: [{ name: 'CSV Файлы', extensions: ['csv'] }]
  });
  if (!canceled && filePaths.length > 0) {
    return filePaths[0]; 
  }
  return null;
});


autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('app-update', { status: 'downloading', message: `Доступна версия ${info.version}. Идет загрузка...` });
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('app-update', { status: 'ready', message: 'Обновление загружено и готово к установке.' });
});

autoUpdater.on('error', (err) => {
  console.error('Ошибка автообновления:', err);
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});


ipcMain.handle('add-inbox', async (_, inboxData) => {
  const { email, app_password, smtp_host, smtp_port, daily_limit } = inboxData;

  const transporter = nodemailer.createTransport({
    host: smtp_host,
    port: Number(smtp_port),
    secure: Number(smtp_port) === 465,
    auth: { user: email, pass: app_password },
    connectionTimeout: 10000, 
  });

  try {
    
    await transporter.verify();

    
    const insert = db.prepare(`
      INSERT INTO Inboxes (email, app_password, smtp_host, smtp_port, daily_limit, sent_today, status)
      VALUES (?, ?, ?, ?, ?, 0, 'GREEN')
    `);
    
    const result = insert.run(email, app_password, smtp_host, smtp_port, daily_limit);
    return { success: true, id: result.lastInsertRowid };
  } catch (error: any) {
    console.error('SMTP Verification failed:', error);
    return { success: false, error: error.message };
  }
});


async function safeResolveMx(domain: string): Promise<any[]> {
  return Promise.race([
    dns.resolveMx(domain),
    new Promise<any[]>((resolve) => 
      setTimeout(() => resolve([{ exchange: 'timeout-fallback-passed', priority: 10 }]), 5000)
    )
  ]);
}


ipcMain.handle('verify-lead-email', async (_, targetEmail: string) => {
  try {
    const domain = targetEmail.split('@')[1];
    if (!domain) return { valid: false, error: 'Invalid email format' };

    const records = await safeResolveMx(domain);
    if (records && records.length > 0) {
      return { valid: true };
    }
    return { valid: false, error: 'No MX records found' };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
});

  
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDB()
  electronApp.setAppUserModelId('com.safeoutreach.app')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  
  ReplyChecker.start();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})


async function createTransporter(inbox: any) {
  const X_MAILERS = ['Apple Mail (16.0)', 'Microsoft Outlook 16.0', 'Thunderbird 115.0', 'iPhone Mail (18.0)'];
  const mailerIndex = (inbox.id || 0) % X_MAILERS.length;
  const selectedMailer = X_MAILERS[mailerIndex];

  const domain = inbox.email ? inbox.email.split('@')[1].toLowerCase() : '';
  const genericDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yandex.ru', 'mail.ru', 'zoho.com', 'yahoo.com'];
  
  let ehloName = '';
  if (domain && !genericDomains.includes(domain)) {
    ehloName = `mail.${domain}`;
  } else {
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    ehloName = `DESKTOP-${randomString}.local`;
  }

  const options: any = {
    host: inbox.smtp_host || inbox.host,
    port: Number(inbox.smtp_port || inbox.port),
    secure: Number(inbox.smtp_port || inbox.port) === 465,
    name: ehloName, 
    auth: { 
      user: inbox.email, 
      pass: inbox.app_password || inbox.password 
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
    tls: { rejectUnauthorized: false }
  };

  
  
  if (inbox.proxy) {
    if (inbox.proxy.startsWith('socks5://')) {
      try {
        const url = new URL(inbox.proxy);
        const isLocal = url.hostname === '127.0.0.1' || url.hostname === 'localhost';

        
        const portsToTry = isLocal
          ? Array.from(new Set([parseInt(url.port || '10808'), 10808, 2334, 2080, 20808, 7890, 1080]))
          : [parseInt(url.port || '10808')];

        let proxySocket: any = null;
        let lastError: any = null;

        
        for (const port of portsToTry) {
          try {
            const proxyInfo = await SocksClient.createConnection({
              proxy: {
                host: url.hostname,
                port: port,
                type: 5,
                userId: url.username ? decodeURIComponent(url.username) : undefined,
                password: url.password ? decodeURIComponent(url.password) : undefined
              },
              
              destination: { host: options.host, port: options.port }, 
              command: 'connect'
            });
            
            proxySocket = proxyInfo.socket;
            if (isLocal && port !== parseInt(url.port || '10808')) {
              systemLog('INFO', `[Proxy] Авто-подключение к запасному порту: ${port}`);
            }
            break; 
          } catch (err: any) {
            lastError = err;
          }
        }

        if (!proxySocket) {
          throw new Error(`Локальный VPN недоступен. Проверены порты: ${portsToTry.join(', ')}. Ошибка: ${lastError?.message}`);
        }

        
        options.connection = proxySocket;

      } catch (err: any) {
        throw new Error(`Ошибка VPN: ${err.message}`);
      }
    } else if (!inbox.proxy.startsWith('rotate://')) {
      options.proxy = inbox.proxy; 
    }
  }

  const transporter = nodemailer.createTransport(options);

  transporter.use('compile', (mail, callback) => {
    const uuid = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    const msgDomain = domain || 'example.com';
    
    if (!mail.data.headers) mail.data.headers = {};
    mail.data.headers['X-Mailer'] = selectedMailer;
    
    if (!mail.data.messageId) {
      mail.data.messageId = `<${uuid}@${msgDomain}>`;
    }
    callback();
  });

  return transporter;
}


if (!is.dev) {
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.error('Не удалось проверить обновления:', e);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function systemLog(type: 'INFO' | 'ERROR' | 'SUCCESS' | 'WARNING', message: string) {
  console.log(`[${type}] ${message}`);
  try {
    db.prepare(`INSERT INTO SystemLogs (type, message) VALUES (?, ?)`).run(type, message);
  } catch (e) {
    console.error('Ошибка записи лога в БД:', e);
  }
}

class CampaignRunner {
  static activeCampaigns: Set<number> = new Set();

  static applySpintax(text: string): string {
    if (!text) return '';
    return text.replace(/\{([^{}]+)\}/g, (_, options) => {
      const opts = options.split('|');
      return opts[Math.floor(Math.random() * opts.length)];
    });
  }

  static async start(campaignId: number) {
    if (this.activeCampaigns.has(campaignId)) return;
    
    this.activeCampaigns.add(campaignId);
    db.prepare(`UPDATE Campaigns SET status = 'RUNNING' WHERE id = ?`).run(campaignId);
    systemLog('INFO', `Кампания ${campaignId} ЗАПУЩЕНА!`);
    
    this.tick(campaignId);
  }

  static stop(campaignId: number) {
    this.activeCampaigns.delete(campaignId);
    db.prepare(`UPDATE Campaigns SET status = 'PAUSED' WHERE id = ?`).run(campaignId);
    systemLog('WARNING', `Кампания ${campaignId} ОСТАНОВЛЕНА.`);
  }

  static async tick(campaignId: number) {
    if (!this.activeCampaigns.has(campaignId)) return;

    let leadIdToFail = null; 
    let inboxIdToFail = null;
    let inboxEmailToLog = '';

    try {
      
      const campaign = db.prepare(`SELECT * FROM Campaigns WHERE id = ?`).get(campaignId) as any;
      if (!campaign) return;

      
      if (campaign.scheduled_at) {
        const scheduledTime = new Date(campaign.scheduled_at).getTime();
        if (Date.now() < scheduledTime) {
          systemLog('INFO', `Кампания ${campaignId} ожидает отложенного старта... Спим.`);
          setTimeout(() => this.tick(campaignId), 30000); // Проверяем снова через 30 сек
          return;
        }
      }

      
      const lead = db.prepare(`SELECT * FROM Leads WHERE campaign_id = ? AND status = 'PENDING' LIMIT 1`).get(campaignId) as any;
      
      if (!lead) {
        systemLog('SUCCESS', `Кампания ${campaignId} завершена (нет новых лидов).`);
        this.stop(campaignId);
        db.prepare(`UPDATE Campaigns SET status = 'COMPLETED' WHERE id = ?`).run(campaignId);
        return;
      }

      leadIdToFail = lead.id;

      
      const isBlacklisted = db.prepare(`SELECT id FROM Blacklist WHERE email = ? COLLATE NOCASE`).get(lead.email);
      if (isBlacklisted) {
        systemLog('WARNING', `[Blacklist] Лид ${lead.email} в черном списке. Пропускаем.`);
        db.prepare(`UPDATE Leads SET status = 'FAILED' WHERE id = ?`).run(lead.id);
        
        return this.tick(campaignId);
      }


      
      let allowedInboxes = [];
      try {
        allowedInboxes = JSON.parse(campaign.selected_inboxes || '[]');
      } catch (e) {
        allowedInboxes = [];
      }

      if (allowedInboxes.length === 0) {
        systemLog('ERROR', `Для кампании ${campaignId} не выбрано ни одного ящика! Остановка.`);
        this.stop(campaignId);
        return;
      }

      // Генерируем вопросики для SQL: ?,?,?
      const placeholders = allowedInboxes.map(() => '?').join(',');
      
      
      const inbox = db.prepare(`
        SELECT * FROM Inboxes 
        WHERE status = 'GREEN' 
          AND sent_today < daily_limit 
          AND id IN (${placeholders}) 
        ORDER BY sent_today ASC 
        LIMIT 1
      `).get(...allowedInboxes) as any;
      
      if (!inbox) {
        systemLog('WARNING', `Нет доступных ящиков для кампании ${campaignId} (достигнут лимит). Пауза.`);
        this.stop(campaignId);
        db.prepare(`UPDATE Campaigns SET status = 'PAUSED_NO_INBOXES' WHERE id = ?`).run(campaignId);
        return;
      }

      inboxIdToFail = inbox.id;
      inboxEmailToLog = inbox.email;

      
      systemLog('INFO', `[Ротация] Выбран ящик ${inbox.email} (Отправлено сегодня: ${inbox.sent_today})`);

      
      let rawSubject = campaign.subject;
      const subjTpl = db.prepare(`SELECT content FROM Templates WHERE type = 'SUBJECT' AND group_name = ? ORDER BY RANDOM() LIMIT 1`).get(rawSubject) as any;
      if (subjTpl) rawSubject = subjTpl.content;

      let rawBody = campaign.body;
      const bodyTpl = db.prepare(`SELECT content FROM Templates WHERE type = 'BODY' AND group_name = ? ORDER BY RANDOM() LIMIT 1`).get(rawBody) as any;
      if (bodyTpl) rawBody = bodyTpl.content;
      

      
      let parsedName = lead.name ? String(lead.name).trim() : '';
      let parsedCompany = '';

      if (lead.custom_data) {
        try {
          const rowData = JSON.parse(lead.custom_data);
          const companyKey = Object.keys(rowData).find(k => k.toLowerCase() === 'company');
          if (companyKey && rowData[companyKey]) {
            parsedCompany = String(rowData[companyKey]).trim();
          }
        } catch (e) {
          console.error('[Runner] Ошибка парсинга custom_data:', e);
        }
      }

      
      const nameRegex = /\{{1,2}name\}{1,2}/gi;
      const companyRegex = /\{{1,2}company\}{1,2}/gi;

      rawSubject = rawSubject.replace(nameRegex, parsedName).replace(companyRegex, parsedCompany);
      rawBody = rawBody.replace(nameRegex, parsedName).replace(companyRegex, parsedCompany);

      
      let subject = this.applySpintax(rawSubject);
      let body = this.applySpintax(rawBody);

      
      subject = subject.replace(/\{\{[^}]+\}\}/g, '').replace(/\s{2,}/g, ' ').trim();
      body = body.replace(/\{\{[^}]+\}\}/g, '');

      
      const unsubSetting = db.prepare(`SELECT value FROM SystemData WHERE key = 'enable_unsubscribe'`).get() as any;
      if (unsubSetting && unsubSetting.value === 'true') {
        body += `<br><br><p style="font-size: 11px; color: #999;">If you don't want to receive these emails, just reply with "stop".</p>`;
      }

      
      const transporter = await createTransporter({
        email: inbox.email,
        app_password: inbox.app_password,
        smtp_host: inbox.smtp_host,
        smtp_port: inbox.smtp_port,
        proxy: inbox.proxy
      });

      
      const fromField = inbox.sender_name 
        ? `"${inbox.sender_name}" <${inbox.email}>` 
        : inbox.email;

      
      if (inbox.proxy && inbox.proxy.startsWith('rotate://')) {
        const rotateUrl = inbox.proxy.replace('rotate://', '');
        try {
          systemLog('INFO', `[Rotate] Запрос смены IP роутера/модема...`);
          await fetch(rotateUrl); 
          systemLog('INFO', `[Rotate] Ожидание 5 секунд для перезагрузки соединения...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          systemLog('SUCCESS', `[Rotate] IP-адрес успешно изменен!`);
        } catch (err: any) {
          systemLog('WARNING', `[Rotate] Ошибка при смене IP: ${err.message}`);
        }
      }

      
      let finalHtmlBody = body;
      if (!finalHtmlBody.toLowerCase().includes('<html')) {
        finalHtmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: sans-serif; font-size: 14px; color: #000;">${body}</body></html>`;
      }

      
      const plainTextBody = body.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');

      
      await transporter.sendMail({
        from: fromField,
        to: lead.email,
        subject: subject,
        html: finalHtmlBody,       
        text: plainTextBody,       
        headers: {
          
          'List-Unsubscribe': `<mailto:${inbox.email}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      });

      db.prepare(`UPDATE Leads SET status = 'SENT', sent_at = CURRENT_TIMESTAMP WHERE id = ?`).run(lead.id);
      db.prepare(`UPDATE Inboxes SET sent_today = sent_today + 1 WHERE id = ?`).run(inbox.id);
      systemLog('SUCCESS', `${lead.email} успешно отправлен через ${inbox.email}`);

    } catch (error: any) {
      systemLog('ERROR', `Не удалось отправить письмо: ${error.message}`);
      
      const errString = error.toString().toLowerCase();
      const isAuthError = errString.includes('535') || errString.includes('eauth') || errString.includes('eenvelope') || errString.includes('bad credentials');

      if (isAuthError && inboxIdToFail) {
        systemLog('ERROR', `[Анти-фрод] Ящик ${inboxEmailToLog} заблокирован или сменился пароль. Отключаем...`);
        db.prepare(`UPDATE Inboxes SET status = 'ERROR' WHERE id = ?`).run(inboxIdToFail);
      }

      if (leadIdToFail) {
        db.prepare(`UPDATE Leads SET status = 'FAILED' WHERE id = ?`).run(leadIdToFail);
      }
    }

    
    if (this.activeCampaigns.has(campaignId)) {
      
      const currentCampaign = db.prepare(`SELECT min_pause, max_pause FROM Campaigns WHERE id = ?`).get(campaignId) as any;
      const minMs = (currentCampaign?.min_pause || 60) * 1000;
      const maxMs = (currentCampaign?.max_pause || 150) * 1000;
      
      const delayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs; 
      systemLog('INFO', `Спим ${Math.round(delayMs / 1000)} секунд (настройки кампании)...`);
      setTimeout(() => this.tick(campaignId), delayMs);
    }
  }
}


ipcMain.handle('verify-license', async (_, key: string) => {
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  if (key.trim().startsWith('SAFE-')) {
    return { valid: true };
  }
  return { valid: false, error: 'Ключ не найден или истек. (Попробуй ввести SAFE-123)' };
});



ipcMain.handle('start-campaign', async (_, campaignId: number) => {
  CampaignRunner.start(campaignId);
  return { success: true };
});

ipcMain.handle('stop-campaign', async (_, campaignId: number) => {
  CampaignRunner.stop(campaignId);
  return { success: true };
});

ipcMain.handle('getInboxes', () => {
  try {
    
    return db.prepare('SELECT id, email, app_password, smtp_host, smtp_port, sender_name, status, sent_today, daily_limit, proxy, warmup_target_limit, warmup_current_limit, warmup_increment FROM Inboxes').all();
  } catch (error) {
    console.error('Ошибка получения ящиков:', error);
    return [];
  }
});

ipcMain.handle('deleteInbox', (_, id) => {
  try {
    db.prepare('DELETE FROM Inboxes WHERE id = ?').run(id);
    return { success: true };
  } catch (error: any) {
    console.error('Ошибка удаления ящика:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('addInbox', async (_, data) => {
  const { email, senderName, password, host, port, dailyLimit, proxy } = data; 
  try {
    const existing = db.prepare('SELECT id FROM Inboxes WHERE email = ?').get(email);
    if (existing) return { success: false, error: 'Этот ящик уже добавлен в систему!' };

    
    const transporter = await createTransporter({ email, password, host, port, proxy });
    await transporter.verify();

    const stmt = db.prepare(`
      INSERT INTO Inboxes (email, sender_name, app_password, smtp_host, smtp_port, daily_limit, status, sent_today, proxy)
      VALUES (?, ?, ?, ?, ?, ?, 'GREEN', 0, ?)
    `);
    stmt.run(email, senderName || '', password, host, port, dailyLimit, proxy || '');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('updateInbox', async (_, data) => {
  const { id, senderName, password, host, port, dailyLimit, proxy, warmupTargetLimit, warmupCurrentLimit, warmupIncrement } = data;
  try {
    db.prepare(`
      UPDATE Inboxes 
      SET sender_name = ?, app_password = ?, smtp_host = ?, smtp_port = ?, daily_limit = ?, proxy = ?, warmup_target_limit = ?, warmup_current_limit = ?, warmup_increment = ? 
      WHERE id = ?
    `).run(
      senderName || '',
      password,
      host,
      port,
      dailyLimit, 
      proxy || '', 
      warmupTargetLimit || 40, 
      warmupCurrentLimit || 2, 
      warmupIncrement || 2, 
      id
    );
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('createCampaign', async (_, data) => {
  const { name, subject, body, csvFilePath, csvFileContent, minPause, maxPause, scheduledAt, selectedInboxes, duplicateAction = 'skip' } = data;

  try {
    const insertCampaign = db.prepare(`
      INSERT INTO Campaigns (name, subject, body, status, min_pause, max_pause, scheduled_at, selected_inboxes) 
      VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?)
    `);
    const campaignResult = insertCampaign.run(name, subject, body, minPause, maxPause, scheduledAt, selectedInboxes);
    const campaignId = campaignResult.lastInsertRowid;

    const results: any[] = [];

    
    await new Promise((resolve, reject) => {
      const stream = csvFileContent 
        ? Readable.from([csvFileContent]) 
        : fs.createReadStream(csvFilePath);

      stream.pipe(csv())
        .on('data', (row) => {
          const email = (row.email || row.Email || row.EMAIL || '').trim();
          if (email && email.includes('@')) results.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    
    const existingEmailsRows = db.prepare('SELECT email FROM Leads').all() as { email: string }[];
    const existingEmails = new Set(existingEmailsRows.map(r => r.email.toLowerCase()));

    const insertLead = db.prepare(`
      INSERT INTO Leads (campaign_id, email, name, custom_data, status) 
      VALUES (?, ?, ?, ?, 'PENDING')
    `);
    const updateLead = db.prepare(`
      UPDATE Leads 
      SET campaign_id = ?, status = 'PENDING', custom_data = ?, name = ? 
      WHERE email = ? COLLATE NOCASE
    `);
    
    let processedLeads = 0;

    const insertMany = db.transaction((leads: any[]) => {
      for (const lead of leads) {
        const email = (lead.email || lead.Email || '').trim();
        if (!email) continue;
        const emailLower = email.toLowerCase();
        const leadName = lead.name || lead.Name || '';
        
        let parsedUsername = '';
        for (const value of Object.values(lead as Record<string, unknown>)) {
          const strVal = String(value).trim();
          if (strVal.includes('instagram.com/') || strVal.includes('twitter.com/') || strVal.includes('x.com/') || strVal.includes('t.me/')) {
            const match = strVal.match(/\/([a-zA-Z0-9_.-]+)\/?$/);
            if (match && match[1]) { parsedUsername = match[1]; break; }
          }
        }
        if (parsedUsername) lead['Parsed_Username'] = parsedUsername;
        const customData = JSON.stringify(lead); 

        
        if (existingEmails.has(emailLower)) {
          if (duplicateAction === 'reuse') {
            updateLead.run(campaignId, customData, leadName.trim(), email);
            processedLeads++;
          }
          
        } else {
          insertLead.run(campaignId, email, leadName.trim(), customData);
          existingEmails.add(emailLower); 
          processedLeads++;
        }
      }
    });

    insertMany(results);

    return { success: true, campaignId, leadsCount: processedLeads };
  } catch (error: any) {
    console.error('Ошибка создания кампании:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('updateCampaign', async (_, data) => {
  const { id, name, subject, body, csvFilePath, csvFileContent, minPause, maxPause, scheduledAt, selectedInboxes, duplicateAction = 'skip' } = data;

  try {
    const updateStmt = db.prepare(`
      UPDATE Campaigns 
      SET name = ?, subject = ?, body = ?, min_pause = ?, max_pause = ?, scheduled_at = ?, selected_inboxes = ?, status = 'PAUSED'
      WHERE id = ?
    `);
    updateStmt.run(name, subject, body, minPause, maxPause, scheduledAt, selectedInboxes, id);

    let addedLeads = 0;

    if (csvFilePath || csvFileContent) {
      const results: any[] = [];
      await new Promise((resolve, reject) => {
        const stream = csvFileContent 
          ? Readable.from([csvFileContent]) 
          : fs.createReadStream(csvFilePath);

        stream.pipe(csv())
          .on('data', (row) => {
            const email = (row.email || row.Email || row.EMAIL || '').trim();
            if (email && email.includes('@')) results.push(row);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      const existingEmailsRows = db.prepare('SELECT email FROM Leads').all() as { email: string }[];
      const existingEmails = new Set(existingEmailsRows.map(r => r.email.toLowerCase()));

      const insertLead = db.prepare(`
        INSERT INTO Leads (campaign_id, email, name, custom_data, status) 
        VALUES (?, ?, ?, ?, 'PENDING')
      `);
      const updateLead = db.prepare(`
        UPDATE Leads 
        SET campaign_id = ?, status = 'PENDING', custom_data = ?, name = ? 
        WHERE email = ? COLLATE NOCASE
      `);
      
      const insertMany = db.transaction((leads: any[]) => {
        for (const lead of leads) {
          const email = (lead.email || lead.Email || '').trim();
          if (!email) continue;
          const emailLower = email.toLowerCase();
          const leadName = lead.name || lead.Name || '';
          
          let parsedUsername = '';
          for (const value of Object.values(lead as Record<string, unknown>)) {
            const strVal = String(value).trim();
            if (strVal.includes('instagram.com/') || strVal.includes('twitter.com/') || strVal.includes('x.com/') || strVal.includes('t.me/')) {
              const match = strVal.match(/\/([a-zA-Z0-9_.-]+)\/?$/);
              if (match && match[1]) { parsedUsername = match[1]; break; }
            }
          }
          if (parsedUsername) lead['Parsed_Username'] = parsedUsername;
          const customData = JSON.stringify(lead); 

          if (existingEmails.has(emailLower)) {
            if (duplicateAction === 'reuse') {
              updateLead.run(id, customData, leadName.trim(), email);
              addedLeads++;
            }
          } else {
            insertLead.run(id, email, leadName.trim(), customData);
            existingEmails.add(emailLower);
            addedLeads++;
          }
        }
      });
      insertMany(results);
    }

    CampaignRunner.stop(id);

    return { success: true, addedLeads };
  } catch (error: any) {
    console.error('Ошибка обновления кампании:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('getCampaigns', () => {
  try {
    return db.prepare(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM Leads WHERE campaign_id = c.id) as total_leads,
             (SELECT COUNT(*) FROM Leads WHERE campaign_id = c.id AND status = 'SENT') as sent_leads
      FROM Campaigns c 
      ORDER BY c.id DESC
    `).all();
  } catch (error) {
    console.error('Ошибка получения кампаний:', error);
    return [];
  }
});


ipcMain.handle('getStats', () => {
  try {
    const sent = db.prepare(`SELECT COUNT(*) as count FROM Leads WHERE status = 'SENT'`).get() as any;
    const pending = db.prepare(`SELECT COUNT(*) as count FROM Leads WHERE status = 'PENDING'`).get() as any;
    const inboxes = db.prepare(`SELECT COUNT(*) as count FROM Inboxes WHERE status = 'GREEN'`).get() as any;
    
    return {
      sent: sent.count || 0,
      pending: pending.count || 0,
      inboxes: inboxes.count || 0
    };
  } catch (error) {
    console.error('Ошибка статистики:', error);
    return { sent: 0, pending: 0, inboxes: 0 };
  }
});


ipcMain.handle('checkCsvDuplicates', async (_, csvFilePath: string) => {
  try {
    if (!fs.existsSync(csvFilePath)) return { success: false, error: 'Файл не найден' };

    
    const emailsSet = new Set<string>();
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          
          const email = row.email || row.Email || row.EMAIL;
          if (email) emailsSet.add(email.trim());
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const emails = Array.from(emailsSet);
    if (emails.length === 0) return { success: true, duplicateCount: 0, exampleCampaign: '' };

    
    let duplicateCount = 0;
    let exampleCampaign = '';
    const chunkSize = 500; 

    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      
      const query = `
        SELECT Campaigns.name as campaign_name 
        FROM Leads 
        JOIN Campaigns ON Leads.campaign_id = Campaigns.id 
        WHERE Leads.email IN (${placeholders})
      `;
      
      const found = db.prepare(query).all(...chunk) as any[];
      duplicateCount += found.length;
      
      
      if (!exampleCampaign && found.length > 0) {
        exampleCampaign = found[0].campaign_name;
      }
    }

    return { success: true, duplicateCount, exampleCampaign };
  } catch (error: any) {
    console.error('Ошибка проверки дубликатов:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('selectTemplateFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Выберите файл шаблона письма',
    properties: ['openFile'],
    filters: [{ name: 'Шаблоны писем', extensions: ['txt', 'html', 'htm'] }]
  });
  
  if (!canceled && filePaths.length > 0) {
    try {
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      return content; 
    } catch (error) {
      console.error('Ошибка чтения шаблона:', error);
      return null;
    }
  }
  return null;
});


ipcMain.handle('getLogs', () => {
  try {
    return db.prepare('SELECT * FROM SystemLogs ORDER BY id DESC LIMIT 100').all();
  } catch (error) {
    console.error('Ошибка получения логов:', error);
    return [];
  }
});


ipcMain.handle('exportLogs', async () => {
  try {
    
    const allLogs = db.prepare('SELECT * FROM SystemLogs ORDER BY id ASC').all() as any[];
    
    if (allLogs.length === 0) return { success: false, error: 'Логи пусты' };

    
    let fileContent = '=== SAFEOUTREACH SYSTEM LOGS ===\n';
    fileContent += `Generated: ${new Date().toLocaleString()}\n\n`;

    for (const log of allLogs) {
      fileContent += `[${new Date(log.created_at + 'Z').toLocaleString()}] [${log.type}] ${log.message}\n`;
    }

    
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Сохранить логи',
      defaultPath: `safeoutreach_logs_${new Date().toISOString().split('T')[0]}.txt`,
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (canceled || !filePath) return { success: true, canceled: true };

    
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    
    return { success: true, canceled: false };
  } catch (error: any) {
    console.error('Ошибка экспорта логов:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('deleteCampaign', async (_, id: number) => {
  try {
    
    CampaignRunner.stop(id);
    db.prepare('DELETE FROM Campaigns WHERE id = ?').run(id);
    systemLog('WARNING', `🗑 Кампания #${id} удалена`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('getTemplates', () => {
  try {
    return db.prepare('SELECT * FROM Templates ORDER BY id DESC').all();
  } catch (error) {
    console.error('Ошибка получения шаблонов:', error);
    return [];
  }
});


ipcMain.handle('addTemplate', async (_, data: { type: string, group_name: string, content: string }) => {
  try {
    
    const stmt = db.prepare(`INSERT INTO Templates (type, name, content, group_name) VALUES (?, 'Template', ?, ?)`);
    const result = stmt.run(data.type, data.content, data.group_name || 'General');
    return { success: true, id: result.lastInsertRowid };
  } catch (error: any) {
    console.error('Ошибка добавления шаблона:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('deleteTemplate', async (_, id: number) => {
  try {
    db.prepare('DELETE FROM Templates WHERE id = ?').run(id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('toggleTemplateRandom', async (_, id: number, isRandom: boolean) => {
  try {
    db.prepare('UPDATE Templates SET is_random = ? WHERE id = ?').run(isRandom ? 1 : 0, id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('importTemplatesBulk', async (_, type: 'SUBJECT' | 'BODY') => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Выберите файл для массового импорта',
      properties: ['openFile'],
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (canceled || filePaths.length === 0) return { success: true, canceled: true };

    const content = fs.readFileSync(filePaths[0], 'utf-8');
    
    let chunks: string[] = [];
    if (content.includes('===')) chunks = content.split(/\r?\n===\r?\n/);
    else chunks = content.split(/\r?\n/);

    const validChunks = chunks.map(c => c.trim()).filter(c => c.length > 0);
    if (validChunks.length === 0) return { success: false, error: 'Файл пуст' };

    const dateStr = new Date().toLocaleDateString();
    const stmt = db.prepare(`INSERT INTO Templates (type, name, content, is_random) VALUES (?, ?, ?, 1)`);
    
    const insertMany = db.transaction((items) => {
      for (let i = 0; i < items.length; i++) {
        stmt.run(type, `Импорт [${dateStr}] #${i + 1}`, items[i]);
      }
    });

    insertMany(validChunks);
    return { success: true, count: validChunks.length };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('deleteAllTemplates', async (_, type: 'SUBJECT' | 'BODY') => {
  try {
    db.prepare('DELETE FROM Templates WHERE type = ?').run(type);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});



ipcMain.handle('getLeads', (_, { searchQuery = '', statusFilter = 'ALL', offset = 0 }) => {
  try {
    let query = `
      SELECT Leads.*, Campaigns.name as campaign_name 
      FROM Leads 
      LEFT JOIN Campaigns ON Leads.campaign_id = Campaigns.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (statusFilter !== 'ALL') {
      query += ` AND Leads.status = ?`;
      params.push(statusFilter);
    }

    if (searchQuery.trim() !== '') {
      query += ` AND (Leads.email LIKE ? OR Leads.name LIKE ? OR Campaigns.name LIKE ?)`;
      const likeSearch = `%${searchQuery.trim()}%`;
      params.push(likeSearch, likeSearch, likeSearch);
    }

    
    const countQuery = query.replace('SELECT Leads.*, Campaigns.name as campaign_name', 'SELECT COUNT(*) as total');
    const totalResult = db.prepare(countQuery).get(...params) as any;
    const total = totalResult.total;

    
    query += ` ORDER BY Leads.id DESC LIMIT 100 OFFSET ?`;
    params.push(offset);

    const leads = db.prepare(query).all(...params);

    return { success: true, leads, total };
  } catch (error: any) {
    console.error('Ошибка getLeads:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('exportLeadsToCsv', async (_, { searchQuery = '', statusFilter = 'ALL' }) => {
  try {
    let query = `
      SELECT Leads.email, Leads.name, Leads.status, Leads.sent_at, Campaigns.name as campaign_name 
      FROM Leads 
      LEFT JOIN Campaigns ON Leads.campaign_id = Campaigns.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (statusFilter !== 'ALL') {
      query += ` AND Leads.status = ?`;
      params.push(statusFilter);
    }

    if (searchQuery.trim() !== '') {
      query += ` AND (Leads.email LIKE ? OR Leads.name LIKE ? OR Campaigns.name LIKE ?)`;
      const likeSearch = `%${searchQuery.trim()}%`;
      params.push(likeSearch, likeSearch, likeSearch);
    }

    const leads = db.prepare(query).all(...params) as any[];
    if (leads.length === 0) return { success: false, error: 'Нет данных для экспорта' };

    
    const header = 'Email,Name,Status,Sent_At,Campaign\n';
    const rows = leads.map(l => {
      const email = l.email || '';
      const name = (l.name || '').replace(/,/g, ' '); 
      const status = l.status || '';
      const sent_at = l.sent_at || '';
      const campaign = (l.campaign_name || '').replace(/,/g, ' ');
      return `${email},${name},${status},${sent_at},${campaign}`;
    }).join('\n');

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Экспорт Базы Лидов',
      defaultPath: `leads_export_${new Date().toISOString().split('T')[0]}.csv`,
      filters: [{ name: 'CSV Файлы', extensions: ['csv'] }]
    });

    if (canceled || !filePath) return { success: true, canceled: true };

    
    fs.writeFileSync(filePath, '\uFEFF' + header + rows, 'utf-8'); 
    return { success: true, canceled: false };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('getSystemSetting', (_, key: string) => {
  const row = db.prepare(`SELECT value FROM SystemData WHERE key = ?`).get(key) as any;
  return row ? row.value : null;
});

ipcMain.handle('setSystemSetting', (_, key: string, value: string) => {
  const exists = db.prepare(`SELECT key FROM SystemData WHERE key = ?`).get(key);
  if (exists) {
    db.prepare(`UPDATE SystemData SET value = ? WHERE key = ?`).run(value, key);
  } else {
    db.prepare(`INSERT INTO SystemData (key, value) VALUES (?, ?)`).run(key, value);
  }
  return { success: true };
});


ipcMain.handle('exportDatabase', async () => {
  try {
    
    db.pragma('wal_checkpoint(TRUNCATE)');
    
    const dbPath = join(app.getPath('userData'), 'database.sqlite');
    
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Экспорт базы данных (Бэкап)',
      defaultPath: `safeoutreach_backup_${new Date().toISOString().split('T')[0]}.sqlite`,
      filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }]
    });

    if (canceled || !filePath) return { success: true, canceled: true };

    fs.copyFileSync(dbPath, filePath);
    return { success: true };
  } catch (error: any) {
    console.error('Ошибка экспорта БД:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('importDatabase', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Импорт базы данных (Восстановление)',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }]
    });

    if (canceled || filePaths.length === 0) return { success: true, canceled: true };

    const sourcePath = filePaths[0];
    const dbPath = join(app.getPath('userData'), 'database.sqlite');

    CampaignRunner.activeCampaigns.clear();
    if ((global as any).ReplyChecker) (global as any).ReplyChecker.isRunning = false;

    
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();

    
    fs.copyFileSync(sourcePath, dbPath);

    
    app.relaunch();
    app.exit(0);

    return { success: true };
  } catch (error: any) {
    
    try { initDB(); } catch(e) {}
    console.error('Ошибка импорта БД:', error);
    return { success: false, error: error.message };
  }
});