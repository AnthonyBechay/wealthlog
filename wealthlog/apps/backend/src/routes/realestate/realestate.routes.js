// src/routes/realestate/realestate.routes.js
const express = require("express");
const router = express.Router();
const { prisma } = require('../../lib/prisma');
const { authenticate } = require("../../middleware/authenticate");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure real estate upload directory exists
const realEstateUploadDir = path.join(process.cwd(), "uploads", "realEstate");
if (!fs.existsSync(realEstateUploadDir)) {
  fs.mkdirSync(realEstateUploadDir, { recursive: true });
}

// Multer config for real estate documents/images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/realEstate/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

/* ========================================================== */
/* PROPERTIES ROUTES                                          */
/* ========================================================== */

// GET /real-estate/properties - List all properties for user
router.get('/properties', authenticate, async (req, res) => {
  try {
    const userAccounts = await prisma.financialAccount.findMany({
      where: { 
        userId: req.user.userId,
        accountType: 'REAL_ESTATE'
      },
      select: { id: true },
    });
    const validAccountIds = userAccounts.map(a => a.id);

    const realEstateInvestments = await prisma.realEstateInvestment.findMany({
      where: {
        accountId: { in: validAccountIds }
      },
      include: {
        account: true,
        valuations: {
          orderBy: { valuationDate: 'desc' },
          take: 1
        },
        mortgage: true,
        expenses: {
          orderBy: { date: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform to match frontend interface
    const properties = realEstateInvestments.map(investment => {
      const latestValuation = investment.valuations[0];
      return {
        id: investment.id,
        name: `${investment.propertyType} - ${investment.propertyAddress}`,
        address: investment.propertyAddress,
        type: investment.propertyType.toUpperCase(),
        purchasePrice: investment.purchasePrice,
        currentValue: latestValuation ? latestValuation.valuationAmount : investment.currentValuation,
        purchaseDate: investment.purchaseDate.toISOString().slice(0, 10),
        status: investment.usage.toUpperCase() || 'OWNED',
        rentAmount: investment.category === 'RENTAL' ? 2000 : null, // You might want to add this field to schema
        mortgageBalance: investment.mortgage ? investment.mortgage.mortgageAmount : null
      };
    });

    res.json(properties);
  } catch (err) {
    console.error('Error fetching real estate properties:', err);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// POST /real-estate/properties - Create new property
router.post('/properties', authenticate, async (req, res) => {
  try {
    const {
      name,
      address,
      type,
      purchasePrice,
      currentValue,
      purchaseDate,
      status,
      rentAmount,
      mortgageBalance
    } = req.body;

    // Validation
    if (!name || !address || !purchasePrice || !currentValue || !purchaseDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find or create real estate account for user
    let realEstateAccount = await prisma.financialAccount.findFirst({
      where: {
        userId: req.user.userId,
        accountType: 'REAL_ESTATE'
      }
    });

    if (!realEstateAccount) {
      realEstateAccount = await prisma.financialAccount.create({
        data: {
          userId: req.user.userId,
          name: 'Real Estate Portfolio',
          accountType: 'REAL_ESTATE',
          balance: 0,
          currency: 'USD',
          isLiquid: false
        }
      });
    }

    // Create real estate investment
    const investment = await prisma.realEstateInvestment.create({
      data: {
        accountId: realEstateAccount.id,
        propertyAddress: address,
        propertyType: type.toLowerCase(),
        usage: status.toLowerCase(),
        category: rentAmount ? 'RENTAL' : 'PERSONAL',
        purchaseDate: new Date(purchaseDate),
        purchasePrice: parseFloat(purchasePrice),
        currentValuation: parseFloat(currentValue)
      }
    });

    // Create initial valuation
    await prisma.realEstateValuation.create({
      data: {
        realEstateInvestmentId: investment.id,
        valuationDate: new Date(purchaseDate),
        valuationAmount: parseFloat(currentValue)
      }
    });

    // Create mortgage if provided
    if (mortgageBalance && mortgageBalance > 0) {
      await prisma.mortgage.create({
        data: {
          realEstateInvestmentId: investment.id,
          mortgageAmount: parseFloat(mortgageBalance),
          interestRate: 4.5, // Default rate, you might want to make this configurable
          termInYears: 30,
          startDate: new Date(purchaseDate),
          monthlyPayment: parseFloat(mortgageBalance) * 0.005 // Rough estimate
        }
      });
    }

    res.json({ 
      message: 'Property created successfully', 
      propertyId: investment.id 
    });

  } catch (err) {
    console.error('Error creating property:', err);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// PUT /real-estate/properties/:id - Update property
router.put('/properties/:id', authenticate, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id, 10);
    const {
      name,
      address,
      type,
      purchasePrice,
      currentValue,
      purchaseDate,
      status,
      rentAmount,
      mortgageBalance
    } = req.body;

    // Find and verify ownership
    const investment = await prisma.realEstateInvestment.findUnique({
      where: { id: propertyId },
      include: { 
        account: true,
        mortgage: true 
      }
    });

    if (!investment || investment.account.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized or property not found' });
    }

    // Update investment
    await prisma.realEstateInvestment.update({
      where: { id: propertyId },
      data: {
        propertyAddress: address,
        propertyType: type.toLowerCase(),
        usage: status.toLowerCase(),
        category: rentAmount ? 'RENTAL' : 'PERSONAL',
        purchaseDate: new Date(purchaseDate),
        purchasePrice: parseFloat(purchasePrice),
        currentValuation: parseFloat(currentValue)
      }
    });

    // Update valuation if different
    const latestValuation = await prisma.realEstateValuation.findFirst({
      where: { realEstateInvestmentId: propertyId },
      orderBy: { valuationDate: 'desc' }
    });

    if (!latestValuation || latestValuation.valuationAmount !== parseFloat(currentValue)) {
      await prisma.realEstateValuation.create({
        data: {
          realEstateInvestmentId: propertyId,
          valuationDate: new Date(),
          valuationAmount: parseFloat(currentValue)
        }
      });
    }

    // Handle mortgage
    if (mortgageBalance && mortgageBalance > 0) {
      if (investment.mortgage) {
        await prisma.mortgage.update({
          where: { realEstateInvestmentId: propertyId },
          data: {
            mortgageAmount: parseFloat(mortgageBalance),
            monthlyPayment: parseFloat(mortgageBalance) * 0.005
          }
        });
      } else {
        await prisma.mortgage.create({
          data: {
            realEstateInvestmentId: propertyId,
            mortgageAmount: parseFloat(mortgageBalance),
            interestRate: 4.5,
            termInYears: 30,
            startDate: new Date(purchaseDate),
            monthlyPayment: parseFloat(mortgageBalance) * 0.005
          }
        });
      }
    } else if (investment.mortgage) {
      // Remove mortgage if balance is 0
      await prisma.mortgage.delete({
        where: { realEstateInvestmentId: propertyId }
      });
    }

    res.json({ message: 'Property updated successfully' });

  } catch (err) {
    console.error('Error updating property:', err);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// DELETE /real-estate/properties/:id - Delete property
router.delete('/properties/:id', authenticate, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id, 10);
    console.log('Deleting property ID:', propertyId); // DEBUG

    // Find and verify ownership
    const investment = await prisma.realEstateInvestment.findUnique({
      where: { id: propertyId },
      include: { account: true }
    });

    if (!investment || investment.account.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized or property not found' });
    }

    // Delete related records first
    await prisma.realEstateValuation.deleteMany({
      where: { realEstateInvestmentId: propertyId }
    });

    await prisma.mortgage.deleteMany({
      where: { realEstateInvestmentId: propertyId }
    });

    await prisma.expense.deleteMany({
      where: { realEstateInvestmentId: propertyId }
    });

    // Finally delete the investment
    await prisma.realEstateInvestment.delete({
      where: { id: propertyId }
    });

    res.json({ message: 'Property deleted successfully' });

  } catch (err) {
    console.error('Error deleting property:', err);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

/* ========================================================== */
/* EXPENSES ROUTES                                            */
/* ========================================================== */

// GET /real-estate/expenses - List all real estate expenses for user
router.get('/expenses', authenticate, async (req, res) => {
  try {
    const userAccounts = await prisma.financialAccount.findMany({
      where: { 
        userId: req.user.userId,
        accountType: 'REAL_ESTATE'
      },
      select: { id: true },
    });
    const validAccountIds = userAccounts.map(a => a.id);

    const realEstateInvestments = await prisma.realEstateInvestment.findMany({
      where: {
        accountId: { in: validAccountIds }
      },
      select: { id: true }
    });
    const validInvestmentIds = realEstateInvestments.map(i => i.id);

    const expenses = await prisma.expense.findMany({
      where: {
        realEstateInvestmentId: { in: validInvestmentIds }
      },
      include: {
        realEstateInvestment: true,
        expenseCategory: true,
        expenseSubcategory: true
      },
      orderBy: { date: 'desc' }
    });

    // Transform to match frontend interface
    const propertyExpenses = expenses.map(expense => ({
      id: expense.id,
      propertyId: expense.realEstateInvestmentId,
      type: expense.expenseCategory?.name?.toUpperCase() || 'OTHER',
      amount: expense.amount,
      description: expense.description || expense.expenseSubcategory?.name || 'Real Estate Expense',
      date: expense.date.toISOString().slice(0, 10)
    }));

    res.json(propertyExpenses);

  } catch (err) {
    console.error('Error fetching real estate expenses:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// POST /real-estate/expenses - Create new expense
router.post('/expenses', authenticate, async (req, res) => {
  try {
    const {
      propertyId,
      type,
      amount,
      description,
      date
    } = req.body;

    // Validation
    if (!propertyId || !amount || !description || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify property ownership
    const investment = await prisma.realEstateInvestment.findUnique({
      where: { id: parseInt(propertyId, 10) },
      include: { account: true }
    });

    if (!investment || investment.account.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized or property not found' });
    }

    // Find or create expense category
    let category = await prisma.expenseCategory.findFirst({
      where: {
        userId: req.user.userId,
        name: type || 'Real Estate'
      }
    });

    if (!category) {
      category = await prisma.expenseCategory.create({
        data: {
          userId: req.user.userId,
          name: type || 'Real Estate'
        }
      });
    }

    // Create expense
    const expense = await prisma.expense.create({
      data: {
        userId: req.user.userId,
        amount: parseFloat(amount),
        description: description,
        date: new Date(date),
        expenseCategoryId: category.id,
        realEstateInvestmentId: parseInt(propertyId, 10)
      }
    });

    res.json({ 
      message: 'Expense created successfully', 
      expenseId: expense.id 
    });

  } catch (err) {
    console.error('Error creating expense:', err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// DELETE /real-estate/expenses/:id - Delete expense
router.delete('/expenses/:id', authenticate, async (req, res) => {
  try {
    const expenseId = parseInt(req.params.id, 10);

    // Find and verify ownership
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId }
    });

    if (!expense || expense.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized or expense not found' });
    }

    await prisma.expense.delete({
      where: { id: expenseId }
    });

    res.json({ message: 'Expense deleted successfully' });

  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

/* ========================================================== */
/* VALUATIONS ROUTES                                          */
/* ========================================================== */

// POST /real-estate/properties/:id/valuations - Add new valuation
router.post('/properties/:id/valuations', authenticate, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id, 10);
    const { valuationAmount, valuationDate } = req.body;

    if (!valuationAmount) {
      return res.status(400).json({ error: 'Valuation amount is required' });
    }

    // Verify property ownership
    const investment = await prisma.realEstateInvestment.findUnique({
      where: { id: propertyId },
      include: { account: true }
    });

    if (!investment || investment.account.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized or property not found' });
    }

    // Create valuation
    const valuation = await prisma.realEstateValuation.create({
      data: {
        realEstateInvestmentId: propertyId,
        valuationAmount: parseFloat(valuationAmount),
        valuationDate: valuationDate ? new Date(valuationDate) : new Date()
      }
    });

    // Update current valuation on investment
    await prisma.realEstateInvestment.update({
      where: { id: propertyId },
      data: {
        currentValuation: parseFloat(valuationAmount)
      }
    });

    res.json({ 
      message: 'Valuation added successfully', 
      valuationId: valuation.id 
    });

  } catch (err) {
    console.error('Error adding valuation:', err);
    res.status(500).json({ error: 'Failed to add valuation' });
  }
});

/* ========================================================== */
/* MEDIA/DOCUMENTS ROUTES                                     */
/* ========================================================== */

// POST /real-estate/properties/:id/media - Upload documents/images
router.post('/properties/:id/media', 
  authenticate, 
  upload.array("documents", 10), 
  async (req, res) => {
    try {
      const propertyId = parseInt(req.params.id, 10);

      // Verify property ownership
      const investment = await prisma.realEstateInvestment.findUnique({
        where: { id: propertyId },
        include: { account: true }
      });

      if (!investment || investment.account.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Not authorized or property not found' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const uploadedFiles = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: path.join("uploads", "realEstate", file.filename),
        size: file.size
      }));

      res.json({
        message: 'Documents uploaded successfully',
        files: uploadedFiles
      });

    } catch (err) {
      console.error('Error uploading documents:', err);
      res.status(500).json({ error: 'Failed to upload documents' });
    }
  }
);

module.exports = router;