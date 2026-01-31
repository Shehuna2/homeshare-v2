import { env } from '../config/env';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    address: string;
    role: 'owner' | 'investor';
  };
}

export interface PropertyPayload {
  name: string;
  description: string;
  location: string;
  totalValue: number;
  tokenSupply: number;
  chain: string;
  status?: 'draft' | 'funding' | 'funded';
}

export interface PropertyResponse {
  id: string;
  name: string;
  description: string;
  location: string;
  totalValue: number;
  tokenSupply: number;
  chain: string;
  status: 'draft' | 'funding' | 'funded';
  createdAt: string;
}

export async function loginWithWallet(payload: {
  address: string;
  signature: string;
  message: string;
  role: 'owner' | 'investor';
}): Promise<AuthResponse> {
  const response = await fetch(`${env.API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Authentication failed');
  }

  return response.json();
}

export async function createProperty(payload: PropertyPayload, token: string) {
  const response = await fetch(`${env.API_BASE_URL}/properties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create property');
  }

  return response.json();
}

export async function fetchProperties(): Promise<PropertyResponse[]> {
  const response = await fetch(`${env.API_BASE_URL}/properties`);

  if (!response.ok) {
    throw new Error('Failed to fetch properties');
  }

  const data = await response.json();
  return data.properties ?? [];
}
