'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button'; // Re-use existing generic Button
import ExportAssignedPayStructureModal from './ExportAssignedPayStructureModal'; // Import the newly created modal

export default function Step3ExportFunctionality() {
  const [showExportModal, setShowExportModal] = useState(false);

  const handleExport = () => {
    setShowExportModal(true);
  };

  return (
    <div className="p-6 border border-gray-200 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Step 3: Export Existing Assignments</h2>
      <p className="mb-4 text-gray-600">
        You can export the currently assigned employee pay structures to an Excel file.
      </p>
      <Button onClick={handleExport}>
        Export to Excel
      </Button>

      {showExportModal && (
        <ExportAssignedPayStructureModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          config_id='export-employee-assignments' // Changed to use the config_id for user roles export
        />
      )}
    </div>
  );
}
