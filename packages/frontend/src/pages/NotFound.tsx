import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
      <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">Page not found</p>
      <Link to="/" className="bg-primary-600 text-white px-8 py-3 rounded-lg hover:bg-primary-700 inline-block">
        Go Home
      </Link>
    </div>
  );
}
