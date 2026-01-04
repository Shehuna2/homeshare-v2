export default function InvestorDashboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Investor Dashboard
      </h1>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Total Invested</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">$0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Active Properties</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Total Returns</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">$0</p>
        </div>
      </div>

      {/* By Chain */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Investments by Chain</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-900 dark:text-white">Ethereum</span>
            <span className="text-gray-900 dark:text-white">$0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-900 dark:text-white">Base</span>
            <span className="text-gray-900 dark:text-white">$0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-900 dark:text-white">Canton</span>
            <span className="text-gray-900 dark:text-white">$0</span>
          </div>
        </div>
      </div>

      {/* Investment History */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Investment History</h2>
        <p className="text-gray-500 dark:text-gray-400">No investments yet</p>
      </div>
    </div>
  );
}
