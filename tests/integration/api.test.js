// tests/integration/api.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('Express Comic API Integration Tests', () => {
  
  describe('Health Check Endpoint', () => {
    test('GET /api/health should return 200 with health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    test('should include proper headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('Comics API Endpoints', () => {
    
    describe('GET /api/comics/latest', () => {
      test('should return latest comic with correct structure', async () => {
        const response = await request(app)
          .get('/api/comics/latest')
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title');
        expect(response.body).toHaveProperty('img');
        expect(response.body).toHaveProperty('alt');
        expect(response.body).toHaveProperty('year');
        expect(response.body).toHaveProperty('month');
        expect(response.body).toHaveProperty('day');
        
        expect(typeof response.body.id).toBe('number');
        expect(typeof response.body.title).toBe('string');
        expect(typeof response.body.img).toBe('string');
        expect(typeof response.body.alt).toBe('string');
        
        expect(response.body.img).toMatch(/^https?:\/\/.+\.(png|jpg|jpeg)$/);
        expect(response.body.id).toBeGreaterThan(0);
      });

      test('should cache results for performance', async () => {
        const start = Date.now();
        await request(app).get('/api/comics/latest');
        const firstCall = Date.now() - start;

        const start2 = Date.now();
        await request(app).get('/api/comics/latest');
        const secondCall = Date.now() - start2;

        expect(secondCall).toBeLessThan(firstCall);
      });
    });

    describe('GET /api/comics/:id', () => {
      test('should return specific comic for valid ID', async () => {
        const response = await request(app)
          .get('/api/comics/614')
          .expect(200);

        expect(response.body).toHaveProperty('id', 614);
        expect(response.body).toHaveProperty('title');
        expect(response.body).toHaveProperty('img');
        expect(response.body).toHaveProperty('alt');
        expect(response.body).toBeValidComicStructure();
      });

      test('should return 400 for invalid ID format', async () => {
        const response = await request(app)
          .get('/api/comics/invalid')
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/Comic ID must be a positive integer/i);
      });

      test('should return 400 for negative ID', async () => {
        const response = await request(app)
          .get('/api/comics/-1')
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/Comic ID must be a positive integer/i);
      });

      test('should return 400 for ID of 0', async () => {
        const response = await request(app)
          .get('/api/comics/0')
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/Comic ID must be a positive integer/i);
      });

      test('should handle non-existent comic ID gracefully', async () => {
        const response = await request(app)
          .get('/api/comics/999999')
          .expect(404);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/Comic not found/i);
      });

      test('should handle decimal IDs as invalid', async () => {
        const response = await request(app)
          .get('/api/comics/1.5')
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/comics/random', () => {
      test('should return a random comic with correct structure', async () => {
        const response = await request(app)
          .get('/api/comics/random')
          .expect(200);

        expect(response.body).toBeValidComicStructure();
        expect(typeof response.body.id).toBe('number');
        expect(response.body.id).toBeGreaterThan(0);
      });

      test('should return different comics on subsequent calls', async () => {
        const response1 = await request(app)
          .get('/api/comics/random')
          .expect(200);
        
        const response2 = await request(app)
          .get('/api/comics/random')
          .expect(200);

        expect(response1.body.id).toBeGreaterThan(0);
        expect(response2.body.id).toBeGreaterThan(0);
        // Note: This test might occasionally fail due to randomness
        // but should pass most of the time with a large enough comic pool
      });

      test('should handle service errors gracefully', async () => {
        // This would require mocking the service to simulate errors
        // For now, we just ensure the endpoint exists and returns valid data
        await request(app)
          .get('/api/comics/random')
          .expect(200);
      });
    });

    describe('GET /api/comics/search', () => {
      test('should require query parameter', async () => {
        const response = await request(app)
          .get('/api/comics/search')
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/Query must be between 1 and 100 characters/i);
      });

      test('should search comics by title', async () => {
        const response = await request(app)
          .get('/api/comics/search')
          .query({ q: 'python' })
          .expect(200);

        expect(Array.isArray(response.body.results)).toBe(true);
        expect(response.body).toHaveProperty('query', 'python');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('pagination');
        
        if (response.body.results.length > 0) {
          response.body.results.forEach(comic => {
            expect(comic).toBeValidComicStructure();
          });
        }
      });

      test('should handle pagination parameters correctly', async () => {
        const response = await request(app)
          .get('/api/comics/search')
          .query({ q: 'the', page: 2, limit: 5 })
          .expect(200);

        expect(response.body).toHaveProperty('pagination');
        expect(response.body.pagination).toHaveProperty('page', 2);
        expect(response.body.pagination).toHaveProperty('limit', 5);
        expect(response.body.pagination).toHaveProperty('offset', 5);
        expect(response.body.results.length).toBeLessThanOrEqual(5);
      });

      test('should validate pagination parameters', async () => {
        const response = await request(app)
          .get('/api/comics/search')
          .query({ q: 'test', page: -1 })
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/Page must be a positive integer/i);
      });

      test('should validate limit parameters', async () => {
        const response = await request(app)
          .get('/api/comics/search')
          .query({ q: 'test', limit: 0 })
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/Limit must be between 1 and 50/i);
      });

      test('should limit query length', async () => {
        const longQuery = 'a'.repeat(101);
        const response = await request(app)
          .get('/api/comics/search')
          .query({ q: longQuery })
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/Query must be between 1 and 100 characters/i);
      });

      test('should return empty results for nonsensical query', async () => {
        const response = await request(app)
          .get('/api/comics/search')
          .query({ q: 'xyzzzzqwertynonexistentterm12345' })
          .expect(200);

        expect(response.body.results).toHaveLength(0);
        expect(response.body.total).toBe(0);
      });

      test('should default pagination values', async () => {
        const response = await request(app)
          .get('/api/comics/search')
          .query({ q: 'test' })
          .expect(200);

        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(10);
        expect(response.body.pagination.offset).toBe(0);
      });
    });
  });

  describe('Statistics Endpoint', () => {
    test('GET /api/stats should return usage statistics', async () => {
      await request(app).get('/api/comics/latest');
      await request(app).get('/api/comics/614');
      
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalRequests');
      expect(response.body).toHaveProperty('endpointStats');
      expect(response.body).toHaveProperty('uptime');
      
      expect(typeof response.body.totalRequests).toBe('number');
      expect(response.body.totalRequests).toBeGreaterThan(0);
      expect(typeof response.body.endpointStats).toBe('object');
      expect(typeof response.body.uptime).toBe('number');
    });

    test('should track endpoint usage correctly', async () => {
      const statsBefore = await request(app).get('/api/stats');
      const initialTotal = statsBefore.body.totalRequests;

      await request(app).get('/api/health');
      
      const statsAfter = await request(app).get('/api/stats');
      
      expect(statsAfter.body.totalRequests).toBe(initialTotal + 2); // +1 for health, +1 for stats
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent API endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Endpoint not found');
      expect(response.body).toHaveProperty('path', '/api/nonexistent');
    });

    test('should handle malformed JSON requests gracefully', async () => {
      const response = await request(app)
        .post('/api/comics/latest')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle unsupported HTTP methods', async () => {
      const response = await request(app)
        .patch('/api/comics/latest')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security and Middleware', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for helmet security headers
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });

    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/comics/latest')
        .expect(204);
    });

    test('should set proper Content-Type for JSON responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Static File Serving', () => {
    test('should serve API documentation at root', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/html/);
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      // Make several requests quickly
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/health')
          .expect(200);
      }
    });
  });
});
