import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import {
  getProperty,
  listEquityClaims,
  listProfitClaims,
  listProfitDeposits,
  listProperties,
} from '../controllers/v1/propertiesController.js';
import {
  getCampaign,
  listCampaignInvestments,
  listCampaignRefunds,
  listCampaigns,
} from '../controllers/v1/campaignsController.js';
import {
  listMyEquityClaims,
  listMyInvestments,
  listMyProfitClaims,
} from '../controllers/v1/meController.js';
import {
  createProfitDistributionIntent,
  createPropertyIntent,
} from '../controllers/v1/adminController.js';

const router = Router();

router.get('/properties', listProperties);
router.get('/properties/:propertyId', getProperty);
router.get('/properties/:propertyId/equity-claims', listEquityClaims);
router.get('/properties/:propertyId/profit-deposits', listProfitDeposits);
router.get('/properties/:propertyId/profit-claims', listProfitClaims);

router.get('/campaigns', listCampaigns);
router.get('/campaigns/:campaignAddress', getCampaign);
router.get('/campaigns/:campaignAddress/investments', listCampaignInvestments);
router.get('/campaigns/:campaignAddress/refunds', listCampaignRefunds);

router.get('/me/investments', auth, listMyInvestments);
router.get('/me/equity-claims', auth, listMyEquityClaims);
router.get('/me/profit-claims', auth, listMyProfitClaims);

router.post('/admin/properties/intents', auth, requireRole('owner'), createPropertyIntent);
router.post('/admin/profits/intents', auth, requireRole('owner'), createProfitDistributionIntent);

export default router;
