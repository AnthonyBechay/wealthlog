// src/routes/trade/trade.routes.js
const express = require("express");
const router = express.Router();
const { prisma } = require('../../lib/prisma');

const { authenticate } = require("../../middleware/authenticate");
const { recalcAccountBalance } = require("../account/recalc.helper");


const multer = require("multer");
const path = require("path");

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/tradeImages/"); // must exist
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// For storing session notes, optional
function detectSession(dateString) {
  const d = dateString ? new Date(dateString) : new Date();
  const hour = d.getHours();
  if (hour >= 10 && hour <= 12) return "London";
  if (hour >= 16 && hour <= 19) return "US";
  return "Other";
}




/* ========================================================== */
/* 1) POST  /trade  — create                                   */
/* ========================================================== */
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      tradeType,
      accountId,
      instrument,      // name-string that must already exist
      pattern,         // optional name-string that must exist if provided
      status = 'CLOSED',
      direction = 'LONG',
      fees = 0,
      entryDate,
      exitDate,
      fx = {}, bond = {}, stock = {}, crypto = {}, etf = {},
      notes,
    } = req.body;

    /* mandatory */
    if (!tradeType) return res.status(400).json({ error: 'tradeType required' });
    if (!accountId) return res.status(400).json({ error: 'accountId required' });
    if (!instrument) return res.status(400).json({ error: 'instrument required' });

    /* ownership */
    const account = await prisma.financialAccount.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== req.user.userId)
      return res.status(403).json({ error: 'Not authorised for that account' });

    /* look-up FK rows */
    const instRow = await prisma.financialInstrument.findFirst({
      where: { userId: req.user.userId, name: instrument.trim() },
    });
    if (!instRow) return res.status(400).json({ error: 'Instrument not found—add it first in Trading Settings.' });

    let patternId = null;
    if (pattern) {
      const pattRow = await prisma.tradingPattern.findFirst({
        where: { userId: req.user.userId, name: pattern.trim() },
      });
      if (!pattRow) return res.status(400).json({ error: 'Pattern not found—add it first in Trading Settings.' });
      patternId = pattRow.id;
    }

    const entryDt = entryDate ? new Date(entryDate) : new Date();
    const exitDt = exitDate ? new Date(exitDate) : null;

    const newTrade = await prisma.trade.create({
      data: {
        accountId,
        tradeType,
        instrumentId: instRow.id,
        patternId,
        status,
        tradeDirection: direction.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG',
        fees,
        entryDate: entryDt,
        exitDate: exitDt,
        notes: notes ?? `session: ${detectSession(entryDt)}`,
      },
    });

    /* sub-type helpers unchanged */
    switch (tradeType) {
      case 'FX': await createFx(newTrade.id, fx); break;
      case 'STOCK': await createStock(newTrade.id, stock); break;
      case 'BOND': await createBond(newTrade.id, bond); break;
      /* CRYPTO / ETF TODO */
      default: break;
    }

    await recalcAccountBalance(accountId, { afterDate: entryDt });
    res.json({ message: 'Trade created', tradeId: newTrade.id });
  } catch (err) {
    console.error('Trade creation failed:', err);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});


/* ------------------ helpers ------------------ */
async function createFx(tradeId, d) {
  const { amountGain, percentageGain, ...rest } = d;
  return prisma.fxTrade.create({
    data: {
      tradeId,
      ...rest,
      amountGain: amountGain != null && percentageGain == null ? amountGain : null,
      percentageGain: percentageGain ?? null
    }
  });

}

async function createStock(tradeId, d) {
  return prisma.stocksTrade.create({
    data: {
      tradeId,
      entryPrice: d.entryPrice ?? 0,
      exitPrice: d.exitPrice ?? 0,
      quantity: d.quantity ?? 0
    }
  });
}

async function createBond(tradeId, d) {
  return prisma.bondTrade.create({
    data: {
      tradeId,
      entryPrice: d.entryPrice ?? 0,
      exitPrice: d.exitPrice ?? 0,
      quantity: d.quantity ?? 0,
      couponRate: d.couponRate ?? 0,
      maturityDate: d.maturityDate ? new Date(d.maturityDate) : null
    }
  });
}


/* ========================================================== */
/* 2) GET /trade  — list                                      */
/* ========================================================== */
router.get('/', authenticate, async (req, res) => {
  try {
    const accountId = req.query.accountId ? parseInt(req.query.accountId, 10) : null;
    const tType = req.query.tradeType || null;

    const userAccounts = await prisma.financialAccount.findMany({
      where: { userId: req.user.userId },
      select: { id: true },
    });
    const validIds = userAccounts.map((a) => a.id);

    if (accountId && !validIds.includes(accountId))
      return res.status(403).json({ error: 'Not authorized for that account' });

    const where = {
      accountId: accountId ? accountId : { in: validIds },
      ...(tType ? { tradeType: tType } : {}),
    };

    const trades = await prisma.trade.findMany({
      where,
      orderBy: { entryDate: 'desc' },
      include: {
        fxTrade: true,
        bondTrade: true,
        stocksTrade: true,
        instrument: true,
        pattern: true,
        media: { include: { label: true } },
      },
    });

    // Flatten instrument & pattern to names
    const flat = trades.map((t) => ({
      ...t,
      instrument: t.instrument?.name || null,
      pattern: t.pattern?.name || null,
    }));

    res.json(flat);
  } catch (err) {
    console.error('Error fetching trades:', err);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});


/* ========================================================== */
/* 3) PUT /trade/:id  — edit                                  */
/*    Accepts instrument & pattern names and rewires FKs      */
/* ========================================================== */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const tradeId = Number(req.params.id);
    const existing = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: { fxTrade: true, bondTrade: true, stocksTrade: true },
    });
    if (!existing) return res.status(404).json({ error: 'Trade not found' });

    /* ownership */
    const acct = await prisma.financialAccount.findUnique({ where: { id: existing.accountId } });
    if (!acct || acct.userId !== req.user.userId)
      return res.status(403).json({ error: 'Not authorized' });

    /* payload */
    const {
      instrument,          // name
      pattern,             // name | null
      direction,
      fees,
      entryDate,
      fx = {}, bond = {}, stock = {},
    } = req.body;

    if (!instrument) return res.status(400).json({ error: 'instrument is required' });

    /* resolve new FKs */
    const instRow = await prisma.financialInstrument.findFirst({
      where: { userId: req.user.userId, name: instrument.trim() },
    });
    if (!instRow) return res.status(400).json({ error: 'Instrument not found' });

    let patternId = null;
    if (pattern) {
      const pattRow = await prisma.tradingPattern.findFirst({
        where: { userId: req.user.userId, name: pattern.trim() },
      });
      if (!pattRow) return res.status(400).json({ error: 'Pattern not found' });
      patternId = pattRow.id;
    }

    const newEntry = entryDate ? new Date(entryDate) : existing.entryDate;

    /* update main trade */
    await prisma.trade.update({
      where: { id: tradeId },
      data: {
        instrumentId: instRow.id,
        patternId,
        tradeDirection: direction === 'Short' ? 'SHORT' : 'LONG',
        fees: Math.abs(fees || 0),
        entryDate: newEntry,
      },
    });

    // FX
    if (existing.tradeType === 'FX' && existing.fxTrade) {
      await prisma.fxTrade.update({
        where: { tradeId },
        data: {
          lots: fx.lots ?? existing.fxTrade.lots,
          entryPrice: fx.entryPrice ?? existing.fxTrade.entryPrice,
          exitPrice: fx.exitPrice ?? existing.fxTrade.exitPrice,
          stopLossPips: fx.stopLossPips ?? existing.fxTrade.stopLossPips,
          pipsGain: fx.pipsGain ?? existing.fxTrade.pipsGain,
          amountGain: fx.amountGain ?? null,
          percentageGain: fx.percentageGain ?? null,
          source: fx.source ?? existing.fxTrade.source,
        },
      });
    }
    // STOCK
    if (existing.tradeType === 'STOCK' && existing.stocksTrade) {
      await prisma.stocksTrade.update({
        where: { tradeId },
        data: {
          entryPrice: stock.entryPrice ?? existing.stocksTrade.entryPrice,
          exitPrice: stock.exitPrice ?? existing.stocksTrade.exitPrice,
          quantity: stock.quantity ?? existing.stocksTrade.quantity,
        },
      });
    }
    // BOND
    if (existing.tradeType === 'BOND' && existing.bondTrade) {
      await prisma.bondTrade.update({
        where: { tradeId },
        data: {
          entryPrice: bond.entryPrice ?? existing.bondTrade.entryPrice,
          exitPrice: bond.exitPrice ?? existing.bondTrade.exitPrice,
          quantity: bond.quantity ?? existing.bondTrade.quantity,
          couponRate: bond.couponRate ?? existing.bondTrade.couponRate,
          maturityDate: bond.maturityDate ? new Date(bond.maturityDate) : existing.bondTrade.maturityDate,
        },
      });
    }

    const replayFrom = new Date(Math.min(newEntry.getTime(), existing.entryDate.getTime()));
    await recalcAccountBalance(existing.accountId, { afterDate: replayFrom });

    res.json({ message: 'Trade updated' });
  } catch (err) {
    console.error('Error updating trade:', err);
    res.status(500).json({ error: 'Failed to update trade' });
  }
});


// 5) DELETE /trade/:id
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const tradeId = parseInt(req.params.id, 10);
    const existing = await prisma.trade.findUnique({
      where: { id: tradeId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Trade not found" });
    }
    const acct = await prisma.financialAccount.findUnique({
      where: { id: existing.accountId },
    });
    if (!acct || acct.userId !== req.user.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // remove sub-trade
    if (existing.tradeType === "FX") {
      await prisma.fxTrade.deleteMany({ where: { tradeId } });
    } else if (existing.tradeType === "BOND") {
      await prisma.bondTrade.deleteMany({ where: { tradeId } });
    } else if (existing.tradeType === "STOCK") {
      await prisma.stocksTrade.deleteMany({ where: { tradeId } });
    }

    // remove media
    await prisma.tradeMedia.deleteMany({ where: { tradeId } });


    await prisma.trade.delete({ where: { id: tradeId } });
    await recalcAccountBalance(existing.accountId, { afterDate: existing.entryDate });


    res.json({ message: "Trade deleted" });
  } catch (err) {
    console.error("Error deleting trade:", err);
    res.status(500).json({ error: "Failed to delete trade" });
  }
});

/**
 * POST /trade/:tradeId/media
 * Accept multiple images (files) and a JSON array describing each piece of media (tagName, description, externalUrl).
 * "images" is the field for file uploads
 * "mediaData" is a JSON array in the request body describing each item
 */
router.post(
  "/:tradeId/media",
  authenticate,
  upload.array("images", 10), // up to 10 files
  async (req, res) => {
    try {
      const tradeId = parseInt(req.params.tradeId, 10);

      // confirm ownership
      const trade = await prisma.trade.findUnique({
        where: { id: tradeId },
        include: { account: true },
      });
      if (!trade || trade.account.userId !== req.user.userId) {
        return res.status(403).json({ error: "Not authorized or trade not found" });
      }

      // mediaData must be a JSON array
      const { mediaData } = req.body;
      if (!mediaData) {
        return res.status(400).json({ error: "Missing mediaData in form-data" });
      }

      let parsed;
      try {
        parsed = JSON.parse(mediaData);
      } catch (err) {
        return res.status(400).json({ error: "Invalid JSON for mediaData" });
      }
      if (!Array.isArray(parsed)) {
        return res.status(400).json({ error: "mediaData must be an array" });
      }

      const createdMedia = [];

      for (const item of parsed) {
        const tagName = item.tagName?.trim() || "";
        const description = item.description?.trim() || "";
        const externalUrl = item.externalUrl?.trim() || "";
        const index = typeof item.index === "number" ? item.index : null;

        // find or create label
        let labelId = null;
        if (tagName) {
          let label = await prisma.label.findFirst({
            where: {
              userId: req.user.userId,
              name: tagName,
            },
          });
          if (!label) {
            label = await prisma.label.create({
              data: {
                userId: req.user.userId,
                name: tagName,
              },
            });
          }
          labelId = label.id;
        }

        let imageUrl = "";
        // if user provided a local file
        if (index !== null && req.files[index]) {
          // map the file in that position
          const fileRef = req.files[index];
          imageUrl = path.join("uploads", "tradeImages", fileRef.filename);
        } else if (externalUrl) {
          imageUrl = externalUrl;
        } else {
          // skip if neither local file nor externalUrl
          continue;
        }

        const newMedia = await prisma.tradeMedia.create({
          data: {
            tradeId,
            labelId,
            imageUrl,
            description: description || null,
          },
          include: { label: true },
        });
        createdMedia.push(newMedia);
      }

      res.json({
        message: "Media attached successfully",
        count: createdMedia.length,
        media: createdMedia,
      });
    } catch (err) {
      console.error("Error attaching media:", err);
      res.status(500).json({ error: "Failed to attach media" });
    }
  }
);

module.exports = router;
