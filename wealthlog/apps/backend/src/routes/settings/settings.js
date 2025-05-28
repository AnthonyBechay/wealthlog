// apps/backend/src/routes/settings/settings.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { prisma } = require('../../lib/prisma');
const { authenticate } = require('../../middleware/authenticate');

// =============================================
//              HELPERS
// =============================================
async function getOrCreateUserSettings(userId) {
  let settings = await prisma.settings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        userId,
        beMin: -0.2,
        beMax: 0.3,
        preferredCurrency: 'USD',
        language: 'en',
        timezone: 'UTC',
        displayMode: 'light',
        notificationPreferences: {
          email: true,
          push: true,
          tradingAlerts: true,
          expenseReminders: true,
          realEstateUpdates: true,
          marketNews: false,
          weeklyReports: true,
          securityAlerts: true,
        },
        mediaTags: [],
      },
    });
  }
  return settings;
}

async function getTradingData(userId) {
  const [instruments, patterns, settings] = await Promise.all([
    prisma.financialInstrument.findMany({ where: { userId } }),
    prisma.tradingPattern.findMany({ where: { userId } }),
    prisma.settings.findUnique({ where: { userId } }),
  ]);
  return {
    instruments: instruments.map(i => i.name),
    patterns: patterns.map(p => p.name),
    mediaTags: settings?.mediaTags || [],
    beMin: settings?.beMin ?? -0.2,
    beMax: settings?.beMax ?? 0.3,
  };
}

// =============================================
//              GENERAL SETTINGS
// =============================================
router.get('/generalSettings', authenticate, async (req, res) => {
  try {
    const settings = await getOrCreateUserSettings(req.user.userId);
    res.json({
      displayMode: settings.displayMode,
      language: settings.language,
      timezone: settings.timezone,
      preferredCurrency: settings.preferredCurrency,
      notificationPreferences: settings.notificationPreferences,
      defaultExpenseWithdrawalAccountId: settings.defaultExpenseWithdrawalAccountId,
      privacySettings: settings.privacySettings || {
        profileVisibility: 'private',
        sharePerformance: false,
        allowDataExport: true,
        marketingEmails: false,
      },
    });
  } catch (err) {
    console.error('GET /generalSettings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.post('/generalSettings/displayMode', authenticate, async (req, res) => {
  try {
    const { displayMode } = req.body;
    if (!['light', 'dark', 'system'].includes(displayMode)) {
      return res.status(400).json({ error: 'Invalid display mode' });
    }

    await getOrCreateUserSettings(req.user.userId);
    const updated = await prisma.settings.update({
      where: { userId: req.user.userId },
      data: { displayMode },
    });
    
    res.json({ displayMode: updated.displayMode });
  } catch (error) {
    console.error('POST /generalSettings/displayMode error:', error);
    res.status(500).json({ error: 'Failed to update display mode' });
  }
});

router.post('/generalSettings/language', authenticate, async (req, res) => {
  try {
    const { language } = req.body;
    if (!['en', 'ar', 'fr'].includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }
    
    await getOrCreateUserSettings(req.user.userId);
    const updated = await prisma.settings.update({
      where: { userId: req.user.userId },
      data: { language },
    });
    
    res.json({ language: updated.language });
  } catch (error) {
    console.error('POST /generalSettings/language error:', error);
    res.status(500).json({ error: 'Failed to update language' });
  }
});

router.post('/generalSettings/timezone', authenticate, async (req, res) => {
  try {
    const { timezone } = req.body;
    if (!timezone) {
      return res.status(400).json({ error: 'Missing timezone' });
    }
    
    await getOrCreateUserSettings(req.user.userId);
    const updated = await prisma.settings.update({
      where: { userId: req.user.userId },
      data: { timezone },
    });
    
    res.json({ timezone: updated.timezone });
  } catch (error) {
    console.error('POST /generalSettings/timezone error:', error);
    res.status(500).json({ error: 'Failed to update timezone' });
  }
});

router.post('/generalSettings/currency', authenticate, async (req, res) => {
  try {
    const { preferredCurrency } = req.body;
    if (!['USD', 'EUR', 'CAD', 'GBP', 'JPY'].includes(preferredCurrency)) {
      return res.status(400).json({ error: 'Invalid currency' });
    }
    
    await getOrCreateUserSettings(req.user.userId);
    const updated = await prisma.settings.update({
      where: { userId: req.user.userId },
      data: { preferredCurrency },
    });
    
    res.json({ preferredCurrency: updated.preferredCurrency });
  } catch (error) {
    console.error('POST /generalSettings/currency error:', error);
    res.status(500).json({ error: 'Failed to update currency' });
  }
});

router.post('/generalSettings/notifications', authenticate, async (req, res) => {
  try {
    const { notificationPreferences } = req.body;
    if (!notificationPreferences || typeof notificationPreferences !== 'object') {
      return res.status(400).json({ error: 'Invalid notification preferences' });
    }
    
    await getOrCreateUserSettings(req.user.userId);
    const updated = await prisma.settings.update({
      where: { userId: req.user.userId },
      data: { notificationPreferences },
    });
    
    res.json({ notificationPreferences: updated.notificationPreferences });
  } catch (error) {
    console.error('POST /generalSettings/notifications error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

router.post('/generalSettings/privacy', authenticate, async (req, res) => {
  try {
    const { privacySettings } = req.body;
    if (!privacySettings || typeof privacySettings !== 'object') {
      return res.status(400).json({ error: 'Invalid privacy settings' });
    }
    
    await getOrCreateUserSettings(req.user.userId);
    const updated = await prisma.settings.update({
      where: { userId: req.user.userId },
      data: { privacySettings },
    });
    
    res.json({ privacySettings: updated.privacySettings });
  } catch (error) {
    console.error('POST /generalSettings/privacy error:', error);
    res.status(500).json({ error: 'Failed to update privacy' });
  }
});

router.post('/generalSettings/defaultAccount', authenticate, async (req, res) => {
  try {
    const { defaultExpenseWithdrawalAccountId } = req.body;
    
    if (defaultExpenseWithdrawalAccountId !== null) {
      const account = await prisma.financialAccount.findFirst({
        where: { id: defaultExpenseWithdrawalAccountId, userId: req.user.userId },
      });
      if (!account) return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    await getOrCreateUserSettings(req.user.userId);
    await prisma.settings.update({
      where: { userId: req.user.userId },
      data: { defaultExpenseWithdrawalAccountId },
    });
    
    res.json({ defaultExpenseWithdrawalAccountId });
  } catch (error) {
    console.error('POST /generalSettings/defaultAccount error:', error);
    res.status(500).json({ error: 'Failed to update default account' });
  }
});

// =============================================
//              PROFILE
// =============================================
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        username: true,
      },
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({
      ...user,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : '',
    });
  } catch (error) {
    console.error('GET /profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.post('/profile/update', authenticate, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, dateOfBirth, username } = req.body;
    
    // Check uniqueness
    if (email) {
      const exists = await prisma.user.findFirst({
        where: { email, NOT: { id: req.user.userId } },
      });
      if (exists) return res.status(400).json({ error: 'Email already in use' });
    }
    
    if (username) {
      const exists = await prisma.user.findFirst({
        where: { username, NOT: { id: req.user.userId } },
      });
      if (exists) return res.status(400).json({ error: 'Username already taken' });
    }
    
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (username !== undefined) updateData.username = username;
    if (dateOfBirth !== undefined) {
      updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }
    
    await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
    });
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('POST /profile/update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// =============================================
//              SECURITY
// =============================================
router.get('/security-settings', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { updatedAt: true },
    });
    
    res.json({
      twoFactorEnabled: false,
      lastPasswordChange: user?.updatedAt?.toISOString() || '',
      loginHistory: [
        {
          date: new Date().toISOString(),
          ip: '192.168.1.1',
          location: 'Quebec, Canada',
        },
      ],
    });
  } catch (error) {
    console.error('GET /security-settings error:', error);
    res.status(500).json({ error: 'Failed to fetch security settings' });
  }
});

router.post('/auth/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: hashedPassword, updatedAt: new Date() },
    });
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('POST /auth/change-password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.post('/auth/toggle-2fa', authenticate, async (req, res) => {
  try {
    const { enabled } = req.body;
    // Placeholder for 2FA implementation
    res.json({ 
      message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`,
      twoFactorEnabled: enabled,
    });
  } catch (error) {
    console.error('POST /auth/toggle-2fa error:', error);
    res.status(500).json({ error: 'Failed to toggle 2FA' });
  }
});

// =============================================
//              TRADING SETTINGS
// =============================================
router.get('/tradingSettings', authenticate, async (req, res) => {
  try {
    const data = await getTradingData(req.user.userId);
    res.json(data);
  } catch (e) {
    console.error('GET /tradingSettings error:', e);
    res.status(500).json({ error: 'Failed to fetch trading settings' });
  }
});

// Generic handler for adding/deleting trading items
router.post('/tradingSettings/:type/:action', authenticate, async (req, res) => {
  try {
    const { type, action } = req.params;
    const { name } = req.body;

    if (!name?.trim() && action === 'add') {
      return res.status(400).json({ error: `Missing ${type} name` });
    }

    if (type === 'instruments') {
      if (action === 'add') {
        await prisma.financialInstrument.upsert({
          where: { userId_name: { userId: req.user.userId, name: name.trim() } },
          update: {},
          create: { userId: req.user.userId, name: name.trim() },
        });
      } else if (action === 'delete') {
        await prisma.financialInstrument.delete({
          where: { userId_name: { userId: req.user.userId, name } },
        });
      }
    } else if (type === 'patterns') {
      if (action === 'add') {
        await prisma.tradingPattern.upsert({
          where: { userId_name: { userId: req.user.userId, name: name.trim() } },
          update: {},
          create: { userId: req.user.userId, name: name.trim() },
        });
      } else if (action === 'delete') {
        await prisma.tradingPattern.delete({
          where: { userId_name: { userId: req.user.userId, name } },
        });
      }
    } else if (type === 'mediaTags') {
      const settings = await getOrCreateUserSettings(req.user.userId);
      const current = Array.isArray(settings.mediaTags) ? [...settings.mediaTags] : [];
      
      if (action === 'add' && !current.includes(name.trim())) {
        current.push(name.trim());
      } else if (action === 'delete') {
        const index = current.indexOf(name);
        if (index > -1) current.splice(index, 1);
      }
      
      await prisma.settings.update({
        where: { userId: req.user.userId },
        data: { mediaTags: current },
      });
    }

    const data = await getTradingData(req.user.userId);
    res.json(data);
  } catch (error) {
    console.error(`POST /tradingSettings/${req.params.type}/${req.params.action} error:`, error);
    res.status(500).json({ error: `Failed to ${req.params.action} ${req.params.type}` });
  }
});

router.post('/tradingSettings/beRange/update', authenticate, async (req, res) => {
  try {
    const { beMin, beMax } = req.body;
    const min = parseFloat(beMin);
    const max = parseFloat(beMax);
    
    if (isNaN(min) || isNaN(max) || min >= max) {
      return res.status(400).json({ error: 'Invalid range values' });
    }
    
    await getOrCreateUserSettings(req.user.userId);
    await prisma.settings.update({
      where: { userId: req.user.userId },
      data: { beMin: min, beMax: max },
    });
    
    const data = await getTradingData(req.user.userId);
    res.json(data);
  } catch (e) {
    console.error('POST /tradingSettings/beRange/update error:', e);
    res.status(500).json({ error: 'Failed to update range' });
  }
});

// =============================================
//              DATA MANAGEMENT
// =============================================

// Data management placeholders
router.get('/data/export', authenticate, (req, res) => {
  res.json({ 
    message: 'Data export will be implemented',
    requestedAt: new Date().toISOString(),
  });
});

router.post('/data/delete-request', authenticate, (req, res) => {
  res.json({ 
    message: 'Deletion request submitted. Confirmation email will be sent.',
    requestedAt: new Date().toISOString(),
  });
});
// =============================================
//              SYSTEM CONSTANTS ROUTE (AJOUTER ÇA!)
// =============================================
router.get('/constants', async (req, res) => {
  try {
    console.log('📦 Loading system constants...');
    
    // ✅ Données hardcodées pour l'instant (sans DB)
    const constants = {
      timezones: [
        { value: 'UTC', label: 'UTC', offset: '+00:00' },
        { value: 'America/New_York', label: 'New York', offset: '-05:00' },
        { value: 'America/Los_Angeles', label: 'Los Angeles', offset: '-08:00' },
        { value: 'Europe/London', label: 'London', offset: '+00:00' },
        { value: 'Europe/Paris', label: 'Paris', offset: '+01:00' },
        { value: 'Asia/Dubai', label: 'Dubai', offset: '+04:00' },
        { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+09:00' },
        { value: 'America/Montreal', label: 'Montreal', offset: '-05:00' },
        { value: 'America/Toronto', label: 'Toronto', offset: '-05:00' },
      ],
      currencies: [
        { code: 'USD', name: 'US Dollar', symbol: '$' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
        { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
        { code: 'GBP', name: 'British Pound', symbol: '£' },
        { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
        { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
        { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
        { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
        { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
        { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س' },
      ],
      languages: [
        { value: 'en', label: 'English', nativeName: 'English' },
        { value: 'fr', label: 'French', nativeName: 'Français' },
        { value: 'ar', label: 'Arabic', nativeName: 'العربية' },
        { value: 'es', label: 'Spanish', nativeName: 'Español' },
        { value: 'de', label: 'German', nativeName: 'Deutsch' },
      ]
    };

    console.log('✅ Constants loaded successfully');
    res.json(constants);
    
  } catch (error) {
    console.error('❌ GET /constants error:', error);
    res.status(500).json({ error: 'Failed to fetch system constants' });
  }
});
module.exports = router;