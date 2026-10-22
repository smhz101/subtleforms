<?php
/**
 * The one table of which field types each importer maps, and to what.
 *
 * Every importer reads its field types from here, and docs/migrate.md lists
 * the same table (a unit test keeps the two in step). A value starting with
 * `!` names the reason the type is skipped instead.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Source field type to SubtleForms field type.
 */
final class FieldMap {

	/**
	 * Targets that are not field types: a page break starts a new step and a
	 * submit button gives the form its button text.
	 */
	public const STEP   = 'step';
	public const SUBMIT = '@submit';

	/**
	 * Contact Form 7 form-tags.
	 */
	public const CF7 = array(
		'text'       => 'text',
		'email'      => 'email',
		'url'        => 'url',
		'tel'        => 'phone',
		'number'     => 'number',
		'range'      => 'range_slider',
		'date'       => 'date',
		'textarea'   => 'textarea',
		'select'     => 'dropdown',
		'checkbox'   => 'multiple_choice',
		'radio'      => 'radio',
		'acceptance' => 'consent',
		'file'       => 'file_upload',
		'hidden'     => 'hidden',
		'submit'     => self::SUBMIT,
		'quiz'       => '!quiz',
		'captchac'   => '!captcha',
		'captchar'   => '!captcha',
		'recaptcha'  => '!captcha',
	);

	/**
	 * Gravity Forms field types.
	 */
	public const GRAVITY = array(
		'text'              => 'text',
		'textarea'          => 'textarea',
		'select'            => 'dropdown',
		'multiselect'       => 'multiple_choice',
		'checkbox'          => 'multiple_choice',
		'radio'             => 'radio',
		'name'              => 'name_group',
		'email'             => 'email',
		'phone'             => 'phone',
		'address'           => 'address_group',
		'website'           => 'url',
		'number'            => 'number',
		'date'              => 'date',
		'time'              => 'time',
		'fileupload'        => 'file_upload',
		'hidden'            => 'hidden',
		'html'              => 'html',
		'section'           => 'section_break',
		'page'              => self::STEP,
		'consent'           => 'consent',
		'password'          => 'password',
		'list'              => '!list',
		'product'           => '!payment',
		'quantity'          => '!payment',
		'option'            => '!payment',
		'shipping'          => '!payment',
		'total'             => '!payment',
		'donation'          => '!payment',
		'calculation'       => '!payment',
		'singleproduct'     => '!payment',
		'creditcard'        => '!payment',
		'stripe_creditcard' => '!payment',
		'paypal'            => '!payment',
		'paypal_checkout'   => '!payment',
		'square'            => '!payment',
		'coupon'            => '!payment',
		'captcha'           => '!captcha',
		'quiz'              => '!quiz',
		'poll'              => '!quiz',
		'survey'            => '!quiz',
		'likert'            => '!quiz',
		'rank'              => '!quiz',
		'rating'            => '!quiz',
		'post_title'        => '!post',
		'post_content'      => '!post',
		'post_excerpt'      => '!post',
		'post_tags'         => '!post',
		'post_category'     => '!post',
		'post_image'        => '!post',
		'post_custom_field' => '!post',
		'signature'         => '!pro',
		'repeater'          => '!repeater',
	);

	/**
	 * Fluent Forms elements.
	 */
	public const FLUENT = array(
		'input_text'             => 'text',
		'input_email'            => 'email',
		'textarea'               => 'textarea',
		'select'                 => 'dropdown',
		'multi_select'           => 'multiple_choice',
		'input_radio'            => 'radio',
		'input_checkbox'         => 'multiple_choice',
		'input_name'             => 'name_group',
		'phone'                  => 'phone',
		'address'                => 'address_group',
		'input_number'           => 'number',
		'input_date'             => 'date',
		'input_url'              => 'url',
		'input_file'             => 'file_upload',
		'input_image'            => 'image_upload',
		'input_password'         => 'password',
		'select_country'         => 'country',
		'rangeslider'            => 'range_slider',
		'section_break'          => 'section_break',
		'form_step'              => self::STEP,
		'terms_and_condition'    => 'consent',
		'gdpr_agreement'         => 'consent',
		'custom_html'            => 'html',
		'input_hidden'           => 'hidden',
		'custom_submit_button'   => self::SUBMIT,
		'repeater_field'         => '!repeater',
		'input_repeat'           => '!repeater',
		'payment_method'         => '!payment',
		'multi_payment_component' => '!payment',
		'subscription_payment_component' => '!payment',
		'custom_payment_component' => '!payment',
		'item_quantity_component' => '!payment',
		'payment_summary_component' => '!payment',
		'payment_coupon'         => '!payment',
		'recaptcha'              => '!captcha',
		'hcaptcha'               => '!captcha',
		'turnstile'              => '!captcha',
		'quiz_score'             => '!quiz',
		'ratings'                => '!quiz',
		'net_promoter_score'     => '!quiz',
		'tabular_grid'           => '!quiz',
		'post_title'             => '!post',
		'post_content'           => '!post',
		'post_excerpt'           => '!post',
		'featured_image'         => '!post',
		'taxonomy'               => '!post',
		'signature'              => '!pro',
	);

	/**
	 * Plain names of the sources, for report lines.
	 *
	 * @return array<string, string>
	 */
	public static function sourceLabels(): array {
		return array(
			'cf7'     => __( 'Contact Form 7', 'subtleforms' ),
			'gravity' => __( 'Gravity Forms', 'subtleforms' ),
			'fluent'  => __( 'Fluent Forms', 'subtleforms' ),
		);
	}

	/**
	 * The table for a source.
	 *
	 * @param string $source cf7, gravity or fluent.
	 * @return array<string, string>
	 */
	public static function table( string $source ): array {
		switch ( $source ) {
			case 'cf7':
				return self::CF7;
			case 'gravity':
				return self::GRAVITY;
			case 'fluent':
				return self::FLUENT;
		}
		return array();
	}

	/**
	 * The SubtleForms type for a source type, or an empty string when it is
	 * skipped or unknown.
	 *
	 * @param string $source Source id.
	 * @param string $type   Source field type.
	 * @return string
	 */
	public static function target( string $source, string $type ): string {
		$target = self::table( $source )[ strtolower( $type ) ] ?? '';
		return '' !== $target && '!' !== $target[0] ? $target : '';
	}

	/**
	 * Why a source type is skipped, in plain words.
	 *
	 * @param string $source Source id.
	 * @param string $type   Source field type.
	 * @return string
	 */
	public static function reason( string $source, string $type ): string {
		$target = self::table( $source )[ strtolower( $type ) ] ?? '';
		$key    = '' !== $target && '!' === $target[0] ? substr( $target, 1 ) : 'unknown';
		$why    = array(
			'payment'  => __( 'payments are not imported', 'subtleforms' ),
			'captcha'  => __( 'SubtleForms has its own spam protection and CAPTCHA settings', 'subtleforms' ),
			'quiz'     => __( 'quizzes, polls, surveys and ratings are not imported', 'subtleforms' ),
			'post'     => __( 'post creation fields are not imported', 'subtleforms' ),
			'list'     => __( 'list fields have no SubtleForms equivalent', 'subtleforms' ),
			'repeater' => __( 'repeating fields are not imported', 'subtleforms' ),
			'pro'      => __( 'this field needs SubtleForms Pro', 'subtleforms' ),
			'unknown'  => __( 'this field type has no SubtleForms equivalent', 'subtleforms' ),
		);
		return $why[ $key ] ?? $why['unknown'];
	}

	/**
	 * The report line for a skipped field.
	 *
	 * @param string $source Source id.
	 * @param string $label  Field label (or name).
	 * @param string $type   Source field type.
	 * @param string $reason Reason; empty uses the table.
	 * @return string
	 */
	public static function skippedLine( string $source, string $label, string $type, string $reason = '' ): string {
		return sprintf(
			/* translators: 1: plugin name, 2: field label, 3: field type, 4: reason */
			__( '%1$s field \'%2$s\' (type %3$s) was skipped: %4$s.', 'subtleforms' ),
			self::sourceLabels()[ $source ] ?? $source,
			'' !== $label ? $label : $type,
			'' !== $type ? $type : '?',
			'' !== $reason ? $reason : self::reason( $source, $type )
		);
	}
}
