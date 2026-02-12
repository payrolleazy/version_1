'use client';

import React, { useState } from 'react';

// Update interface to accept onClick
interface TabProps {
  label: string;
  children: React.ReactNode;
  isActive?: boolean; // Optional: specific to usage in parent
  onClick?: () => void; // Added onClick
}

function Tab({ children }: TabProps) {
  return <div className="py-4">{children}</div>;
}

interface TabsProps {
  children: React.ReactElement<TabProps>[];
}

export default function Tabs({ children }: TabsProps) {
  const [activeTab, setActiveTab] = useState(children[0]?.props.label);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>, newActiveTab: string, childOnClick?: () => void) => {
    e.preventDefault();
    setActiveTab(newActiveTab);
    
    // FIX: Execute the child's onClick handler if it exists
    if (childOnClick) {
      childOnClick();
    }
  };

  return (
    <div className="w-full">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {children.map((child) => (
            <button
              key={child.props.label}
              // FIX: Pass child.props.onClick to the handler
              onClick={(e) => handleClick(e, child.props.label, child.props.onClick)}
              suppressHydrationWarning={true}
              className={`${
                activeTab === child.props.label
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {child.props.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-2">
        {children.map((child) => {
          if (child.props.label === activeTab) {
            return <div key={child.props.label}>{child.props.children}</div>;
          }
          return null;
        })}
      </div>
    </div>
  );
}

Tabs.Tab = Tab;