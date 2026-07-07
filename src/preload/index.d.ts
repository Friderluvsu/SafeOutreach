import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ping: () => Promise<string>
      minimize: () => void
      maximize: () => void  
      close: () => void
      
      startCampaign: (id: number) => Promise<{success: boolean, error?: string}>
      stopCampaign: (id: number) => Promise<{success: boolean, error?: string}>
      
      
      getInboxes: () => Promise<any[]>
      addInbox: (data: any) => Promise<{ success: boolean; error?: string }>
      deleteInbox: (id: number) => Promise<{ success: boolean; error?: string }>
      createCampaign: (data: any) => Promise<{ success: boolean, campaignId?: number, leadsCount?: number, error?: string }>;
      updateCampaign: (data: any) => Promise<{ success: boolean, addedLeads?: number, error?: string }>;
      getCampaigns: () => Promise<any[]>;
      getStats: () => Promise<{ sent: number, pending: number, inboxes: number }>;
      selectCsv: () => Promise<string | null>;
      selectTemplateFile: () => Promise<string | null>;
      getLogs: () => Promise<any[]>;
      deleteCampaign: (id: number) => Promise<{ success: boolean; error?: string }>;
      checkCsvDuplicates: (csvFilePath: string) => Promise<{ success: boolean, duplicateCount?: number, exampleCampaign?: string, error?: string }>;
      exportLogs: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
      getTemplates: () => Promise<any[]>;
      addTemplate: (data: { type: string, group_name: string, content: string }) => Promise<{ success: boolean; id?: number; error?: string }>;
      deleteTemplate: (id: number) => Promise<{ success: boolean; error?: string }>;
      importTemplatesBulk: (type: 'SUBJECT' | 'BODY') => Promise<{ success: boolean; canceled?: boolean; count?: number; error?: string }>;
      deleteAllTemplates: (type: 'SUBJECT' | 'BODY') => Promise<{ success: boolean; error?: string }>;
      
      getLeads: (filters: {searchQuery: string, statusFilter: string, offset: number}) => Promise<any>;
      exportLeadsToCsv: (filters: {searchQuery: string, statusFilter: string}) => Promise<any>;
      updateInbox: (data: any) => Promise<{ success: boolean; error?: string }>;
      getSystemSetting: (key: string) => Promise<string | null>;
      setSystemSetting: (key: string, value: string) => Promise<{ success: boolean }>;
      exportDatabase: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
      importDatabase: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
    }
  }
}