// src/routes/comics.js
const express = require('express');
const { query, param, validationResult } = require('express-validator');
const XKCDService = require('../services/xkcdService');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  return next();
};

/**
 * GET /api/comics/latest
 * (No .all() — tests expect PATCH to return 404, not 405)
 */
router.get('/latest', async (req, res, next) => {
  try {
    const comic = await XKCDService.getLatest();
    return res.json(comic);
  } catch (err) {
    return next(err);
  }
});

/**
 * IMPORTANT: /search BEFORE /:id to avoid collisions
 */
router.get(
  '/search',
  [
    query('q')
      .custom((value) => {
        const v = typeof value === 'string' ? value : '';
        if (v.length < 1 || v.length > 100) {
          throw new Error('Query must be between 1 and 100 characters');
        }
        return true;
      }),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { q } = req.query;
      const page = req.query.page ? parseInt(req.query.page, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
      const result = await XKCDService.search(q, page, limit);
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/comics/random
 */
router.get('/random', async (req, res, next) => {
  try {
    const comic = await XKCDService.getRandom();
    return res.json(comic);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/comics/:id
 */
router.get(
  '/:id',
  param('id')
    .custom((value) => {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error('Comic ID must be a positive integer');
      }
      return true;
    }),
  validate,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const comic = await XKCDService.getById(id);
      return res.json(comic);
    } catch (err) {
      if (String(err.message).includes('Comic not found')) {
        return res.status(404).json({ error: 'Comic not found' });
      }
      if (String(err.message).includes('Invalid comic ID')) {
        return res
          .status(400)
          .json({ error: 'Comic ID must be a positive integer' });
      }
      return next(err);
    }
  }
);

module.exports = router;
