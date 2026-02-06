import { Response } from 'express';
import { randomUUID } from 'crypto';
import { sequelize } from '../../db/index.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  BASE_SEPOLIA_CHAIN_ID,
  ValidationError,
  normalizeAddress,
  parseBaseUnits,
  validatePropertyId,
} from '../../validators/v1.js';

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ValidationError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: 'Internal server error' });
};

const requireAdminAddress = (req: AuthenticatedRequest): string => {
  if (!req.user?.address) {
    throw new ValidationError('Unauthorized', 401);
  }
  return normalizeAddress(req.user.address, 'address');
};

export const createPropertyIntent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminAddress = requireAdminAddress(req);
    const propertyId = validatePropertyId(req.body.propertyId);
    const name = req.body.name?.toString().trim();
    const location = req.body.location?.toString().trim();
    const description = req.body.description?.toString().trim();
    const targetUsdcBaseUnits = parseBaseUnits(req.body.targetUsdcBaseUnits, 'targetUsdcBaseUnits');
    const crowdfundContractAddress = req.body.crowdfundContractAddress
      ? normalizeAddress(req.body.crowdfundContractAddress.toString(), 'crowdfundContractAddress')
      : null;

    if (!name) {
      throw new ValidationError('Missing name');
    }

    if (!location) {
      throw new ValidationError('Missing location');
    }

    if (!description) {
      throw new ValidationError('Missing description');
    }

    const [rows] = await sequelize.query(
      `
      INSERT INTO property_intents (
        id,
        chain_id,
        property_id,
        name,
        location,
        description,
        target_usdc_base_units,
        crowdfund_contract_address,
        created_by_address
      )
      VALUES (
        :id,
        :chainId,
        :propertyId,
        :name,
        :location,
        :description,
        :targetUsdcBaseUnits,
        :crowdfundContractAddress,
        :createdByAddress
      )
      RETURNING
        property_id AS "propertyId",
        name,
        location,
        description,
        target_usdc_base_units::text AS "targetUsdcBaseUnits",
        LOWER(crowdfund_contract_address) AS "crowdfundContractAddress",
        created_at AS "createdAt"
      `,
      {
        replacements: {
          id: randomUUID(),
          chainId: BASE_SEPOLIA_CHAIN_ID,
          propertyId,
          name,
          location,
          description,
          targetUsdcBaseUnits,
          crowdfundContractAddress,
          createdByAddress: adminAddress,
        },
      }
    );

    const intent = Array.isArray(rows) ? rows[0] : null;
    return res.status(201).json({ intent });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createProfitDistributionIntent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminAddress = requireAdminAddress(req);
    const propertyId = validatePropertyId(req.body.propertyId);
    const profitDistributorAddress = normalizeAddress(
      req.body.profitDistributorAddress?.toString(),
      'profitDistributorAddress'
    );
    const usdcAmountBaseUnits = parseBaseUnits(req.body.usdcAmountBaseUnits, 'usdcAmountBaseUnits');

    const [rows] = await sequelize.query(
      `
      INSERT INTO profit_distribution_intents (
        id,
        chain_id,
        property_id,
        profit_distributor_address,
        usdc_amount_base_units,
        created_by_address
      )
      VALUES (
        :id,
        :chainId,
        :propertyId,
        :profitDistributorAddress,
        :usdcAmountBaseUnits,
        :createdByAddress
      )
      RETURNING
        property_id AS "propertyId",
        LOWER(profit_distributor_address) AS "profitDistributorAddress",
        usdc_amount_base_units::text AS "usdcAmountBaseUnits",
        created_at AS "createdAt"
      `,
      {
        replacements: {
          id: randomUUID(),
          chainId: BASE_SEPOLIA_CHAIN_ID,
          propertyId,
          profitDistributorAddress,
          usdcAmountBaseUnits,
          createdByAddress: adminAddress,
        },
      }
    );

    const intent = Array.isArray(rows) ? rows[0] : null;
    return res.status(201).json({ intent });
  } catch (error) {
    return handleError(res, error);
  }
};
