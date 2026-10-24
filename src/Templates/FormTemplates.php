<?php

/**
 * Form Templates
 *
 * Provides pre-built form templates for quick setup.
 *
 * @package   SubtleForms\Templates
 * @version   1.5.0
 */

namespace SubtleForms\Templates;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Form template definitions.
 */
class FormTemplates {

	/**
	 * Raw card inputs, matched by stable id or key. Labels are not used: a
	 * "Gift card message" or a "Scorecard" is not a card number, and the
	 * gateway-managed Card Payment field (payment_card) is always kept.
	 */
	const CARD_INPUT_ID = '/^(?:(?:credit|debit)[\s_-]*)?(?:card[\s_-]*(?:number|num|no|cvv2?|cvc|csc|expiry|expiration|exp[\s_-]*date)|cc[\s_-]*(?:number|num|cvv2?|cvc)|cvv2?|cvc|csc|expiry|expiration|exp[\s_-]*date)(?:[\s_-]|$)/i';

	/**
	 * Get all available templates.
	 *
	 * @return array Array of template definitions.
	 */
	public static function get_all() {
		$templates = self::base_templates();

		/**
		 * Filter available form templates.
		 *
		 * Allows add-ons to add templates. An add-on template may set
		 * `addon` to true to keep its own fields as they are.
		 *
		 * @param array $templates Associative array of template definitions.
		 * @since 1.5.0
		 */
		$templates = apply_filters( 'subtleforms/templates', $templates );

		return self::prepare_all( $templates );
	}

	/**
	 * The templates this plugin ships, without add-on templates.
	 *
	 * @return array Template definitions.
	 */
	public static function free_templates(): array {
		return self::prepare_all( self::base_templates() );
	}

	/**
	 * @param array $templates Templates.
	 * @return array
	 */
	private static function prepare_all( array $templates ): array {
		foreach ( $templates as $key => $template ) {
			if ( is_array( $template ) ) {
				$templates[ $key ] = self::prepare_template( (string) $key, $template );
			}
		}
		return $templates;
	}

	/**
	 * @return array Template definitions.
	 */
	private static function base_templates(): array {
		return array(
			// ── Contact ─────────────────────────────────────────────────────
			'contact'              => self::contact_form(),
			'simple_contact'       => self::simple_contact_form(),
			'contact_with_file'    => self::contact_with_file(),
			// ── Lead generation ─────────────────────────────────────────────
			'lead_capture'         => self::lead_capture_form(),
			'newsletter'           => self::newsletter(),
			'newsletter_signup'    => self::newsletter_signup(),
			'ebook_download'       => self::ebook_download(),
			// ── Feedback ────────────────────────────────────────────────────
			'product_feedback'     => self::product_feedback(),
			'website_feedback'     => self::website_feedback(),
			'customer_satisfaction'=> self::customer_satisfaction(),
			// ── Registration ────────────────────────────────────────────────
			'rsvp'                 => self::rsvp_form(),
			// ── Support ─────────────────────────────────────────────────────
			'bug_report'           => self::bug_report(),
		);
	}

	/**
	 * Get a specific template by ID.
	 *
	 * @param string $template_id Template identifier.
	 * @return array|null Template definition or null if not found.
	 */
	public static function get( $template_id ) {
		$templates = self::get_all();
		return $templates[ $template_id ] ?? null;
	}

	/**
	 * Contact Form Template
	 *
	 * Simple contact form with name, email, and message.
	 *
	 * @return array Template definition.
	 */
	private static function contact_form() {
		return array(
			'id'          => 'contact',
			'name'        => __( 'Contact Form', 'subtleforms' ),
			'description' => __( 'A simple contact form with name, email, and message fields', 'subtleforms' ),
			'category'    => 'general',
			'icon'        => 'email',
			'schema'      => array(
				'metadata' => array(
					'title'       => __( 'Contact Us', 'subtleforms' ),
					'name'        => 'contact_form',
					'description' => __( 'Get in touch with us', 'subtleforms' ),
				),
				'fields'   => array(
					array(
						'id'       => 'name',
						'type'     => 'text',
						'label'    => __( 'Name', 'subtleforms' ),
						'required' => true,
					),
					array(
						'id'       => 'email',
						'type'     => 'email',
						'label'    => __( 'Email Address', 'subtleforms' ),
						'required' => true,
					),
					array(
						'id'       => 'subject',
						'type'     => 'text',
						'label'    => __( 'Subject', 'subtleforms' ),
						'required' => false,
					),
					array(
						'id'          => 'message',
						'type'        => 'textarea',
						'label'       => __( 'Message', 'subtleforms' ),
						'required'    => true,
						'placeholder' => __( 'Tell us how we can help...', 'subtleforms' ),
						'rows'        => 5,
					),
				),
				'actions'  => array(
					array(
						'id'      => 'save',
						'type'    => 'save',
						'enabled' => true,
					),
					array(
						'id'      => 'email',
						'type'    => 'email',
						'enabled' => true,
						'config'  => array(
							'to'      => '{{admin_email}}',
							'subject' => __( 'New Contact Form Submission', 'subtleforms' ),
							'message' => __( "Name: {{name}}\nEmail: {{email}}\nSubject: {{subject}}\n\nMessage:\n{{message}}", 'subtleforms' ),
						),
					),
				),
			),
		);
	}

	private static function simple_contact_form() {
		return array(
			'id'          => 'simple_contact',
			'name'        => __( 'Simple Contact', 'subtleforms' ),
			'description' => __( 'Minimal contact form: just name, email, and message. Perfect for sidebars and footers.', 'subtleforms' ),
			'category'    => 'contact',
			'icon'        => 'email',
			'schema'      => array(
				'metadata' => array(
					'title' => __( 'Contact Us', 'subtleforms' ),
					'name'  => 'simple_contact',
				),
				'fields' => array(
					array( 'id' => 'name',    'type' => 'text',     'label' => __( 'Name', 'subtleforms' ),    'required' => true ),
					array( 'id' => 'email',   'type' => 'email',    'label' => __( 'Email', 'subtleforms' ),   'required' => true ),
					array( 'id' => 'message', 'type' => 'textarea', 'label' => __( 'Message', 'subtleforms' ), 'required' => true, 'rows' => 4 ),
				),
				'actions' => array(
					array( 'id' => 'save',  'type' => 'save',  'enabled' => true ),
					array( 'id' => 'email', 'type' => 'email', 'enabled' => true, 'config' => array(
						'to'      => '{{admin_email}}',
						'subject' => __( 'New Contact Form Message', 'subtleforms' ),
						'message' => __( "From: {{name}} <{{email}}>\n\n{{message}}", 'subtleforms' ),
					) ),
				),
			),
		);
	}

	private static function contact_with_file() {
		return array(
			'id'          => 'contact_with_file',
			'name'        => __( 'Contact + Attachment', 'subtleforms' ),
			'description' => __( 'Contact form that lets visitors attach a file: handy for design briefs, CVs, or support docs.', 'subtleforms' ),
			'category'    => 'contact',
			'icon'        => 'email',
			'schema'      => array(
				'metadata' => array(
					'title' => __( 'Contact Us', 'subtleforms' ),
					'name'  => 'contact_with_file',
				),
				'fields' => array(
					array( 'id' => 'name',    'type' => 'text',     'label' => __( 'Your Name', 'subtleforms' ),    'required' => true ),
					array( 'id' => 'email',   'type' => 'email',    'label' => __( 'Email Address', 'subtleforms' ),'required' => true ),
					array( 'id' => 'subject', 'type' => 'text',     'label' => __( 'Subject', 'subtleforms' ),      'required' => false ),
					array( 'id' => 'message', 'type' => 'textarea', 'label' => __( 'Message', 'subtleforms' ),      'required' => true, 'rows' => 4 ),
					array( 'id' => 'file',    'type' => 'file_upload', 'label' => __( 'Attachment (optional)', 'subtleforms' ), 'required' => false ),
				),
				'actions' => array(
					array( 'id' => 'save',  'type' => 'save',  'enabled' => true ),
					array( 'id' => 'email', 'type' => 'email', 'enabled' => true, 'config' => array(
						'to'      => '{{admin_email}}',
						'subject' => '{{subject}}',
						'message' => __( "From: {{name}} <{{email}}>\n\n{{message}}", 'subtleforms' ),
					) ),
				),
			),
		);
	}

	/**
	 * Newsletter (2.3.0): one email field and a button on one row, for a
	 * footer or a hero. Uses the inline layout.
	 *
	 * @return array
	 */
	private static function newsletter() {
		return array(
			'id'          => 'newsletter',
			'name'        => __( 'Newsletter', 'subtleforms' ),
			'description' => __( 'Email only, with the button on the same row. Made for footers and hero sections.', 'subtleforms' ),
			'category'    => 'lead',
			'icon'        => 'email',
			'schema'      => array(
				'metadata' => array(
					'title'      => __( 'Newsletter', 'subtleforms' ),
					'name'       => 'newsletter',
					'type'       => 'regular',
					'submitText' => __( 'Subscribe', 'subtleforms' ),
					'_showTitle' => false,
					'appearance' => array(
						'preset'   => 'default',
						'variants' => array(
							'layout' => 'inline',
							'width'  => 'standard',
						),
					),
				),
				'fields'   => array(
					array(
						'id'          => 'email',
						'type'        => 'email',
						'label'       => __( 'Email address', 'subtleforms' ),
						'placeholder' => __( 'you@example.com', 'subtleforms' ),
						'required'    => true,
						'appearance'  => array( 'hideLabel' => true ),
					),
				),
				'actions'  => array(
					array(
						'id'       => 'email',
						'type'     => 'email',
						'enabled'  => true,
						'settings' => array(
							'to'      => '{admin_email}',
							'subject' => __( 'New subscriber: {field:email}', 'subtleforms' ),
							'message' => __( 'A new subscriber joined from {form_title}: {field:email}', 'subtleforms' ),
						),
					),
				),
			),
		);
	}

	private static function newsletter_signup() {
		return array(
			'id'          => 'newsletter_signup',
			'name'        => __( 'Newsletter Sign-Up', 'subtleforms' ),
			'description' => __( 'Ultra-light sign-up: just first name and email, with consent checkbox.', 'subtleforms' ),
			'category'    => 'lead',
			'icon'        => 'rss',
			'schema'      => array(
				'metadata' => array(
					'title' => __( 'Subscribe', 'subtleforms' ),
					'name'  => 'newsletter_signup',
				),
				'fields' => array(
					array( 'id' => 'first_name', 'type' => 'text',     'label' => __( 'First Name', 'subtleforms' ),  'required' => true ),
					array( 'id' => 'email',      'type' => 'email',    'label' => __( 'Email Address', 'subtleforms' ),'required' => true ),
					array( 'id' => 'consent',    'type' => 'checkbox', 'label' => __( 'I agree to receive emails and accept the Privacy Policy.', 'subtleforms' ), 'required' => true ),
				),
				'actions' => array(
					array( 'id' => 'save',  'type' => 'save',  'enabled' => true ),
					array( 'id' => 'email', 'type' => 'email', 'enabled' => true, 'config' => array(
						'to'      => '{{admin_email}}',
						'subject' => __( 'New Newsletter Subscriber: {{first_name}}', 'subtleforms' ),
						'message' => __( "New subscriber:\n\n{{first_name}}, {{email}}", 'subtleforms' ),
					) ),
				),
			),
		);
	}

	private static function ebook_download() {
		return array(
			'id'          => 'ebook_download',
			'name'        => __( 'Free Resource Download', 'subtleforms' ),
			'description' => __( 'Gated content form: collect name and email before granting access to a guide or ebook.', 'subtleforms' ),
			'category'    => 'lead',
			'icon'        => 'media-document',
			'schema'      => array(
				'metadata' => array(
					'title' => __( 'Get the Free Guide', 'subtleforms' ),
					'name'  => 'ebook_download',
				),
				'fields' => array(
					array( 'id' => 'first_name', 'type' => 'text',  'label' => __( 'First Name', 'subtleforms' ),   'required' => true ),
					array( 'id' => 'last_name',  'type' => 'text',  'label' => __( 'Last Name', 'subtleforms' ),    'required' => false ),
					array( 'id' => 'email',      'type' => 'email', 'label' => __( 'Work Email', 'subtleforms' ),   'required' => true ),
					array( 'id' => 'company',    'type' => 'text',  'label' => __( 'Company (optional)', 'subtleforms' ), 'required' => false ),
				),
				'actions' => array(
					array( 'id' => 'save',  'type' => 'save',  'enabled' => true ),
					array( 'id' => 'email', 'type' => 'email', 'enabled' => true, 'config' => array(
						'to'      => '{{admin_email}}',
						'subject' => __( 'New Resource Download Request', 'subtleforms' ),
						'message' => __( "{{first_name}} {{last_name}} ({{company}}) requested the guide.\nEmail: {{email}}", 'subtleforms' ),
					) ),
				),
			),
		);
	}

	private static function product_feedback() {
		return array(
			'id'          => 'product_feedback',
			'name'        => __( 'Product Feedback', 'subtleforms' ),
			'description' => __( 'Collect star ratings and open-ended feedback about your product.', 'subtleforms' ),
			'category'    => 'feedback',
			'icon'        => 'star-filled',
			'schema'      => array(
				'metadata' => array(
					'title' => __( 'Share Your Feedback', 'subtleforms' ),
					'name'  => 'product_feedback',
				),
				'fields' => array(
					array( 'id' => 'rating',   'type' => 'rating',   'label' => __( 'Overall Rating', 'subtleforms' ),        'required' => true, 'max' => 5 ),
					array( 'id' => 'use_case', 'type' => 'textarea', 'label' => __( 'How are you using our product?', 'subtleforms' ), 'required' => false, 'rows' => 3 ),
					array( 'id' => 'likes',    'type' => 'textarea', 'label' => __( 'What do you like most?', 'subtleforms' ), 'required' => false, 'rows' => 3 ),
					array( 'id' => 'improve',  'type' => 'textarea', 'label' => __( 'What could we improve?', 'subtleforms' ), 'required' => false, 'rows' => 3 ),
					array( 'id' => 'email',    'type' => 'email',    'label' => __( 'Your email (optional, for follow-up)', 'subtleforms' ), 'required' => false ),
				),
				'actions' => array(
					array( 'id' => 'save',  'type' => 'save',  'enabled' => true ),
					array( 'id' => 'email', 'type' => 'email', 'enabled' => true, 'config' => array(
						'to'      => '{{admin_email}}',
						'subject' => __( 'New Product Feedback ({{rating}} stars)', 'subtleforms' ),
						'message' => __( "Rating: {{rating}}/5\n\nUse case: {{use_case}}\nLikes: {{likes}}\nImprove: {{improve}}\n\nReply to: {{email}}", 'subtleforms' ),
					) ),
				),
			),
		);
	}

	private static function website_feedback() {
		return array(
			'id'          => 'website_feedback',
			'name'        => __( 'Website Feedback', 'subtleforms' ),
			'description' => __( 'Quick feedback on your website: usability, design, and suggestions.', 'subtleforms' ),
			'category'    => 'feedback',
			'icon'        => 'admin-site',
			'schema'      => array(
				'metadata' => array(
					'title' => __( 'Website Feedback', 'subtleforms' ),
					'name'  => 'website_feedback',
				),
				'fields' => array(
					array(
						'id'      => 'finding',
						'type'    => 'select',
						'label'   => __( 'How did you find what you needed?', 'subtleforms' ),
						'required'=> true,
						'options' => array(
							array( 'label' => __( 'Easily', 'subtleforms' ), 'value' => 'easily' ),
							array( 'label' => __( 'With some effort', 'subtleforms' ), 'value' => 'some_effort' ),
							array( 'label' => __( 'With great difficulty', 'subtleforms' ), 'value' => 'difficult' ),
							array( 'label' => __( 'Could not find it', 'subtleforms' ), 'value' => 'not_found' ),
						),
					),
					array( 'id' => 'design_rating', 'type' => 'rating', 'label' => __( 'Design rating', 'subtleforms' ), 'required' => false, 'max' => 5 ),
					array( 'id' => 'suggestions',   'type' => 'textarea', 'label' => __( 'Suggestions for improvement', 'subtleforms' ), 'required' => false, 'rows' => 4 ),
				),
				'actions' => array(
					array( 'id' => 'save',  'type' => 'save',  'enabled' => true ),
					array( 'id' => 'email', 'type' => 'email', 'enabled' => true, 'config' => array(
						'to'      => '{{admin_email}}',
						'subject' => __( 'Website Feedback Received', 'subtleforms' ),
						'message' => __( "Finding: {{finding}}\nDesign: {{design_rating}}/5\n\nSuggestions:\n{{suggestions}}", 'subtleforms' ),
					) ),
				),
			),
		);
	}

	private static function customer_satisfaction() {
		return array(
			'id'          => 'customer_satisfaction',
			'name'        => __( 'Customer Satisfaction (CSAT)', 'subtleforms' ),
			'description' => __( 'Post-purchase or post-support satisfaction survey.', 'subtleforms' ),
			'category'    => 'feedback',
			'icon'        => 'heart',
			'schema'      => array(
				'metadata' => array(
					'title' => __( 'How did we do?', 'subtleforms' ),
					'name'  => 'customer_satisfaction',
				),
				'fields' => array(
					array( 'id' => 'satisfaction', 'type' => 'rating', 'label' => __( 'How satisfied are you?', 'subtleforms' ), 'required' => true, 'max' => 5 ),
					array(
						'id'      => 'recommend',
						'type'    => 'select',
						'label'   => __( 'Would you recommend us to a friend?', 'subtleforms' ),
						'required'=> true,
						'options' => array(
							array( 'label' => __( 'Definitely yes', 'subtleforms' ), 'value' => 'yes' ),
							array( 'label' => __( 'Probably yes', 'subtleforms' ), 'value' => 'probably' ),
							array( 'label' => __( 'Not sure', 'subtleforms' ), 'value' => 'unsure' ),
							array( 'label' => __( 'Probably not', 'subtleforms' ), 'value' => 'probably_not' ),
							array( 'label' => __( 'Definitely not', 'subtleforms' ), 'value' => 'no' ),
						),
					),
					array( 'id' => 'comments', 'type' => 'textarea', 'label' => __( 'Any additional comments?', 'subtleforms' ), 'required' => false, 'rows' => 3 ),
				),
				'actions' => array(
					array( 'id' => 'save',  'type' => 'save',  'enabled' => true ),
					array( 'id' => 'email', 'type' => 'email', 'enabled' => true, 'config' => array(
						'to'      => '{{admin_email}}',
						'subject' => __( 'CSAT Response: {{satisfaction}}/5', 'subtleforms' ),
						'message' => __( "Satisfaction: {{satisfaction}}/5\nRecommend: {{recommend}}\n\nComments:\n{{comments}}", 'subtleforms' ),
					) ),
				),
			),
		);
	}

	private static function rsvp_form() {
		return array(
			'id'          => 'rsvp',
			'name'        => __( 'RSVP', 'subtleforms' ),
			'description' => __( 'Event RSVP: yes / no, guest count, and dietary requirements.', 'subtleforms' ),
			'category'    => 'registration',
			'icon'        => 'calendar-alt',
			'schema'      => array(
				'metadata' => array(
					'title' => __( 'RSVP', 'subtleforms' ),
					'name'  => 'rsvp',
				),
				'fields' => array(
					array( 'id' => 'name',  'type' => 'text',  'label' => __( 'Your Name', 'subtleforms' ),   'required' => true ),
					array( 'id' => 'email', 'type' => 'email', 'label' => __( 'Email Address', 'subtleforms' ),'required' => true ),
					array(
						'id'      => 'attending',
						'type'    => 'radio',
						'label'   => __( 'Will you attend?', 'subtleforms' ),
						'required'=> true,
						'options' => array(
							array( 'label' => __( 'Yes, I will attend', 'subtleforms' ), 'value' => 'yes' ),
							array( 'label' => __( 'No, I cannot attend', 'subtleforms' ), 'value' => 'no' ),
						),
					),
					array( 'id' => 'guests', 'type' => 'number', 'label' => __( 'Number of additional guests', 'subtleforms' ), 'required' => false, 'min' => 0, 'max' => 10 ),
					array( 'id' => 'dietary', 'type' => 'text', 'label' => __( 'Dietary requirements (optional)', 'subtleforms' ), 'required' => false ),
				),
				'actions' => array(
					array( 'id' => 'save',  'type' => 'save',  'enabled' => true ),
					array( 'id' => 'email', 'type' => 'email', 'enabled' => true, 'config' => array(
						'to'      => '{{admin_email}}',
						'subject' => __( 'RSVP: {{name}} ({{attending}})', 'subtleforms' ),
						'message' => __( "Name: {{name}}\nEmail: {{email}}\nAttending: {{attending}}\nGuests: {{guests}}\nDietary: {{dietary}}", 'subtleforms' ),
					) ),
				),
			),
		);
	}

	private static function bug_report() {
		return array(
			'id'          => 'bug_report',
			'name'        => __( 'Bug Report', 'subtleforms' ),
			'description' => __( 'Let users report bugs with steps to reproduce, severity, and device info.', 'subtleforms' ),
			'category'    => 'support',
			'icon'        => 'warning',
			'schema'      => array(
				'metadata' => array(
					'title' => __( 'Report a Bug', 'subtleforms' ),
					'name'  => 'bug_report',
				),
				'fields' => array(
					array( 'id' => 'summary',  'type' => 'text',     'label' => __( 'Brief summary of the issue', 'subtleforms' ), 'required' => true ),
					array( 'id' => 'steps',    'type' => 'textarea', 'label' => __( 'Steps to reproduce', 'subtleforms' ),         'required' => true, 'rows' => 4,
						'placeholder' => __( "1. Go to…\n2. Click on…\n3. See error", 'subtleforms' ) ),
					array( 'id' => 'expected', 'type' => 'textarea', 'label' => __( 'Expected behaviour', 'subtleforms' ),         'required' => false, 'rows' => 2 ),
					array( 'id' => 'actual',   'type' => 'textarea', 'label' => __( 'Actual behaviour', 'subtleforms' ),           'required' => false, 'rows' => 2 ),
					array(
						'id'      => 'severity',
						'type'    => 'select',
						'label'   => __( 'Severity', 'subtleforms' ),
						'required'=> true,
						'options' => array(
							array( 'label' => __( 'Critical: app is unusable', 'subtleforms' ), 'value' => 'critical' ),
							array( 'label' => __( 'High: major feature broken', 'subtleforms' ), 'value' => 'high' ),
							array( 'label' => __( 'Medium: partial functionality affected', 'subtleforms' ), 'value' => 'medium' ),
							array( 'label' => __( 'Low: minor inconvenience', 'subtleforms' ), 'value' => 'low' ),
						),
					),
					array( 'id' => 'browser',  'type' => 'text',  'label' => __( 'Browser & OS', 'subtleforms' ),       'required' => false ),
					array( 'id' => 'email',    'type' => 'email', 'label' => __( 'Your email (for follow-up)', 'subtleforms' ), 'required' => false ),
				),
				'actions' => array(
					array( 'id' => 'save',  'type' => 'save',  'enabled' => true ),
					array( 'id' => 'email', 'type' => 'email', 'enabled' => true, 'config' => array(
						'to'      => '{{admin_email}}',
						'subject' => __( '[{{severity}}] Bug: {{summary}}', 'subtleforms' ),
						'message' => __( "Summary: {{summary}}\nSeverity: {{severity}}\nBrowser: {{browser}}\n\nSteps:\n{{steps}}\n\nExpected: {{expected}}\nActual: {{actual}}\n\nContact: {{email}}", 'subtleforms' ),
					) ),
				),
			),
		);
	}

	/**
	 * Lead Capture Form Template
	 */
	private static function lead_capture_form() {
		return array(
			'id'          => 'lead_capture',
			'name'        => __( 'Lead Capture', 'subtleforms' ),
			'description' => __( 'Simple lead capture form with name and email', 'subtleforms' ),
			'category'    => 'marketing',
			'icon'        => 'groups',
			'schema'      => array(
				'metadata' => array(
					'title'       => __( 'Stay Updated', 'subtleforms' ),
					'name'        => 'lead_capture',
					'description' => __( 'Subscribe to our newsletter', 'subtleforms' ),
				),
				'fields'   => array(
					array(
						'id'          => 'first_name',
						'type'        => 'text',
						'label'       => __( 'First Name', 'subtleforms' ),
						'required'    => true,
						'placeholder' => __( 'John', 'subtleforms' ),
					),
					array(
						'id'          => 'email',
						'type'        => 'email',
						'label'       => __( 'Email Address', 'subtleforms' ),
						'required'    => true,
						'placeholder' => __( 'john@example.com', 'subtleforms' ),
					),
					array(
						'id'      => 'consent',
						'type'    => 'checkbox',
						'label'   => __( 'I agree to receive marketing emails', 'subtleforms' ),
						'required' => true,
					),
				),
				'actions'  => array(
					array(
						'id'      => 'save',
						'type'    => 'save',
						'enabled' => true,
					),
					array(
						'id'      => 'email',
						'type'    => 'email',
						'enabled' => true,
						'config'  => array(
							'to'      => '{{admin_email}}',
							'subject' => __( 'New Lead: {{first_name}}', 'subtleforms' ),
							'message' => __( "New lead captured:\n\nName: {{first_name}}\nEmail: {{email}}\n\nConsent: {{consent}}", 'subtleforms' ),
						),
					),
				),
			),
		);
	}

	/**
	 * Drop example.com webhooks, notify the site owner, and keep payment
	 * templates away from card numbers. Runs after other plugins add templates.
	 *
	 * @param string $id       Template id.
	 * @param array  $template Template definition.
	 * @return array
	 */
	private static function prepare_template( string $id, array $template ): array {
		$schema = ( isset( $template['schema'] ) && is_array( $template['schema'] ) ) ? $template['schema'] : array();

		// Templates an add-on marks as its own (`addon`, or `is_pro` from
		// older add-ons) keep their fields, such as the Card Payment field;
		// only their actions are checked here.
		if ( ! empty( $template['addon'] ) || ! empty( $template['is_pro'] ) ) {
			if ( isset( $schema['actions'] ) || isset( $schema['fields'] ) ) {
				$schema['actions']  = self::owner_actions( is_array( $schema['actions'] ?? null ) ? $schema['actions'] : array() );
				$template['schema'] = $schema;
			}
			return $template;
		}

		foreach ( array( 'fields', 'steps' ) as $list ) {
			if ( isset( $schema[ $list ] ) && is_array( $schema[ $list ] ) ) {
				$schema[ $list ] = self::prepare_field_list( $schema[ $list ], $id );
			}
		}

		$schema['actions']   = self::owner_actions( is_array( $schema['actions'] ?? null ) ? $schema['actions'] : array() );
		$template['schema']  = $schema;
		return $template;
	}

	/**
	 * @param array<int, mixed> $fields Fields or steps.
	 * @param string            $id     Template id.
	 * @return array<int, mixed>
	 */
	private static function prepare_field_list( array $fields, string $id ): array {
		$out = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			foreach ( array( 'fields', 'children' ) as $child ) {
				if ( isset( $field[ $child ] ) && is_array( $field[ $child ] ) ) {
					$field[ $child ] = self::prepare_field_list( $field[ $child ], $id );
				}
			}
			if ( self::is_card_field( $field ) ) {
				continue;
			}
			$out[] = $field;
		}
		return $out;
	}

	/**
	 * @param array<string, mixed> $field Field definition.
	 */
	public static function is_card_field( array $field ): bool {
		if ( 'payment_card' === ( $field['type'] ?? '' ) ) {
			return false;
		}
		$config = isset( $field['config'] ) && is_array( $field['config'] ) ? $field['config'] : array();
		foreach ( array( $field['id'] ?? '', $field['key'] ?? '', $config['key'] ?? '' ) as $identifier ) {
			if ( is_string( $identifier ) && 1 === preg_match( self::CARD_INPUT_ID, strtolower( trim( $identifier ) ) ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Keep every action except example.com webhooks and previous emails, then
	 * add one email to the site owner. An empty message sends {all_fields}.
	 *
	 * @param array<int, mixed> $actions Actions.
	 * @return array<int, mixed>
	 */
	private static function owner_actions( array $actions ): array {
		$kept = array();
		foreach ( $actions as $action ) {
			if ( ! is_array( $action ) ) {
				continue;
			}
			$type = (string) ( $action['type'] ?? '' );
			if ( 'email' === $type ) {
				continue;
			}
			if ( 'webhook' === $type && self::webhook_is_example( $action ) ) {
				continue;
			}
			$kept[] = $action;
		}
		$kept[] = array(
			'id'      => 'email',
			'type'    => 'email',
			'enabled' => true,
			'config'  => array(
				'to'      => '{admin_email}',
				'subject' => __( 'New entry: {form_title}', 'subtleforms' ),
				'message' => '',
			),
		);
		return $kept;
	}

	/**
	 * @param array<string, mixed> $action Webhook action.
	 */
	private static function webhook_is_example( array $action ): bool {
		$values = array();
		if ( isset( $action['url'] ) && is_string( $action['url'] ) ) {
			$values[] = $action['url'];
		}
		$config = $action['config'] ?? array();
		if ( is_array( $config ) ) {
			foreach ( $config as $value ) {
				if ( is_string( $value ) ) {
					$values[] = $value;
				}
			}
		}
		foreach ( $values as $value ) {
			if ( self::is_example_host( $value ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Whether a webhook address is example.com or a subdomain of it.
	 */
	private static function is_example_host( string $value ): bool {
		$candidate = trim( $value );
		if ( '' === $candidate ) {
			return false;
		}
		if ( ! str_contains( $candidate, '://' ) ) {
			$candidate = 'https://' . $candidate;
		}
		$host = function_exists( 'wp_parse_url' ) ? wp_parse_url( $candidate, PHP_URL_HOST ) : parse_url( $candidate, PHP_URL_HOST ); // phpcs:ignore WordPress.WP.AlternativeFunctions.parse_url_parse_url -- Fallback outside WordPress.
		if ( ! is_string( $host ) || '' === $host ) {
			return false;
		}
		$host = strtolower( $host );
		return 'example.com' === $host || str_ends_with( $host, '.example.com' );
	}

}
