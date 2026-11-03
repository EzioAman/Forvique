import { shadcn } from '@clerk/themes';
import type { ComponentProps } from 'react';
import type { ClerkProvider } from '@clerk/nextjs';

export type ClerkAppearance = NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>;

/**
 * Global appearance configuration for Clerk components.
 * 
 * Powered by Clerk's official `shadcn` CSS-variable theme + Forvique custom tokens:
 * - Automatically keys off `:root` and `.dark` CSS variables (--card, --primary, --border, etc.)
 * - Zero hydration lag or theme mismatch when user toggles light/dark/system mode
 * - Consistent 10px rounded borders (`rounded-xl` / `rounded-lg`) and Geist typography
 * - Formatted for <SignIn />, <SignUp />, <UserButton />, <OrganizationSwitcher />, <OrganizationProfile />
 */
export const clerkAppearance: ClerkAppearance = {
  variables: {
    ...shadcn.variables,
    fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    borderRadius: '0.625rem',
  },
  elements: {
    ...shadcn.elements,

    // Top-level containers & cards
    rootBox: 'font-sans',
    cardBox: 'shadow-sm border border-neutral-200 dark:border-neutral-800 rounded-xl',
    card: 'shadow-none bg-transparent',
    
    // Headers & Copy
    headerTitle: 'text-neutral-900 dark:text-neutral-100 font-semibold tracking-tight',
    headerSubtitle: 'text-neutral-600 dark:text-neutral-400 text-xs',
    dividerText: 'text-neutral-500 dark:text-neutral-400 text-xs uppercase',
    dividerLine: 'bg-neutral-200 dark:bg-neutral-800',
    
    // Buttons & Inputs
    formButtonPrimary: 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200 text-xs font-medium rounded-lg transition-colors shadow-xs h-9',
    socialButtonsBlockButton: 'border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 rounded-lg text-xs font-medium transition-colors h-9',
    socialButtonsBlockButtonText: 'font-medium text-xs',
    formFieldLabel: 'text-neutral-700 dark:text-neutral-300 text-xs font-medium',
    formFieldInput: 'rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-xs focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600 h-9 transition-colors',
    
    // Footers & Links
    footerActionText: 'text-neutral-600 dark:text-neutral-400 text-xs',
    footerActionLink: 'text-neutral-900 dark:text-neutral-100 font-medium hover:underline text-xs',
    identityPreviewText: 'text-neutral-900 dark:text-neutral-100 font-medium text-xs',
    identityPreviewEditButton: 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100',
    
    // Popovers & Dropdowns (UserButton & OrganizationSwitcher)
    popoverBox: 'shadow-lg border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 overflow-hidden',
    userButtonAvatarBox: 'w-8 h-8 rounded-lg',
    userButtonTrigger: 'focus:shadow-none focus:outline-none rounded-lg',
    userButtonPopoverCard: 'shadow-lg border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900',
    userButtonPopoverFooter: 'border-t border-neutral-200 dark:border-neutral-800',
    userButtonPopoverActionButton: 'text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors',
    
    // Organization Switcher
    organizationSwitcherTrigger: 'py-1.5 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-xs font-medium text-neutral-800 dark:text-neutral-200 flex items-center gap-2',
    organizationSwitcherPopoverCard: 'shadow-lg border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900',
    organizationSwitcherPopoverActions: 'border-t border-neutral-200 dark:border-neutral-800',
    
    // Organization Profile & Modals
    organizationProfile: 'border-none shadow-none',
    navbar: 'border-r border-neutral-200 dark:border-neutral-800',
    navbarButton: 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 text-xs font-medium rounded-lg',
    modalBackdrop: 'bg-black/40 dark:bg-black/70 backdrop-blur-xs',
    modalContent: 'border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl bg-white dark:bg-neutral-900 overflow-hidden',
    modalCloseButton: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
  },
};
