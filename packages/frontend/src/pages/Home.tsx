import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
          Multi-Chain Real Estate Crowdfunding
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Invest in real estate across Ethereum, Base, and Canton networks
        </p>
        <div className="flex justify-center gap-4">
          <Link
            to="/properties"
            className="bg-primary-600 text-white px-8 py-3 rounded-lg hover:bg-primary-700 transition"
          >
            Browse Properties
          </Link>
          <Link
            to="/dashboard"
            className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-8 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Investor Dashboard
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Multi-Chain Support</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Invest on Ethereum, Base, or Canton networks with seamless chain switching
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Multiple Tokens</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Use USDC, USDT, ETH, RIZE, or CC tokens for your investments
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Fractional Ownership</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Own property tokens representing shares in real estate assets
          </p>
        </div>
      </div>

      {/* Supported Networks */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-white">
          Supported Networks
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Ethereum</h4>
            <p className="text-gray-600 dark:text-gray-300">USDC, USDT, ETH</p>
          </div>
          <div className="text-center">
            <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Base</h4>
            <p className="text-gray-600 dark:text-gray-300">USDC, USDT, ETH, RIZE</p>
          </div>
          <div className="text-center">
            <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Canton</h4>
            <p className="text-gray-600 dark:text-gray-300">CC</p>
          </div>
        </div>
      </div>
    </div>
  );
}
