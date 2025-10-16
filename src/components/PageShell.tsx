import Breadcrumbs from './Breadcrumbs';

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-8 py-4">
          <Breadcrumbs />
        </div>
      </header>
      <main className="p-8">
        {children}
      </main>
    </div>
  );
}
