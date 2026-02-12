'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import { supabase } from '@/lib/supabase';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================
type JobStatus = 'IDLE' | 'INITIATING' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DOWNLOAD_READY';

interface Establishment {
    id: number;
    name: string;
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS (PLACEHOLDERS)
// ============================================================================
const CONFIGS = {
  // NOTE: These are placeholder config_ids
  INITIATE_CHALLAN_JOB: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  READ_ESTABLISHMENTS: 'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
  READ_PAYROLL_PERIODS: 'c3d4e5f6-a7b8-9012-3456-7890abcdef12',
};

// ============================================================================
// 3. MAIN PAGE COMPONENT
// ============================================================================
export default function ChallanEcrGenerationPage() {
  const { session } = useSessionContext();
  
  const [periods, setPeriods] = useState<string[]>(['2023-11-01', '2023-10-01', '2023-09-01']);
  const [establishments, setEstablishments] = useState<Establishment[]>([{id: 1, name: 'TechCorp Bangalore'}]);
  
  const [selectedPeriod, setSelectedPeriod] = useState<string>(periods[0]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<number>(establishments[0].id);

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>('IDLE');
  const [progress, setProgress] = useState<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // MOCK ASYNC JOB LOGIC
  const initiateGeneration = async () => {
    if (!session) return;
    setError(null);
    setStatus('INITIATING');
    setJobId(null);
    setDownloadUrl(null);
    setProgress(0);

    console.log('Initiating Challan/ECR generation for', {selectedPeriod, selectedEstablishment});

    // Mock API call to start job
    setTimeout(() => {
        const newJobId = `job_${Date.now()}`;
        setJobId(newJobId);
        setStatus('PROCESSING');
        console.log('Job started with ID:', newJobId);
    }, 1000);
  };

  useEffect(() => {
      let interval: NodeJS.Timeout;
      if (jobId && status === 'PROCESSING') {
          interval = setInterval(() => {
              setProgress(prev => {
                  const newProgress = prev + 20;
                  if (newProgress >= 100) {
                      clearInterval(interval);
                      setStatus('COMPLETED');
                      console.log('Job completed. Fetching download URL...');
                      // Mock fetching download URL
                      setTimeout(() => {
                          setDownloadUrl('/mock-download/ecr-challan.zip');
                          setStatus('DOWNLOAD_READY');
                      }, 1500);
                      return 100;
                  }
                  return newProgress;
              });
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [jobId, status]);


  const handleDownload = () => {
    if (downloadUrl) {
      alert(`Starting download from: ${downloadUrl}`);
      // In a real app: window.open(downloadUrl, '_blank');
      // Reset for next run
      setStatus('IDLE');
      setJobId(null);
    }
  };

  return (
    <div className="p-8 bg-white rounded-lg shadow-md min-h-screen">
       <div className="mb-4">
        <a href="/payroll_admin/pf-dashboard" className="text-blue-600 hover:underline">&larr; Back to PF Dashboard</a>
      </div>
      <h1 className="text-3xl font-bold mb-6">Generate Challan & ECR</h1>
      
      <div className="max-w-md mx-auto mt-10 bg-gray-50 p-8 rounded-xl shadow-lg">
        {status === 'IDLE' && (
            <div className="space-y-6">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payroll Period</label>
                    <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className="w-full p-2 border rounded-md">
                        {periods.map(p => <option key={p} value={p}>{new Date(p).toLocaleString('default', {month: 'long', year: 'numeric'})}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Establishment</label>
                    <select value={selectedEstablishment} onChange={e => setSelectedEstablishment(Number(e.target.value))} className="w-full p-2 border rounded-md">
                        {establishments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>
                <Button onClick={initiateGeneration} className="w-full">Generate Challan & ECR</Button>
            </div>
        )}

        {(status !== 'IDLE') && (
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">{getStatusMessage(status)}</h2>
                <p className="text-gray-500 mb-4">{getStatusSubMessage(status, error)}</p>

                {(status === 'PROCESSING' || status === 'COMPLETED') && (
                    <div className="w-full bg-gray-200 rounded-full h-4 my-4">
                        <div className="bg-blue-600 h-4 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                )}
                
                {status === 'DOWNLOAD_READY' && (
                    <Button onClick={handleDownload} className="w-full">Download Files</Button>
                )}

                {status === 'FAILED' && (
                    <Button onClick={() => setStatus('IDLE')} variant="destructive" className="w-full">Try Again</Button>
                )}
                 {(status === 'PROCESSING' || status === 'INITIATING') && (
                    <div className="mt-4">
                        <Loader />
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}

const getStatusMessage = (status: JobStatus): string => {
    switch (status) {
        case 'INITIATING': return 'Initiating Job...';
        case 'PROCESSING': return 'Generating Files...';
        case 'COMPLETED': return 'Finalizing...';
        case 'DOWNLOAD_READY': return 'Your Files are Ready!';
        case 'FAILED': return 'Generation Failed';
        default: return 'Please wait...';
    }
}
const getStatusSubMessage = (status: JobStatus, error: string | null): string => {
    switch (status) {
        case 'PROCESSING': return 'This may take a few moments. Please do not close this window.';
        case 'DOWNLOAD_READY': return 'Click the button below to download the generated zip file.';
        case 'FAILED': return error || 'An unknown error occurred. Please try again.';
        default: return 'We are preparing your request.';
    }
}
