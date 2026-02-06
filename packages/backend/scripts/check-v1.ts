import request from 'supertest';
import app from '../src/app.js';
import { sequelize } from '../src/db/index.js';

const originalQuery = sequelize.query.bind(sequelize);

const stubQueries = () => {
  sequelize.query = (async () => []) as typeof sequelize.query;
};

const restoreQueries = () => {
  sequelize.query = originalQuery;
};

const run = async () => {
  stubQueries();

  try {
    const propertiesRes = await request(app).get('/v1/properties');
    if (propertiesRes.status >= 500) {
      throw new Error(`GET /v1/properties returned ${propertiesRes.status}`);
    }

    const propertyRes = await request(app).get('/v1/properties/nonexistent-property');
    if (propertyRes.status !== 404) {
      throw new Error(`GET /v1/properties/:id expected 404, got ${propertyRes.status}`);
    }

    const equityClaimsRes = await request(app).get('/v1/properties/nonexistent-property/equity-claims');
    if (equityClaimsRes.status >= 500) {
      throw new Error(`GET /v1/properties/:id/equity-claims returned ${equityClaimsRes.status}`);
    }

    console.log('v1 checks passed');
  } finally {
    restoreQueries();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
