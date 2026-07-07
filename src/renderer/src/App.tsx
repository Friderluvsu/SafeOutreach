import React, { useState, useEffect } from 'react';

function formatProxyString(type: string, rawInput: string): string {
  if (!rawInput) return '';
  const cleanInput = rawInput.trim();

  
  if (type === 'rotate') {
    return cleanInput.startsWith('rotate://') ? cleanInput : `rotate://${cleanInput}`;
  }

  if (cleanInput.includes('://')) {
    return cleanInput;
  }

  const parts = cleanInput.split(':');

  if (parts.length === 4) {
    return `${type}://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
  }

  if (parts.length === 2) {
    return `${type}://${parts[0]}:${parts[1]}`;
  }

  return `${type === 'socks5' ? 'socks5' : 'http'}://${cleanInput}`;
}

function calculateSpamScore(text: string): { score: number; issues: string[] } {
  if (!text || text.trim() === '') return { score: 0, issues: [] };
  let score = 0;
  const issues: string[] = [];
  const lower = text.toLowerCase();

  
  const salesWords = ["price", "sale", "buy", "discount", "cheap", "free", "cash", "earn", "income", "profit", "save money", "цена", "прайс", "распродажа", "скидка", "дешево", "бесплатно", "подарок", "бонус", "деньги", "кэш", "заработать", "доход", "прибыль", "сэкономить"];
  const urgencyWords = ["act now", "apply now", "call now", "limited time", "urgent", "instant", "fast cash", "действуй сейчас", "ограниченное время", "срочно", "мгновенно", "быстрые деньги"];
  const guaranteeWords = ["100%", "best price", "guarantee", "no cost", "no hidden costs", "promise", "лучшая цена", "гарантия", "без затрат", "без скрытых", "обещаю"];
  const marketingWords = ["marketing", "ad", "advertisement", "promotion", "special offer", "clicked", "маркетинг", "реклама", "продвижение", "акция", "спецпредложение", "жми", "кликай"];

  let foundSpamWords: string[] = [];

  
  salesWords.forEach(w => { if (lower.includes(w)) { score += 15; foundSpamWords.push(w); } });
  urgencyWords.forEach(w => { if (lower.includes(w)) { score += 20; foundSpamWords.push(w); } });
  guaranteeWords.forEach(w => { if (lower.includes(w)) { score += 20; foundSpamWords.push(w); } });
  marketingWords.forEach(w => { if (lower.includes(w)) { score += 15; foundSpamWords.push(w); } });

  if (foundSpamWords.length > 0) {
    const displayWords = foundSpamWords.slice(0, 5);
    const extra = foundSpamWords.length > 5 ? ` и еще ${foundSpamWords.length - 5}` : '';
    issues.push(`Спам-слова: ${displayWords.join(', ')}${extra}`);
  }

  
  const links = text.match(/(https?:\/\/[^\s]+)/g) || [];
  if (links.length >= 3) {
    score += 30;
    issues.push("Много ссылок (более 2 шт). Риск попадания в спам");
  }

  
  const lettersOnly = text.replace(/[^a-zA-Zа-яА-Я]/g, '');
  if (lettersOnly.length > 15) {
    const upperCount = (lettersOnly.match(/[A-ZА-Я]/g) || []).length;
    const upperRatio = upperCount / lettersOnly.length;
    if (upperRatio > 0.4) {
      score += 40;
      issues.push("Агрессивный КАПС (более 40% текста)");
    } else if (upperRatio > 0.2) {
      score += 20;
      issues.push("Много КАПСА (более 20% текста)");
    }
  }

  
  if (text.includes('!!!') || text.includes('???') || text.includes('!?!')) {
    score += 15;
    issues.push("Избыток восклицательных знаков/вопросов (!!!, ???)");
  }

  
  return { score: Math.min(score, 100), issues };
}

export default function App() {



  const [activeTab, setActiveTab] = useState('dashboard');
  const [enableUnsubscribe, setEnableUnsubscribe] = useState(false);

  
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('smtp.gmail.com');
  const [port, setPort] = useState(465);
  const [dailyLimit, setDailyLimit] = useState(40);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingInbox, setEditingInbox] = useState<any>(null);
  const [showAddInboxModal, setShowAddInboxModal] = useState(false);
  const [proxyType, setProxyType] = useState('http');
  const [proxyInput, setProxyInput] = useState('');
  const [networkMode, setNetworkMode] = useState('direct');

  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [stats, setStats] = useState({ sent: 0, pending: 0, inboxes: 0 });
  const [logs, setLogs] = useState<any[]>([]);

  
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ type: 'BODY', group_name: 'General', content: '' });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [csvFileContent, setCsvFileContent] = useState(''); 


  
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);

  
  const [wizardStep, setWizardStep] = useState(1);
  const [campName, setCampName] = useState('');

  
  const [selectedInboxesForCamp, setSelectedInboxesForCamp] = useState<number[]>([]);

  
  const [campSubject, setCampSubject] = useState('');
  const [campBody, setCampBody] = useState('');

  
  const [minPause, setMinPause] = useState(60);
  const [maxPause, setMaxPause] = useState(150);
  const [scheduledAt, setScheduledAt] = useState('');
  const [csvFilePath, setCsvFilePath] = useState('');

  
  const [timingPreset, setTimingPreset] = useState('moderate');
  const [showAdvancedTimings, setShowAdvancedTimings] = useState(false);

  
  const [leads, setLeads] = useState<any[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsSearch, setLeadsSearch] = useState('');
  const [leadsFilter, setLeadsFilter] = useState('ALL');
  const [leadsPage, setLeadsPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

 
  const handlePresetChange = (preset: string) => {
    setTimingPreset(preset);
    if (preset === 'fast') { setMinPause(15); setMaxPause(30); }
    if (preset === 'moderate') { setMinPause(60); setMaxPause(150); }
    if (preset === 'safe') { setMinPause(300); setMaxPause(600); }
  };

  
  const [duplicateInfo, setDuplicateInfo] = useState({ count: 0, exampleCamp: '' });
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'reuse'>('skip');
  const [isCheckingCsv, setIsCheckingCsv] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);


  const [isCreatingCamp, setIsCreatingCamp] = useState(false);
  const [campMessage, setCampMessage] = useState({ text: '', type: '' as 'success' | 'error' | '' });

  
  const [updateInfo, setUpdateInfo] = useState<{ status: 'idle' | 'downloading' | 'ready', message: string }>({ status: 'idle', message: '' });

 
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, type: 'confirm', title, message, onConfirm });
  };

  const showAlert = (title: string, message: string) => {
    setModalConfig({ isOpen: true, type: 'alert', title, message });
  };

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    window.api.onAppUpdate((_event, data) => {
      setUpdateInfo({ status: data.status, message: data.message });
    });
  }, []);

  const fetchLeads = async () => {
    const res = await window.api.getLeads({
      searchQuery: leadsSearch,
      statusFilter: leadsFilter,
      offset: leadsPage * 100
    });
    if (res.success) {
      setLeads(res.leads);
      setLeadsTotal(res.total);
    }
  };

  useEffect(() => {
    if (activeTab === 'leads') fetchLeads();
  }, [activeTab, leadsPage, leadsFilter]);

  const handleLeadsSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLeadsPage(0);
    fetchLeads();
  };

  const handleExportLeads = async () => {
    setIsExporting(true);
    const res = await window.api.exportLeadsToCsv({ searchQuery: leadsSearch, statusFilter: leadsFilter });
    setIsExporting(false);
    if (res.success && !res.canceled) {
      showAlert('Успех', 'База лидов успешно экспортирована!');
    } else if (!res.success) {
      showAlert('Ошибка', res.error || 'Ошибка экспорта');
    }
  };


  

  useEffect(() => {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return;
    switch (domain) {
      case 'gmail.com': setHost('smtp.gmail.com'); setPort(465); break;
      case 'outlook.com':
      case 'hotmail.com': setHost('smtp.office365.com'); setPort(587); break;
      case 'yandex.ru': setHost('smtp.yandex.ru'); setPort(465); break;
      case 'mail.ru': setHost('smtp.mail.ru'); setPort(465); break;
      case 'zoho.com': setHost('smtp.zoho.com'); setPort(465); break;
    }
  }, [email]);

  const fetchInboxes = async () => {
    try {
      const data = await window.api.getInboxes();
      setInboxes(data);
    } catch (err) {
      console.error("Ошибка загрузки ящиков:", err);
    }
  };

  
  const parseProxyToState = (proxyStr: string) => {
    if (!proxyStr) {
      setNetworkMode('direct');
      setProxyType('http'); setProxyInput(''); return;
    }
    if (proxyStr === 'socks5://127.0.0.1:10808') {
      setNetworkMode('local_vpn');
      setProxyType('socks5'); setProxyInput(''); return;
    }
    
    setNetworkMode('custom_proxy');
    if (proxyStr.startsWith('socks5://')) { setProxyType('socks5'); setProxyInput(proxyStr.replace('socks5://', '')); }
    else if (proxyStr.startsWith('rotate://')) { setProxyType('rotate'); setProxyInput(proxyStr.replace('rotate://', '')); }
    else { setProxyType('http'); setProxyInput(proxyStr.replace(/^(http|https):\/\//i, '')); }
  };


  const handleAddInbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      
      let finalProxy = '';
      if (networkMode === 'local_vpn') {
        finalProxy = 'socks5://127.0.0.1:10808';
      } else if (networkMode === 'custom_proxy') {
        finalProxy = formatProxyString(proxyType, proxyInput);
      }

      const res = await window.api.addInbox({
        email,
        senderName,
        password,
        host,
        port,
        dailyLimit,
        proxy: finalProxy
      });

      if (res.success) {
        setEmail(''); setSenderName(''); setPassword(''); setProxyInput(''); setNetworkMode('direct'); setShowAddInboxModal(false); fetchInboxes();
      } else {
        setErrorMsg(res.error || 'Ошибка при подключении к SMTP');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Внутренняя ошибка IPC');
    }
    setIsLoading(false);
  };

  const handleUpdateInbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInbox) return;

    
    let finalProxy = '';
    if (networkMode === 'local_vpn') {
      finalProxy = 'socks5://127.0.0.1:10808';
    } else if (networkMode === 'custom_proxy') {
      finalProxy = formatProxyString(proxyType, proxyInput);
    }

    const res = await window.api.updateInbox({
      id: editingInbox.id,
      senderName: editingInbox.sender_name,
      password: editingInbox.app_password, 
      host: editingInbox.smtp_host,        
      port: editingInbox.smtp_port,        
      dailyLimit: editingInbox.daily_limit,
      proxy: finalProxy,
      warmupTargetLimit: editingInbox.warmup_target_limit,
      warmupCurrentLimit: editingInbox.warmup_current_limit,
      warmupIncrement: editingInbox.warmup_increment
    });

    if (res.success) {
      setEditingInbox(null);
      setNetworkMode('direct');
      fetchInboxes();
    } else {
      showAlert('Ошибка', 'Не удалось обновить ящик: ' + res.error);
    }
  };

  const handleDeleteInbox = (id: number) => {
    showConfirm('Удаление ящика', 'Вы уверены, что хотите удалить этот ящик?', async () => {
      const res = await window.api.deleteInbox(id);
      if (res.success) fetchInboxes();
      else showAlert('Ошибка', 'Ошибка при удалении: ' + res.error);
      closeModal();
    });
  };

  const handleSelectFile = async () => {
    try {
      const path = await window.api.selectCsv();
      if (path) {
        setCsvFilePath(path);
        setDuplicateInfo({ count: 0, exampleCamp: '' });
        setDuplicateAction('skip');
        setIsCheckingCsv(true);
        const res = await window.api.checkCsvDuplicates(path);
        setIsCheckingCsv(false);
        if (res.success && res.duplicateCount && res.duplicateCount > 0) {
          setDuplicateInfo({ count: res.duplicateCount, exampleCamp: res.exampleCampaign || '' });
        }
      }
    } catch (error) {
      console.error("Ошибка выбора файла:", error);
      setIsCheckingCsv(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaignId && !csvFilePath) {
      setCampMessage({ text: 'Пожалуйста, выберите CSV файл с лидами', type: 'error' });
      return;
    }
    if (selectedInboxesForCamp.length === 0) {
      setCampMessage({ text: 'Выберите хотя бы один ящик для рассылки', type: 'error' });
      return;
    }

    setIsCreatingCamp(true);
    setCampMessage({ text: '', type: '' });

    try {
      const payload = {
        id: editingCampaignId,
        name: campName,
        subject: campSubject,
        body: campBody,
        csvFilePath,
        csvFileContent,
        minPause,
        maxPause,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        selectedInboxes: JSON.stringify(selectedInboxesForCamp),
        duplicateAction 
      };

      let res: any;
      if (editingCampaignId) {
        res = await window.api.updateCampaign(payload);
      } else {
        res = await window.api.createCampaign(payload);
      }

      if (res.success) {
        const msg = editingCampaignId
          ? `Успешно сохранено! ${res.addedLeads > 0 ? 'Догружено новых лидов: ' + res.addedLeads : ''}`
          : `Успешно! Загружено лидов: ${res.leadsCount}`;

        setCampMessage({ text: msg, type: 'success' });

        
        setShowCampaignModal(false);
        setWizardStep(1); setCampName(''); setCampSubject(''); setCampBody('');
        setCsvFilePath(''); setCsvFileContent('');
        setDuplicateInfo({ count: 0, exampleCamp: '' }); setDuplicateAction('skip');
        setSelectedInboxesForCamp([]);
        setEditingCampaignId(null);

        fetchCampaigns();
        setTimeout(() => setCampMessage({ text: '', type: '' }), 3000);
      } else {
        setCampMessage({ text: `Ошибка: ${res.error}`, type: 'error' });
      }
    } catch (error: any) {
      setCampMessage({ text: `Внутренняя ошибка IPC: ${error.message}`, type: 'error' });
    }
    setIsCreatingCamp(false);
  };

  const openEditModal = (camp: any) => {
    setEditingCampaignId(camp.id);
    setCampName(camp.name);
    setCampSubject(camp.subject);
    setCampBody(camp.body);
    setMinPause(camp.min_pause);
    setMaxPause(camp.max_pause);

    try {
      setSelectedInboxesForCamp(JSON.parse(camp.selected_inboxes || '[]'));
    } catch {
      setSelectedInboxesForCamp([]);
    }

    if (camp.scheduled_at) {
      const date = new Date(camp.scheduled_at);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      setScheduledAt(date.toISOString().slice(0, 16));
    } else {
      setScheduledAt('');
    }

    setCsvFilePath('');
    setWizardStep(1);
    setShowCampaignModal(true);
  };

  const fetchCampaigns = async () => {
    try {
      const data = await window.api.getCampaigns();
      setCampaignsList(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'campaigns') {
      fetchCampaigns();
      const interval = setInterval(fetchCampaigns, 3000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      const fetchStats = async () => {
        const data = await window.api.getStats();
        setStats(data);
        fetchInboxes();
      };
      fetchStats();
      const interval = setInterval(fetchStats, 3000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [activeTab]);

  const handleStartCampaign = async (id: number) => {
    await window.api.startCampaign(id);
    fetchCampaigns();
  };

  const handleStopCampaign = async (id: number) => {
    await window.api.stopCampaign(id);
    fetchCampaigns();
  };

  const fetchLogs = async () => {
    try {
      const data = await window.api.getLogs();
      setLogs(data);
    } catch (err) {
      console.error("Ошибка загрузки логов:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' || activeTab === 'dashboard') {
      fetchLogs();
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [activeTab]);

  const handleExportLogs = async () => {
    try {
      const res = await window.api.exportLogs();
      if (!res.success && !res.canceled) {
        showAlert('Ошибка', 'Ошибка при скачивании: ' + res.error);
      }
    } catch (err) {
      showAlert('Ошибка', 'Ошибка IPC при скачивании логов');
    }
  };

  const handleDeleteCampaign = (id: number) => {
    showConfirm('Удаление кампании', 'Удалить эту кампанию? Все лиды из неё также будут удалены.', async () => {
      const res = await window.api.deleteCampaign(id);
      if (res.success) fetchCampaigns();
      else showAlert('Ошибка', 'Ошибка при удалении: ' + res.error);
      closeModal();
    });
  };

  const fetchTemplates = async () => {
    try {
      const data = await window.api.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error("Ошибка загрузки шаблонов:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplates();
    }
  }, [activeTab]);

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await window.api.addTemplate(newTemplate);
    if (res.success) {
      setNewTemplate({ type: 'BODY', group_name: 'General', content: '' });
      setShowTemplateModal(false);
      fetchTemplates();
    } else {
      showAlert('Ошибка', 'Ошибка при сохранении шаблона: ' + res.error);
    }
  };

  const handleDeleteTemplate = (id: number) => {
    showConfirm('Удаление шаблона', 'Удалить этот шаблон навсегда?', async () => {
      const res = await window.api.deleteTemplate(id);
      if (res.success) fetchTemplates();
      else showAlert('Ошибка', 'Ошибка при удалении: ' + res.error);
      closeModal();
    });
  };

  const handleBulkImportTemplates = async (type: 'SUBJECT' | 'BODY') => {
    const res = await window.api.importTemplatesBulk(type);
    if (res.success && !res.canceled) {
      showAlert('Успешный импорт', `Загружено новых шаблонов: ${res.count}`);
      fetchTemplates();
    } else if (!res.success) {
      showAlert('Ошибка', 'Не удалось импортировать: ' + res.error);
    }
  };

  const handleDeleteAllTemplates = (type: 'SUBJECT' | 'BODY') => {
    showConfirm('Удаление', 'Вы уверены, что хотите удалить ВСЕ шаблоны в этой колонке?', async () => {
      const res = await window.api.deleteAllTemplates(type);
      if (res.success) fetchTemplates();
      else showAlert('Ошибка', 'Ошибка при удалении: ' + res.error);
      closeModal();
    });
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      window.api.getSystemSetting('enable_unsubscribe').then(val => {
        setEnableUnsubscribe(val === 'true');
      });
    }
  }, [activeTab]);

  const toggleUnsubscribe = async () => {
    const newVal = !enableUnsubscribe;
    setEnableUnsubscribe(newVal);
    await window.api.setSystemSetting('enable_unsubscribe', newVal ? 'true' : 'false');
  };

  const handleExportDB = async () => {
    const res = await window.api.exportDatabase();
    if (res.success && !res.canceled) {
      showAlert('Успех', 'Резервная копия базы данных успешно сохранена!');
    } else if (!res.success) {
      showAlert('Ошибка', 'Не удалось экспортировать базу данных: ' + res.error);
    }
  };

  const handleImportDB = async () => {
    showConfirm(
      'Восстановление базы данных',
      'ВНИМАНИЕ: Импорт файла сотрет все текущие данные и перезапустит приложение. Вы уверены, что хотите продолжить?',
      async () => {
        closeModal();
        const res = await window.api.importDatabase();
        if (res && !res.success && !res.canceled) {
          showAlert('Ошибка', 'Не удалось восстановить базу данных: ' + res.error);
        }
      }
    );
  };

  

  return (
    <div className="min-h-screen flex flex-col md:flex-row p-6 pt-12 gap-6">

      {/* КАСТОМНЫЙ TITLE-BAR */}
      <div className="fixed top-0 left-0 right-0 h-10 z-[9999] [-webkit-app-region:drag] flex justify-end items-center px-2 gap-1 bg-transparent">
        <button onClick={() => window.api.minimize()} className="[-webkit-app-region:no-drag] w-11 h-8 flex items-center justify-center rounded-md text-gray-600 hover:bg-slate-200/50 transition-colors" title="Свернуть">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5" /></svg>
        </button>
        <button onClick={() => window.api.maximize()} className="[-webkit-app-region:no-drag] w-11 h-8 flex items-center justify-center rounded-md text-gray-600 hover:bg-slate-200/50 transition-colors" title="Развернуть">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1" ry="1" /></svg>
        </button>
        <button onClick={() => window.api.close()} className="[-webkit-app-region:no-drag] w-11 h-8 flex items-center justify-center rounded-md text-gray-600 hover:bg-red-500 hover:text-white transition-colors" title="Закрыть">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* САЙДБАР */}
      <div className="w-full md:w-64 bg-white/70 backdrop-blur-2xl rounded-[2rem] p-6 border border-white/60 shadow-[0_8px_30px_rgb(251,191,36,0.15)] h-fit flex flex-col justify-between space-y-3">
        <div>
          <div className="text-xs font-bold text-amber-900/60 uppercase tracking-wider mb-2 px-3">Навигация</div>

          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left font-semibold text-sm transition ${activeTab === 'dashboard' ? 'bg-amber-100/80 text-amber-900 border border-amber-300 shadow-sm' : 'text-amber-900/60 hover:bg-white/60 border border-transparent'}`}>Статистика</button>
          <button onClick={() => setActiveTab('inboxes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left font-semibold text-sm transition ${activeTab === 'inboxes' ? 'bg-amber-100/80 text-amber-900 border border-amber-300 shadow-sm' : 'text-amber-900/60 hover:bg-white/60 border border-transparent'}`}>Ящики</button>
          <button onClick={() => setActiveTab('templates')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left font-semibold text-sm transition ${activeTab === 'templates' ? 'bg-amber-100/80 text-amber-900 border border-amber-300 shadow-sm' : 'text-amber-900/60 hover:bg-white/60 border border-transparent'}`}>Шаблоны</button>
          <button onClick={() => setActiveTab('campaigns')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left font-semibold text-sm transition ${activeTab === 'campaigns' ? 'bg-amber-100/80 text-amber-900 border border-amber-300 shadow-sm' : 'text-amber-900/60 hover:bg-white/60 border border-transparent'}`}>Кампании</button>
          <button onClick={() => setActiveTab('leads')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left font-semibold text-sm transition ${activeTab === 'leads' ? 'bg-amber-100/80 text-amber-900 border border-amber-300 shadow-sm' : 'text-amber-900/60 hover:bg-white/60 border border-transparent'}`}>База лидов</button>
          <button onClick={() => setActiveTab('logs')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left font-semibold text-sm transition ${activeTab === 'logs' ? 'bg-amber-100/80 text-amber-900 border border-amber-300 shadow-sm' : 'text-amber-900/60 hover:bg-white/60 border border-transparent'}`}>Логи системы</button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left font-semibold text-sm transition ${activeTab === 'settings' ? 'bg-amber-100/80 text-amber-900 border border-amber-300 shadow-sm' : 'text-amber-900/60 hover:bg-white/60 border border-transparent'}`}>Настройки</button>
        </div>

        <div className="text-[10px] text-amber-900/40 font-bold uppercase tracking-widest text-center mt-6">
          SafeOutreach — для всех.<br />
          made by wjtchcraft
        </div>
      </div>

      
      <div className="flex-grow w-full md:w-3/4">

        
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Пульт безопасности</h2>
              <p className="text-sm text-gray-400">Сводка в реальном времени</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)] flex flex-col justify-center items-center text-center space-y-2">
                <div className="text-gray-400 text-sm font-bold uppercase tracking-wider">Отправлено</div>
                <div className="text-5xl font-extrabold bg-gradient-to-b from-[#ffc163] to-[#FF8A00] bg-clip-text text-transparent drop-shadow-sm">{stats.sent}</div>
                <div className="text-xs text-gray-400">успешных писем</div>
              </div>

              <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)] flex flex-col justify-center items-center text-center space-y-2">
                <div className="text-gray-400 text-sm font-bold uppercase tracking-wider">В очереди</div>
                <div className="text-5xl font-extrabold bg-gradient-to-b from-[#ffc163] to-[#FF8A00] bg-clip-text text-transparent drop-shadow-sm">{stats.pending}</div>
                <div className="text-xs text-gray-400">лидов ожидают</div>
              </div>

              <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)] flex flex-col justify-center items-center text-center space-y-2">
                <div className="text-gray-400 text-sm font-bold uppercase tracking-wider">Активно ящиков</div>
                <div className="text-5xl font-extrabold bg-gradient-to-b from-[#ffc163] to-[#FF8A00] bg-clip-text text-transparent drop-shadow-sm">{stats.inboxes}</div>
                <div className="text-xs text-gray-400">готовы к работе</div>
              </div>
            </div>

            
            <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)] space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Состояние инфраструктуры</h3>
              {inboxes.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">Нет подключенных ящиков...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inboxes.map(inbox => {
                    const percent = Math.min((inbox.sent_today / inbox.daily_limit) * 100, 100);
                    const isExhausted = inbox.sent_today >= inbox.daily_limit;
                    const isError = inbox.status === 'ERROR';

                    let barColor = 'bg-green-500';
                    if (isError) barColor = 'bg-red-500';
                    else if (isExhausted) barColor = 'bg-amber-500';

                    return (
                      <div key={inbox.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-gray-800 truncate pr-2">{inbox.email}</span>
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isError ? 'bg-red-500' : isExhausted ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-gray-500">
                            <span>Отправлено</span>
                            <span>{inbox.sent_today} / {inbox.daily_limit}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percent}%` }}></div>
                          </div>
                        </div>

                        {isError && <div className="text-[10px] font-bold text-red-500">Требуется переподключение (Сбой)</div>}
                        {isExhausted && !isError && <div className="text-[10px] font-bold text-amber-500">Дневной лимит исчерпан</div>}
                        {!isExhausted && !isError && <div className="text-[10px] font-bold text-green-500">Ящик готов к работе</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'templates' && (
          <div className="space-y-6 relative h-full">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Шаблоны</h2>
              <p className="text-sm text-gray-400">Организация текстов по папкам (группам)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* === КОЛОНКА 1: ТЕМЫ ПИСЕМ === */}
              <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-gray-900">Темы писем</h3>
                    <button onClick={() => { setNewTemplate({ type: 'SUBJECT', group_name: 'General', content: '' }); setShowTemplateModal(true); }} className="w-7 h-7 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 hover:bg-amber-100 transition" title="Создать">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleBulkImportTemplates('SUBJECT')} className="text-gray-400 hover:text-amber-600 transition" title="Массовый импорт">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </button>
                    <button onClick={() => handleDeleteAllTemplates('SUBJECT')} className="text-gray-400 hover:text-red-500 transition" title="Удалить все">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                <div className="space-y-5">
                  {templates.filter(t => t.type === 'SUBJECT').length === 0 ? (
                    <p className="text-sm text-gray-400">Нет сохраненных тем</p>
                  ) : (
                    Object.entries(
                      templates.filter(t => t.type === 'SUBJECT').reduce((acc: any, t) => {
                        const group = t.group_name || 'General';
                        acc[group] = acc[group] || [];
                        acc[group].push(t);
                        return acc;
                      }, {})
                    ).map(([group, items]: [string, any]) => {
                      const isExpanded = expandedGroups[`SUBJECT-${group}`];
                      return (
                        <div key={group} className="space-y-2">
                          <div
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [`SUBJECT-${group}`]: !isExpanded }))}
                            className="flex items-center gap-2 text-sm font-bold text-gray-800 cursor-pointer hover:text-amber-600 transition select-none"
                          >
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                            {group} <span className="text-gray-400 text-xs font-normal">({items.length})</span>
                          </div>
                          {isExpanded && (
                            <div className="pl-6 border-l-2 border-amber-100 space-y-2 ml-2">
                              {items.map((t: any) => (
                                <div key={t.id} className="p-3 bg-gray-50 rounded-2xl group relative pr-8 transition hover:bg-gray-100">
                                  <div className="text-xs text-gray-600 font-medium line-clamp-2">{t.content}</div>
                                  <button onClick={() => handleDeleteTemplate(t.id)} className="absolute top-1/2 -translate-y-1/2 right-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100" title="Удалить">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              
              <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-gray-900">Тексты писем</h3>
                    <button onClick={() => { setNewTemplate({ type: 'BODY', group_name: 'General', content: '' }); setShowTemplateModal(true); }} className="w-7 h-7 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 hover:bg-amber-100 transition" title="Создать">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleBulkImportTemplates('BODY')} className="text-gray-400 hover:text-amber-600 transition" title="Массовый импорт">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </button>
                    <button onClick={() => handleDeleteAllTemplates('BODY')} className="text-gray-400 hover:text-red-500 transition" title="Удалить все">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                <div className="space-y-5">
                  {templates.filter(t => t.type === 'BODY').length === 0 ? (
                    <p className="text-sm text-gray-400">Нет сохраненных текстов</p>
                  ) : (
                    Object.entries(
                      templates.filter(t => t.type === 'BODY').reduce((acc: any, t) => {
                        const group = t.group_name || 'General';
                        acc[group] = acc[group] || [];
                        acc[group].push(t);
                        return acc;
                      }, {})
                    ).map(([group, items]: [string, any]) => {
                      const isExpanded = expandedGroups[`BODY-${group}`];
                      return (
                        <div key={group} className="space-y-2">
                          <div
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [`BODY-${group}`]: !isExpanded }))}
                            className="flex items-center gap-2 text-sm font-bold text-gray-800 cursor-pointer hover:text-amber-600 transition select-none"
                          >
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                            {group} <span className="text-gray-400 text-xs font-normal">({items.length})</span>
                          </div>
                          {isExpanded && (
                            <div className="pl-6 border-l-2 border-amber-100 space-y-2 ml-2">
                              {items.map((t: any) => (
                                <div key={t.id} className="p-3 bg-gray-50 rounded-2xl group relative pr-8 transition hover:bg-gray-100">
                                  <div className="text-xs text-gray-600 font-medium line-clamp-2">{t.content}</div>
                                  <button onClick={() => handleDeleteTemplate(t.id)} className="absolute top-1/2 -translate-y-1/2 right-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100" title="Удалить">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            
            {showTemplateModal && (
              <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.15)] max-w-lg w-full animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Новый шаблон ({newTemplate.type === 'SUBJECT' ? 'Тема' : 'Текст'})
                  </h3>
                  <form onSubmit={handleAddTemplate} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 ml-1">Папка</label>
                      <input
                        type="text"
                        value={newTemplate.group_name}
                        onChange={e => setNewTemplate({ ...newTemplate, group_name: e.target.value })}
                        required
                        className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-medium text-sm text-slate-800"
                      />

                      <div className="flex flex-wrap gap-2 pt-2">
                        {Array.from(new Set(templates.map(t => String(t.group_name || 'General'))))
                          .filter(g => g.trim() !== '')
                          .map(g => (
                            <div
                              key={g}
                              onClick={() => setNewTemplate({ ...newTemplate, group_name: g })}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition select-none"
                            >
                              {g}
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 ml-1">Содержимое</label>

                      
                      <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
                        <button
                          type="button"
                          onClick={() => setNewTemplate(prev => ({ ...prev, content: prev.content + '{{Name}}' }))}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition border border-amber-200/50 whitespace-nowrap"
                        >
                          [+ Имя]
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewTemplate(prev => ({ ...prev, content: prev.content + '{{Company}}' }))}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition border border-amber-200/50 whitespace-nowrap"
                        >
                          [+ Компания]
                        </button>
                      </div>

                      <textarea
                        value={newTemplate.content}
                        onChange={e => setNewTemplate({ ...newTemplate, content: e.target.value })}
                        required
                        rows={5}
                        className="w-full bg-white/75 border border-amber-200/60 rounded-2xl px-4 py-3 outline-none focus:border-amber-500 transition resize-none font-sans text-sm text-gray-700 leading-relaxed"
                      />

                      
                      {(() => {
                        const { score, issues } = calculateSpamScore(newTemplate.content);
                        const barColor = score <= 30 ? 'bg-green-500' : score <= 60 ? 'bg-amber-400' : 'bg-red-500';
                        const textColor = score <= 30 ? 'text-green-500' : score <= 60 ? 'text-amber-500' : 'text-red-500';
                        return (
                          <div className="pt-2 space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                              <span>Вероятность попадания в спам:</span>
                              <span className={textColor}>{score}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${score}%` }}></div>
                            </div>
                            {issues.length > 0 && (
                              <ul className="text-[10px] text-red-500 font-medium list-disc pl-4 pt-1 space-y-0.5">
                                {issues.map((i, idx) => <li key={idx}>{i}</li>)}
                              </ul>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowTemplateModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-2xl transition">Отмена</button>
                      <button type="submit" className="flex-1 bg-gradient-to-b from-[#ffc163] to-[#FFAE40] hover:from-[#ffcf85] hover:to-[#ffb957] border border-[#FFAE40]/50 shadow-[0_4px_14px_rgb(255,174,64,0.4)] text-amber-950 font-bold py-3 rounded-2xl shadow-sm transition">Сохранить</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        
        {activeTab === 'inboxes' && (
          <div className="space-y-8 relative h-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Управление ящиками</h2>
                <p className="text-sm text-gray-400">Добавление и настройка SMTP/IMAP аккаунтов</p>
              </div>
              <button
                onClick={() => {
                  setEmail(''); setSenderName(''); setPassword(''); setHost('smtp.gmail.com'); setPort(465); setDailyLimit(40);setShowAdvanced(false);
                  setProxyType('http'); setProxyInput(''); setErrorMsg(''); setShowAdvanced(false);
                  setShowAddInboxModal(true);
                }}
                className="bg-gradient-to-b from-[#ffc163] to-[#FFAE40] hover:from-[#ffcf85] hover:to-[#ffb957] border border-[#FFAE40]/50 shadow-[0_4px_14px_rgb(255,174,64,0.4)] text-amber-950 font-bold py-2.5 px-5 rounded-xl text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 ease-out flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Добавить ящик
              </button>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm font-semibold">
                    <th className="py-4 px-6">Email</th>
                    <th className="py-4 px-6">Статус</th>
                    <th className="py-4 px-6">Отправлено (сегодня)</th>
                    <th className="py-4 px-6 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inboxes.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="py-16 flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                          </div>
                          <div className="text-gray-500 font-bold">Здесь пока ничего нет</div>
                          <div className="text-xs text-gray-400 mt-1">Добавьте свой первый SMTP-ящик</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    inboxes.map((inbox) => (
                      <tr key={inbox.id} className="hover:bg-gray-50/50 transition">
                        <td className="py-4 px-6 text-sm font-bold text-gray-900">
                          {inbox.email}
                          {inbox.proxy && <div className="text-[10px] font-medium text-gray-400 mt-0.5 truncate max-w-[200px]">Proxy: {inbox.proxy}</div>}
                        </td>
                        <td className="py-4 px-6">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${inbox.status === 'GREEN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${inbox.status === 'GREEN' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            {inbox.status === 'GREEN' ? 'Работает' : 'Ошибка входа'}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-gray-600">
                          <span className="text-gray-900">{inbox.sent_today}</span> / {inbox.daily_limit}
                        </td>
                        <td className="py-4 px-6 text-right space-x-3">
                          <button
                            onClick={() => { parseProxyToState(inbox.proxy || ''); setEditingInbox(inbox); }}
                            className="text-blue-500 hover:text-blue-700 font-bold text-sm transition inline-flex items-center gap-1.5"
                            title="Редактировать"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button
                            onClick={() => handleDeleteInbox(inbox.id)}
                            className="text-red-400 hover:text-red-600 font-bold text-sm transition inline-flex items-center gap-1.5"
                            title="Удалить"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            
            {showAddInboxModal && (
              <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 max-w-md w-full border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Добавить новый ящик</h3>
                  <form onSubmit={handleAddInbox} className="space-y-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 ml-1">Email</label>
                          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-white/75 border border-amber-200/60 rounded-2xl px-5 py-3.5 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all duration-200 outline-none font-medium text-sm" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 ml-1">App Password</label>
                          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-white/75 border border-amber-200/60 rounded-2xl px-5 py-3.5 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all duration-200 outline-none font-medium text-sm" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1">Имя отправителя (Опционально)</label>
                        <input type="text" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Например: Ivan | SafeOutreach" className="w-full bg-white/75 border border-amber-200/60 rounded-2xl px-5 py-3.5 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all duration-200 outline-none font-medium text-sm" />
                      </div>
                    </div>

                    
                    <div className="space-y-3 pt-2">
                      <label className="text-xs font-bold text-gray-500 ml-1">Сетевое подключение</label>
                      <div className="flex p-1 bg-gray-100/80 rounded-xl">
                        <button type="button" onClick={() => setNetworkMode('direct')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${networkMode === 'direct' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          Домашний IP
                        </button>
                        <button type="button" onClick={() => setNetworkMode('local_vpn')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${networkMode === 'local_vpn' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          VPN на ПК
                        </button>
                        <button type="button" onClick={() => setNetworkMode('custom_proxy')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${networkMode === 'custom_proxy' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          Свой прокси
                        </button>
                      </div>

                      {networkMode === 'direct' && (
                        <p className="text-xs font-bold text-slate-500 mt-2 px-1">Письма будут отправляться напрямую через ваше текущее интернет-соединение.</p>
                      )}

                      {networkMode === 'local_vpn' && (
                        <p className="text-xs font-bold text-slate-500 mt-2 px-1">Письма пойдут через VLESS/VPN клиент, запущенный на вашем компьютере (порт 10808).</p>
                      )}

                      {networkMode === 'custom_proxy' && (
                        <div className="space-y-2 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex p-1 bg-gray-100/80 rounded-xl">
                            <button type="button" onClick={() => setProxyType('http')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${proxyType === 'http' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                              HTTP
                            </button>
                            <button type="button" onClick={() => setProxyType('socks5')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${proxyType === 'socks5' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                              SOCKS5
                            </button>
                            <button type="button" onClick={() => setProxyType('rotate')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${proxyType === 'rotate' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              Rotate
                            </button>
                          </div>
                          <input
                            type="text"
                            value={proxyInput}
                            onChange={e => setProxyInput(e.target.value)}
                            placeholder="127.0.0.1:8080:login:pass"
                            className="w-full bg-white/75 border border-amber-200/60 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none font-medium text-sm mt-1"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between items-end ml-1">
                        <label className="text-xs font-bold text-gray-500">Суточный лимит</label>
                      </div>
                      <div className="flex gap-4 items-center bg-white/75 border border-amber-200/60 rounded-2xl px-5 py-3 transition focus-within:border-amber-500">
                      <input
                           type="range" min="1" max="2000" step="1"
                            value={dailyLimit}
                          onChange={e => setDailyLimit(Number(e.target.value))}
                          className="flex-grow h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        
                        <input
                          type="number" min="1" max="2000"
                          value={dailyLimit}
                          onChange={e => setDailyLimit(e.target.value === '' ? '' as any : parseInt(e.target.value.replace(/^0+/, '') || '0', 10))}
                          className="w-20 bg-white/75 border border-amber-200/60 rounded-xl px-3 py-2 text-center font-bold text-gray-800 outline-none focus:border-amber-500 transition shadow-sm text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs font-bold text-gray-400 hover:text-gray-700 transition flex items-center gap-1 w-fit">
                        <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        Расширенные настройки SMTP
                      </button>
                    </div>

                    {showAdvanced && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 ml-1">SMTP Host</label>
                          <input type="text" value={host} onChange={e => setHost(e.target.value)} required placeholder="smtp.gmail.com" className="w-full bg-white/75 border border-amber-200/60 rounded-xl px-4 py-2 outline-none focus:border-amber-500 transition text-sm" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 ml-1">SMTP Port</label>
                          <input type="number" value={port} onChange={e => setPort(e.target.value === '' ? '' as any : parseInt(e.target.value.replace(/^0+/, '') || '0', 10))} required placeholder="465" className="w-full bg-white/75 border border-amber-200/60 rounded-xl px-4 py-2 outline-none focus:border-amber-500 transition text-sm" />
                        </div>
                      </div>
                    )}

                    {errorMsg && (
                      <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-xs font-bold border border-red-100">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        {errorMsg}
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddInboxModal(false);
                          setIsLoading(false);
                          setErrorMsg('');
                        }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 ease-out"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-b from-[#ffc163] to-[#FFAE40] hover:from-[#ffcf85] hover:to-[#ffb957] border border-[#FFAE40]/50 shadow-[0_4px_14px_rgb(255,174,64,0.4)] text-amber-950 font-bold py-3.5 rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? 'Проверка...' : 'Добавить'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

           
            {editingInbox && (
              <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 max-w-md w-full border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Редактирование ящика</h3>
                  
                  <form onSubmit={handleUpdateInbox} className="space-y-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 ml-1">Email</label>
                          
                          <input type="email" value={editingInbox.email} disabled className="w-full bg-slate-100/75 border border-slate-200/60 rounded-2xl px-5 py-3.5 text-slate-500 cursor-not-allowed font-medium text-sm" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 ml-1">App Password</label>
                          <input type="password" value={editingInbox.app_password || ''} onChange={e => setEditingInbox({...editingInbox, app_password: e.target.value})} required className="w-full bg-white/75 border border-amber-200/60 rounded-2xl px-5 py-3.5 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all duration-200 outline-none font-medium text-sm" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1">Имя отправителя (Опционально)</label>
                        <input type="text" value={editingInbox.sender_name || ''} onChange={e => setEditingInbox({...editingInbox, sender_name: e.target.value})} placeholder="Например: Ivan | SafeOutreach" className="w-full bg-white/75 border border-amber-200/60 rounded-2xl px-5 py-3.5 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all duration-200 outline-none font-medium text-sm" />
                      </div>
                    </div>

                    
                    <div className="space-y-3 pt-2">
                      <label className="text-xs font-bold text-gray-500 ml-1">Сетевое подключение</label>
                      <div className="flex p-1 bg-gray-100/80 rounded-xl">
                        <button type="button" onClick={() => setNetworkMode('direct')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${networkMode === 'direct' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          Домашний IP
                        </button>
                        <button type="button" onClick={() => setNetworkMode('local_vpn')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${networkMode === 'local_vpn' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          VPN на ПК
                        </button>
                        <button type="button" onClick={() => setNetworkMode('custom_proxy')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${networkMode === 'custom_proxy' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          Свой прокси
                        </button>
                      </div>

                      {networkMode === 'direct' && (
                        <p className="text-xs font-bold text-slate-500 mt-2 px-1">Письма будут отправляться напрямую через ваше текущее интернет-соединение.</p>
                      )}

                      {networkMode === 'local_vpn' && (
                        <p className="text-xs font-bold text-slate-500 mt-2 px-1">Письма пойдут через VLESS/VPN клиент, запущенный на вашем компьютере (порт 10808).</p>
                      )}

                      {networkMode === 'custom_proxy' && (
                        <div className="space-y-2 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex p-1 bg-gray-100/80 rounded-xl">
                            <button type="button" onClick={() => setProxyType('http')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${proxyType === 'http' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                              HTTP
                            </button>
                            <button type="button" onClick={() => setProxyType('socks5')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${proxyType === 'socks5' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                              SOCKS5
                            </button>
                            <button type="button" onClick={() => setProxyType('rotate')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition ${proxyType === 'rotate' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              Rotate
                            </button>
                          </div>
                          <input
                            type="text"
                            value={proxyInput}
                            onChange={e => setProxyInput(e.target.value)}
                            placeholder="127.0.0.1:8080:login:pass"
                            className="w-full bg-white/75 border border-amber-200/60 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none font-medium text-sm mt-1"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between items-end ml-1">
                        <label className="text-xs font-bold text-gray-500">Суточный лимит</label>
                      </div>
                      <div className="flex gap-4 items-center bg-white/75 border border-amber-200/60 rounded-2xl px-5 py-3 transition focus-within:border-amber-500">
                        <input
                          type="range" min="1" max="2000" step="1"
                          value={editingInbox.daily_limit}
                          onChange={e => setEditingInbox({...editingInbox, daily_limit: Number(e.target.value)})}
                          className="flex-grow h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <input
                          type="number" min="1" max="2000"
                          value={editingInbox.daily_limit}
                          onChange={e => setEditingInbox({...editingInbox, daily_limit: e.target.value === '' ? '' as any : parseInt(e.target.value.replace(/^0+/, '') || '0', 10)})}
                          className="w-20 bg-white/75 border border-amber-200/60 rounded-xl px-3 py-2 text-center font-bold text-gray-800 outline-none focus:border-amber-500 transition shadow-sm text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs font-bold text-gray-400 hover:text-gray-700 transition flex items-center gap-1 w-fit">
                        <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        Расширенные настройки SMTP
                      </button>
                    </div>

                    {showAdvanced && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 ml-1">SMTP Host</label>
                          <input type="text" value={editingInbox.smtp_host || ''} onChange={e => setEditingInbox({...editingInbox, smtp_host: e.target.value})} required placeholder="smtp.gmail.com" className="w-full bg-white/75 border border-amber-200/60 rounded-xl px-4 py-2 outline-none focus:border-amber-500 transition text-sm" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 ml-1">SMTP Port</label>
                          <input type="number" value={editingInbox.smtp_port || ''} onChange={e => setEditingInbox({...editingInbox, smtp_port: e.target.value === '' ? '' as any : parseInt(e.target.value.replace(/^0+/, '') || '0', 10)})} required placeholder="465" className="w-full bg-white/75 border border-amber-200/60 rounded-xl px-4 py-2 outline-none focus:border-amber-500 transition text-sm" />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingInbox(null);
                          setProxyInput('');
                          setProxyType('http');
                          setShowAdvanced(false);
                        }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 ease-out"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-gradient-to-b from-[#ffc163] to-[#FFAE40] hover:from-[#ffcf85] hover:to-[#ffb957] border border-[#FFAE40]/50 shadow-[0_4px_14px_rgb(255,174,64,0.4)] text-amber-950 font-bold py-3.5 rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 ease-out"
                      >
                        Сохранить
                      </button>
                    </div>

                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        
        {activeTab === 'campaigns' && (
          <div className="space-y-8 relative h-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Кампании</h2>
                <p className="text-sm text-gray-400">Управление рассылками и базами</p>
              </div>
              <button
                onClick={() => {
                  setEditingCampaignId(null); setCampName(''); setCampSubject(''); setCampBody('');
                  setCsvFilePath(''); setSelectedInboxesForCamp([]); setScheduledAt('');
                  setWizardStep(1); setShowCampaignModal(true);
                }}
                className="bg-gradient-to-b from-[#ffc163] to-[#FFAE40] hover:from-[#ffcf85] hover:to-[#ffb957] border border-[#FFAE40]/50 shadow-[0_4px_14px_rgb(255,174,64,0.4)] text-amber-950 font-bold py-2.5 px-5 rounded-xl text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 ease-out flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Создать кампанию
              </button>
            </div>

            
            {campMessage.text && !showCampaignModal && (
              <div className={`p-4 rounded-2xl text-sm font-bold shadow-sm animate-in fade-in slide-in-from-top-4 ${campMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {campMessage.text}
              </div>
            )}

            
            <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm font-semibold">
                    <th className="py-4 px-6">Название</th>
                    <th className="py-4 px-6">Статус</th>
                    <th className="py-4 px-6">Прогресс</th>
                    <th className="py-4 px-6 text-right">Управление</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaignsList.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="py-16 flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                          </div>
                          <div className="text-gray-500 font-bold">Нет активных рассылок</div>
                          <div className="text-xs text-gray-400 mt-1">Нажмите "Создать кампанию", чтобы загрузить лидов</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    campaignsList.map((camp) => (
                      <tr key={camp.id} className="hover:bg-gray-50/50 transition">
                        <td className="py-4 px-6 font-medium text-gray-900">{camp.name}</td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${camp.status === 'RUNNING' ? 'bg-green-100 text-green-700' :
                            camp.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
                              camp.status === 'PAUSED_NO_INBOXES' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                            }`}>
                            {camp.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-600">
                          {camp.sent_leads} / {camp.total_leads} отправлено
                        </td>
                        <td className="py-4 px-6 text-right space-x-3">
                          {camp.status !== 'RUNNING' && camp.status !== 'COMPLETED' && (
                            <button onClick={() => handleStartCampaign(camp.id)} className="text-green-600 hover:text-green-800 font-bold text-sm transition inline-flex items-center gap-1.5" title="Запустить">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            </button>
                          )}
                          {camp.status === 'RUNNING' && (
                            <button onClick={() => handleStopCampaign(camp.id)} className="text-amber-600 hover:text-amber-800 font-bold text-sm transition inline-flex items-center gap-1.5" title="Пауза">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                            </button>
                          )}
                          <button onClick={() => openEditModal(camp)} className="text-blue-500 hover:text-blue-700 font-bold text-sm transition inline-flex items-center gap-1.5" title="Редактировать">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteCampaign(camp.id)} className="text-red-400 hover:text-red-600 font-bold text-sm transition inline-flex items-center gap-1.5" title="Удалить">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            
            {showCampaignModal && (
              <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40 flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.15)] w-full max-w-3xl relative mt-10 mb-10 animate-in fade-in zoom-in-95 duration-200">

                  
                  <button onClick={() => setShowCampaignModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 transition">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>

                  <div className="p-8 pb-4">
                    <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{editingCampaignId ? 'Редактирование кампании' : 'Создание рассылки'}</h2>
                    <p className="text-sm text-gray-500 mt-1">{editingCampaignId ? 'Измените настройки или догрузите новую базу лидов' : 'Пошаговый мастер настройки кампании'}</p>

                    
                    <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm mt-6">
                      <div className={`flex-1 flex items-center gap-2 font-bold text-sm ${wizardStep === 1 ? 'text-amber-500' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${wizardStep === 1 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100'}`}>1</span>
                        Ящики
                      </div>
                      <div className="w-8 h-[2px] bg-gray-100"></div>
                      <div className={`flex-1 flex items-center gap-2 font-bold text-sm ${wizardStep === 2 ? 'text-amber-500' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${wizardStep === 2 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100'}`}>2</span>
                        Письмо
                      </div>
                      <div className="w-8 h-[2px] bg-gray-100"></div>
                      <div className={`flex-1 flex items-center gap-2 font-bold text-sm ${wizardStep === 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${wizardStep === 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100'}`}>3</span>
                        База и Паузы
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleCreateCampaign} className="p-8 pt-4 space-y-6">
                    
                    {wizardStep === 1 && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-600 ml-1">Название кампании</label>
                          <input type="text" value={campName} onChange={e => setCampName(e.target.value)} required className="w-full bg-white/75 border border-amber-200/60 rounded-2xl px-4 py-3 outline-none focus:border-amber-500 transition" />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-600 ml-1">Ящики для рассылки</label>
                          {inboxes.length === 0 ? (
                            <p className="text-sm text-red-500 font-semibold p-4 bg-red-50 rounded-2xl border border-red-100">Сначала добавьте ящики во вкладке "Ящики"</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-52 overflow-y-auto p-1">
                              {inboxes.map(inbox => (
                                <label key={inbox.id} className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition ${selectedInboxesForCamp.includes(inbox.id) ? 'bg-amber-100/50 text-amber-900 shadow-sm' : 'bg-transparent hover:bg-gray-50 text-gray-600'}`}>
                                  <input
                                    type="checkbox"
                                    checked={selectedInboxesForCamp.includes(inbox.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedInboxesForCamp([...selectedInboxesForCamp, inbox.id]);
                                      else setSelectedInboxesForCamp(selectedInboxesForCamp.filter(id => id !== inbox.id));
                                    }}
                                    className="appearance-none w-5 h-5 border-2 border-gray-200 rounded-md checked:bg-amber-500 checked:border-transparent transition cursor-pointer relative after:content-[''] after:absolute after:top-[2px] after:left-[6px] after:w-[5px] after:h-[10px] after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:opacity-0 checked:after:opacity-100 shrink-0"
                                  />
                                  <div className="text-xs overflow-hidden">
                                    <div className="font-bold text-gray-800 truncate">{inbox.email}</div>
                                    <div className="text-gray-400 truncate">Очередь: {inbox.sent_today}/{inbox.daily_limit}</div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end pt-4">
                          <button type="button" disabled={!campName || selectedInboxesForCamp.length === 0} onClick={() => setWizardStep(2)} className="bg-gradient-to-b from-[#ffc163] to-[#FFAE40] hover:from-[#ffcf85] hover:to-[#ffb957] border border-[#FFAE40]/50 shadow-[0_4px_14px_rgb(255,174,64,0.4)] disabled:opacity-50 text-amber-950 font-bold py-3 px-8 rounded-2xl shadow-sm transition">
                            Далее
                          </button>
                        </div>
                      </div>
                    )}

                    
                    {wizardStep === 2 && (
                      <div className="space-y-6">
                        
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-600 ml-1">Тема письма (или Папка шаблонов)</label>
                          
                          {/* SMART TAGS PANEL */}
                          <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
                            <button
                              type="button"
                              onClick={() => setCampSubject(prev => prev + '{{Name}}')}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition border border-amber-200/50 whitespace-nowrap"
                            >
                              [+ Имя]
                            </button>
                            <button
                              type="button"
                              onClick={() => setCampSubject(prev => prev + '{{Company}}')}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition border border-amber-200/50 whitespace-nowrap"
                            >
                              [+ Компания]
                            </button>
                          </div>

                          <input 
                            type="text"
                            value={campSubject}
                            onChange={e => setCampSubject(e.target.value)}
                            className="w-full bg-white/75 border border-amber-200/60 rounded-2xl px-4 py-3 outline-none focus:border-amber-500 transition font-medium text-sm text-gray-800"
                            placeholder="Введите тему или выберите папку ниже..."
                          />

                          
                          <div className="flex flex-wrap gap-2 pt-1 ml-1">
                            {Array.from(new Set(templates.filter(t => t.type === 'SUBJECT').map(t => String(t.group_name || 'General')))).map(g => (
                              <div 
                                key={g} 
                                onClick={() => setCampSubject(g)} 
                                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition select-none"
                              >
                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                {g}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-600 ml-1">Текст письма (или Папка шаблонов)</label>
                          
                          {/* SMART TAGS PANEL */}
                          <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
                            <button
                              type="button"
                              onClick={() => setCampBody(prev => prev + '{{Name}}')}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition border border-amber-200/50 whitespace-nowrap"
                            >
                              [+ Имя]
                            </button>
                            <button
                              type="button"
                              onClick={() => setCampBody(prev => prev + '{{Company}}')}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition border border-amber-200/50 whitespace-nowrap"
                            >
                              [+ Компания]
                            </button>
                          </div>

                          <textarea 
                            value={campBody}
                            onChange={e => setCampBody(e.target.value)}
                            rows={4}
                            className="w-full bg-white/75 border border-amber-200/60 rounded-2xl px-4 py-3 outline-none focus:border-amber-500 transition font-medium text-sm text-gray-800 resize-none"
                            placeholder="Введите текст или выберите папку ниже..."
                          />

                          
                          <div className="flex flex-wrap gap-2 pt-1 ml-1">
                            {Array.from(new Set(templates.filter(t => t.type === 'BODY').map(t => String(t.group_name || 'General')))).map(g => (
                              <div 
                                key={g} 
                                onClick={() => setCampBody(g)} 
                                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition select-none"
                              >
                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                {g}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-between pt-4">
                          <button type="button" onClick={() => setWizardStep(1)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-8 rounded-2xl transition">Назад</button>
                          <button type="button" onClick={() => setWizardStep(3)} className="bg-gradient-to-b from-[#ffc163] to-[#FFAE40] hover:from-[#ffcf85] hover:to-[#ffb957] border border-[#FFAE40]/50 shadow-[0_4px_14px_rgb(255,174,64,0.4)] text-amber-950 font-bold py-3 px-8 rounded-2xl shadow-sm transition" disabled={!campSubject || !campBody}>Далее</button>
                        </div>
                      </div>
                    )}

                    
                    {wizardStep === 3 && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600 ml-1">{editingCampaignId ? 'Догрузить базу CSV' : 'CSV база лидов'}</label>
                            <div
                              onClick={handleSelectFile}
                              onDragOver={(e) => { e.preventDefault(); setIsDraggingCsv(true); }}
                              onDragLeave={(e) => { e.preventDefault(); setIsDraggingCsv(false); }}
                              onDrop={async (e) => {
                                e.preventDefault();
                                setIsDraggingCsv(false);
                                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                  const file = e.dataTransfer.files[0];
                                  if (file.name.toLowerCase().endsWith('.csv')) {
                                    
                                    const reader = new FileReader();
                                    reader.onload = async (event) => {
                                      const text = event.target?.result as string;
                                      setCsvFileContent(text);
                                      setCsvFilePath(file.name); 
                                      
                                    };
                                    reader.readAsText(file);
                                  } else {
                                    setCampMessage({ text: 'Пожалуйста, выберите файл .csv', type: 'error' });
                                  }
                                }
                              }}
                              className={`w-full h-14 flex items-center justify-center border-2 border-dashed rounded-2xl px-4 transition cursor-pointer 
                                ${isDraggingCsv ? 'border-amber-500 bg-amber-50 text-amber-700' :
                                  csvFilePath ? 'border-green-400 bg-green-50 text-green-700' :
                                    'border-gray-200 bg-white text-gray-500 hover:border-amber-400'}`}
                            >
                              <span className="truncate text-sm font-medium">
                                {isCheckingCsv ? 'Проверка...' :
                                  isDraggingCsv ? 'Отпустите файл здесь' :
                                    csvFilePath ? `Файл: ...${csvFilePath.slice(-25)}` :
                                      editingCampaignId ? 'Нажмите чтобы добавить новых лидов' : 'Нажмите или перетащите CSV'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600 ml-1">Отложенный старт</label>
                            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="w-full bg-white/75 border border-amber-200/60 rounded-2xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition" />
                          </div>
                        </div>

                        {/* ПРЕСЕТЫ ТАЙМИНГОВ */}
                        <div className="space-y-3">
                          <label className="text-sm font-bold text-gray-600 ml-1">Скорость рассылки</label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className={`cursor-pointer p-4 rounded-2xl border transition relative ${timingPreset === 'fast' ? 'bg-amber-50/50 border-amber-400 shadow-sm' : 'bg-white border-gray-200 hover:border-amber-200'}`}>
                              <input type="radio" name="timing" value="fast" checked={timingPreset === 'fast'} onChange={() => handlePresetChange('fast')} className="hidden" />
                              <div className="flex items-center gap-2 mb-1"><div className="font-bold text-gray-900 text-sm">Ультра-быстро</div></div>
                              <div className="text-xs text-gray-500 mb-2">15-30 секунд</div>
                            </label>
                            <label className={`cursor-pointer p-4 rounded-2xl border transition relative ${timingPreset === 'moderate' ? 'bg-amber-50/50 border-amber-400 shadow-sm' : 'bg-white border-gray-200 hover:border-amber-200'}`}>
                              <input type="radio" name="timing" value="moderate" checked={timingPreset === 'moderate'} onChange={() => handlePresetChange('moderate')} className="hidden" />
                              <div className="flex items-center gap-2 mb-1"><div className="font-bold text-gray-900 text-sm">Умеренно</div></div>
                              <div className="text-xs text-gray-500 mb-2">60-150 секунд</div>
                            </label>
                            <label className={`cursor-pointer p-4 rounded-2xl border transition relative ${timingPreset === 'safe' ? 'bg-amber-50/50 border-amber-400 shadow-sm' : 'bg-white border-gray-200 hover:border-amber-200'}`}>
                              <input type="radio" name="timing" value="safe" checked={timingPreset === 'safe'} onChange={() => handlePresetChange('safe')} className="hidden" />
                              <div className="flex items-center gap-2 mb-1"><div className="font-bold text-gray-900 text-sm">Безопасно</div></div>
                              <div className="text-xs text-gray-500 mb-2">5-10 минут</div>
                            </label>
                          </div>
                          <button type="button" onClick={() => setShowAdvancedTimings(!showAdvancedTimings)} className="text-xs font-bold text-gray-400 hover:text-gray-700 transition flex items-center gap-1 mt-2">
                            Расширенные настройки таймингов
                          </button>
                        </div>

                        {showAdvancedTimings && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white rounded-2xl border border-gray-200">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500 ml-1">Мин. пауза</label>
                              <input
                                type="number" min="1"
                                value={minPause}
                                onChange={e => { setMinPause(e.target.value === '' ? '' as any : parseInt(e.target.value.replace(/^0+/, '') || '0', 10)); setTimingPreset('custom'); }}
                                required
                                className="w-full bg-white/75 border border-amber-200/60 rounded-xl px-4 py-2 outline-none focus:border-amber-500 transition text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500 ml-1">Макс. пауза</label>
                              <input
                                type="number" min="1"
                                value={maxPause}
                                onChange={e => { setMaxPause(e.target.value === '' ? '' as any : parseInt(e.target.value.replace(/^0+/, '') || '0', 10)); setTimingPreset('custom'); }}
                                required
                                className="w-full bg-white/75 border border-amber-200/60 rounded-xl px-4 py-2 outline-none focus:border-amber-500 transition text-sm"
                              />
                            </div>
                          </div>
                        )}

                        
                        {duplicateInfo.count > 0 && (
                          <div className="p-5 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl border border-yellow-200/60 shadow-sm animate-in slide-in-from-bottom-2">
                            <div className="flex gap-3 mb-3">
                              <div className="mt-0.5 text-amber-500 shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-yellow-900">Найдены дубликаты</h4>
                                <p className="text-xs text-yellow-700/80 mt-0.5">В загруженном файле {duplicateInfo.count} email-адресов уже есть в вашей базе.</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                              
                              <label className={`relative flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${duplicateAction === 'skip' ? 'bg-white border-amber-400 shadow-sm' : 'bg-white/50 border-transparent hover:bg-white'}`}>
                                <input type="radio" name="duplicateAction" value="skip" checked={duplicateAction === 'skip'} onChange={() => setDuplicateAction('skip')} className="hidden" />
                                <span className="font-bold text-gray-900 text-sm">Убрать повторы из рассылки</span>
                                <div className={`w-4 h-4 rounded-full border-4 ${duplicateAction === 'skip' ? 'border-amber-500 bg-white' : 'border-gray-300'}`}></div>
                              </label>

                              
                              <label className={`relative flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${duplicateAction === 'reuse' ? 'bg-white border-amber-400 shadow-sm' : 'bg-white/50 border-transparent hover:bg-white'}`}>
                                <input type="radio" name="duplicateAction" value="reuse" checked={duplicateAction === 'reuse'} onChange={() => setDuplicateAction('reuse')} className="hidden" />
                                <span className="font-bold text-gray-900 text-sm">Разослать на повторы</span>
                                <div className={`w-4 h-4 rounded-full border-4 ${duplicateAction === 'reuse' ? 'border-amber-500 bg-white' : 'border-gray-300'}`}></div>
                              </label>
                            </div>
                          </div>
                        )}

                        {campMessage.text && (
                          <div className={`p-4 rounded-2xl text-sm font-bold ${campMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            {campMessage.text}
                          </div>
                        )}

                        <div className="flex justify-between pt-4">
                          <button type="button" onClick={() => setWizardStep(2)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-8 rounded-2xl transition">Назад</button>
                          <button type="submit" disabled={isCreatingCamp || (!editingCampaignId && !csvFilePath) || isCheckingCsv} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-2xl shadow-sm transition disabled:opacity-50">
                            {isCreatingCamp ? 'Сохранение...' : editingCampaignId ? 'Сохранить изменения' : 'Создать кампанию'}
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        
        {activeTab === 'leads' && (
          <div className="space-y-6 flex flex-col h-full relative">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">База лидов</h2>
                <p className="text-sm text-gray-400">Mini-CRM: Всего контактов: {leadsTotal}</p>
              </div>
              <button
                onClick={handleExportLeads}
                disabled={isExporting || leadsTotal === 0}
                className="bg-white/75 border border-amber-200/60 hover:border-amber-300 text-gray-700 font-bold py-2.5 px-5 rounded-xl text-sm transition shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isExporting ? 'Экспорт...' : 'Экспорт в CSV'}
              </button>
            </div>

            
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col md:flex-row gap-4 justify-between items-center">
              <form onSubmit={handleLeadsSearch} className="flex gap-2 w-full md:w-1/2">
                <input
                  type="text"
                  placeholder="Поиск по Email, Имени или Кампании..."
                  value={leadsSearch}
                  onChange={(e) => setLeadsSearch(e.target.value)}
                  className="flex-grow bg-white/75 border border-amber-200/60 rounded-xl px-5 py-3 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all duration-200 outline-none text-sm font-medium"
                />
                <button type="submit" className="bg-gradient-to-b from-[#ffc163] to-[#FFAE40] hover:from-[#ffcf85] hover:to-[#ffb957] border border-[#FFAE40]/50 shadow-[0_4px_14px_rgb(255,174,64,0.4)] text-amber-950 px-5 py-3 rounded-xl font-bold shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 ease-out text-sm">
                  Найти
                </button>
              </form>

              <select
                value={leadsFilter}
                onChange={(e) => { setLeadsFilter(e.target.value); setLeadsPage(0); }}
                className="w-full md:w-48 bg-white/75 border border-amber-200/60 rounded-xl px-4 py-2.5 outline-none focus:border-amber-500 transition font-bold text-sm text-gray-700 cursor-pointer"
              >
                <option value="ALL">Все статусы</option>
                <option value="PENDING">Ожидают (PENDING)</option>
                <option value="SENT">Отправлено (SENT)</option>
                <option value="FAILED">Ошибка (FAILED)</option>
              </select>
            </div>

            
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex-grow overflow-auto h-[50vh]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 shadow-sm z-10">
                <tr className="text-gray-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">Email</th>
                    <th className="py-4 px-6">Name</th>
                    <th className="py-4 px-6">Company</th>
                    <th className="py-4 px-6">Статус</th>
                    <th className="py-4 px-6">Кампания</th>
                    <th className="py-4 px-6 text-right">Дата отправки</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400 font-medium">
                        Ничего не найдено
                      </td>
                    </tr>
                  ) : (
                    leads.map(lead => {
                      
                      let companyName = '-';
                      if (lead.custom_data) {
                        try {
                          const rowData = JSON.parse(lead.custom_data);
                          const companyKey = Object.keys(rowData).find(k => k.toLowerCase() === 'company');
                          if (companyKey && rowData[companyKey]) {
                            companyName = String(rowData[companyKey]).trim();
                          }
                        } catch (e) {
                          
                        }
                      }

                      return (
                        <tr key={lead.id} className="hover:bg-gray-50/50 transition">
                          <td className="py-4 px-6 font-semibold text-gray-900 truncate max-w-[200px]">{lead.email}</td>
                          <td className="py-4 px-6 text-gray-600 truncate max-w-[150px]">{lead.name || '-'}</td>
                          <td className="py-4 px-6 text-gray-600 truncate max-w-[150px]" title={companyName}>{companyName}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${lead.status === 'SENT' ? 'bg-green-100 text-green-700' :
                              lead.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                lead.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                              }`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-600 truncate max-w-[150px]">{lead.campaign_name || 'Удалена'}</td>
                          <td className="py-4 px-6 text-right text-xs text-gray-400">
                            {lead.sent_at ? new Date(lead.sent_at + 'Z').toLocaleString() : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            
            {leadsTotal > 0 && (
              <div className="flex justify-between items-center pt-2">
                <div className="text-sm font-bold text-gray-500">
                  Показано {leadsPage * 100 + 1}-{Math.min((leadsPage + 1) * 100, leadsTotal)} из {leadsTotal}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLeadsPage(p => Math.max(0, p - 1))}
                    disabled={leadsPage === 0}
                    className="bg-white/75 border border-amber-200/60 hover:border-amber-300 disabled:opacity-50 disabled:pointer-events-none text-gray-700 font-bold py-2 px-4 rounded-xl transition shadow-sm text-sm"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setLeadsPage(p => p + 1)}
                    disabled={(leadsPage + 1) * 100 >= leadsTotal}
                    className="bg-white/75 border border-amber-200/60 hover:border-amber-300 disabled:opacity-50 disabled:pointer-events-none text-gray-700 font-bold py-2 px-4 rounded-xl transition shadow-sm text-sm"
                  >
                    Вперед
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        
        {activeTab === 'logs' && (
          <div className="space-y-6 h-[80vh] flex flex-col">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Логи системы</h2>
                <p className="text-sm text-gray-400">Терминал процессов CampaignRunner</p>
              </div>
              <button
                onClick={handleExportLogs}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-xl text-sm transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-3 3m0 0l-3-3m3 3V4" /></svg>
                Скачать лог (.txt)
              </button>
            </div>

            <div className="bg-[#1e1e1e] rounded-3xl p-6 shadow-sm border border-gray-800 flex-grow overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500">Ожидание процессов...</div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-4 border-b border-gray-800 pb-1">
                      <span className="text-gray-500 shrink-0">[{new Date(log.created_at + 'Z').toLocaleTimeString()}]</span>
                      <span className={`shrink-0 w-20 font-bold ${log.type === 'SUCCESS' ? 'text-green-400' :
                        log.type === 'ERROR' ? 'text-red-400' :
                          log.type === 'WARNING' ? 'text-amber-400' :
                            'text-blue-400'
                        }`}>[{log.type}]</span>
                      <span className="text-gray-300">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Настройки</h2>
              <p className="text-sm text-gray-400">Управление приложением</p>
            </div>

            <div className="grid grid-cols-1 gap-6">

              
              <div className="space-y-6">
                
                <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)]">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Холодные рассылки</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-gray-800">Текст для отписки</div>
                      <div className="text-xs text-gray-500 mt-1 max-w-[220px]">Добавлять в конец писем фразу "If you don't want to receive these emails, just reply with 'stop'"</div>
                    </div>
                    <label className="flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" checked={enableUnsubscribe} onChange={toggleUnsubscribe} className="sr-only peer" />
                      <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#FFAE40] transition-colors relative after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4"></div>
                    </label>
                  </div>
                </div>

                
                <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.08)]">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Резервное копирование</h3>
                  <p className="text-sm text-gray-500 mb-6">Вы можете сохранить все свои кампании, ящики и шаблоны в один файл для переноса приложения или восстановить бэкап.</p>

                  <div className="flex flex-row gap-4">
                    <button onClick={handleExportDB} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 ease-out text-sm text-center">
                      Экспорт базы
                    </button>
                    <button onClick={handleImportDB} className="flex-1 bg-gradient-to-b from-[#ffc163] to-[#FFAE40] hover:from-[#ffcf85] hover:to-[#ffb957] border border-[#FFAE40]/50 shadow-[0_4px_14px_rgb(255,174,64,0.4)] text-amber-950 font-bold py-3.5 rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 ease-out text-sm text-center">
                      Импорт базы
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        
        {modalConfig.isOpen && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-6 border border-white/80 shadow-[0_8px_30px_rgb(251,191,36,0.15)] max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-3">
                {modalConfig.type === 'confirm' ? (
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900 leading-tight">{modalConfig.title}</h3>
              </div>

              <p className="text-sm text-gray-500 mb-6 pl-[52px]">{modalConfig.message}</p>

              <div className="flex gap-3 pl-[52px]">
                <button onClick={closeModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition text-sm">
                  {modalConfig.type === 'confirm' ? 'Отмена' : 'ОК'}
                </button>
                {modalConfig.type === 'confirm' && (
                  <button onClick={modalConfig.onConfirm} className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 rounded-xl shadow-sm transition text-sm">
                    Подтвердить
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        
        {updateInfo.status !== 'idle' && (
          <div className="fixed bottom-6 right-6 bg-gray-900 text-white rounded-2xl p-5 shadow-2xl border border-gray-700 z-[100] flex flex-col gap-3 max-w-sm animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-3">
              {updateInfo.status === 'downloading' ? (
                <svg className="w-5 h-5 text-amber-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
              <div className="font-bold text-sm leading-tight">{updateInfo.message}</div>
            </div>

            {updateInfo.status === 'ready' && (
              <button
                onClick={() => window.api.installUpdate()}
                className="mt-1 w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-2.5 rounded-xl transition text-sm text-center"
              >
                Перезапустить и Установить
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}