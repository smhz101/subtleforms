<?php
/**
 * The Extensions catalog: what each plan adds to SubtleForms.
 *
 * Built-in entries are static data. Add-ons change the list through the
 * `subtleforms/extensions/catalog` filter. Nothing here makes a web request.
 *
 * @package SubtleForms\Extensions
 */

namespace SubtleForms\Extensions;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Admin\AdminMenu;

/**
 * Catalog of extensions.
 */
final class Catalog {

	public const PLANS      = array( 'free', 'starter', 'pro', 'agency' );
	public const SOURCES    = array( 'core', 'addon' );
	public const STATUSES   = array( 'included', 'locked', 'available', 'installed', 'active', 'update' );
	public const ACTIONS    = array( 'settings', 'plans', 'install', 'activate', 'update' );
	private const REQUIRED  = array( 'slug', 'title', 'description', 'category', 'plan', 'icon', 'source', 'status' );

	/**
	 * Category ids and labels, in display order.
	 *
	 * @return array<int,array{id:string,label:string}>
	 */
	public static function categories(): array {
		return array(
			array( 'id' => 'payments', 'label' => __( 'Payments', 'subtleforms' ) ),
			array( 'id' => 'integrations', 'label' => __( 'Integrations', 'subtleforms' ) ),
			array( 'id' => 'fields', 'label' => __( 'Fields', 'subtleforms' ) ),
			array( 'id' => 'entries', 'label' => __( 'Entries and reports', 'subtleforms' ) ),
			array( 'id' => 'site', 'label' => __( 'Site and admin', 'subtleforms' ) ),
		);
	}

	/**
	 * Entries after the filter, validated.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	public static function entries(): array {
		/**
		 * Add, change or remove Extensions catalog entries.
		 *
		 * @param array $entries Built-in entries. See docs/hooks.md for the shape.
		 * @since 2.12.0
		 */
		$entries = apply_filters( 'subtleforms/extensions/catalog', self::builtin() );
		return self::validate( is_array( $entries ) ? $entries : array() );
	}

	/**
	 * Keep valid entries only, with every key present and typed.
	 *
	 * @param array $entries Raw entries.
	 * @return array<int,array<string,mixed>>
	 */
	public static function validate( array $entries ): array {
		$ids   = wp_list_pluck( self::categories(), 'id' );
		$out   = array();
		$seen  = array();
		foreach ( $entries as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			foreach ( self::REQUIRED as $key ) {
				if ( ! isset( $entry[ $key ] ) || ! is_string( $entry[ $key ] ) || '' === trim( $entry[ $key ] ) ) {
					continue 2;
				}
			}
			$slug = sanitize_title( $entry['slug'] );
			if ( '' === $slug || isset( $seen[ $slug ] )
				|| ! in_array( $entry['category'], $ids, true )
				|| ! in_array( $entry['plan'], self::PLANS, true )
				|| ! in_array( $entry['source'], self::SOURCES, true )
				|| ! in_array( $entry['status'], self::STATUSES, true ) ) {
				continue;
			}
			$seen[ $slug ] = true;
			$out[]         = array(
				'slug'        => $slug,
				'title'       => sanitize_text_field( $entry['title'] ),
				'description' => sanitize_text_field( $entry['description'] ),
				'category'    => $entry['category'],
				'plan'        => $entry['plan'],
				'icon'        => sanitize_key( $entry['icon'] ),
				'docsUrl'     => self::url( $entry['docsUrl'] ?? '' ),
				'settingsUrl' => self::url( $entry['settingsUrl'] ?? '' ),
				'source'      => $entry['source'],
				'status'      => $entry['status'],
				'action'      => self::action( $entry['action'] ?? null ),
			);
		}
		return $out;
	}

	/**
	 * @param mixed $value Raw URL.
	 * @return string
	 */
	private static function url( $value ): string {
		return is_string( $value ) ? esc_url_raw( $value ) : '';
	}

	/**
	 * @param mixed $action Raw action.
	 * @return array{label:string,url:string,kind:string}|null
	 */
	private static function action( $action ): ?array {
		if ( ! is_array( $action ) || ! isset( $action['label'], $action['url'], $action['kind'] )
			|| ! is_string( $action['label'] ) || ! is_string( $action['url'] ) || ! in_array( $action['kind'], self::ACTIONS, true ) ) {
			return null;
		}
		$label = sanitize_text_field( $action['label'] );
		$url   = esc_url_raw( $action['url'] );
		if ( '' === $label || '' === $url ) {
			return null;
		}
		return array(
			'label' => $label,
			'url'   => $url,
			'kind'  => $action['kind'],
		);
	}

	/**
	 * Built-in entries.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	private static function builtin(): array {
		$settings = admin_url( 'admin.php?page=subtleforms-settings#tab=extensions' );
		$plans    = AdminMenu::upgrade_url( 'extensions' );
		$out      = array();

		$included = array(
			array( 'mailchimp', 'Mailchimp', __( 'Add new contacts to your Mailchimp audience from any form.', 'subtleforms' ) ),
			array( 'brevo', 'Brevo', __( 'Add new contacts to your Brevo lists from any form.', 'subtleforms' ) ),
			array( 'kit', 'Kit', __( 'Add new subscribers to your Kit account from any form.', 'subtleforms' ) ),
			array( 'mailpoet', 'MailPoet', __( 'Add new subscribers to your MailPoet lists from any form.', 'subtleforms' ) ),
			array( 'hubspot', 'HubSpot', __( 'Send form entries to HubSpot as contacts.', 'subtleforms' ) ),
		);
		foreach ( $included as $row ) {
			$out[] = array(
				'slug'        => $row[0],
				'title'       => $row[1],
				'description' => $row[2],
				'category'    => 'integrations',
				'plan'        => 'free',
				'icon'        => 'email-alt',
				'docsUrl'     => '',
				'settingsUrl' => $settings,
				'source'      => 'core',
				'status'      => 'included',
				'action'      => array(
					'label' => __( 'Settings', 'subtleforms' ),
					'url'   => $settings,
					'kind'  => 'settings',
				),
			);
		}

		$locked = array(
			array( 'starter', 'signature-field', __( 'Signature field', 'subtleforms' ), __( 'Let people sign a form with a mouse or a finger.', 'subtleforms' ), 'fields', 'edit' ),
			array( 'starter', 'calculation-field', __( 'Calculation field', 'subtleforms' ), __( 'Show totals and other values worked out from the answers.', 'subtleforms' ), 'fields', 'editor-table' ),
			array( 'starter', 'picture-choice-field', __( 'Picture choice field', 'subtleforms' ), __( 'Let people pick from images instead of text.', 'subtleforms' ), 'fields', 'format-image' ),
			array( 'starter', 'payments', __( 'Payments', 'subtleforms' ), __( 'Take payments with Stripe, Apple Pay and Google Pay, and accept coupons.', 'subtleforms' ), 'payments', 'money-alt' ),
			array( 'starter', 'conditional-emails', __( 'Conditional emails and advanced logic', 'subtleforms' ), __( 'Send different emails depending on the answers, with more ways to combine rules.', 'subtleforms' ), 'site', 'randomize' ),
			array( 'starter', 'entry-pdfs', __( 'Entry PDFs', 'subtleforms' ), __( 'Save or send an entry as a PDF.', 'subtleforms' ), 'entries', 'media-document' ),
			array( 'starter', 'form-analytics', __( 'Form analytics without cookies', 'subtleforms' ), __( 'See how each form performs, without setting cookies.', 'subtleforms' ), 'entries', 'chart-area' ),
			array( 'starter', 'ai-assistant', __( 'AI assistant access (MCP)', 'subtleforms' ), __( 'Let an AI assistant that supports MCP work with your forms.', 'subtleforms' ), 'site', 'lightbulb' ),
			array( 'pro', 'crm-sales', __( 'Salesforce, Pipedrive and Close', 'subtleforms' ), __( 'Send form entries to your sales CRM.', 'subtleforms' ), 'integrations', 'cloud' ),
			array( 'pro', 'automation', __( 'Zapier, Make and n8n', 'subtleforms' ), __( 'Connect forms to other apps through Zapier, Make or n8n.', 'subtleforms' ), 'integrations', 'networking' ),
			array( 'pro', 'woocommerce', __( 'WooCommerce products and checkout', 'subtleforms' ), __( 'Sell WooCommerce products from a form and send people to checkout.', 'subtleforms' ), 'payments', 'cart' ),
			array( 'pro', 'managed-webhooks', __( 'Managed webhooks with retries', 'subtleforms' ), __( 'Send entries to other services and try again when a call fails.', 'subtleforms' ), 'integrations', 'rest-api' ),
			array( 'pro', 'multi-file-uploads', __( 'Multi-file uploads', 'subtleforms' ), __( 'Let people attach up to 20 files to one field.', 'subtleforms' ), 'fields', 'media-archive' ),
			array( 'agency', 'white-label', __( 'White label', 'subtleforms' ), __( 'Show your own name and logo instead of SubtleForms.', 'subtleforms' ), 'site', 'tag' ),
			array( 'agency', 'wpml-polylang', __( 'WPML and Polylang', 'subtleforms' ), __( 'Translate forms with WPML or Polylang.', 'subtleforms' ), 'site', 'translation' ),
		);
		foreach ( $locked as $row ) {
			$out[] = array(
				'slug'        => $row[1],
				'title'       => $row[2],
				'description' => $row[3],
				'category'    => $row[4],
				'plan'        => $row[0],
				'icon'        => $row[5],
				'docsUrl'     => '',
				'settingsUrl' => '',
				'source'      => 'addon',
				'status'      => 'locked',
				'action'      => array(
					'label' => __( 'See plans', 'subtleforms' ),
					'url'   => $plans,
					'kind'  => 'plans',
				),
			);
		}
		return $out;
	}
}
