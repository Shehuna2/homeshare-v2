import { useParams } from 'react-router-dom';

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Property Details - {id}
      </h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Property Image */}
        <div className="bg-gray-300 dark:bg-gray-700 h-96 rounded-lg"></div>
        
        {/* Property Info */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Property Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Location</label>
              <p className="text-gray-900 dark:text-white">To be loaded</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Total Value</label>
              <p className="text-gray-900 dark:text-white">$0</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Funding Progress</label>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: '0%' }}></div>
              </div>
            </div>
            <button className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 mt-6">
              Invest Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
