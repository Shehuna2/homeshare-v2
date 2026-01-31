export interface PropertyRecord {
  id: string;
  name: string;
  location: string;
  description: string;
  totalValue: number;
  tokenSupply: number;
  chain: string;
  status: 'draft' | 'funding' | 'funded';
  createdAt: string;
}

export interface InvestmentRecord {
  id: string;
  propertyId: string;
  investor: string;
  amount: number;
  tokenAmount: number;
  chain: string;
  createdAt: string;
}

const properties: PropertyRecord[] = [];
const investments: InvestmentRecord[] = [];

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export function listProperties(): PropertyRecord[] {
  return properties;
}

export function getPropertyById(id: string): PropertyRecord | undefined {
  return properties.find((property) => property.id === id);
}

export function createProperty(
  payload: Omit<PropertyRecord, 'id' | 'createdAt'>
): PropertyRecord {
  const property: PropertyRecord = {
    ...payload,
    id: generateId('property'),
    createdAt: new Date().toISOString(),
  };

  properties.push(property);
  return property;
}

export function listInvestments(investor?: string): InvestmentRecord[] {
  if (!investor) {
    return investments;
  }

  return investments.filter((investment) => investment.investor === investor);
}

export function createInvestment(
  payload: Omit<InvestmentRecord, 'id' | 'createdAt'>
): InvestmentRecord {
  const investment: InvestmentRecord = {
    ...payload,
    id: generateId('investment'),
    createdAt: new Date().toISOString(),
  };

  investments.push(investment);
  return investment;
}
