// D:\gemini_cli\version_1\components\DynamicJsonForm.tsx
import React from 'react';
import Input from './ui/Input';
import Button from './ui/Button'; // Assuming Button is available for the toggle switch

interface DynamicJsonFormProps {
  formData: any;
  onFormChange: (updatedFormData: any) => void;
  loading?: boolean;
}

const renderField = (key: string, value: any, handleInputChange: (keys: string[], value: any) => void, keys: string[] = []) => {
  const currentKey = [...keys, key];
  const type = typeof value;

  if (type === 'object' && value !== null && !Array.isArray(value)) {
    return (
      <div key={key} className="pl-4 border-l-2 border-gray-200 mt-2">
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

const DynamicJsonForm: React.FC<DynamicJsonFormProps> = ({ formData, onFormChange, loading }) => {

  const handleInputChange = (keys: string[], value: any) => {
    const newFormData = { ...formData };
    let current = newFormData;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {}; // Ensure path exists
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    onFormChange(newFormData);
  };

  return (
    <div className="p-4 bg-gradient-to-r from-[#faf7ff] to-[#f5f8ff] rounded-lg shadow-inner space-y-4 max-h-64 overflow-y-auto">
      {Object.entries(formData).map(([key, value]) => renderField(key, value, handleInputChange))}
    </div>
  );
};

export default DynamicJsonForm;
