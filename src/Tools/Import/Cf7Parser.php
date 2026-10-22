<?php
/**
 * Read a Contact Form 7 form template: its form-tags and the text around them.
 *
 * The tag syntax follows Contact Form 7's own parser:
 * `[type* name option option:value "value" "label|value"]`, with an optional
 * closing tag for types that wrap content (`[acceptance x] text [/acceptance]`).
 * Labels are not part of the tag: they are the text written just before it,
 * usually inside a `<label>`. Other text between tags is kept as text items.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Form template to an ordered list of tags and text.
 */
final class Cf7Parser {

	/** Tag types that have no name: the first word is not a field name. */
	private const NAMELESS = array( 'submit', 'response', 'count' );

	/**
	 * @param string $template Form template.
	 * @return array<int, array> Items: kind tag (type, basetype, required, name,
	 *                           options, values, content, label) or kind text (html).
	 */
	public static function parse( string $template ): array {
		$pattern = '/(\[?)\[([a-zA-Z_][0-9a-zA-Z:._-]*\*?)(?:[\r\n\t ](.*?))?(?:[\r\n\t ](\/))?\](?:([^\[]*?)\[\/\2\])?(\]?)/s';
		if ( ! preg_match_all( $pattern, $template, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE ) ) {
			return self::textItems( $template );
		}
		$items  = array();
		$cursor = 0;
		foreach ( $matches as $m ) {
			$start = (int) $m[0][1];
			$whole = (string) $m[0][0];
			// [[tag]] is an escaped tag: plain text.
			if ( '[' === $m[1][0] && ']' === ( $m[6][0] ?? '' ) ) {
				continue;
			}
			$before = substr( $template, $cursor, $start - $cursor );
			$cursor = $start + strlen( $whole );
			$tag    = self::tag( (string) $m[2][0], (string) ( $m[3][0] ?? '' ), (string) ( $m[5][0] ?? '' ) );
			$split  = self::splitLead( $before );
			foreach ( $split['text'] as $text ) {
				$items[] = array(
					'kind' => 'text',
					'html' => $text,
				);
			}
			if ( in_array( $tag['basetype'], array( 'submit', 'hidden', 'response', 'count' ), true ) ) {
				// These take no label: the lead text, if any, is text.
				if ( '' !== SchemaBuilder::plain( $split['lead'] ) ) {
					$items[] = array(
						'kind' => 'text',
						'html' => $split['lead'],
					);
				}
				$tag['label'] = '';
			} else {
				$tag['label'] = self::cleanLabel( $split['lead'] );
			}
			$items[] = $tag;
		}
		$after = substr( $template, $cursor );
		foreach ( self::textItems( $after ) as $item ) {
			$items[] = $item;
		}
		return $items;
	}

	/**
	 * One form-tag.
	 *
	 * @param string $type    Tag type, with * when required.
	 * @param string $attr    Everything after the type.
	 * @param string $content Content between an opening and closing tag.
	 * @return array
	 */
	public static function tag( string $type, string $attr, string $content = '' ): array {
		$required = '*' === substr( $type, -1 );
		$basetype = strtolower( rtrim( $type, '*' ) );
		$values   = array();
		if ( preg_match_all( '/"[^"]*"|\'[^\']*\'/', $attr, $quoted ) ) {
			foreach ( $quoted[0] as $raw ) {
				$values[] = substr( $raw, 1, -1 );
			}
		}
		$rest    = trim( (string) preg_replace( '/"[^"]*"|\'[^\']*\'/', ' ', $attr ) );
		$options = '' === $rest ? array() : preg_split( '/[\r\n\t ]+/', $rest );
		$options = array_values( array_filter( (array) $options, 'strlen' ) );
		$name    = '';
		if ( ! in_array( $basetype, self::NAMELESS, true ) && $options ) {
			$name = (string) array_shift( $options );
		}
		return array(
			'kind'     => 'tag',
			'type'     => $type,
			'basetype' => $basetype,
			'required' => $required,
			'name'     => $name,
			'options'  => $options,
			'values'   => $values,
			'content'  => trim( $content ),
			'label'    => '',
		);
	}

	/**
	 * The value of `name:value`, or of a bare `name` flag (`true`), or null.
	 *
	 * @param array  $tag  Parsed tag.
	 * @param string $name Option name.
	 * @return string|bool|null
	 */
	public static function option( array $tag, string $name ) {
		foreach ( (array) $tag['options'] as $option ) {
			if ( $option === $name ) {
				return true;
			}
			if ( 0 === strpos( $option, $name . ':' ) ) {
				return (string) substr( $option, strlen( $name ) + 1 );
			}
		}
		return null;
	}

	/**
	 * `Label|value` choices, as Contact Form 7 pipes write them.
	 *
	 * @param string $value Raw value.
	 * @return array{label: string, value: string}
	 */
	public static function pipe( string $value ): array {
		$pos = strpos( $value, '|' );
		if ( false === $pos ) {
			return array(
				'label' => $value,
				'value' => $value,
			);
		}
		return array(
			'label' => substr( $value, 0, $pos ),
			'value' => substr( $value, $pos + 1 ),
		);
	}

	/**
	 * Split the text before a tag into free text and the label of the tag.
	 *
	 * The label is the last block before the tag: after the last closing
	 * label, paragraph, div, heading or list item, or the last blank line.
	 * A line break inside it is part of the label ("Name<br>[text name]").
	 *
	 * @param string $before Template text before a tag.
	 * @return array{text: string[], lead: string}
	 */
	private static function splitLead( string $before ): array {
		$pieces = preg_split( '#(</(?:label|p|div|h[1-6]|li|legend|fieldset|span|td|th|tr)\s*>|\n[ \t]*\n)#i', $before, -1, PREG_SPLIT_DELIM_CAPTURE );
		$pieces = is_array( $pieces ) ? $pieces : array( $before );
		$lead   = (string) array_pop( $pieces );
		$text   = array();
		$buffer = '';
		foreach ( $pieces as $piece ) {
			$buffer .= $piece;
			if ( preg_match( '#^(</[a-z0-9]+\s*>|\n[ \t]*\n)$#i', $piece ) ) {
				if ( '' !== SchemaBuilder::plain( $buffer ) ) {
					$text[] = $buffer;
				}
				$buffer = '';
			}
		}
		if ( '' !== SchemaBuilder::plain( $buffer ) ) {
			$text[] = $buffer;
		}
		return array(
			'text' => $text,
			'lead' => $lead,
		);
	}

	/**
	 * Free text after the last tag, as text items.
	 *
	 * @param string $html Template text.
	 * @return array<int, array>
	 */
	private static function textItems( string $html ): array {
		$split = self::splitLead( $html );
		$items = array();
		foreach ( array_merge( $split['text'], array( $split['lead'] ) ) as $text ) {
			if ( '' !== SchemaBuilder::plain( $text ) ) {
				$items[] = array(
					'kind' => 'text',
					'html' => $text,
				);
			}
		}
		return $items;
	}

	/**
	 * A label without markup, required or optional marks, or a trailing colon.
	 *
	 * @param string $lead Label text.
	 * @return string
	 */
	public static function cleanLabel( string $lead ): string {
		$label = SchemaBuilder::plain( $lead );
		$label = (string) preg_replace( '/\s*\((?:required|optional)\)\s*/i', ' ', $label );
		$label = trim( (string) preg_replace( '/\s*[*:]+\s*$/', '', trim( $label ) ) );
		return $label;
	}
}
