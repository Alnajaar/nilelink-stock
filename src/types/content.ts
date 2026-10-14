export interface PublicFeatureCard {
  title: string;
  description: string;
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
  footerTagline: string;
  trustBadge: string;
}

export const DEFAULT_PUBLIC_SITE_CONTENT: PublicSiteContent = {
  brandName: 'BarStock.OS',
  logoUrl: '',
  tagline: 'Cafe & Restaurant Inventory SaaS',
  heroEyebrow: 'Built Exclusively for Coffee Shops, Roasteries & Restaurant Chains',
  headline: 'Smarter stock management for hospitality teams',
  description: 'Control inventory, reduce waste, and coordinate every location from one place.',
  features: ['Stock tracking', 'Branch transfers', 'Waste insights', 'Offline workflows'],
  primaryCta: 'Start 14-Day Free Trial',
  pricingEyebrow: 'Transparent, Scalable SaaS Pricing',
  pricingHeadline: 'Choose the Plan Sized for Your Stock',
  pricingDescription: 'From a single kiosk with limited items to an expanding multi-branch chain managing thousands of SKUs across multiple locations.',
  multiBranchEyebrow: 'Multi-Location Architecture',
  multiBranchHeadline: 'One Account. Unlimited Branches. Zero Cross-Store Data Leaks.',
  multiBranchDescription: 'Give each cafe private access to its own stock, and let restaurant groups manage locations from one account.',
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
  footerTagline: 'Multi-Tenant Cafe & Restaurant SaaS',
  trustBadge: 'Cloudflare Edge'
};
