import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

export default function Navbar() {
  const { address } = useSelector((state: RootState) => state.user);
  const { activeChainId } = useSelector((state: RootState) => state.chain);

  const getChainName = (chainId: number) => {
    switch (chainId) {
      case 1: return 'Ethereum';
      case 8453: return 'Base';
      case 9000: return 'Canton';
      default: return 'Unknown';
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold text-primary-600">
            Homeshare
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex space-x-6">
            <Link to="/properties" className="text-gray-700 dark:text-gray-300 hover:text-primary-600">
              Properties
            </Link>
            <Link to="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-primary-600">
              Dashboard
            </Link>
            <Link to="/owner" className="text-gray-700 dark:text-gray-300 hover:text-primary-600">
              Owner Console
            </Link>
          </div>

          {/* Wallet & Chain Info */}
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">Chain: </span>
              <span className="text-gray-900 dark:text-white font-medium">
                {getChainName(activeChainId)}
              </span>
            </div>
            <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
