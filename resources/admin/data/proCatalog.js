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
		title: __( 'Signature and Calculation', 'subtleforms' ),
		text: __( 'A signature pad and live calculations, with a calculation as the amount to charge.', 'subtleforms' ),
	},
	{
		key: 'payments',
		icon: Icon.CreditCard,
		title: __( 'Stripe payments', 'subtleforms' ),
		text: __( 'A Card Payment field for the free Product, Priced Options and Coupon fields.', 'subtleforms' ),
	},
	{
		key: 'automation',
		icon: Icon.Users,
		title: __( 'Marketing and CRM', 'subtleforms' ),
		text: __( 'Mailchimp, Brevo, Kit, HubSpot, Zapier and WooCommerce.', 'subtleforms' ),
	},
	{
		key: 'insights',
		icon: Icon.FileText,
		title: __( 'PDFs and translation', 'subtleforms' ),
		text: __( 'PDF copies of entries, WPML and Polylang, and 47 more templates.', 'subtleforms' ),
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
		outcome: __( 'Accept card payments with Stripe inside any form.', 'subtleforms' ),
	},
	ecommerce: {
		icon: Icon.ShoppingCart,
		group: 'commerce',
		outcome: __( 'Create WooCommerce orders from form submissions.', 'subtleforms' ),
	},
	crm: {
		icon: Icon.Users,
		group: 'marketing',
		outcome: __( 'Create or update HubSpot contacts, or send them to Zapier or Make.', 'subtleforms' ),
	},
	email_marketing: {
		icon: Icon.Mail,
		group: 'marketing',
		outcome: __( 'Add subscribers to Mailchimp, Brevo or Kit automatically.', 'subtleforms' ),
	},
	webhooks: {
		icon: Icon.Webhook,
		group: 'marketing',
		outcome: __( 'Post every submission to any URL the moment it arrives.', 'subtleforms' ),
	},
	analytics: {
		icon: Icon.BarChart2,
		group: 'insights',
		outcome: __( 'See views, submissions and conversion rate for each form.', 'subtleforms' ),
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
	__( 'Signature, Calculation and Picture Choice fields', 'subtleforms' ),
	__( 'Several files per upload field', 'subtleforms' ),
	__( 'Advanced conditional logic', 'subtleforms' ),
	__( 'Form analytics: views, conversion rate and funnel', 'subtleforms' ),
	__( 'Stripe card payments with a Card Payment field', 'subtleforms' ),
	__( 'Mailchimp, Brevo, Kit, HubSpot and Zapier actions', 'subtleforms' ),
	__( 'WooCommerce checkout and a WooCommerce Product field', 'subtleforms' ),
	__( 'PDF copies of entries', 'subtleforms' ),
	__( '47 more templates', 'subtleforms' ),
	__( 'White label branding set in your licence portal, and WPML or Polylang translation (Agency)', 'subtleforms' ),
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
