// apps/web/pages/settings.tsx - Version Finale avec gestion URL tab
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

// =============================================
//              CONSTANTS
// =============================================
const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 
  'Europe/Paris', 'Asia/Dubai', 'Asia/Tokyo', 'America/Montreal', 'America/Toronto'
];

const CURRENCIES = ['USD', 'EUR', 'CAD', 'GBP', 'JPY'];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' }
];

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'trading', label: 'Trading' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy' },
] as const;

const TRADING_SECTIONS = [
  {
    key: 'instruments',
    title: 'Instruments',
    tooltip: 'Manage financial instruments for your trades (e.g., EUR/USD, AAPL, Gold)',
    placeholder: 'Add instrument'
  },
  {
    key: 'patterns',
    title: 'Patterns',
    tooltip: 'Create custom trading patterns to categorize your strategies (e.g., Breakout, Support/Resistance)',
    placeholder: 'Add pattern'
  },
  {
    key: 'mediaTags',
    title: 'Media Tags',
    tooltip: 'Organize your trade screenshots and documents with custom tags (e.g., entry-signal, chart-analysis)',
    placeholder: 'Add media tag'
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

const TabButton = ({ active, onClick, children }: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode 
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
      active
        ? 'bg-[var(--primary)] text-white'
        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
    }`}
  >
    {children}
  </button>
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
        <option key={option.value || option} value={option.value || option}>
          {option.label || option}
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

const MessageAlert = ({ type, message }: { type: 'success' | 'error'; message: string }) => (
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
  const { t } = useTranslation('common');
  const { setTheme } = useTheme();

  // =============================================
  //              STATE MANAGEMENT
  // =============================================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [accounts, setAccounts] = useState<Account[]>([]);
  
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
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return 'Password must contain lowercase, uppercase, and number';
    }
    return null;
  }, []);

  const validateBeRange = useCallback((min: string, max: string): string | null => {
    const minVal = parseFloat(min);
    const maxVal = parseFloat(max);
    
    if (isNaN(minVal) || isNaN(maxVal)) return 'Please enter valid numbers';
    if (minVal >= maxVal) return 'Minimum must be less than maximum';
    if (minVal < -100 || maxVal > 100) return 'Values must be between -100% and 100%';
    
    return null;
  }, []);

  // =============================================
  //              TAB MANAGEMENT
  // =============================================
  
  // ✅ NOUVEAU: Gérer l'onglet depuis l'URL
  useEffect(() => {
    const { tab } = router.query;
    if (tab && typeof tab === 'string') {
      const validTabs: TabType[] = ['general', 'trading', 'notifications', 'profile', 'security', 'privacy', 'accounts'];
      if (validTabs.includes(tab as TabType)) {
        setActiveTab(tab as TabType);
      }
    } else {
      // ✅ Si aucun paramètre tab, ouvrir sur 'general' par défaut
      setActiveTab('general');
    }
  }, [router.query]);

  // ✅ NOUVEAU: Fonction pour changer d'onglet avec mise à jour URL
  const handleTabChange = useCallback((newTab: TabType) => {
    setActiveTab(newTab);
    // Mettre à jour l'URL sans reload de la page
    router.push(`/settings?tab=${newTab}`, undefined, { shallow: true });
  }, [router]);

  // =============================================
  //              API FUNCTIONS
  // =============================================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await api.get('/auth/me');
      
      const [generalRes, tradingRes, profileRes, accountsRes] = await Promise.all([
        api.get('/generalSettings').catch(() => ({ data: {} })),
        api.get('/tradingSettings').catch(() => ({ data: {} })),
        api.get('/profile').catch(() => ({ data: {} })),
        api.get('/accounts').catch(() => ({ data: [] })),
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
      await api.post(endpoint, data);
      if (localUpdate) localUpdate();
      showMessage('Settings updated successfully');
    } catch (err) {
      console.error('Update failed:', err);
      showMessage('Failed to update settings', 'error');
    }
  }, [showMessage]);

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
      showMessage('Please enter a value', 'error');
      return;
    }

    if (settings[type].includes(value)) {
      showMessage('Item already exists', 'error');
      return;
    }

    try {
      await api.post(`/tradingSettings/${type}/add`, { name: value });
      setSettings(s => ({ ...s, [type]: [...s[type], value] }));
      setNewItems(prev => ({ ...prev, [key]: '' }));
      showMessage(`${type.slice(0, -1)} added successfully`);
    } catch (err) {
      showMessage(`Failed to add ${type.slice(0, -1)}`, 'error');
    }
  }, [newItems, settings, showMessage]);

  const handleDeleteItem = useCallback(async (type: 'instruments' | 'patterns' | 'mediaTags', name: string) => {
    try {
      await api.post(`/tradingSettings/${type}/delete`, { name });
      setSettings(s => ({ ...s, [type]: s[type].filter(item => item !== name) }));
      showMessage(`${type.slice(0, -1)} deleted successfully`);
    } catch (err) {
      showMessage(`Failed to delete ${type.slice(0, -1)}`, 'error');
    }
  }, [showMessage]);

  const handleBeRangeUpdate = useCallback(async () => {
    const validationError = validateBeRange(beRange.min, beRange.max);
    if (validationError) {
      showMessage(validationError, 'error');
      return;
    }

    const min = parseFloat(beRange.min);
    const max = parseFloat(beRange.max);

    try {
      await api.post('/tradingSettings/beRange/update', { beMin: min, beMax: max });
      setSettings(s => ({ ...s, beMin: min, beMax: max }));
      showMessage('Break-even range updated successfully');
    } catch (err) {
      showMessage('Failed to update break-even range', 'error');
    }
  }, [beRange, showMessage, validateBeRange]);

  const handlePasswordChange = useCallback(async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('Please fill all password fields', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('New passwords do not match', 'error');
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      showMessage(validationError, 'error');
      return;
    }

    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showMessage('Password changed successfully');
    } catch (err) {
      showMessage('Failed to change password', 'error');
    }
  }, [passwordForm, showMessage, validatePassword]);

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
    loadData();
  }, [loadData]);

  // =============================================
  //              RENDER
  // =============================================
  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[var(--background)] dark:text-[var(--text)]">
      <h1 className="text-3xl font-bold">Settings</h1>
      
      {/* Messages */}
      {error && <MessageAlert type="error" message={error} />}
      {success && <MessageAlert type="success" message={success} />}

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)} // ✅ Utilise la nouvelle fonction
          >
            {tab.label}
          </TabButton>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <Title tooltip="Choose how the application appears: light theme, dark theme, or follow your system preference">
                Display Mode
              </Title>
              <Select
                value={settings.displayMode}
                onChange={(e: any) => handleDisplayMode(e.target.value)}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' }
                ]}
              />
            </Card>

            <Card>
              <Title tooltip="Select your preferred language for the application interface">
                Language
              </Title>
              <Select
                value={settings.language}
                onChange={(e: any) => handleGeneralSetting('language', e.target.value, '/generalSettings/language')}
                options={LANGUAGES}
              />
            </Card>

            <Card>
              <Title tooltip="Set your local timezone to display dates and times accurately">
                Timezone
              </Title>
              <Select
                value={settings.timezone}
                onChange={(e: any) => handleGeneralSetting('timezone', e.target.value, '/generalSettings/timezone')}
                options={TIMEZONES}
              />
            </Card>

            <Card>
              <Title tooltip="Choose your default currency for displaying monetary values throughout the application">
                Preferred Currency
              </Title>
              <Select
                value={settings.preferredCurrency}
                onChange={(e: any) => handleGeneralSetting('preferredCurrency', e.target.value, '/generalSettings/currency')}
                options={CURRENCIES}
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
                  <p className="text-slate-500 mb-4">No {section.key} configured</p>
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
                    Add
                  </button>
                </div>
              </Card>
            ))}

            <Card>
              <Title tooltip="Set the percentage range around breakeven point for trade analysis (-0.2% to +0.3% means trades within this range are considered breakeven)">
                Break‑Even Range
              </Title>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <label className="block text-sm font-medium mb-1">Minimum (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="p-2 border rounded w-28 dark:bg-[var(--background-2)] dark:border-slate-600"
                    value={beRange.min}
                    onChange={(e) => setBeRange(prev => ({ ...prev, min: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Maximum (%)</label>
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
                  Save
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Current: {settings.beMin}% to {settings.beMax}%
              </p>
            </Card>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <Card>
            <Title tooltip="Configure which types of notifications you want to receive via email, push, or in-app alerts">
              Notification Preferences
            </Title>
            <div className="space-y-4">
              {Object.entries(settings.notificationPreferences).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-sm font-medium capitalize">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </label>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => handleNotificationToggle(key, e.target.checked)}
                    className="h-4 w-4 text-[var(--primary)] rounded"
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <Card>
            <Title tooltip="View your personal information. Contact your administrator to make changes to these fields">
              Personal Information
            </Title>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(userProfile).map(([key, value]) => (
                <Input
                  key={key}
                  label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  type={key === 'email' ? 'email' : 'text'}
                  value={value}
                  className="bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed"
                  readOnly
                  disabled
                />
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                📝 Profile information is read-only. Contact your administrator to make changes.
              </p>
            </div>
          </Card>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <Card>
            <Title tooltip="Update your password to keep your account secure. Use a strong password with at least 8 characters">
              Change Password
            </Title>
            <div className="space-y-4 max-w-md">
              <Input
                label="Current Password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e: any) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
              />
              <Input
                label="New Password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e: any) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e: any) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
              <button
                onClick={handlePasswordChange}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                disabled={!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              >
                Change Password
              </button>
            </div>
          </Card>
        )}

        {/* Privacy Tab */}
        {activeTab === 'privacy' && (
          <Card>
            <Title tooltip="Control who can see your profile and trading data, and manage your data preferences">
              Privacy Preferences
            </Title>
            <div className="space-y-4">
              <Select
                label="Profile Visibility"
                value={settings.privacySettings.profileVisibility}
                onChange={(e: any) => handlePrivacyToggle('profileVisibility', e.target.value)}
                options={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                  { value: 'friends', label: 'Friends Only' }
                ]}
              />
              
              {[
                { key: 'sharePerformance', label: 'Share Performance Data' },
                { key: 'allowDataExport', label: 'Allow Data Export' },
                { key: 'marketingEmails', label: 'Marketing Emails' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <label className="text-sm font-medium">{item.label}</label>
                  <input
                    type="checkbox"
                    checked={settings.privacySettings[item.key as keyof typeof settings.privacySettings] as boolean}
                    onChange={(e) => handlePrivacyToggle(item.key, e.target.checked)}
                    className="h-4 w-4 text-[var(--primary)] rounded"
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <Card>
            <Title tooltip="Select which account will be used by default when recording expenses and withdrawals">
              Default Expense Withdrawal Account
            </Title>
            <Select
              value={settings.defaultExpenseWithdrawalAccountId || ''}
              onChange={(e: any) => handleDefaultAccount(e.target.value)}
              options={[
                { value: '', label: 'No default account' },
                ...accounts.map(account => ({
                  value: account.id,
                  label: `${account.name} (${account.accountType})`
                }))
              ]}
            />
            <p className="text-sm text-slate-500 mt-2">
              This account will be used by default when recording expenses
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  };
}