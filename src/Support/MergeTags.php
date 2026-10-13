<?php
/**
 * Merge tags for notification emails.
 *
 * Supported tags, written with single or double braces ({tag} or {{tag}}):
 *
 *   {all_fields}   every answer with its label (secret fields left out)
 *   {field:key}    the answer to one field, by field key
 *   {key}          the same, shorthand (kept for forms built before 2.3)
 *   {form_title}   the form's title
 *   {entry_id}     the entry number
 *   {site_name}    the site title
 *   {admin_email}  the site admin email
 *   {date}         the date and time the entry was sent (site format)
 *
 * A double-brace tag that matches nothing becomes empty, as before 2.3. A
 * single-brace word that matches nothing is left as written, so ordinary
 * braces in a message are not lost.
 *
 * @package SubtleForms\Support
 * @since   2.3.0
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Replaces merge tags in email recipients, subjects and bodies.
 */
final class MergeTags {

	/**
	 * Tags that are not field answers.
	 */
	public const GLOBAL_TAGS = array( 'all_fields', 'form_title', 'entry_id', 'site_name', 'admin_email', 'date' );

	/**
	 * Replace tags in a template.
	 *
	 * @param string $template Template text.
	 * @param array  $context {
	 *     @type array  $answers    Field key => formatted answer (text or HTML).
	 *     @type array  $fields     List of ['key','label','type','field'] (FieldMapper::fields()).
	 *     @type string $form_title Form title.
	 *     @type int    $entry_id   Entry ID.
	 *     @type string $date       Formatted date.
	 * }
	 * @param bool   $html     Whether the output is HTML.
	 * @return string
	 */
	public static function render( string $template, array $context, bool $html = false ): string {
		$answers = isset( $context['answers'] ) && is_array( $context['answers'] ) ? $context['answers'] : array();

		return (string) preg_replace_callback(
			'/\{\{\s*([a-zA-Z0-9_:.\-]+)\s*\}\}|\{([a-zA-Z0-9_:.\-]+)\}/',
			static function ( $m ) use ( $context, $answers, $html ) {
				$double = isset( $m[1] ) && $m[1] !== '';
				$name   = $double ? $m[1] : $m[2];
				$value  = self::resolve( $name, $context, $answers, $html );
				if ( $value === null ) {
					return $double ? '' : $m[0];
				}
				return $value;
			},
			$template
		);
	}

	/**
	 * Value of one tag, or null when the tag is unknown.
	 *
	 * @param string $name    Tag name.
	 * @param array  $context Context (see render()).
	 * @param array  $answers Formatted answers.
	 * @param bool   $html    HTML output.
	 * @return string|null
	 */
	private static function resolve( string $name, array $context, array $answers, bool $html ): ?string {
		$escape = static function ( $text ) use ( $html ) {
			return $html ? esc_html( (string) $text ) : (string) $text;
		};

		switch ( $name ) {
			case 'all_fields':
				return self::allFields( $context, $answers, $html );
			case 'form_title':
				return $escape( $context['form_title'] ?? '' );
			case 'entry_id':
				return $escape( (string) ( $context['entry_id'] ?? '' ) );
			case 'site_name':
				return $escape( function_exists( 'get_bloginfo' ) ? wp_specialchars_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES ) : '' );
			case 'admin_email':
				return $escape( function_exists( 'get_option' ) ? (string) get_option( 'admin_email' ) : '' );
			case 'date':
				return $escape( $context['date'] ?? self::now() );
		}

		$key = strpos( $name, 'field:' ) === 0 ? substr( $name, 6 ) : $name;
		if ( $key !== '' && array_key_exists( $key, $answers ) ) {
			$value = $answers[ $key ];
			if ( is_array( $value ) ) {
				$value = implode( ', ', array_map( 'strval', array_filter( $value, 'is_scalar' ) ) );
			}
			return (string) $value;
		}

		// {field:key} of a field that was left empty or hidden: nothing.
		if ( strpos( $name, 'field:' ) === 0 ) {
			return '';
		}

		return null;
	}

	/**
	 * Every answer with its label.
	 *
	 * @param array $context Context.
	 * @param array $answers Formatted answers.
	 * @param bool  $html    HTML output.
	 * @return string
	 */
	public static function allFields( array $context, array $answers, bool $html ): string {
		$rows   = array();
		$fields = isset( $context['fields'] ) && is_array( $context['fields'] ) ? $context['fields'] : array();
		$seen   = array();

		foreach ( $fields as $entry ) {
			$key = (string) ( $entry['key'] ?? '' );
			if ( $key === '' || ! array_key_exists( $key, $answers ) || EntryValues::isSecret( (array) ( $entry['field'] ?? array() ) ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$value        = $answers[ $key ];
			if ( is_array( $value ) ) {
				$value = implode( ', ', array_map( 'strval', array_filter( $value, 'is_scalar' ) ) );
			}
			if ( trim( wp_strip_all_tags( (string) $value ) ) === '' && false === stripos( (string) $value, '<img' ) ) {
				continue;
			}
			$rows[] = array( (string) ( $entry['label'] ?? '' ) !== '' ? (string) $entry['label'] : $key, (string) $value );
		}

		if ( ! $rows ) {
			return '';
		}

		if ( ! $html ) {
			$lines = array();
			foreach ( $rows as $row ) {
				$lines[] = $row[0] . ': ' . ( strpos( $row[1], "\n" ) !== false ? "\n" . $row[1] : $row[1] );
			}
			return implode( "\n", $lines );
		}

		$out = '<table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;">';
		foreach ( $rows as $row ) {
			$out .= '<tr><th align="left" valign="top" style="border-bottom:1px solid #e5e7eb;color:#374151;font-weight:600;width:35%;">' . esc_html( $row[0] ) . '</th>'
				. '<td valign="top" style="border-bottom:1px solid #e5e7eb;color:#111827;">' . $row[1] . '</td></tr>';
		}
		return $out . '</table>';
	}

	/**
	 * Current date and time in the site's formats.
	 *
	 * @return string
	 */
	private static function now(): string {
		if ( function_exists( 'wp_date' ) ) {
			return (string) wp_date( get_option( 'date_format', 'F j, Y' ) . ' ' . get_option( 'time_format', 'g:i a' ) );
		}
		return gmdate( 'Y-m-d H:i' );
	}
}
