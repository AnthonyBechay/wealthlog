// apps/backend/src/routes/realEstate.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/authenticate');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const prisma = new PrismaClient();

// Configuration pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'real-estate');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limite à 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté.'));
    }
  }
});

// Middleware d'erreur
const errorHandler = (res, error) => {
  console.error('API Error:', error);
  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  if (error.code === 'P2002') {
    return res.status(400).json({ error: 'Unique constraint violation' });
  }
  return res.status(500).json({ 
    error: 'Internal server error', 
    details: error.message,
    code: error.code
  });
};

//-------------------------------------------------------
// ROUTES POUR LES PROPRIÉTÉS IMMOBILIÈRES
//-------------------------------------------------------

// GET - Récupérer une propriété spécifique
router.get('/investments/:id', authenticate, async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  
  try {
    const investment = await prisma.realEstateInvestment.findFirst({
      where: {
        id: parseInt(id),
        account: {
          userId: user.id
        }
      },
      include: {
        account: true,
        mortgage: true,
        valuations: {
          orderBy: { valuationDate: 'desc' }
        },
        expenses: {
          orderBy: { date: 'desc' }
        },
        documents: true,
        tenants: {
          include: { rentPayments: true }
        },
        insurancePolicies: true,
        financialProjections: true,
        renovations: true,
        maintenanceSchedules: true,
        realEstateLabels: {
          include: { label: true }
        }
      }
    });

    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }

    // Transformer les labels
    const labels = investment.realEstateLabels.map(rel => rel.label);

    return res.status(200).json({
      ...investment,
      labels
    });
  } catch (error) {
    return errorHandler(res, error);
  }
});

// GET - Récupérer toutes les propriétés
router.get('/investments', authenticate, async (req, res) => {
  const user = req.user;
  const { query } = req.query;
  
  try {
    const investments = await prisma.realEstateInvestment.findMany({
      where: {
        account: {
          userId: user.id
        },
        ...(query && {
          OR: [
            { propertyAddress: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } }
          ]
        })
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            accountType: true,
            currency: true
          }
        },
        mortgage: {
          select: {
            mortgageAmount: true,
            interestRate: true,
            monthlyPayment: true
          }
        },
        valuations: {
          orderBy: { valuationDate: 'desc' },
          take: 1
        },
        expenses: {
          orderBy: { date: 'desc' },
          take: 5
        },
        tenants: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            monthlyRent: true
          }
        },
        realEstateLabels: {
          include: { label: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Transformer les données
    const transformedInvestments = investments.map(investment => {
      const labels = investment.realEstateLabels.map(rel => rel.label);
      const monthlyRentalIncome = investment.tenants.reduce(
        (sum, tenant) => sum + tenant.monthlyRent, 0
      );
      
      return {
        ...investment,
        labels,
        monthlyRentalIncome,
        currentValuation: investment.valuations[0]?.valuationAmount || investment.currentValuation,
        realEstateLabels: undefined
      };
    });

    return res.status(200).json(transformedInvestments);
  } catch (error) {
    return errorHandler(res, error);
  }
});

// POST - Créer une nouvelle propriété
router.post('/investments', authenticate, async (req, res) => {
  const user = req.user;
  const { 
    accountId, 
    propertyAddress, 
    propertyType, 
    usage, 
    category, 
    purchaseDate, 
    purchasePrice, 
    currentValuation,
    squareFootage,
    yearBuilt,
    numberOfBedrooms,
    numberOfBathrooms,
    mortgage,
    labels = []
  } = req.body;

  try {
    // Vérifier que le compte appartient à l'utilisateur
    const account = await prisma.financialAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id
      }
    });

    if (!account) {
      return res.status(403).json({ error: 'Account not found or not authorized' });
    }

    // Créer la propriété avec une transaction
    const investment = await prisma.$transaction(async (tx) => {
      const newInvestment = await tx.realEstateInvestment.create({
        data: {
          propertyAddress,
          propertyType,
          usage,
          category,
          purchaseDate: new Date(purchaseDate),
          purchasePrice,
          currentValuation,
          squareFootage: squareFootage || null,
          yearBuilt: yearBuilt || null,
          numberOfBedrooms: numberOfBedrooms || null,
          numberOfBathrooms: numberOfBathrooms || null,
          account: {
            connect: { id: accountId }
          },
          valuations: {
            create: {
              valuationDate: new Date(purchaseDate),
              valuationAmount: purchasePrice
            }
          }
        }
      });

      // Créer le prêt si fourni
      if (mortgage) {
        await tx.mortgage.create({
          data: {
            mortgageAmount: mortgage.mortgageAmount,
            interestRate: mortgage.interestRate,
            monthlyPayment: mortgage.monthlyPayment,
            termInYears: mortgage.termInYears || 25,
            startDate: new Date(purchaseDate),
            realEstateInvestment: {
              connect: { id: newInvestment.id }
            }
          }
        });
      }

      // Ajouter les étiquettes
      if (labels.length > 0) {
        for (const labelId of labels) {
          await tx.realEstateInvestmentLabel.create({
            data: {
              realEstateInvestment: {
                connect: { id: newInvestment.id }
              },
              label: {
                connect: { id: labelId }
              }
            }
          });
        }
      }

      // Ajouter l'évaluation actuelle si différente
      if (currentValuation !== purchasePrice) {
        await tx.realEstateValuation.create({
          data: {
            valuationDate: new Date(),
            valuationAmount: currentValuation,
            realEstateInvestment: {
              connect: { id: newInvestment.id }
            }
          }
        });
      }

      return newInvestment;
    });

    // Récupérer la propriété complète
    const createdInvestment = await prisma.realEstateInvestment.findUnique({
      where: { id: investment.id },
      include: {
        account: true,
        mortgage: true,
        valuations: true,
        realEstateLabels: {
          include: { label: true }
        }
      }
    });

    // Transformer les labels
    const responseLabels = createdInvestment.realEstateLabels.map(rel => rel.label);

    return res.status(201).json({
      ...createdInvestment,
      labels: responseLabels
    });
  } catch (error) {
    return errorHandler(res, error);
  }
});

// PUT - Mettre à jour une propriété
router.put('/investments/:id', authenticate, async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { 
    accountId, 
    propertyAddress, 
    propertyType, 
    usage, 
    category, 
    purchaseDate, 
    purchasePrice, 
    currentValuation,
    squareFootage,
    yearBuilt,
    numberOfBedrooms,
    numberOfBathrooms,
    mortgage,
    labels = []
  } = req.body;
  
  try {
    // Vérifier que l'investissement appartient à l'utilisateur
    const existingInvestment = await prisma.realEstateInvestment.findFirst({
      where: {
        id: parseInt(id),
        account: {
          userId: user.id
        }
      }
    });

    if (!existingInvestment) {
      return res.status(403).json({ error: 'Investment not found or not authorized' });
    }

    // Mettre à jour avec une transaction
    await prisma.$transaction(async (tx) => {
      // Mettre à jour l'investissement
      await tx.realEstateInvestment.update({
        where: { id: parseInt(id) },
        data: {
          propertyAddress,
          propertyType,
          usage,
          category,
          purchaseDate: new Date(purchaseDate),
          purchasePrice,
          currentValuation,
          squareFootage: squareFootage || null,
          yearBuilt: yearBuilt || null,
          numberOfBedrooms: numberOfBedrooms || null,
          numberOfBathrooms: numberOfBathrooms || null,
          ...(accountId && {
            account: {
              connect: { id: accountId }
            }
          })
        }
      });

      // Gérer le prêt
      if (mortgage) {
        const existingMortgage = await tx.mortgage.findFirst({
          where: { realEstateInvestmentId: parseInt(id) }
        });

        if (existingMortgage) {
          await tx.mortgage.update({
            where: { id: existingMortgage.id },
            data: {
              mortgageAmount: mortgage.mortgageAmount,
              interestRate: mortgage.interestRate,
              monthlyPayment: mortgage.monthlyPayment,
              termInYears: mortgage.termInYears || existingMortgage.termInYears
            }
          });
        } else {
          await tx.mortgage.create({
            data: {
              mortgageAmount: mortgage.mortgageAmount,
              interestRate: mortgage.interestRate,
              monthlyPayment: mortgage.monthlyPayment,
              termInYears: mortgage.termInYears || 25,
              startDate: new Date(purchaseDate),
              realEstateInvestment: {
                connect: { id: parseInt(id) }
              }
            }
          });
        }
      } else {
        const existingMortgage = await tx.mortgage.findFirst({
          where: { realEstateInvestmentId: parseInt(id) }
        });
        
        if (existingMortgage) {
          await tx.mortgage.delete({
            where: { id: existingMortgage.id }
          });
        }
      }

      // Mettre à jour les étiquettes
      await tx.realEstateInvestmentLabel.deleteMany({
        where: { realEstateInvestmentId: parseInt(id) }
      });

      if (labels.length > 0) {
        for (const labelId of labels) {
          await tx.realEstateInvestmentLabel.create({
            data: {
              realEstateInvestment: {
                connect: { id: parseInt(id) }
              },
              label: {
                connect: { id: labelId }
              }
            }
          });
        }
      }
    });

    // Récupérer la propriété mise à jour
    const updatedInvestment = await prisma.realEstateInvestment.findUnique({
      where: { id: parseInt(id) },
      include: {
        account: true,
        mortgage: true,
        valuations: true,
        realEstateLabels: {
          include: { label: true }
        }
      }
    });

    // Transformer les labels
    const responseLabels = updatedInvestment.realEstateLabels.map(rel => rel.label);

    return res.status(200).json({
      ...updatedInvestment,
      labels: responseLabels
    });
  } catch (error) {
    return errorHandler(res, error);
  }
});

// DELETE - Supprimer une propriété
router.delete('/investments/:id', authenticate, async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  
  try {
    // Vérifier que l'investissement appartient à l'utilisateur
    const investment = await prisma.realEstateInvestment.findFirst({
      where: {
        id: parseInt(id),
        account: {
          userId: user.id
        }
      }
    });

    if (!investment) {
      return res.status(403).json({ error: 'Investment not found or not authorized' });
    }

    // Approche simplifiée: supprimer l'investissement directement
    await prisma.realEstateInvestment.delete({
      where: { id: parseInt(id) }
    });

    return res.status(200).json({ message: 'Investment deleted successfully' });
  } catch (error) {
    console.error(`Error deleting investment ${id}:`, error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      code: error.code
    });
  }
});

//-------------------------------------------------------
// ROUTES POUR LES DÉPENSES
//-------------------------------------------------------

// GET - Récupérer une dépense spécifique
router.get('/expenses/:id', authenticate, async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  
  try {
    const expense = await prisma.expense.findFirst({
      where: {
        id: parseInt(id),
        userId: user.id
      },
      include: {
        expenseCategory: true,
        expenseSubcategory: true,
        expenseLabels: {
          include: { label: true }
        },
        realEstateInvestment: {
          select: {
            id: true,
            propertyAddress: true
          }
        }
      }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    return res.status(200).json(expense);
  } catch (error) {
    return errorHandler(res, error);
  }
});

// GET - Récupérer les dépenses d'une propriété
router.get('/expenses', authenticate, async (req, res) => {
  const user = req.user;
  const { propertyId } = req.query;
  
  try {
    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }

    // Vérifier que la propriété appartient à l'utilisateur
    const property = await prisma.realEstateInvestment.findFirst({
      where: {
        id: parseInt(propertyId),
        account: { userId: user.id }
      }
    });

    if (!property) {
      return res.status(403).json({ error: 'Property not found or not authorized' });
    }

    const expenses = await prisma.expense.findMany({
      where: { realEstateInvestmentId: parseInt(propertyId) },
      include: {
        expenseCategory: true,
        expenseSubcategory: true,
        expenseLabels: {
          include: { label: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    return res.status(200).json(expenses);
  } catch (error) {
    return errorHandler(res, error);
  }
});

// POST - Ajouter une dépense
router.post('/expenses', authenticate, async (req, res) => {
  const user = req.user;
  const { 
    realEstateInvestmentId, 
    amount, 
    description, 
    date,
    category,
    expenseCategoryId,
    expenseSubcategoryId,
    withdrawalAccountId,
    labelIds = [] 
  } = req.body;

  try {
    // Vérifier que la propriété appartient à l'utilisateur
    if (realEstateInvestmentId) {
      const property = await prisma.realEstateInvestment.findFirst({
        where: {
          id: parseInt(realEstateInvestmentId),
          account: { userId: user.id }
        }
      });

      if (!property) {
        return res.status(403).json({ error: 'Property not found or not authorized' });
      }
    }

    // Gérer la catégorie
    let categoryId = expenseCategoryId;
    if (!categoryId && category) {
      let expenseCategory = await prisma.expenseCategory.findFirst({
        where: {
          name: category,
          userId: user.id
        }
      });

      if (!expenseCategory) {
        expenseCategory = await prisma.expenseCategory.create({
          data: {
            name: category,
            user: { connect: { id: user.id } }
          }
        });
      }

      categoryId = expenseCategory.id;
    }

    // Créer la dépense
    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount),
        description,
        date: new Date(date),
        user: { connect: { id: user.id } },
        expenseCategory: { connect: { id: categoryId || 1 } },
        ...(expenseSubcategoryId && {
          expenseSubcategory: { connect: { id: parseInt(expenseSubcategoryId) } }
        }),
        ...(realEstateInvestmentId && {
          realEstateInvestment: { connect: { id: parseInt(realEstateInvestmentId) } }
        }),
        ...(withdrawalAccountId && {
          withdrawalAccount: { connect: { id: parseInt(withdrawalAccountId) } }
        })
      }
    });

    // Ajouter les étiquettes
    if (labelIds.length > 0) {
      for (const labelId of labelIds) {
        await prisma.expenseLabel.create({
          data: {
            expense: { connect: { id: expense.id } },
            label: { connect: { id: parseInt(labelId) } }
          }
        });
      }
    }

    // Récupérer la dépense complète
    const createdExpense = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: {
        expenseCategory: true,
        expenseSubcategory: true,
        expenseLabels: {
          include: { label: true }
        },
        realEstateInvestment: {
          select: {
            id: true,
            propertyAddress: true
          }
        }
      }
    });

    return res.status(201).json(createdExpense);
  } catch (error) {
    return errorHandler(res, error);
  }
});

//-------------------------------------------------------
// ROUTES POUR LES ÉVALUATIONS
//-------------------------------------------------------

// GET - Récupérer les évaluations d'une propriété
router.get('/valuations', authenticate, async (req, res) => {
  const user = req.user;
  const { propertyId } = req.query;
  
  try {
    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }

    // Vérifier que la propriété appartient à l'utilisateur
    const property = await prisma.realEstateInvestment.findFirst({
      where: {
        id: parseInt(propertyId),
        account: { userId: user.id }
      }
    });

    if (!property) {
      return res.status(403).json({ error: 'Property not found or not authorized' });
    }

    const valuations = await prisma.realEstateValuation.findMany({
      where: { realEstateInvestmentId: parseInt(propertyId) },
      orderBy: { valuationDate: 'desc' }
    });

    return res.status(200).json(valuations);
  } catch (error) {
    return errorHandler(res, error);
  }
});

// POST - Ajouter une évaluation
router.post('/valuations', authenticate, async (req, res) => {
  const user = req.user;
  const { 
    realEstateInvestmentId, 
    valuationDate, 
    valuationAmount,
    valuationMethod
  } = req.body;

  try {
    // Vérifier que la propriété appartient à l'utilisateur
    const property = await prisma.realEstateInvestment.findFirst({
      where: {
        id: parseInt(realEstateInvestmentId),
        account: { userId: user.id }
      }
    });

    if (!property) {
      return res.status(403).json({ error: 'Property not found or not authorized' });
    }

    // Créer l'évaluation
    const valuation = await prisma.realEstateValuation.create({
      data: {
        valuationDate: new Date(valuationDate),
        valuationAmount: parseFloat(valuationAmount),
        valuationMethod,
        realEstateInvestment: { connect: { id: parseInt(realEstateInvestmentId) } }
      }
    });

    // Mettre à jour la valeur actuelle
    await prisma.realEstateInvestment.update({
      where: { id: parseInt(realEstateInvestmentId) },
      data: { currentValuation: parseFloat(valuationAmount) }
    });

    return res.status(201).json(valuation);
  } catch (error) {
    return errorHandler(res, error);
  }
});

//-------------------------------------------------------
// ROUTES POUR LES DOCUMENTS
//-------------------------------------------------------

// GET - Récupérer les documents d'une propriété
router.get('/documents', authenticate, async (req, res) => {
  const user = req.user;
  const { propertyId } = req.query;
  
  try {
    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }

    // Vérifier que la propriété appartient à l'utilisateur
    const property = await prisma.realEstateInvestment.findFirst({
      where: {
        id: parseInt(propertyId),
        account: { userId: user.id }
      }
    });

    if (!property) {
      return res.status(403).json({ error: 'Property not found or not authorized' });
    }

    const documents = await prisma.realEstateDocument.findMany({
      where: { realEstateInvestmentId: parseInt(propertyId) },
      orderBy: { uploadedDate: 'desc' }
    });

    return res.status(200).json(documents);
  } catch (error) {
    return errorHandler(res, error);
  }
});

// POST - Ajouter un document
router.post('/documents', authenticate, upload.single('file'), async (req, res) => {
  const user = req.user;
  const { 
    realEstateInvestmentId, 
    name, 
    documentType,
    description
  } = req.body;

  try {
    // Vérifier que la propriété appartient à l'utilisateur
    const property = await prisma.realEstateInvestment.findFirst({
      where: {
        id: parseInt(realEstateInvestmentId),
        account: { userId: user.id }
      }
    });

    if (!property) {
      return res.status(403).json({ error: 'Property not found or not authorized' });
    }

    // Vérifier si un fichier a été uploadé
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Créer le document
    const document = await prisma.realEstateDocument.create({
      data: {
        name,
        documentType,
        description,
        fileUrl: `/uploads/real-estate/${req.file.filename}`,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedDate: new Date(),
        realEstateInvestment: { connect: { id: parseInt(realEstateInvestmentId) } }
      }
    });

    return res.status(201).json(document);
  } catch (error) {
    return errorHandler(res, error);
  }
});

//-------------------------------------------------------
// ROUTES POUR LES LOCATAIRES
//-------------------------------------------------------

// GET - Récupérer les paiements d'un locataire
router.get('/tenants/:id/payments', authenticate, async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  
  try {
    // Vérifier que le locataire appartient à l'utilisateur
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: parseInt(id),
        realEstateInvestment: {
          account: { userId: user.id }
        }
      }
    });

    if (!tenant) {
      return res.status(403).json({ error: 'Tenant not found or not authorized' });
    }

    const payments = await prisma.rentPayment.findMany({
      where: { tenantId: parseInt(id) },
      orderBy: { dueDate: 'desc' }
    });

    return res.status(200).json(payments);
  } catch (error) {
    return errorHandler(res, error);
  }
});

// GET - Récupérer un locataire
router.get('/tenants/:id', authenticate, async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  
  try {
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: parseInt(id),
        realEstateInvestment: {
          account: { userId: user.id }
        }
      },
      include: {
        rentPayments: {
          orderBy: { dueDate: 'desc' }
        },
        maintenanceRequests: {
          orderBy: { requestDate: 'desc' }
        },
        documents: true
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    return res.status(200).json(tenant);
  } catch (error) {
    return errorHandler(res, error);
  }
});

// GET - Récupérer les locataires d'une propriété
router.get('/tenants', authenticate, async (req, res) => {
  const user = req.user;
  const { propertyId } = req.query;
  
  try {
    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }

    // Vérifier que la propriété appartient à l'utilisateur
    const property = await prisma.realEstateInvestment.findFirst({
      where: {
        id: parseInt(propertyId),
        account: { userId: user.id }
      }
    });

    if (!property) {
      return res.status(403).json({ error: 'Property not found or not authorized' });
    }

    const tenants = await prisma.tenant.findMany({
      where: { realEstateInvestmentId: parseInt(propertyId) },
      include: {
        rentPayments: {
          orderBy: { dueDate: 'desc' }
        }
      },
      orderBy: { leaseStartDate: 'desc' }
    });

    return res.status(200).json(tenants);
  } catch (error) {
    return errorHandler(res, error);
  }
});

// POST - Ajouter un locataire
router.post('/tenants', authenticate, async (req, res) => {
  const user = req.user;
  const { 
    realEstateInvestmentId, 
    name, 
    email,
    phone,
    secondaryContact,
    leaseStartDate,
    leaseEndDate,
    initialLeaseTermMonths,
    monthlyRent,
    securityDeposit,
    occupants,
    notes
  } = req.body;

  try {
    // Vérifier que la propriété appartient à l'utilisateur
    const property = await prisma.realEstateInvestment.findFirst({
      where: {
        id: parseInt(realEstateInvestmentId),
        account: { userId: user.id }
      }
    });

    if (!property) {
      return res.status(403).json({ error: 'Property not found or not authorized' });
    }

    // Créer le locataire
    const tenant = await prisma.tenant.create({
      data: {
        name,
        email,
        phone,
        secondaryContact,
        leaseStartDate: new Date(leaseStartDate),
        leaseEndDate: leaseEndDate ? new Date(leaseEndDate) : null,
        initialLeaseTermMonths: initialLeaseTermMonths ? parseInt(initialLeaseTermMonths) : null,
        monthlyRent: parseFloat(monthlyRent),
        securityDeposit: securityDeposit ? parseFloat(securityDeposit) : null,
occupants: occupants ? parseInt(occupants) : null,
       active: true,
       notes,
       realEstateInvestment: { connect: { id: parseInt(realEstateInvestmentId) } }
     }
   });

   return res.status(201).json(tenant);
 } catch (error) {
   return errorHandler(res, error);
 }
});

// PUT - Mettre à jour un locataire
router.put('/tenants/:id', authenticate, async (req, res) => {
 const user = req.user;
 const { id } = req.params;
 const { 
   name, 
   email,
   phone,
   secondaryContact,
   leaseStartDate,
   leaseEndDate,
   initialLeaseTermMonths,
   monthlyRent,
   securityDeposit,
   occupants,
   active,
   notes
 } = req.body;
 
 try {
   // Vérifier que le locataire appartient à l'utilisateur
   const tenant = await prisma.tenant.findFirst({
     where: {
       id: parseInt(id),
       realEstateInvestment: {
         account: { userId: user.id }
       }
     }
   });

   if (!tenant) {
     return res.status(403).json({ error: 'Tenant not found or not authorized' });
   }

   // Mettre à jour le locataire
   const updatedTenant = await prisma.tenant.update({
     where: { id: parseInt(id) },
     data: {
       name,
       email,
       phone,
       secondaryContact,
       leaseStartDate: leaseStartDate ? new Date(leaseStartDate) : undefined,
       leaseEndDate: leaseEndDate ? new Date(leaseEndDate) : null,
       initialLeaseTermMonths: initialLeaseTermMonths ? parseInt(initialLeaseTermMonths) : null,
       monthlyRent: monthlyRent ? parseFloat(monthlyRent) : undefined,
       securityDeposit: securityDeposit ? parseFloat(securityDeposit) : null,
       occupants: occupants ? parseInt(occupants) : null,
       active: active !== undefined ? active : true,
       notes
     },
     include: {
       rentPayments: {
         orderBy: { dueDate: 'desc' }
       }
     }
   });

   return res.status(200).json(updatedTenant);
 } catch (error) {
   return errorHandler(res, error);
 }
});

// POST - Ajouter un paiement de loyer
router.post('/tenants/:id/payments', authenticate, async (req, res) => {
 const user = req.user;
 const { id } = req.params;
 const { 
   amount, 
   dueDate,
   paidDate,
   status,
   paymentMethod,
   notes
 } = req.body;

 try {
   // Vérifier que le locataire appartient à l'utilisateur
   const tenant = await prisma.tenant.findFirst({
     where: {
       id: parseInt(id),
       realEstateInvestment: {
         account: { userId: user.id }
       }
     }
   });

   if (!tenant) {
     return res.status(403).json({ error: 'Tenant not found or not authorized' });
   }

   // Créer le paiement
   const payment = await prisma.rentPayment.create({
     data: {
       amount: parseFloat(amount),
       dueDate: new Date(dueDate),
       paidDate: paidDate ? new Date(paidDate) : null,
       status,
       paymentMethod,
       notes,
       tenant: { connect: { id: parseInt(id) } }
     }
   });

   return res.status(201).json(payment);
 } catch (error) {
   return errorHandler(res, error);
 }
});

//-------------------------------------------------------
// ROUTES POUR LES DEMANDES DE MAINTENANCE
//-------------------------------------------------------

// PUT - Mettre à jour une demande de maintenance
router.put('/maintenance/:id', authenticate, async (req, res) => {
 const user = req.user;
 const { id } = req.params;
 const { 
   title, 
   description,
   priority,
   status,
   scheduledDate,
   resolvedDate,
   estimatedCost,
   actualCost,
   assignedTo,
   notes
 } = req.body;
 
 try {
   // Vérifier que la demande appartient à l'utilisateur
   const request = await prisma.maintenanceRequest.findFirst({
     where: {
       id: parseInt(id),
       tenant: {
         realEstateInvestment: {
           account: { userId: user.id }
         }
       }
     }
   });

   if (!request) {
     return res.status(403).json({ error: 'Maintenance request not found or not authorized' });
   }

   // Mettre à jour la demande
   const updatedRequest = await prisma.maintenanceRequest.update({
     where: { id: parseInt(id) },
     data: {
       title,
       description,
       priority,
       status,
       scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
       resolvedDate: resolvedDate ? new Date(resolvedDate) : null,
       estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
       actualCost: actualCost ? parseFloat(actualCost) : null,
       assignedTo,
       notes
     }
   });

   return res.status(200).json(updatedRequest);
 } catch (error) {
   return errorHandler(res, error);
 }
});

// GET - Récupérer les demandes de maintenance
router.get('/maintenance', authenticate, async (req, res) => {
 const user = req.user;
 const { propertyId } = req.query;
 
 try {
   if (!propertyId) {
     return res.status(400).json({ error: 'Property ID is required' });
   }

   // Vérifier que la propriété appartient à l'utilisateur
   const property = await prisma.realEstateInvestment.findFirst({
     where: {
       id: parseInt(propertyId),
       account: { userId: user.id }
     }
   });

   if (!property) {
     return res.status(403).json({ error: 'Property not found or not authorized' });
   }

   // Récupérer les locataires
   const tenants = await prisma.tenant.findMany({
     where: { realEstateInvestmentId: parseInt(propertyId) },
     select: { id: true }
   });

   const tenantIds = tenants.map(tenant => tenant.id);

   // Récupérer les demandes
   const maintenanceRequests = await prisma.maintenanceRequest.findMany({
     where: {
       tenantId: { in: tenantIds }
     },
     include: {
       tenant: {
         select: { id: true, name: true }
       }
     },
     orderBy: { requestDate: 'desc' }
   });

   return res.status(200).json(maintenanceRequests);
 } catch (error) {
   return errorHandler(res, error);
 }
});

// POST - Ajouter une demande de maintenance
router.post('/maintenance', authenticate, async (req, res) => {
 const user = req.user;
 const { 
   tenantId, 
   title, 
   description,
   priority,
   status,
   estimatedCost,
   assignedTo
 } = req.body;

 try {
   // Vérifier que le locataire appartient à l'utilisateur
   const tenant = await prisma.tenant.findFirst({
     where: {
       id: parseInt(tenantId),
       realEstateInvestment: {
         account: { userId: user.id }
       }
     }
   });

   if (!tenant) {
     return res.status(403).json({ error: 'Tenant not found or not authorized' });
   }

   // Créer la demande
   const maintenanceRequest = await prisma.maintenanceRequest.create({
     data: {
       title,
       description,
       priority,
       status,
       requestDate: new Date(),
       estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
       assignedTo,
       tenant: { connect: { id: parseInt(tenantId) } }
     }
   });

   return res.status(201).json(maintenanceRequest);
 } catch (error) {
   return errorHandler(res, error);
 }
});

//-------------------------------------------------------
// ROUTES POUR LES PROJECTIONS FINANCIÈRES
//-------------------------------------------------------

// GET - Récupérer les projections d'une propriété
router.get('/projections', authenticate, async (req, res) => {
 const user = req.user;
 const { propertyId } = req.query;
 
 try {
   if (!propertyId) {
     return res.status(400).json({ error: 'Property ID is required' });
   }

   // Vérifier que la propriété appartient à l'utilisateur
   const property = await prisma.realEstateInvestment.findFirst({
     where: {
       id: parseInt(propertyId),
       account: { userId: user.id }
     }
   });

   if (!property) {
     return res.status(403).json({ error: 'Property not found or not authorized' });
   }

   const projections = await prisma.realEstateFinancialProjection.findMany({
     where: { realEstateInvestmentId: parseInt(propertyId) },
     orderBy: { projectionYear: 'asc' }
   });

   return res.status(200).json(projections);
 } catch (error) {
   return errorHandler(res, error);
 }
});

// POST - Ajouter une projection financière
router.post('/projections', authenticate, async (req, res) => {
 const user = req.user;
 const { 
   realEstateInvestmentId, 
   projectionYear, 
   expectedRentalIncome,
   expectedExpenses,
   expectedAppreciation,
   expectedCashFlow,
   roi,
   maintenanceReserve,
   vacancyRate,
   propertyTaxes,
   insuranceCosts,
   managementFees,
   utilities,
   notes
 } = req.body;

 try {
   // Vérifier que la propriété appartient à l'utilisateur
   const property = await prisma.realEstateInvestment.findFirst({
     where: {
       id: parseInt(realEstateInvestmentId),
       account: { userId: user.id }
     }
   });

   if (!property) {
     return res.status(403).json({ error: 'Property not found or not authorized' });
   }

   // Créer la projection
   const projection = await prisma.realEstateFinancialProjection.create({
     data: {
       projectionYear: parseInt(projectionYear),
       expectedRentalIncome: expectedRentalIncome ? parseFloat(expectedRentalIncome) : null,
       expectedExpenses: expectedExpenses ? parseFloat(expectedExpenses) : null,
       expectedAppreciation: expectedAppreciation ? parseFloat(expectedAppreciation) : null,
       expectedCashFlow: expectedCashFlow ? parseFloat(expectedCashFlow) : null,
       roi: roi ? parseFloat(roi) : null,
       maintenanceReserve: maintenanceReserve ? parseFloat(maintenanceReserve) : null,
       vacancyRate: vacancyRate ? parseFloat(vacancyRate) : null,
       propertyTaxes: propertyTaxes ? parseFloat(propertyTaxes) : null,
       insuranceCosts: insuranceCosts ? parseFloat(insuranceCosts) : null,
       managementFees: managementFees ? parseFloat(managementFees) : null,
       utilities: utilities ? parseFloat(utilities) : null,
       notes,
       realEstateInvestment: { connect: { id: parseInt(realEstateInvestmentId) } }
     }
   });

   return res.status(201).json(projection);
 } catch (error) {
   return errorHandler(res, error);
 }
});

// GET - Récupérer des statistiques globales
router.get('/statistics', authenticate, async (req, res) => {
 const user = req.user;
 
 try {
   // Récupérer toutes les propriétés
   const properties = await prisma.realEstateInvestment.findMany({
     where: {
       account: { userId: user.id }
     },
     include: {
       mortgage: true,
       tenants: {
         where: { active: true }
       },
       expenses: true,
       valuations: {
         orderBy: { valuationDate: 'desc' },
         take: 1
       }
     }
   });

   // Calculer les statistiques
   const totalProperties = properties.length;
   const totalValue = properties.reduce((sum, p) => sum + p.currentValuation, 0);
   const totalCost = properties.reduce((sum, p) => sum + p.purchasePrice, 0);
   const totalMortgage = properties.reduce((sum, p) => sum + (p.mortgage?.mortgageAmount || 0), 0);
   const totalEquity = totalValue - totalMortgage;
   const totalRentalProperties = properties.filter(p => 
     ['RENTAL', 'AIRBNB', 'MIXED_USE'].includes(p.usage)
   ).length;
   const totalRentalIncome = properties.reduce((sum, p) => 
     sum + p.tenants.reduce((s, t) => s + (t.monthlyRent || 0), 0), 0
   );
   
   // Calculer les dépenses de l'année dernière
   const oneYearAgo = new Date();
   oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
   const totalExpensesLastYear = properties.reduce((sum, p) => 
     sum + p.expenses
       .filter(e => new Date(e.date) >= oneYearAgo)
       .reduce((s, e) => s + e.amount, 0), 0
   );
   
   // Calculer l'appréciation moyenne
   let totalAppreciation = 0;
   let propertiesWithMultipleValuations = 0;
   
   for (const property of properties) {
     if (property.valuations.length > 0 && property.purchasePrice > 0) {
       const initialValue = property.purchasePrice;
       const currentValue = property.currentValuation;
       const years = (new Date() - new Date(property.purchaseDate)) / (1000 * 60 * 60 * 24 * 365);
       
       if (years > 0.5) { // Au moins 6 mois de possession
         const annualAppreciation = ((currentValue / initialValue) ** (1/years) - 1) * 100;
         totalAppreciation += annualAppreciation;
         propertiesWithMultipleValuations++;
       }
     }
   }
   
   const averageAnnualAppreciation = propertiesWithMultipleValuations > 0 
     ? totalAppreciation / propertiesWithMultipleValuations 
     : 0;
   
   // Rendement locatif
   const rentalYield = totalValue > 0 ? (totalRentalIncome * 12 / totalValue) * 100 : 0;
   
   // Répartition par type
   const propertyTypeDistribution = {};
   properties.forEach(p => {
     propertyTypeDistribution[p.propertyType] = (propertyTypeDistribution[p.propertyType] || 0) + 1;
   });
   
   // Répartition par usage
   const usageDistribution = {};
   properties.forEach(p => {
     usageDistribution[p.usage] = (usageDistribution[p.usage] || 0) + 1;
   });

   return res.status(200).json({
     totalProperties,
     totalValue,
     totalCost,
     totalMortgage,
     totalEquity,
     totalRentalProperties,
     totalRentalIncome,
     totalExpensesLastYear,
     averageAnnualAppreciation,
     rentalYield,
     propertyTypeDistribution,
     usageDistribution
   });
 } catch (error) {
   return errorHandler(res, error);
 }
});

module.exports = router;