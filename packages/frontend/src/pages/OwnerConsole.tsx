import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount, useSignMessage } from 'wagmi';
import { RootState } from '../store';
import { setUser, clearUser } from '../store/slices/userSlice';
import { createProperty, loginWithWallet } from '../lib/api';

export default function OwnerConsole() {
  const dispatch = useDispatch();
  const { address, role, token, isAuthenticated } = useSelector((state: RootState) => state.user);
  const { address: walletAddress } = useAccount();
  const { signMessageAsync, isLoading: isSigning } = useSignMessage();
  const [loginForm, setLoginForm] = useState({
    address: '',
    signature: '',
    message: 'Sign-in request for Homeshare',
    role: 'owner' as 'owner' | 'investor',
  });
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    description: '',
    location: '',
    totalValue: '',
    tokenSupply: '',
    chain: 'sepolia',
    status: 'draft' as 'draft' | 'funding' | 'funded',
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (walletAddress && walletAddress !== loginForm.address) {
      setLoginForm((prev) => ({ ...prev, address: walletAddress }));
    }
  }, [walletAddress, loginForm.address]);

  const handleLoginChange = (field: keyof typeof loginForm, value: string) => {
    setLoginForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePropertyChange = (field: keyof typeof propertyForm, value: string) => {
    setPropertyForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogin = async () => {
    setErrorMessage('');
    setStatusMessage('Authenticating...');
    try {
      const response = await loginWithWallet({
        address: loginForm.address,
        signature: loginForm.signature,
        message: loginForm.message,
        role: loginForm.role,
      });
      dispatch(
        setUser({
          address: response.user.address,
          role: response.user.role,
          token: response.token,
        })
      );
      setStatusMessage(`Authenticated as ${response.user.role}.`);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    }
  };

  const handleLogout = () => {
    dispatch(clearUser());
    setStatusMessage('Logged out.');
  };

  const handleSignMessage = async () => {
    if (!loginForm.address) {
      setErrorMessage('Connect a wallet first.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('Waiting for signature...');
    try {
      const signature = await signMessageAsync({ message: loginForm.message });
      setLoginForm((prev) => ({ ...prev, signature }));
      setStatusMessage('Message signed. Ready to authenticate.');
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    }
  };

  const handleCreateProperty = async () => {
    setErrorMessage('');
    setStatusMessage('Creating property...');
    try {
      if (!token) {
        throw new Error('You must be logged in as an owner to create properties.');
      }

      const payload = {
        name: propertyForm.name,
        description: propertyForm.description,
        location: propertyForm.location,
        totalValue: Number(propertyForm.totalValue),
        tokenSupply: Number(propertyForm.tokenSupply),
        chain: propertyForm.chain,
        status: propertyForm.status,
      };

      await createProperty(payload, token);
      setStatusMessage('Property created successfully.');
      setPropertyForm({
        name: '',
        description: '',
        location: '',
        totalValue: '',
        tokenSupply: '',
        chain: 'sepolia',
        status: 'draft',
      });
    } catch (error) {
      setErrorMessage((error as Error).message);
      setStatusMessage('');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Owner Console
      </h1>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Wallet Login</h2>
          <div className="space-y-4">
            <input
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Wallet address"
              value={loginForm.address}
              onChange={(event) => handleLoginChange('address', event.target.value)}
            />
            <input
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Signature"
              value={loginForm.signature}
              onChange={(event) => handleLoginChange('signature', event.target.value)}
            />
            <input
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Message to sign"
              value={loginForm.message}
              onChange={(event) => handleLoginChange('message', event.target.value)}
            />
            <select
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              value={loginForm.role}
              onChange={(event) => handleLoginChange('role', event.target.value)}
            >
              <option value="owner">Owner</option>
              <option value="investor">Investor</option>
            </select>
            <div className="flex flex-wrap gap-3">
              <button
                className="border border-primary-600 text-primary-700 dark:text-primary-300 px-6 py-2 rounded-lg"
                onClick={handleSignMessage}
                disabled={isSigning}
              >
                {isSigning ? 'Signing...' : 'Sign Message'}
              </button>
              <button
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
                onClick={handleLogin}
              >
                Authenticate
              </button>
              {isAuthenticated && (
                <button
                  className="border border-gray-300 dark:border-gray-600 px-6 py-2 rounded-lg text-gray-700 dark:text-gray-200"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Logged in as: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}{' '}
              {role ? `(${role})` : ''}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create Property</h2>
          <div className="space-y-4">
            <input
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Property name"
              value={propertyForm.name}
              onChange={(event) => handlePropertyChange('name', event.target.value)}
            />
            <input
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Location"
              value={propertyForm.location}
              onChange={(event) => handlePropertyChange('location', event.target.value)}
            />
            <textarea
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Description"
              rows={3}
              value={propertyForm.description}
              onChange={(event) => handlePropertyChange('description', event.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="Total value"
                value={propertyForm.totalValue}
                onChange={(event) => handlePropertyChange('totalValue', event.target.value)}
              />
              <input
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="Token supply"
                value={propertyForm.tokenSupply}
                onChange={(event) => handlePropertyChange('tokenSupply', event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <select
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                value={propertyForm.chain}
                onChange={(event) => handlePropertyChange('chain', event.target.value)}
              >
                <option value="sepolia">Sepolia</option>
                <option value="base-sepolia">Base Sepolia</option>
              </select>
              <select
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                value={propertyForm.status}
                onChange={(event) => handlePropertyChange('status', event.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="funding">Funding</option>
                <option value="funded">Funded</option>
              </select>
            </div>
            <button
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
              onClick={handleCreateProperty}
            >
              Create Property
            </button>
          </div>
        </div>
      </div>

      {(statusMessage || errorMessage) && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 ${
            errorMessage
              ? 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200'
              : 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-200'
          }`}
        >
          {errorMessage || statusMessage}
        </div>
      )}

      {/* Properties List */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Your Properties</h2>
        <p className="text-gray-500 dark:text-gray-400">No properties created yet</p>
      </div>
    </div>
  );
}
