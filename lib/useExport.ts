
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase'; // Ensure you have this client configured

const POLL_INTERVAL_MS = 3000;

type ExportStatus = 'IDLE' | 'INITIATING' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'DOWNLOAD_READY' | 'FAILED';

export function useExport(config_id: string) {
  const { session } = useSessionContext();
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<ExportStatus>('IDLE');
  const [progress, setProgress] = useState<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const reset = () => {
    setJobId(null);
    setStatus('IDLE');
    setProgress(0);
    setDownloadUrl(null);
    setError(null);
    setLoading(false);
  };

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
      // This endpoint's job is to create a job record in the database.
      // A database trigger will then start the actual export worker.
      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: config_id,
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.data || result.data.length === 0) {
        throw new Error(result.message || 'Failed to initiate export job.');
      }

      const newJobId = result.data[0]?.job_id;
      if (!newJobId) {
        throw new Error('Export job ID not received.');
      }

      setJobId(newJobId);
      setStatus('PENDING'); // The job is now in the queue
    } catch (err: any) {
      setError(`Failed to start export: ${err.message}`);
      setStatus('FAILED');
    } finally {
      setLoading(false);
    }
  }, [session, config_id]);

  const fetchDownloadUrl = useCallback(async (currentJobId: string) => {
    if (!session?.access_token) return;

    try {
      const functionsBaseUrl = supabase.supabaseUrl.replace('.co', '.co/functions/v1');
      const response = await fetch(`${functionsBaseUrl}/export-download?jobId=${currentJobId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get download link.');
      
      setDownloadUrl(data.downloadUrl);
      setStatus('DOWNLOAD_READY');
    } catch (err: any) {
      setError(`Failed to get download URL: ${err.message}`);
      setStatus('FAILED');
    }
  }, [session]);

  const fetchExportStatus = useCallback(async () => {
    if (!jobId || !session?.access_token) return;

    try {
      const functionsBaseUrl = supabase.supabaseUrl.replace('.co', '.co/functions/v1');
      const response = await fetch(`${functionsBaseUrl}/export-status?jobId=${jobId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch status.');

      setStatus(data.status);
      setProgress(data.progress);

      if (data.status === 'COMPLETED') {
        fetchDownloadUrl(jobId);
      } else if (data.status === 'FAILED') {
        setError(data.errorMessage || 'Export job failed.');
      }
    } catch (err: any) {
      setError(`Failed to get status: ${err.message}`);
      setStatus('FAILED');
    }
  }, [jobId, session, fetchDownloadUrl]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'PENDING' || status === 'PROCESSING') {
      interval = setInterval(fetchExportStatus, POLL_INTERVAL_MS);
    }
    return () => clearInterval(interval);
  }, [status, fetchExportStatus]);

  return {
    initiateExport,
    status,
    progress,
    downloadUrl,
    error,
    loading,
    reset,
  };
}
