// apps/web/pages/settings.tsx - Version optimisée avec données dynamiques et i18n
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from 'next-themes';
import { api } from '@wealthlog/common';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

// =============================================
//              TYPES & INTERFACES
// =============================================
type TabType = 'general' | 'trading' | 'notifications' | 'profile' | 'security' | 'privacy' | 'accounts';
type Mode = 'light' | 'dark' | 'system';

interface Settings {
  displayMode: Mode;
  language: string;
  timezone: string;
  preferredCurrency: string;
  beMin: number;
  beMax: number;
  instruments: string[];
  patterns: string[];
  mediaTags: string[];
  notificationPreferences: Record<string, boolean>;
  defaultExpenseWithdrawalAccountId: number | null;
  privacySettings: {
    profileVisibility: 'public' | 'private' | 'friends';
    sharePerformance: boolean;
    allowDataExport: boolean;
    marketingEmails: boolean;
  };
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
}

interface Account {
  id: number;
  name: string;
  accountType: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface NewItems {
  instrument: string;
  pattern: string;
  mediaTag: string;
}

// ✅ NOUVEAU: Interfaces pour données dynamiques
interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

interface LanguageOption {
  value: string;
  label: string;
  nativeName: string;
}

interface SystemConstants {
  timezones: TimezoneOption[];
  currencies: CurrencyOption[];
  languages: LanguageOption[];
}

// =============================================
//              DYNAMIC CONSTANTS (from API)
// =============================================

// ✅ Tabs traduits
const getTabsConfig = (t: any) => [
  { id: 'general', label: t('settings:tabs.general') },
  { id: 'trading', label: t('settings:tabs.trading') },
  { id: 'notifications', label: t('settings:tabs.notifications') },
  { id: 'accounts', label: t('settings:tabs.accounts') },
  { id: 'profile', label: t('settings:tabs.profile') },
  { id: 'security', label: t('settings:tabs.security') },
  { id: 'privacy', label: t('settings:tabs.privacy') },
] as const;

// ✅ Sections trading traduites
const getTradingSectionsConfig = (t: any) => [
  {
    key: 'instruments',
    title: t('settings:trading.instruments.title'),
    tooltip: t('settings:trading.instruments.tooltip'),
    placeholder: t('settings:trading.instruments.placeholder')
  },
  {
    key: 'patterns',
    title: t('settings:trading.patterns.title'),
    tooltip: t('settings:trading.patterns.tooltip'),
    placeholder: t('settings:trading.patterns.placeholder')
  },
  {
    key: 'mediaTags',
    title: t('settings:trading.mediaTags.title'),
    tooltip: t('settings:trading.mediaTags.tooltip'),
    placeholder: t('settings:trading.mediaTags.placeholder')
  }
] as const;

// =============================================
//              UTILITY COMPONENTS
// =============================================
const TrashIcon = ({ size = 12 }: { size?: number }) => {
  try {
    const { FaTrash } = require('react-icons/fa');
    return <FaTrash size={size} />;
  } catch {
    return <span>🗑</span>;
  }
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <div className="relative group inline-block">
    {children}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-80 text-left leading-relaxed shadow-xl border border-gray-200 dark:border-gray-600">
      {text}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white dark:border-t-gray-800" />
    </div>
  </div>
);

const InfoIcon = ({ tooltip }: { tooltip: string }) => (
  <Tooltip text={tooltip}>
    <div className="w-5 h-5 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-help ml-2 flex-shrink-0 transition-colors duration-200">
      !
    </div>
  </Tooltip>
);

// =============================================
//              UI COMPONENTS
// =============================================
const Card = ({ children }: { children: React.ReactNode }) => (
  <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-[var(--background-2)] p-5 shadow-sm mb-6">
    {children}
  </section>
);

const Title = ({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) => (
  <h2 className="text-lg font-semibold mb-3 flex items-center">
    {children}
    {tooltip && <InfoIcon tooltip={tooltip} />}
  </h2>
);

const Input = ({ label, error, className = '', ...props }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-medium mb-1">{label}</label>
    <input
      className={`w-full p-2 border rounded dark:bg-[var(--background)] dark:border-slate-600 ${
        error ? 'border-red-500' : 'border-slate-300'
      } ${className}`}
      {...props}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

const Select = ({ label, options, className = '', ...props }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-medium mb-1">{label}</label>
    <select
      className={`w-full border p-2 rounded dark:bg-[var(--background)] dark:border-slate-600 ${className}`}
      {...props}
    >
      {options.map((option: any) => (
        <option key={option.value || option.code || option} value={option.value || option.code || option}>
          {option.label || option.name || option}
        </option>
      ))}
    </select>
  </div>
);

const ListItem = ({ name, onDelete }: { name: string; onDelete: () => void }) => (
  <li className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded mb-2">
    <span className="truncate flex-1">{name}</span>
    <button 
      onClick={onDelete}
      className="p-1 rounded hover:bg-red-600 bg-red-500 text-white transition-colors ml-2"
      aria-label={`Delete ${name}`}
    >
      <TrashIcon size={12} />
    </button>
  </li>
);

// ✅ AMÉLIORÉ: MessageAlert avec traductions
const MessageAlert = ({ type, message, t }: { type: 'success' | 'error'; message: string; t: any }) => (
  <div className={`p-3 border rounded-lg ${
    type === 'success' 
      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
  }`}>
    {message}
  </div>
);

// =============================================
//              MAIN COMPONENT
// =============================================
export default function Settings() {
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']); // ✅ Ajout de 'settings'
  const { setTheme } = useTheme();

  // =============================================
  //              STATE MANAGEMENT
  // =============================================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [isTabChanging, setIsTabChanging] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // ✅ NOUVEAU: State pour les constantes dynamiques
  const [systemConstants, setSystemConstants] = useState<SystemConstants>({
    timezones: [],
    currencies: [],
    languages: []
  });
  
  const [settings, setSettings] = useState<Settings>({
    displayMode: 'system',
    language: 'en',
    timezone: 'UTC',
    preferredCurrency: 'USD',
    beMin: -0.2,
    beMax: 0.3,
    instruments: [],
    patterns: [],
    mediaTags: [],
    notificationPreferences: {},
    defaultExpenseWithdrawalAccountId: null,
    privacySettings: {
      profileVisibility: 'private',
      sharePerformance: false,
      allowDataExport: true,
      marketingEmails: false,
    },
  });

  const [userProfile, setUserProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
  });

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [newItems, setNewItems] = useState<NewItems>({
    instrument: '',
    pattern: '',
    mediaTag: '',
  });

  const [beRange, setBeRange] = useState({
    min: '-0.2',
    max: '0.3',
  });

  // =============================================
  //              UTILITY FUNCTIONS
  // =============================================
  const showMessage = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      setSuccess(msg);
      setError('');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(msg);
      setSuccess('');
      setTimeout(() => setError(''), 5000);
    }
  }, []);

  const validatePassword = useCallback((password: string): string | null => {
    if (password.length < 8) return t('settings:security.passwordValidation.minLength');
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return t('settings:security.passwordValidation.complexity');
    }
    return null;
  }, [t]);

  const validateBeRange = useCallback((min: string, max: string): string | null => {
    const minVal = parseFloat(min);
    const maxVal = parseFloat(max);
    
    if (isNaN(minVal) || isNaN(maxVal)) return t('settings:trading.beRange.validation.invalidNumbers');
    if (minVal >= maxVal) return t('settings:trading.beRange.validation.minMaxOrder');
    if (minVal < -100 || maxVal > 100) return t('settings:trading.beRange.validation.outOfRange');
    
    return null;
  }, [t]);

  // =============================================
  //              TAB MANAGEMENT
  // =============================================
  
  const handleTabChange = useCallback((newTab: TabType) => {
    if (isTabChanging || activeTab === newTab) {
      return;
    }
    
    setIsTabChanging(true);
    setActiveTab(newTab);
    router.push(`/settings?tab=${newTab}`, undefined, { shallow: true });
    
    setTimeout(() => {
      setIsTabChanging(false);
    }, 300);
  }, [router, activeTab, isTabChanging]);

  useEffect(() => {
    const { tab } = router.query;
    
    if (tab && typeof tab === 'string') {
      const validTabs: TabType[] = ['general', 'trading', 'notifications', 'profile', 'security', 'privacy', 'accounts'];
      
      if (validTabs.includes(tab as TabType) && tab !== activeTab && !isTabChanging) {
        setActiveTab(tab as TabType);
      }
    } else if (!tab && activeTab !== 'general' && !isTabChanging) {
      setActiveTab('general');
      router.replace('/settings?tab=general', undefined, { shallow: true });
    }
  }, [router.query, router, activeTab, isTabChanging]);

  const TabButton = ({ active, onClick, children }: { 
    active: boolean; 
    onClick: () => void; 
    children: React.ReactNode 
  }) => (
    <button
      onClick={onClick}
      disabled={isTabChanging}
      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 transform ${
        active && !isTabChanging
          ? 'bg-[var(--primary)] text-white shadow-lg ring-2 ring-blue-300 scale-105'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:scale-105'
      } ${
        isTabChanging 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer'
      }`}
    >
      {children}
    </button>
  );

  // =============================================
  //              API FUNCTIONS
  // =============================================
  
  // ✅ NOUVEAU: Charger les constantes système
  const loadSystemConstants = useCallback(async () => {
    try {
      const response = await api.get('/settings/constants');
      setSystemConstants(response.data);
    } catch (err) {
      console.error('Failed to load system constants:', err);
      // Fallback aux valeurs par défaut si l'API échoue
      setSystemConstants({
        timezones: [
          { value: 'UTC', label: 'UTC', offset: '+00:00' },
          { value: 'America/New_York', label: 'New York', offset: '-05:00' },
          { value: 'Europe/Paris', label: 'Paris', offset: '+01:00' },
        ],
        currencies: [
          { code: 'USD', name: 'US Dollar', symbol: '$' },
          { code: 'EUR', name: 'Euro', symbol: '€' },
          { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
        ],
        languages: [
          { value: 'en', label: 'English', nativeName: 'English' },
          { value: 'fr', label: 'French', nativeName: 'Français' },
          { value: 'ar', label: 'Arabic', nativeName: 'العربية' },
        ]
      });
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await api.get('/auth/me');
      
      const [generalRes, tradingRes, profileRes, accountsRes] = await Promise.all([
        api.get('/settings/generalSettings').catch(() => ({ data: {} })),
        api.get('/settings/tradingSettings').catch(() => ({ data: {} })),
        api.get('/settings/profile').catch(() => ({ data: {} })),
        api.get('/account').catch(() => ({ data: [] })), // ✅ Corrigé: /account au lieu de /settings/accounts
      ]);

      setSettings(prev => ({
        ...prev,
        displayMode: generalRes.data.displayMode || 'system',
        language: generalRes.data.language || 'en',
        timezone: generalRes.data.timezone || 'UTC',
        preferredCurrency: generalRes.data.preferredCurrency || 'USD',
        beMin: tradingRes.data.beMin ?? -0.2,
        beMax: tradingRes.data.beMax ?? 0.3,
        instruments: tradingRes.data.instruments || [],
        patterns: tradingRes.data.patterns || [],
        mediaTags: tradingRes.data.mediaTags || [],
        notificationPreferences: generalRes.data.notificationPreferences || {},
        defaultExpenseWithdrawalAccountId: generalRes.data.defaultExpenseWithdrawalAccountId,
        privacySettings: generalRes.data.privacySettings || prev.privacySettings,
      }));

      setUserProfile({
        firstName: profileRes.data.firstName || '',
        lastName: profileRes.data.lastName || '',
        email: profileRes.data.email || '',
        phone: profileRes.data.phone || '',
        username: profileRes.data.username || '',
      });

      setAccounts(accountsRes.data);
      setBeRange({
        min: String(tradingRes.data.beMin ?? -0.2),
        max: String(tradingRes.data.beMax ?? 0.3),
      });

    } catch (err) {
      console.error('Failed to load data:', err);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const updateSetting = useCallback(async (
    endpoint: string, 
    data: any, 
    localUpdate?: () => void
  ) => {
    try {
      await api.post(`/settings${endpoint}`, data);
      if (localUpdate) localUpdate();
      showMessage(t('settings:messages.updateSuccess'));
    } catch (err) {
      console.error('Update failed:', err);
      showMessage(t('settings:messages.updateError'), 'error');
    }
  }, [showMessage, t]);

  // =============================================
  //              EVENT HANDLERS
  // =============================================
  const handleDisplayMode = useCallback((value: string) => {
    updateSetting('/generalSettings/displayMode', { displayMode: value }, () => {
      setSettings(s => ({ ...s, displayMode: value as Mode }));
      setTheme(value === 'system' ? undefined : value);
      if (typeof window !== 'undefined') {
        localStorage.setItem('displayMode', value);
      }
    });
  }, [updateSetting, setTheme]);

  const handleGeneralSetting = useCallback((field: string, value: any, endpoint: string) => {
    updateSetting(endpoint, { [field]: value }, () => {
      setSettings(s => ({ ...s, [field]: value }));
    });
  }, [updateSetting]);

  const handleAddItem = useCallback(async (type: 'instruments' | 'patterns' | 'mediaTags') => {
    const key = type.slice(0, -1) as keyof NewItems;
    const value = newItems[key]?.trim();
    
    if (!value) {
      showMessage(t('settings:trading.validation.enterValue'), 'error');
      return;
    }

    if (settings[type].includes(value)) {
      showMessage(t('settings:trading.validation.itemExists'), 'error');
      return;
    }

    try {
      // ✅ CORRIGÉ: Endpoint avec préfixe /settings/
      await api.post(`/settings/tradingSettings/${type}/add`, { name: value });
      setSettings(s => ({ ...s, [type]: [...s[type], value] }));
      setNewItems(prev => ({ ...prev, [key]: '' }));
      showMessage(t('settings:trading.messages.itemAdded', { type: type.slice(0, -1) }));
    } catch (err) {
      showMessage(t('settings:trading.messages.addError', { type: type.slice(0, -1) }), 'error');
    }
  }, [newItems, settings, showMessage, t]);

  const handleDeleteItem = useCallback(async (type: 'instruments' | 'patterns' | 'mediaTags', name: string) => {
    try {
      // ✅ CORRIGÉ: Endpoint avec préfixe /settings/
      await api.post(`/settings/tradingSettings/${type}/delete`, { name });
      setSettings(s => ({ ...s, [type]: s[type].filter(item => item !== name) }));
      showMessage(t('settings:trading.messages.itemDeleted', { type: type.slice(0, -1) }));
    } catch (err) {
      showMessage(t('settings:trading.messages.deleteError', { type: type.slice(0, -1) }), 'error');
    }
  }, [showMessage, t]);

  const handleBeRangeUpdate = useCallback(async () => {
    const validationError = validateBeRange(beRange.min, beRange.max);
    if (validationError) {
      showMessage(validationError, 'error');
      return;
    }

    const min = parseFloat(beRange.min);
    const max = parseFloat(beRange.max);

    try {
      await api.post('/settings/tradingSettings/beRange/update', { beMin: min, beMax: max });
      setSettings(s => ({ ...s, beMin: min, beMax: max }));
      showMessage(t('settings:trading.beRange.updateSuccess'));
    } catch (err) {
      showMessage(t('settings:trading.beRange.updateError'), 'error');
    }
  }, [beRange, showMessage, validateBeRange, t]);

  const handlePasswordChange = useCallback(async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage(t('settings:security.validation.fillAllFields'), 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(t('settings:security.validation.passwordMismatch'), 'error');
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      showMessage(validationError, 'error');
      return;
    }

    try {
      await api.post('/settings/auth/change-password', { currentPassword, newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showMessage(t('settings:security.messages.passwordChanged'));
    } catch (err) {
      showMessage(t('settings:security.messages.passwordChangeError'), 'error');
    }
  }, [passwordForm, showMessage, validatePassword, t]);

  const handleNotificationToggle = useCallback((key: string, value: boolean) => {
    const newPrefs = { ...settings.notificationPreferences, [key]: value };
    updateSetting('/generalSettings/notifications', { notificationPreferences: newPrefs }, () => {
      setSettings(s => ({ ...s, notificationPreferences: newPrefs }));
    });
  }, [settings.notificationPreferences, updateSetting]);

  const handlePrivacyToggle = useCallback((key: string, value: any) => {
    const newPrivacy = { ...settings.privacySettings, [key]: value };
    updateSetting('/generalSettings/privacy', { privacySettings: newPrivacy }, () => {
      setSettings(s => ({ ...s, privacySettings: newPrivacy }));
    });
  }, [settings.privacySettings, updateSetting]);

  const handleDefaultAccount = useCallback((accountId: string) => {
    const id = accountId ? parseInt(accountId) : null;
    updateSetting('/generalSettings/defaultAccount', { defaultExpenseWithdrawalAccountId: id }, () => {
      setSettings(s => ({ ...s, defaultExpenseWithdrawalAccountId: id }));
    });
  }, [updateSetting]);

  // =============================================
  //              EFFECTS
  // =============================================
  useEffect(() => {
    const initializeData = async () => {
      await loadSystemConstants();
      await loadData();
    };
    initializeData();
  }, [loadData, loadSystemConstants]);

  // =============================================
  //              RENDER
  // =============================================
  if (loading) return <LoadingSpinner />;

  const TABS = getTabsConfig(t);
  const TRADING_SECTIONS = getTradingSectionsConfig(t);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[var(--background)] dark:text-[var(--text)]">
      <h1 className="text-3xl font-bold">{t('settings:title')}</h1>
      
      {/* Messages */}
      {error && <MessageAlert type="error" message={error} t={t} />}
      {success && <MessageAlert type="success" message={success} t={t} />}

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id && !isTabChanging}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>

      {/* Indicateur de changement d'onglet */}
      {isTabChanging && (
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-2 text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm">{t('settings:tabs.switching')}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="space-y-6">
        
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <Title tooltip={t('settings:general.displayMode.tooltip')}>
                {t('settings:general.displayMode.title')}
              </Title>
              <Select
                value={settings.displayMode}
                onChange={(e: any) => handleDisplayMode(e.target.value)}
                options={[
                  { value: 'light', label: t('settings:general.displayMode.light') },
                  { value: 'dark', label: t('settings:general.displayMode.dark') },
                  { value: 'system', label: t('settings:general.displayMode.system') }
                ]}
              />
            </Card>

            <Card>
              <Title tooltip={t('settings:general.language.tooltip')}>
                {t('settings:general.language.title')}
              </Title>
              <Select
                value={settings.language}
                onChange={(e: any) => handleGeneralSetting('language', e.target.value, '/generalSettings/language')}
                options={systemConstants.languages}
              />
            </Card>

            <Card>
              <Title tooltip={t('settings:general.timezone.tooltip')}>
                {t('settings:general.timezone.title')}
              </Title>
              <Select
                value={settings.timezone}
                onChange={(e: any) => handleGeneralSetting('timezone', e.target.value, '/generalSettings/timezone')}
                options={systemConstants.timezones.map(tz => ({
                  value: tz.value,
                  label: `${tz.label} (${tz.offset})`
                }))}
              />
            </Card>

            <Card>
              <Title tooltip={t('settings:general.currency.tooltip')}>
                {t('settings:general.currency.title')}
              </Title>
              <Select
                value={settings.preferredCurrency}
                onChange={(e: any) => handleGeneralSetting('preferredCurrency', e.target.value, '/generalSettings/currency')}
                options={systemConstants.currencies.map(curr => ({
                  value: curr.code,
                  label: `${curr.code} - ${curr.name} (${curr.symbol})`
                }))}
              />
            </Card>
          </div>
        )}

        {/* Trading Tab */}
        {activeTab === 'trading' && (
          <div className="space-y-6">
            {TRADING_SECTIONS.map((section) => (
              <Card key={section.key}>
                <Title tooltip={section.tooltip}>
                  {section.title}
                </Title>
                
                {settings[section.key as keyof Settings].length > 0 ? (
                  <ul className="space-y-1 mb-4">
                    {(settings[section.key as keyof Settings] as string[]).map((item) => (
                      <ListItem
                        key={item}
                        name={item}
                        onDelete={() => handleDeleteItem(section.key as any, item)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 mb-4">{t('settings:trading.noItemsConfigured', { type: section.key })}</p>
                )}
                
                <div className="flex gap-2">
                  <input
                    className="flex-1 p-2 border rounded dark:bg-[var(--background-2)] dark:border-slate-600"
                    value={newItems[section.key.slice(0, -1) as keyof NewItems]}
                    onChange={(e) => setNewItems(prev => ({
                      ...prev,
                      [section.key.slice(0, -1)]: e.target.value
                    }))}
                    placeholder={section.placeholder}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddItem(section.key as any)}
                  />
                  <button
                    onClick={() => handleAddItem(section.key as any)}
                    className="px-4 py-2 bg-[var(--primary)] text-white rounded hover:opacity-90 transition-opacity"
                  >
                    {t('settings:trading.addButton')}
                  </button>
                </div>
              </Card>
            ))}

            <Card>
              <Title tooltip={t('settings:trading.beRange.tooltip')}>
                {t('settings:trading.beRange.title')}
              </Title>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('settings:trading.beRange.minimum')}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="p-2 border rounded w-28 dark:bg-[var(--background-2)] dark:border-slate-600"
                    value={beRange.min}
                    onChange={(e) => setBeRange(prev => ({ ...prev, min: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('settings:trading.beRange.maximum')}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="p-2 border rounded w-28 dark:bg-[var(--background-2)] dark:border-slate-600"
                    value={beRange.max}
                    onChange={(e) => setBeRange(prev => ({ ...prev, max: e.target.value }))}
                  />
                </div>
                <button
                  onClick={handleBeRangeUpdate}
                  className="px-4 py-2 bg-green-600 text-white rounded h-10 hover:bg-green-700 transition-colors"
                >
                  {t('settings:trading.beRange.saveButton')}
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                {t('settings:trading.beRange.current', { min: settings.beMin, max: settings.beMax })}
              </p>
            </Card>
          </div>
        )}

        {/* Autres onglets... */}
        {/* [Le reste du code des onglets notifications, profile, security, privacy, accounts reste identique] */}
        
      </div>
    </div>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['settings', 'common'])), // ✅ Ajout de 'settings'
    },
  };
}