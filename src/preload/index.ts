import { contextBridge, ipcRenderer } from 'electron'


const api = {
  ping: () => ipcRenderer.invoke('ping'),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  startCampaign: (id: number) => ipcRenderer.invoke('start-campaign', id),
  stopCampaign: (id: number) => ipcRenderer.invoke('stop-campaign', id),
  uploadCsv: (filePath: string, campaignId: number) => ipcRenderer.invoke('upload-csv', filePath, campaignId),
  
  
  getInboxes: () => ipcRenderer.invoke('getInboxes'),
  addInbox: (data: any) => ipcRenderer.invoke('addInbox', data),
  deleteInbox: (id: number) => ipcRenderer.invoke('deleteInbox', id),
  createCampaign: (data: any) => ipcRenderer.invoke('createCampaign', data),
  updateCampaign: (data: any) => ipcRenderer.invoke('updateCampaign', data),
  getCampaigns: () => ipcRenderer.invoke('getCampaigns'),
  getStats: () => ipcRenderer.invoke('getStats'),
  selectCsv: () => ipcRenderer.invoke('selectCsv'),
  selectTemplateFile: () => ipcRenderer.invoke('selectTemplateFile'),
  getLogs: () => ipcRenderer.invoke('getLogs'),
  deleteCampaign: (id: number) => ipcRenderer.invoke('deleteCampaign', id),
  checkCsvDuplicates: (csvFilePath: string) => ipcRenderer.invoke('checkCsvDuplicates', csvFilePath),
  exportLogs: () => ipcRenderer.invoke('exportLogs'),
  getTemplates: () => ipcRenderer.invoke('getTemplates'),
  addTemplate: (data: any) => ipcRenderer.invoke('addTemplate', data),
  deleteTemplate: (id: number) => ipcRenderer.invoke('deleteTemplate', id),
  toggleTemplateRandom: (id: number, isRandom: boolean) => ipcRenderer.invoke('toggleTemplateRandom', id, isRandom),
  importTemplatesBulk: (type: 'SUBJECT' | 'BODY') => ipcRenderer.invoke('importTemplatesBulk', type),
  deleteAllTemplates: (type: 'SUBJECT' | 'BODY') => ipcRenderer.invoke('deleteAllTemplates', type),
  
  onAppUpdate: (callback: any) => ipcRenderer.on('app-update', callback),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  getLeads: (filters: any) => ipcRenderer.invoke('getLeads', filters),
  exportLeadsToCsv: (filters: any) => ipcRenderer.invoke('exportLeadsToCsv', filters),
  updateInbox: (data: any) => ipcRenderer.invoke('updateInbox', data),
  verifyLicense: (key: string) => ipcRenderer.invoke('verify-license', key),
  getSystemSetting: (key: string) => ipcRenderer.invoke('getSystemSetting', key),
  setSystemSetting: (key: string, value: string) => ipcRenderer.invoke('setSystemSetting', key, value),
  exportDatabase: () => ipcRenderer.invoke('exportDatabase'),
  importDatabase: () => ipcRenderer.invoke('importDatabase'),
}

if (process.contextIsolated) {
  try {
    // exposeInMainWorld 
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Ошибка exposeInMainWorld:', error)
  }
} else {
  // @ts-ignore 
  window.api = api
}
