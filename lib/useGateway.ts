/**
 * useGateway Hook
 * Standardized hook for making API calls through the universal gateway
 */

import { useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { API_ENDPOINTS, POLLING } from './constants';

// ============================================================================
// Types
// ============================================================================
export interface GatewayResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface GatewayOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to throw on error instead of returning error response */
  throwOnError?: boolean;
  /** Custom headers to include */
  headers?: Record<string, string>;
}

export interface UseGatewayReturn<T = any> {
  /** Execute the gateway call */
  execute: (params?: Record<string, any>) => Promise<GatewayResponse<T>>;
  /** Whether the request is in progress */
  loading: boolean;
  /** Response data */
  data: T | null;
  /** Error message if request failed */
  error: string | null;
  /** Reset state to initial values */
  reset: () => void;
  /** Refetch with last used params */
  refetch: () => Promise<GatewayResponse<T>>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Make a gateway API call
 */
export async function callGateway<T = any>(
  endpoint: string,
  payload: Record<string, any>,
  token: string,
  options: GatewayOptions = {}
): Promise<GatewayResponse<T>> {
  const { timeout = POLLING.DEFAULT_REQUEST_TIMEOUT, headers = {} } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...headers,
      },
      body: JSON.stringify({ ...payload, accessToken: token }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    // Handle various response formats
    if (!response.ok) {
      return {
        success: false,
        error: result.message || result.error || `HTTP Error: ${response.status}`,
      };
    }

    // Check for explicit success flag
    if (result.hasOwnProperty('success') && !result.success) {
      return {
        success: false,
        error: result.message || result.error || 'Request failed',
        data: result.data,
      };
    }

    return {
      success: true,
      data: result.data ?? result,
      message: result.message,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out',
      };
    }

    return {
      success: false,
      error: err.message || 'Network error',
    };
  }
}

/**
 * Make a gateway call that invokes a PostgreSQL function
 */
export async function callPgFunction<T = any>(
  configId: string,
  params: Record<string, any>,
  token: string,
  options?: GatewayOptions
): Promise<GatewayResponse<T>> {
  return callGateway<T>(
    API_ENDPOINTS.GATEWAY,
    { config_id: configId, params },
    token,
    options
  );
}

/**
 * Make a gateway call for reading data
 */
export async function callReadGateway<T = any>(
  configId: string,
  params: {
    filters?: Record<string, any>;
    orderBy?: Array<[string, 'ASC' | 'DESC']>;
    limit?: number;
    offset?: number;
  },
  token: string,
  options?: GatewayOptions
): Promise<GatewayResponse<T>> {
  return callGateway<T>(
    API_ENDPOINTS.READ,
    { config_id: configId, ...params },
    token,
    options
  );
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for making gateway API calls with built-in state management
 *
 * @example
 * ```tsx
 * const { execute, loading, data, error } = useGateway<DashboardData>(
 *   AMS_GATEWAY_CONFIGS.EMPLOYEE_DASHBOARD
 * );
 *
 * useEffect(() => {
 *   execute({ date_from: '2026-01-01' });
 * }, []);
 * ```
 */
export function useGateway<T = any>(
  configId: string,
  options: GatewayOptions = {}
): UseGatewayReturn<T> {
  const { session } = useSessionContext();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState<Record<string, any>>({});

  const reset = useCallback(() => {
    setLoading(false);
    setData(null);
    setError(null);
    setLastParams({});
  }, []);

  const execute = useCallback(
    async (params: Record<string, any> = {}): Promise<GatewayResponse<T>> => {
      if (!session?.access_token) {
        const errorMsg = 'Authentication required';
        setError(errorMsg);
        if (options.throwOnError) {
          throw new Error(errorMsg);
        }
        return { success: false, error: errorMsg };
      }

      setLoading(true);
      setError(null);
      setLastParams(params);

      const result = await callPgFunction<T>(
        configId,
        params,
        session.access_token,
        options
      );

      setLoading(false);

      if (result.success) {
        setData(result.data ?? null);
        setError(null);
      } else {
        setError(result.error ?? 'Unknown error');
        if (options.throwOnError) {
          throw new Error(result.error);
        }
      }

      return result;
    },
    [session?.access_token, configId, options]
  );

  const refetch = useCallback(async (): Promise<GatewayResponse<T>> => {
    return execute(lastParams);
  }, [execute, lastParams]);

  return {
    execute,
    loading,
    data,
    error,
    reset,
    refetch,
  };
}

/**
 * Hook for reading data through the read gateway
 *
 * @example
 * ```tsx
 * const { execute, loading, data, error, pagination } = useReadGateway<LeaveType[]>(
 *   'lms-read-leave-types'
 * );
 * ```
 */
export function useReadGateway<T = any>(
  configId: string,
  options: GatewayOptions = {}
) {
  const { session } = useSessionContext();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const reset = useCallback(() => {
    setLoading(false);
    setData(null);
    setError(null);
    setTotalCount(0);
  }, []);

  const execute = useCallback(
    async (params: {
      filters?: Record<string, any>;
      orderBy?: Array<[string, 'ASC' | 'DESC']>;
      limit?: number;
      offset?: number;
    } = {}): Promise<GatewayResponse<T>> => {
      if (!session?.access_token) {
        const errorMsg = 'Authentication required';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setLoading(true);
      setError(null);

      const result = await callReadGateway<T>(
        configId,
        params,
        session.access_token,
        options
      );

      setLoading(false);

      if (result.success) {
        setData(result.data ?? null);
        // Handle pagination metadata if present
        if (result.data && typeof result.data === 'object' && 'total_count' in (result.data as any)) {
          setTotalCount((result.data as any).total_count);
        }
        setError(null);
      } else {
        setError(result.error ?? 'Unknown error');
      }

      return result;
    },
    [session?.access_token, configId, options]
  );

  return {
    execute,
    loading,
    data,
    error,
    reset,
    totalCount,
  };
}

/**
 * Hook for executing multiple gateway calls in parallel
 *
 * @example
 * ```tsx
 * const { executeAll, loading, results, errors } = useParallelGateway([
 *   { configId: 'ams-employee-dashboard', params: {} },
 *   { configId: 'lms-employee-dashboard', params: {} },
 * ]);
 * ```
 */
export function useParallelGateway(
  calls: Array<{ configId: string; params: Record<string, any> }>,
  options: GatewayOptions = {}
) {
  const { session } = useSessionContext();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<GatewayResponse>>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const executeAll = useCallback(async () => {
    if (!session?.access_token) {
      setErrors(['Authentication required']);
      return [];
    }

    setLoading(true);
    setErrors([]);

    const promises = calls.map(({ configId, params }) =>
      callPgFunction(configId, params, session.access_token, options)
    );

    const responses = await Promise.all(promises);

    setResults(responses);
    setErrors(
      responses
        .filter((r) => !r.success)
        .map((r) => r.error ?? 'Unknown error')
    );
    setLoading(false);

    return responses;
  }, [session?.access_token, calls, options]);

  return {
    executeAll,
    loading,
    results,
    errors,
  };
}

export default useGateway;
