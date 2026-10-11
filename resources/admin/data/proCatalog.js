/**
 * One description of what SubtleForms Pro adds, shared by every place that
 * talks about it (Extensions hub, License screen, upgrade prompts) so the
 * story is identical wherever a user meets it.
 */
import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';

export const PRO_URL = 'https://subtleforms.com/pro';
export const ACCOUNT_URL = 'https://subtleforms.com/account';

/**
 * Headline capabilities, grouped the way users think about them.
 */
export const PRO_PILLARS = [
	{
		key: 'fields',
		icon: Icon.Calculator,
		title: __( 'Smarter fields', 'subtleforms' ),
		text: __( 'Picture Choice, Signature and live Calculations with a formula builder.', 'subtleforms' ),
	},
	{
		key: 'payments',
		icon: Icon.CreditCard,
		title: __( 'Payments', 'subtleforms' ),
		text: __( 'Stripe and PayPal checkout, products, coupons and order summaries.', 'subtleforms' ),
	},
	{
		key: 'automation',
		icon: Icon.Webhook,
		title: __( 'Automation', 'subtleforms' ),
		text: __( 'Webhooks, CRM and email marketing sync, with retries and delays.', 'subtleforms' ),
	},
	{
		key: 'insights',
		icon: Icon.TrendingUp,
		title: __( 'Insights & exports', 'subtleforms' ),
		text: __( 'Conversion analytics, CSV export and PDF copies of every entry.', 'subtleforms' ),
	},
];

/**
 * Extension presentation: icon, group and a one-line outcome.
 * Slugs match the backend extension registry.
 */
export const EXTENSIONS = {
	payments: {
		icon: Icon.CreditCard,
		group: 'commerce',
		outcome: __( 'Accept card and PayPal payments inside any form.', 'subtleforms' ),
	},
	ecommerce: {
		icon: Icon.ShoppingCart,
		group: 'commerce',
		outcome: __( 'Create WooCommerce orders from form submissions.', 'subtleforms' ),
	},
	crm: {
		icon: Icon.Users,
		group: 'marketing',
		outcome: __( 'Create or update HubSpot contacts on every entry.', 'subtleforms' ),
	},
	email_marketing: {
		icon: Icon.Mail,
		group: 'marketing',
		outcome: __( 'Add subscribers to Mailchimp or ConvertKit automatically.', 'subtleforms' ),
	},
	webhooks: {
		icon: Icon.Webhook,
		group: 'marketing',
		outcome: __( 'Post every submission to any URL the moment it arrives.', 'subtleforms' ),
	},
	analytics: {
		icon: Icon.BarChart2,
		group: 'insights',
		outcome: __( 'See views, starts and conversion rate for each form.', 'subtleforms' ),
	},
	pdf: {
		icon: Icon.FileText,
		group: 'insights',
		outcome: __( 'Turn entries into PDFs and attach them to emails.', 'subtleforms' ),
	},
	multilanguage: {
		icon: Icon.Globe,
		group: 'insights',
		outcome: __( 'Serve forms in your visitors’ language with WPML or Polylang.', 'subtleforms' ),
	},
};

export const EXTENSION_GROUPS = [
	{ key: 'commerce', title: __( 'Payments & commerce', 'subtleforms' ) },
	{ key: 'marketing', title: __( 'Marketing & automation', 'subtleforms' ) },
	{ key: 'insights', title: __( 'Insights & documents', 'subtleforms' ) },
];

/**
 * Plain feature checklist used on the License screen.
 */
export const PRO_CHECKLIST = [
	__( 'Picture Choice, Signature and Calculation fields', 'subtleforms' ),
	__( 'Stripe and PayPal payments', 'subtleforms' ),
	__( 'Webhooks, CRM and email marketing actions', 'subtleforms' ),
	__( 'Advanced conditional logic', 'subtleforms' ),
	__( 'CSV export of submissions', 'subtleforms' ),
	__( 'PDF generator and analytics', 'subtleforms' ),
	__( 'Pipeline retries and delayed actions', 'subtleforms' ),
	__( 'Pro templates and priority support', 'subtleforms' ),
];

/**
 * Plan state from localized admin data.
 *
 * @return {{ hasProPlugin: boolean, licensed: boolean, isDev: boolean }}
 */
export function getPlanState() {
	const admin = window.subtleformsAdmin || {};
	const license = admin.license || null;
	const isDev = !! license?.isDev || !! license?.dev;
	const licensed =
		isDev ||
		( !! license &&
			( license.connected === true ||
				[ 'valid', 'active', 'grace_period' ].includes( license.status ) ) );
	const plan = license?.plan && license.plan !== 'free' ? license.plan : 'pro';
	return {
		hasProPlugin: !! admin.hasProPlugin,
		licensed,
		isDev,
		plan,
		license,
	};
}
