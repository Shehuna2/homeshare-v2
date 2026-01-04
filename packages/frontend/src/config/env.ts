export const env = {
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Homeshare',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  DEFAULT_CHAIN: import.meta.env.VITE_DEFAULT_CHAIN || 'ethereum',
  SUPPORTED_CHAINS: (import.meta.env.VITE_SUPPORTED_CHAINS || 'ethereum,base,canton').split(','),
};
