// D:\gemini_cli\version_1\components\ConfigurePayStructureComponentRulesModal.tsx
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './ui/Button';
import Input from './ui/Input';

interface ConfigurePayStructureComponentRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedOverrideRules: any) => void;
  initialOverrideRules: any; // The current override rules for the pay structure component
  baseComponentRules: any; // The rules from the associated WCM component
  componentName: string; // For display in the modal title
  loading: boolean;
}

const renderField = (key: string, value: any, handleInputChange: (keys: string[], value: any) => void, keys: string[] = []) => {
  const currentKey = [...keys, key];
  const type = typeof value;

  if (type === 'object' && value !== null && !Array.isArray(value)) {
    return (
      <div key={key} className="pl-4 border-l-2 border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">{key}</h3>
        {Object.entries(value).map(([subKey, subValue]) => renderField(subKey, subValue, handleInputChange, currentKey))}
      </div>
    );
  }

  return (
    <div key={key} className="flex items-center justify-between py-2">
      <label htmlFor={currentKey.join('.')} className="text-sm font-medium text-gray-700">{key}</label>
      {type === 'boolean' ? (
        <button
          type="button"
          id={currentKey.join('.')}
          onClick={() => handleInputChange(currentKey, !value)}
          className={`${
            value ? 'bg-gradient-to-r from-[#d0b9df] to-[#a9b9df]' : 'bg-gray-200'
          } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
          role="switch"
          aria-checked={value}
        >
          <span className="sr-only">Toggle {key}</span>
          <span
            aria-hidden="true"
            className={`${
              value ? 'translate-x-5' : 'translate-x-0'
            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out`}
          />
        </button>
      ) : Array.isArray(value) ? (
        <Input
          id={currentKey.join('.')}
          type="text"
          value={value.join(', ')} // Display array as comma-separated string
          onChange={(e) => handleInputChange(currentKey, e.target.value.split(',').map(item => item.trim()))} // Parse back to array
          className="w-1/2"
          disabled={key === 'method'} // Assuming 'method' should not be overridden
        />
      ) : (
        <Input
          id={currentKey.join('.')}
          type={type === 'number' ? 'number' : 'text'}
          value={value === null || value === undefined ? '' : value}
          onChange={(e) => handleInputChange(currentKey, type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
          className="w-1/2"
          disabled={key === 'method'} // Assuming 'method' should not be overridden
        />
      )}
    </div>
  );
};

export default function ConfigurePayStructureComponentRulesModal({
  isOpen,
  onClose,
  onSave,
  initialOverrideRules,
  baseComponentRules,
  componentName,
  loading,
}: ConfigurePayStructureComponentRulesModalProps) {
  const [overrideRules, setOverrideRules] = useState<any>({});

  useEffect(() => {
    // Initialize with initialOverrideRules, or baseComponentRules if initialOverrideRules is empty
    if (initialOverrideRules && Object.keys(initialOverrideRules).length > 0) {
      setOverrideRules(initialOverrideRules);
    } else if (baseComponentRules && Object.keys(baseComponentRules).length > 0) {
      setOverrideRules(baseComponentRules);
    } else {
      setOverrideRules({});
    }
  }, [initialOverrideRules, baseComponentRules, isOpen]);

  const handleInputChange = (keys: string[], value: any) => {
    setOverrideRules((prevRules: any) => {
      const newRules = { ...prevRules };
      let current = newRules;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
          current[keys[i]] = {}; // Ensure path exists
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newRules;
    });
  };

  const handleSave = () => {
    onSave(overrideRules);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Configure Override Rules for ${componentName}`}>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {Object.entries(overrideRules).map(([key, value]) => renderField(key, value, handleInputChange))}
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button onClick={onClose} variant="secondary" disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} isLoading={loading}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
