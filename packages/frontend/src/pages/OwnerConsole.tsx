export default function OwnerConsole() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Owner Console
      </h1>

      {/* Create Property Button */}
      <div className="mb-8">
        <button className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700">
          + Create New Property
        </button>
      </div>

      {/* Properties List */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Your Properties</h2>
        <p className="text-gray-500 dark:text-gray-400">No properties created yet</p>
      </div>
    </div>
  );
}
