import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface PropertyAttributes {
  id: string;
  name: string;
  location: string;
  description: string;
  totalValue: number;
  tokenSupply: number;
  chain: string;
  status: 'draft' | 'funding' | 'funded';
  createdAt?: Date;
  updatedAt?: Date;
}

type PropertyCreationAttributes = Optional<PropertyAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export class Property extends Model<PropertyAttributes, PropertyCreationAttributes> implements PropertyAttributes {
  public id!: string;
  public name!: string;
  public location!: string;
  public description!: string;
  public totalValue!: number;
  public tokenSupply!: number;
  public chain!: string;
  public status!: 'draft' | 'funding' | 'funded';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initPropertyModel(sequelize: Sequelize): typeof Property {
  Property.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      totalValue: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      tokenSupply: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      chain: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('draft', 'funding', 'funded'),
        allowNull: false,
        defaultValue: 'draft',
      },
    },
    {
      sequelize,
      tableName: 'properties',
      underscored: true,
    }
  );

  return Property;
}
