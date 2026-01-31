import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface InvestmentAttributes {
  id: string;
  propertyId: string;
  investor: string;
  amount: number;
  tokenAmount: number;
  chain: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type InvestmentCreationAttributes = Optional<InvestmentAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export class Investment extends Model<InvestmentAttributes, InvestmentCreationAttributes> implements InvestmentAttributes {
  public id!: string;
  public propertyId!: string;
  public investor!: string;
  public amount!: number;
  public tokenAmount!: number;
  public chain!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initInvestmentModel(sequelize: Sequelize): typeof Investment {
  Investment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      propertyId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      investor: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      tokenAmount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      chain: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'investments',
      underscored: true,
    }
  );

  return Investment;
}
