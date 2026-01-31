import { Sequelize } from 'sequelize';
import { initInvestmentModel, Investment } from './investment.js';
import { initPropertyModel, Property } from './property.js';

export function initModels(sequelize: Sequelize): void {
  initPropertyModel(sequelize);
  initInvestmentModel(sequelize);

  Property.hasMany(Investment, { foreignKey: 'propertyId', as: 'investments' });
  Investment.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
}

export { Property, Investment };
