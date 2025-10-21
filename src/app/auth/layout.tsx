import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="w-1/2 bg-gray-100 flex items-center justify-center">
        {/* Placeholder for animated illustration */}
        <div className="text-center">
          <h1 className="text-4xl font-bold">Welcome</h1>
          <p className="mt-2 text-lg text-gray-600">A modern auth experience</p>
        </div>
      </div>
      <div className="w-1/2 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
