import { Search, Filter } from 'lucide-react';
import { UserType } from '../types';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType: UserType;
  onTypeChange: (type: UserType) => void;
  stats: {
    all: number;
    nbfc: number;
    merchants: number;
    customers: number;
  };
}

export function FilterBar({ searchQuery, onSearchChange, selectedType, onTypeChange, stats }: FilterBarProps) {
  const filters = [
    { id: 'all' as UserType, label: 'All Users', count: stats.all, color: 'from-gray-500 to-gray-600' },
    { id: 'nbfc_admin' as UserType, label: 'NBFC Admins', count: stats.nbfc, color: 'from-purple-500 to-purple-600' },
    { id: 'merchant' as UserType, label: 'Merchants', count: stats.merchants, color: 'from-blue-500 to-blue-600' },
    { id: 'customer' as UserType, label: 'Customers', count: stats.customers, color: 'from-green-500 to-green-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-12 pr-4 text-gray-900 placeholder-gray-500 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
        />
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        <div className="flex items-center text-sm font-medium text-gray-700">
          <Filter className="mr-2 h-4 w-4" />
          Filter:
        </div>
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onTypeChange(filter.id)}
            className={`group relative flex-shrink-0 overflow-hidden rounded-xl px-6 py-3 font-medium shadow-sm transition-all ${
              selectedType === filter.id
                ? `bg-gradient-to-r ${filter.color} text-white shadow-lg scale-105`
                : 'bg-white text-gray-700 hover:shadow-md hover:scale-105 dark:bg-gray-800 dark:text-gray-200'
            }`}
          >
            <div className="relative z-10 flex items-center">
              <span>{filter.label}</span>
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                selectedType === filter.id
                  ? 'bg-white/25 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200'
              }`}>
                {filter.count}
              </span>
            </div>
            {selectedType !== filter.id && (
              <div className={`absolute inset-0 bg-gradient-to-r ${filter.color} opacity-0 transition-opacity group-hover:opacity-10`}></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
