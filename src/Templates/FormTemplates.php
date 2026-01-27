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

/**
 * Form template definitions.
 */
class FormTemplates {

	/**
	 * Get all available templates.
	 *
	 * @return array Array of template definitions.
	 */
	public static function get_all() {
		$templates = array(
			'contact'      => self::contact_form(),
			'lead_capture' => self::lead_capture_form(),
		);

		/**
		 * Filter available form templates.
		 *
		 * Allows extensions (like Pro) to add additional templates.
		 *
		 * @param array $templates Associative array of template definitions.
		 * @since 1.5.0
		 */
		return apply_filters( 'subtleforms/templates', $templates );
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

	/**
	 * Lead Capture Form Template
	 *
	 * Minimal form for capturing leads with name and email.
	 *
	 * @return array Template definition.
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
}
