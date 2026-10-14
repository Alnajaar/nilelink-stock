export interface PublicFeatureCard {
  title: string;
  description: string;
}

export interface PublicMarketingMetric {
  value: string;
  label: string;
}

export interface PublicBranchBenefit {
  title: string;
  description: string;
}

export interface PublicBranchPreview {
  organizationName: string;
  activeBranchesLabel: string;
  flagshipName: string;
  flagshipDetails: string;
  secondBranchName: string;
  secondBranchDetails: string;
  singleBranchNotice: string;
  singleBranchName: string;
  singleBranchDetails: string;
}

export interface PublicSiteContent {
  brandName: string;
  logoUrl: string;
  tagline: string;
  heroEyebrow: string;
  headline: string;
  description: string;
  features: string[];
  primaryCta: string;
  pricingEyebrow: string;
  pricingHeadline: string;
  pricingDescription: string;
  multiBranchEyebrow: string;
  multiBranchHeadline: string;
  multiBranchDescription: string;
  featuresEyebrow: string;
  featuresHeadline: string;
  featuresDescription: string;
  featureCards: PublicFeatureCard[];
  marketingMetrics: PublicMarketingMetric[];
  multiBranchBenefits: PublicBranchBenefit[];
  branchPreview: PublicBranchPreview;
  footerTagline: string;
  trustBadge: string;
}

export const DEFAULT_PUBLIC_SITE_CONTENT: PublicSiteContent = {
  brandName: 'BarStock.OS',
  logoUrl: '',
  tagline: 'Cafe & Restaurant Inventory SaaS',
  heroEyebrow: 'Built Exclusively for Coffee Shops, Roasteries & Restaurant Chains',
  headline: 'Smarter stock management for hospitality teams',
  description: 'Control inventory, reduce waste, and give your team clearer day-to-day operations.',
  features: ['Stock tracking', 'Team time tracking', 'Waste insights', 'Offline workflows'],
  primaryCta: 'Start 14-Day Free Trial',
  pricingEyebrow: 'Transparent, Scalable SaaS Pricing',
  pricingHeadline: 'Choose the Plan Sized for Your Stock',
  pricingDescription: 'Compare plans for single-location cafes and growing hospitality teams, with limits that fit your current operation.',
  multiBranchEyebrow: 'Hospitality Operations',
  multiBranchHeadline: 'Inventory and workforce tools for hospitality teams.',
  multiBranchDescription: 'Manage stock, record team hours, and review day-to-day operations from one workspace.',
  featuresEyebrow: 'Engineered for Real Hospitality',
  featuresHeadline: 'The Next-Gen Bar Operating System',
  featuresDescription: 'Every detail is tuned for speed, accountability, and reliability in busy service shifts.',
  featureCards: [
    { title: 'ML Predictive Stock Restock', description: 'Machine learning analyzes historical usage and suggests reorder quantities before items run out.' },
    { title: 'Smart Shrinkage & Theft Audit', description: 'Compare physical counts with stock movement records to identify unexplained variances.' },
    { title: 'Web Push Notification Service', description: 'Send background push notifications to administrators when important stock events occur.' },
    { title: 'Branded Tax & Payroll PDFs', description: 'Export formatted reports for business records. Statutory tax and payroll compliance depend on local configuration.' },
    { title: 'Offline Inventory Queue', description: 'Continue recording inventory changes offline and synchronize them when the connection returns.' },
    { title: 'Cloudflare Edge Deployment', description: 'Run the application on Cloudflare Pages and Workers with globally distributed delivery.' }
  ],
  marketingMetrics: [
    { value: 'Inventory', label: 'Track stock and adjustments' },
    { value: 'Workforce', label: 'Record and review staff hours' },
    { value: 'Offline', label: 'Queue supported changes for sync' },
    { value: 'Plans', label: 'Set configurable usage limits' }
  ],
  multiBranchBenefits: [
    { title: 'Role-based access', description: 'Business actions are protected by authenticated, tenant-scoped roles.' },
    { title: 'Inventory records', description: 'Record stock movements, waste, and inventory changes.' },
    { title: 'Workforce time tracking', description: 'Employees can record shifts and managers can review submitted hours.' }
  ],
  branchPreview: {
    organizationName: 'Example Organization (illustrative)',
    activeBranchesLabel: '2 SAMPLE LOCATIONS',
    flagshipName: 'Sample Flagship Location',
    flagshipDetails: 'Example inventory · Example team · Sample data',
    secondBranchName: 'Sample Second Location',
    secondBranchDetails: 'Example inventory · Example team · Sample data',
    singleBranchNotice: 'Example single-location business (illustrative data):',
    singleBranchName: 'Sample Cafe',
    singleBranchDetails: 'Example plan · 1 location'
  },
  footerTagline: 'Multi-Tenant Cafe & Restaurant SaaS',
  trustBadge: 'Cloudflare Edge'
};
