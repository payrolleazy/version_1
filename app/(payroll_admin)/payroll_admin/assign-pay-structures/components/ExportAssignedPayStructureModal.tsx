import { useSessionContext } from '@supabase/auth-helpers-react';
import { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/Modal'; // Re-use existing generic Modal
import Button from '@/components/ui/Button'; // Re-use existing generic Button
import Loader from '@/components/ui/Loader'; // Re-use existing generic Loader
import { supabase } from '@/lib/supabase'; // Re-use existing Supabase client

interface ExportAssignedPayStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  config_id: string; // This will be 'export-employee-assignments'
}

const POLL_INTERVAL_MS = 3000; // Define polling interval for export status

export default function ExportAssignedPayStructureModal({ isOpen, onClose, config_id }: ExportAssignedPayStructureModalProps) {
  const { session } = useSessionContext();
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('IDLE');
  const [progress, setProgress] = useState<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const initiateExport = useCallback(async () => {
    if (!session?.access_token) {
      setError('Authentication required to initiate export.');
      return;
    }

    setLoading(true);
    setStatus('INITIATING');
    setError(null);
    setDownloadUrl(null);
    setProgress(0);

    try {
      // Call the *new* dedicated API route for this export
      const response = await fetch('/api/payroll/bulk-assign-pay-structures-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: config_id, // Pass the specific config_id for this export
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.data || result.data.length === 0) {
        throw new Error(result.message || 'Failed to initiate export job or no job ID returned.');
      }

      const newJobId = result.data[0]?.job_id;
      if (!newJobId) {
        throw new Error('Export job ID not received in expected format.');
      }!

      setJobId(newJobId);
      setStatus('PENDING');
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to start export: ${err.message}`);
      setStatus('FAILED');
      setLoading(false);
    }
  }, [session, config_id]);

  const fetchDownloadUrl = useCallback(async () => {
    if (!jobId || !session?.access_token) return;

    try {
      // Supabase client instance from '@/lib/supabase' is used
      const functionsBaseUrl = supabase.supabaseUrl.replace('.co', '.co/functions/v1');
      const response = await fetch(`${functionsBaseUrl}/export-download?jobId=${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get download link.');
      }

      setDownloadUrl(data.downloadUrl);
      setStatus('DOWNLOAD_READY');
    } catch (err: any) {
      setError(`Failed to get download URL: ${err.message}`);
      setStatus('FAILED');
    }
  }, [jobId, session]);

  const fetchExportStatus = useCallback(async () => {
    if (!jobId || !session?.access_token) return;

    try {
      // Supabase client instance from '@/lib/supabase' is used
      const functionsBaseUrl = supabase.supabaseUrl.replace('.co', '.co/functions/v1');
      const response = await fetch(`${functionsBaseUrl}/export-status?jobId=${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch export status.');
      }

      setStatus(data.status);
      setProgress(data.progress);

      if (data.status === 'COMPLETED') {
        await fetchDownloadUrl();
      } else if (data.status === 'FAILED') {
        setError(data.errorMessage || 'Export job failed.');
      }
    } catch (err: any) {
      setError(`Failed to get status: ${err.message}`);
      setStatus('FAILED');
    }
  }, [jobId, session, fetchDownloadUrl]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setJobId(null);
      setStatus('IDLE');
      setProgress(0);
      setDownloadUrl(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen && (status === 'PENDING' || status === 'PROCESSING')) {
      interval = setInterval(fetchExportStatus, POLL_INTERVAL_MS);
    }
    return () => clearInterval(interval);
  }, [isOpen, status, fetchExportStatus]);

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
      onClose(); // Close modal after download initiated
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Assigned Pay Structure to Excel">
      <div className="p-4">
        {error && <p className="text-red-500 mb-4">{error}</p>}

        {status === 'IDLE' && (
          <div className="text-center">
            <p className="mb-4">Click the button below to start the export process.</p>
            <Button onClick={initiateExport} disabled={loading}>Start Export</Button>
          </div>
        )}
        {status === 'INITIATING' && <p>Initiating export job...</p>}
        {status === 'PENDING' && <p>Export job queued. Waiting to start...</p>}
        {status === 'PROCESSING' && (
          <div>
            <p>Export in progress: {progress}% complete</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
        {status === 'COMPLETED' && <p>Export job completed. Preparing download link...</p>}
        {status === 'DOWNLOAD_READY' && (
          <div>
            <p className="mb-4">Your export is ready!</p>
            <Button onClick={handleDownload}>Download Excel File</Button>
          </div>
        )}
        {status === 'FAILED' && <p>Export failed. Please try again.</p>}

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} variant="ghost" disabled={loading || status === 'PROCESSING' || status === 'PENDING'}>
            {status === 'DOWNLOAD_READY' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
