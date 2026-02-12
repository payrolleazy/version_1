import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerClient'

// Define role IDs from a_auth_function_gateway table
const EMPLOYEE_ROLE_ID = '9e9942d7-0d41-4405-8546-e32e155d4d2c';
const CANDIDATE_ROLE_ID = '390c05eb-2f6a-474e-957d-3496458f388a';
const ADMIN_ROLE_ID = 'd971edc1-ed25-4697-95bf-3a8f1ab43467';
const SUPER_ADMIN_ROLE_ID = '95b1c199-b3c1-428e-bbb4-0722429f3c96';
const MASTER_ADMIN_ROLE_ID = 'a1b2c3d4-e5f6-7890-1234-567890abcdef'; // Placeholder: Replace with actual Master Admin Role ID
const PAYROLL_ADMIN_ROLE_ID = 'dbbeefb8-985b-49f4-94a5-6f3a8a3c1ce6';

export async function middleware(request: NextRequest) {
  const supabase = createClient()

  const { data: { session } } = await supabase.auth.getSession()
  const userRoleId = session?.user?.user_metadata?.role_id;

  const { pathname } = request.nextUrl;

  // Routes that are part of the authentication flow (login, signup, etc.)
  const authRoutes = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/update-password'];
  const isAuthRoute = authRoutes.includes(pathname);

  // Determine if the current path is for the employee, candidate, admin, super_admin, or master_admin portal
  const isEmployeePortalPath = pathname.startsWith('/employee');
  const isAdminPortalPath = pathname.startsWith('/admin');
  const isSuperAdminPortalPath = pathname.startsWith('/super_admin');
  const isMasterAdminPortalPath = pathname.startsWith('/master_admin');
  const isPayrollAdminPortalPath = pathname.startsWith('/payroll_admin');
  const isCandidatePortalPath = !isEmployeePortalPath && !isAdminPortalPath && !isSuperAdminPortalPath && !isMasterAdminPortalPath && !isPayrollAdminPortalPath;

  // --- Handle authenticated users ---
  if (session) {
    // If an authenticated user tries to access any auth route, redirect them to their respective dashboard
    if (isAuthRoute) {
      if (userRoleId === EMPLOYEE_ROLE_ID) {
        return NextResponse.redirect(new URL('/employee', request.url));
      } else if (userRoleId === CANDIDATE_ROLE_ID) {
        return NextResponse.redirect(new URL('/', request.url));
      } else if (userRoleId === ADMIN_ROLE_ID) {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else if (userRoleId === SUPER_ADMIN_ROLE_ID) {
        return NextResponse.redirect(new URL('/super_admin', request.url));
      } else if (userRoleId === MASTER_ADMIN_ROLE_ID) {
        return NextResponse.redirect(new URL('/master_admin', request.url));
      } else if (userRoleId === PAYROLL_ADMIN_ROLE_ID) {
        return NextResponse.redirect(new URL('/payroll_admin', request.url));
      }
      // Fallback for unknown role or missing role_id for authenticated user
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Admin portal protection
    if (isAdminPortalPath) {
      if (userRoleId !== ADMIN_ROLE_ID) {
        // Redirect non-admin users trying to access admin portal
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    // Super Admin portal protection
    if (isSuperAdminPortalPath) {
      if (userRoleId !== SUPER_ADMIN_ROLE_ID) {
        // Redirect non-super_admin users trying to access super_admin portal
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    // Master Admin portal protection
    if (isMasterAdminPortalPath) {
      if (userRoleId !== MASTER_ADMIN_ROLE_ID) {
        // Redirect non-master_admin users trying to access master_admin portal
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    // Payroll Admin portal protection
    if (isPayrollAdminPortalPath) {
      if (userRoleId !== PAYROLL_ADMIN_ROLE_ID) {
        // Redirect non-payroll_admin users trying to access payroll_admin portal
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    // If user is an employee
    if (userRoleId === EMPLOYEE_ROLE_ID) {
      // If employee tries to access candidate portal paths, redirect to employee dashboard
      if (isCandidatePortalPath) {
        return NextResponse.redirect(new URL('/employee', request.url));
      }
    } 
    // If user is a candidate
    else if (userRoleId === CANDIDATE_ROLE_ID) {
      // If candidate tries to access employee portal paths, redirect to candidate dashboard
      if (isEmployeePortalPath) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
    // If role_id is present but doesn't match known roles, or if it's missing for an authenticated user
    // For now, let them proceed, but a more robust solution might redirect to an error page or re-authenticate.
  } 
  // --- Handle unauthenticated users ---
  else {
    // If unauthenticated user tries to access a protected route (not auth route)
    if (!isAuthRoute) {
      // Redirect all unauthenticated access to protected routes to the login page
      // If trying to access employee portal, redirect to login
      if (isEmployeePortalPath) {
        return NextResponse.redirect(new URL('/employee/auth/login', request.url));
      } else if (isAdminPortalPath) {
        // Redirect unauthenticated users trying to access admin portal to admin login
        return NextResponse.redirect(new URL('/admin/auth/login', request.url));
      } else if (isSuperAdminPortalPath) {
        // Redirect unauthenticated users trying to access super_admin portal to super_admin login
        return NextResponse.redirect(new URL('/super_admin/auth/login', request.url));
      } else if (isMasterAdminPortalPath) {
        // Redirect unauthenticated users trying to access master_admin portal to master_admin login
        return NextResponse.redirect(new URL('/master_admin/auth/login', request.url));
      } else if (isPayrollAdminPortalPath) {
        // Redirect unauthenticated users trying to access payroll_admin portal to payroll_admin login
        return NextResponse.redirect(new URL('/payroll_admin/auth/login', request.url));
      }
    }
    // Allow unauthenticated users to access auth routes
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder (e.g. /vercel.svg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*) ',
  ],
}