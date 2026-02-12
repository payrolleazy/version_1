/**
 * Date and Time Utilities
 * Standardized date formatting and manipulation functions
 */

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format a date to display format (28 Jan 2026)
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format a date to short format (28/01/2026)
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

/**
 * Format a date to ISO format (2026-01-28)
 */
export function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  return d.toISOString().split('T')[0];
}

/**
 * Format a datetime to display format (28 Jan 2026, 09:30 AM)
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return `${formatDate(d)}, ${formatTime(d)}`;
}

/**
 * Format time to 12-hour format (09:30 AM)
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12

  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

/**
 * Format time to 24-hour format (09:30)
 */
export function formatTime24(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

/**
 * Format to Month Year (January 2026)
 */
export function formatMonthYear(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format to Day Month (28 Jan)
 */
export function formatDayMonth(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// ============================================================================
// Duration Formatting
// ============================================================================

/**
 * Format minutes to hours and minutes (8h 30m)
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '-';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format minutes to decimal hours (8.5)
 */
export function formatDurationDecimal(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '-';
  return (minutes / 60).toFixed(1);
}

/**
 * Format days duration (1.5 days)
 */
export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return '-';

  if (days === 1) return '1 day';
  return `${days} days`;
}

// ============================================================================
// Date Calculations
// ============================================================================

/**
 * Get the start of day
 */
export function startOfDay(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of day
 */
export function endOfDay(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get the start of month
 */
export function startOfMonth(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Get the end of month
 */
export function endOfMonth(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * Get the start of week (Monday)
 */
export function startOfWeek(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Add days to a date
 */
export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Add months to a date
 */
export function addMonths(date: Date | string, months: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Get difference in days between two dates
 */
export function daysBetween(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string): boolean {
  return isSameDay(date, new Date());
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d < startOfDay(new Date());
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d > endOfDay(new Date());
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Get day name from date
 */
export function getDayName(date: Date | string, short: boolean = false): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = short
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[d.getDay()];
}

// ============================================================================
// Relative Time
// ============================================================================

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffMins) < 1) return 'just now';
  if (Math.abs(diffMins) < 60) {
    return diffMins > 0 ? `in ${diffMins} min` : `${Math.abs(diffMins)} min ago`;
  }
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours} hours` : `${Math.abs(diffHours)} hours ago`;
  }
  if (Math.abs(diffDays) < 7) {
    return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
  }

  return formatDate(d);
}

// ============================================================================
// Payroll Period Helpers
// ============================================================================

/**
 * Get payroll period for a given date (first day of month)
 */
export function getPayrollPeriod(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Get list of payroll periods for a year
 */
export function getPayrollPeriodsForYear(year: number): Array<{ value: string; label: string }> {
  const periods = [];
  for (let month = 0; month < 12; month++) {
    const date = new Date(year, month, 1);
    periods.push({
      value: formatDateISO(date),
      label: formatMonthYear(date),
    });
  }
  return periods;
}

/**
 * Get current payroll period
 */
export function getCurrentPayrollPeriod(): string {
  return formatDateISO(getPayrollPeriod(new Date()));
}

// ============================================================================
// Date Range Helpers
// ============================================================================

/**
 * Get preset date ranges
 */
export function getDateRangePresets(): Array<{
  label: string;
  value: string;
  from: Date;
  to: Date;
}> {
  const today = new Date();

  return [
    {
      label: 'Today',
      value: 'today',
      from: startOfDay(today),
      to: endOfDay(today),
    },
    {
      label: 'Yesterday',
      value: 'yesterday',
      from: startOfDay(addDays(today, -1)),
      to: endOfDay(addDays(today, -1)),
    },
    {
      label: 'This Week',
      value: 'this_week',
      from: startOfWeek(today),
      to: endOfDay(today),
    },
    {
      label: 'Last 7 Days',
      value: 'last_7_days',
      from: startOfDay(addDays(today, -6)),
      to: endOfDay(today),
    },
    {
      label: 'This Month',
      value: 'this_month',
      from: startOfMonth(today),
      to: endOfDay(today),
    },
    {
      label: 'Last 30 Days',
      value: 'last_30_days',
      from: startOfDay(addDays(today, -29)),
      to: endOfDay(today),
    },
    {
      label: 'Last Month',
      value: 'last_month',
      from: startOfMonth(addMonths(today, -1)),
      to: endOfMonth(addMonths(today, -1)),
    },
  ];
}
