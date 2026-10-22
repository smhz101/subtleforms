<?php
/**
 * Contact Form 7 form to SubtleForms schema.
 *
 * Pure: takes the post's template and meta as read from the database and
 * writes nothing.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map one Contact Form 7 form.
 */
final class Cf7Mapper {

	private const SOURCE = 'cf7';

	/** Tags that only position output or count characters. */
	private const SILENT = array( 'response', 'count' );

	/** @var ImportNotes */
	private $notes;

	/** @var SchemaBuilder */
	private $build;

	/** @var array<string, string> Contact Form 7 field name => SubtleForms key. */
	private $keys = array();

	/** @var array<string, string> Field name => label, for the report. */
	private $labels = array();

	/** @var array Site facts. */
	private $context;

	/**
	 * @param array $context site_title, site_url, admin_email.
	 */
	public function __construct( array $context = array() ) {
		$this->notes   = new ImportNotes();
		$this->build   = new SchemaBuilder( $this->notes );
		$this->context = $context;
	}

	/**
	 * @param array $raw     id, title, form, mail, mail_2, messages, additional_settings.
	 * @param array $context Site facts.
	 * @return array{title: string, schema: array, notes: ImportNotes}
	 */
	public static function map( array $raw, array $context = array() ): array {
		return ( new self( $context ) )->run( $raw );
	}

	/**
	 * @param array $raw Raw form.
	 * @return array{title: string, schema: array, notes: ImportNotes}
	 */
	private function run( array $raw ): array {
		$title    = SchemaBuilder::title( (string) ( $raw['title'] ?? '' ) );
		$items    = Cf7Parser::parse( (string) ( $raw['form'] ?? '' ) );
		$fields   = array();
		$metadata = array();

		// Keys first, so a mail tag can point at any field.
		foreach ( $items as $item ) {
			if ( 'tag' === $item['kind'] && '' !== $item['name'] && '' !== FieldMap::target( self::SOURCE, $item['basetype'] ) && FieldMap::SUBMIT !== FieldMap::target( self::SOURCE, $item['basetype'] ) ) {
				$this->keys[ $item['name'] ]   = $this->build->key( $item['name'], $this->labelFor( $item ), $item['name'] );
				$this->labels[ $item['name'] ] = $this->labelFor( $item );
			}
		}

		foreach ( $items as $item ) {
			if ( 'text' === $item['kind'] ) {
				$fields[] = $this->text( (string) $item['html'] );
				continue;
			}
			if ( in_array( $item['basetype'], self::SILENT, true ) ) {
				continue;
			}
			$target = FieldMap::target( self::SOURCE, $item['basetype'] );
			if ( FieldMap::SUBMIT === $target ) {
				$text = trim( (string) ( $item['values'][0] ?? '' ) );
				if ( '' !== $text ) {
					$metadata['submitText'] = SchemaBuilder::cut( $text, SchemaBuilder::MAX_SUBMIT );
				}
				continue;
			}
			if ( '' === $target ) {
				$this->notes->skipped( FieldMap::skippedLine( self::SOURCE, $this->labelFor( $item ), $item['basetype'] ) );
				continue;
			}
			$field = $this->field( $item, $target );
			if ( $field ) {
				$fields[] = $field;
			}
		}

		$settings = self::settings( (string) ( $raw['additional_settings'] ?? '' ) );
		$mailOff  = $this->mailSwitchedOff( $settings );
		$actions  = $this->emails( $raw, $mailOff );

		$messages = is_array( $raw['messages'] ?? null ) ? $raw['messages'] : array();
		$sent     = trim( (string) ( $messages['mail_sent_ok'] ?? '' ) );
		if ( '' !== $sent ) {
			$metadata['confirmation'] = array(
				'type'    => 'message',
				'message' => SchemaBuilder::cut( $sent, SchemaBuilder::MAX_MESSAGE ),
			);
		}
		$requiredMessage = trim( (string) ( $messages['invalid_required'] ?? '' ) );
		if ( '' !== $requiredMessage ) {
			$metadata['requiredMessage'] = SchemaBuilder::cut( $requiredMessage, 500 );
		}
		if ( $this->truthy( $settings['subscribers_only'] ?? '' ) ) {
			$metadata['restrictions'] = array( 'requireLogin' => true );
			$this->notes->info( __( 'Only logged-in visitors can send this form, as before.', 'subtleforms' ) );
		}
		foreach ( $settings as $name => $value ) {
			if ( in_array( $name, array( 'subscribers_only', 'skip_mail', 'demo_mode' ), true ) ) {
				continue;
			}
			$this->notes->skipped(
				sprintf(
					/* translators: %s: setting name */
					__( 'The additional setting \'%s\' was not copied.', 'subtleforms' ),
					$name
				)
			);
		}

		$schema = SchemaBuilder::schema( $title, '', array_values( array_filter( $fields ) ), $actions, $metadata );
		return array(
			'title'  => $title,
			'schema' => $schema,
			'notes'  => $this->notes,
		);
	}

	/**
	 * Text between tags: a heading becomes a Section Heading, anything else
	 * Custom HTML.
	 *
	 * @param string $html Template text.
	 * @return array|null
	 */
	private function text( string $html ): ?array {
		$plain = SchemaBuilder::plain( $html );
		if ( '' === $plain ) {
			return null;
		}
		if ( preg_match( '#<h[1-6][^>]*>#i', $html ) ) {
			return $this->build->field( 'section_break', $this->build->key( '', 'section' ), $plain, false, array( 'title' => $plain ) );
		}
		$field = $this->build->field( 'html', $this->build->key( '', 'text_block' ), '', false );
		$field['content'] = '<p>' . htmlspecialchars( $plain, ENT_QUOTES, 'UTF-8' ) . '</p>';
		return $field;
	}

	/**
	 * The label a tag gets: the text before it, else its placeholder, else
	 * its name in words.
	 *
	 * @param array $tag Parsed tag.
	 * @return string
	 */
	private function labelFor( array $tag ): string {
		if ( '' !== $tag['label'] ) {
			return $tag['label'];
		}
		if ( ( Cf7Parser::option( $tag, 'placeholder' ) || Cf7Parser::option( $tag, 'watermark' ) ) && isset( $tag['values'][0] ) && ! in_array( $tag['basetype'], array( 'select', 'checkbox', 'radio' ), true ) ) {
			return trim( (string) $tag['values'][0] );
		}
		if ( 'acceptance' === $tag['basetype'] ) {
			return __( 'Consent', 'subtleforms' );
		}
		$words = trim( (string) preg_replace( '/[-_]+/', ' ', (string) preg_replace( '/^your[-_]/i', '', $tag['name'] ) ) );
		return '' !== $words ? ucfirst( $words ) : ucfirst( $tag['basetype'] );
	}

	/**
	 * One form-tag as a field.
	 *
	 * @param array  $tag    Parsed tag.
	 * @param string $target SubtleForms type.
	 * @return array|null
	 */
	private function field( array $tag, string $target ): ?array {
		$label    = $this->labelFor( $tag );
		$key      = $this->keys[ $tag['name'] ] ?? $this->build->key( $tag['name'], $label, $tag['basetype'] );
		$required = (bool) $tag['required'];
		$extra    = array();
		$type     = $tag['basetype'];

		$isPlaceholder = Cf7Parser::option( $tag, 'placeholder' ) || Cf7Parser::option( $tag, 'watermark' );
		$first         = isset( $tag['values'][0] ) ? (string) $tag['values'][0] : '';

		switch ( $type ) {
			case 'text':
			case 'email':
			case 'url':
			case 'tel':
			case 'textarea':
				if ( '' !== $first ) {
					$extra[ $isPlaceholder ? 'placeholder' : 'defaultValue' ] = $first;
				}
				$min = Cf7Parser::option( $tag, 'minlength' );
				$max = Cf7Parser::option( $tag, 'maxlength' );
				foreach ( (array) $tag['options'] as $option ) {
					// Size options: 40/100 (text) and 40x10 (textarea).
					if ( preg_match( '#^(\d*)/(\d+)$#', $option, $size ) ) {
						$max = $max ?? $size[2];
					}
					if ( 'textarea' === $type && preg_match( '#^(\d*)x(\d+)$#', $option, $size ) ) {
						$extra['rows'] = (int) $size[2];
					}
				}
				if ( is_string( $min ) && ctype_digit( $min ) ) {
					$extra['minLength'] = (int) $min;
				}
				if ( is_string( $max ) && ctype_digit( $max ) ) {
					$extra['maxLength'] = (int) $max;
				}
				break;

			case 'number':
			case 'range':
				if ( '' !== $first ) {
					$extra[ $isPlaceholder ? 'placeholder' : 'defaultValue' ] = $first;
				}
				foreach ( array( 'min', 'max', 'step' ) as $limit ) {
					$value = Cf7Parser::option( $tag, $limit );
					if ( is_string( $value ) && is_numeric( $value ) ) {
						$extra[ $limit ] = $value + 0;
					}
				}
				break;

			case 'date':
				if ( '' !== $first ) {
					$extra[ $isPlaceholder ? 'placeholder' : 'defaultValue' ] = $first;
				}
				foreach ( array( 'min' => 'minDate', 'max' => 'maxDate' ) as $limit => $setting ) {
					$value = Cf7Parser::option( $tag, $limit );
					if ( is_string( $value ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
						$extra[ $setting ] = $value;
					} elseif ( is_string( $value ) ) {
						$this->notes->skipped(
							sprintf(
								/* translators: 1: limit such as min, 2: value, 3: field label */
								__( 'The date limit %1$s:%2$s of \'%3$s\' was not copied: only fixed dates are supported.', 'subtleforms' ),
								$limit,
								$value,
								$label
							)
						);
					}
				}
				break;

			case 'select':
			case 'checkbox':
			case 'radio':
				return $this->choiceField( $tag, $target, $key, $label, $required );

			case 'acceptance':
				$text = '' !== $tag['content'] ? $tag['content'] : $first;
				if ( '' !== SchemaBuilder::plain( $text ) ) {
					$extra['checkboxLabel'] = SchemaBuilder::cut( SchemaBuilder::plain( $text ), SchemaBuilder::MAX_LABEL );
				}
				if ( preg_match( '#<a\s[^>]*href=["\']([^"\']+)["\']#i', $text, $link ) ) {
					$extra['privacyPolicyUrl'] = $link[1];
				}
				// An acceptance box must be ticked unless it is marked optional.
				$required = ! Cf7Parser::option( $tag, 'optional' );
				break;

			case 'file':
				$limit = Cf7Parser::option( $tag, 'limit' );
				if ( is_string( $limit ) ) {
					$bytes = self::bytes( $limit );
					if ( $bytes > 0 ) {
						$extra['maxSize'] = $bytes;
					}
				}
				$types = Cf7Parser::option( $tag, 'filetypes' );
				if ( is_string( $types ) ) {
					$list = array();
					foreach ( explode( '|', $types ) as $ext ) {
						$ext = strtolower( ltrim( trim( $ext ), '.' ) );
						if ( preg_match( '/^[a-z0-9]+$/', $ext ) ) {
							$list[] = $ext;
						} elseif ( '' !== $ext ) {
							$this->notes->skipped(
								sprintf(
									/* translators: 1: file type such as audio/*, 2: field label */
									__( 'The file type %1$s of \'%2$s\' was not copied: list file extensions instead.', 'subtleforms' ),
									$ext,
									$label
								)
							);
						}
					}
					if ( $list ) {
						$extra['allowedExtensions'] = implode( ', ', $list );
					}
				}
				break;

			case 'hidden':
				return $this->build->field( 'hidden', $key, $label, false, array( 'value' => $this->defaultToken( $tag, $first ) ) );
		}

		$token = $this->defaultToken( $tag, '' );
		if ( '' !== $token ) {
			$extra['defaultValue'] = $token;
		}
		if ( Cf7Parser::option( $tag, 'readonly' ) ) {
			$extra['readOnly'] = true;
		}
		return $this->build->field( $target, $key, $label, $required, $extra );
	}

	/**
	 * A default that comes from the visitor or the URL (`default:user_email`,
	 * `default:get`), as a SubtleForms default token.
	 *
	 * @param array  $tag      Parsed tag.
	 * @param string $fallback Value when there is no such default.
	 * @return string
	 */
	private function defaultToken( array $tag, string $fallback ): string {
		$default = Cf7Parser::option( $tag, 'default' );
		if ( ! is_string( $default ) ) {
			return $fallback;
		}
		$map = array(
			'user_email'        => '{user_email}',
			'user_display_name' => '{user_name}',
			'get'               => '{get:' . $tag['name'] . '}',
		);
		foreach ( $map as $source => $token ) {
			if ( $default === $source || 0 === strpos( $default, $source . ' ' ) ) {
				return $token;
			}
		}
		if ( preg_match( '/^[\d_]+$/', $default ) ) {
			return $fallback;
		}
		$this->notes->skipped(
			sprintf(
				/* translators: 1: option such as default:post, 2: field label */
				__( 'The default %1$s of \'%2$s\' was not copied.', 'subtleforms' ),
				'default:' . $default,
				$this->labelFor( $tag )
			)
		);
		return $fallback;
	}

	/**
	 * Dropdown, checkboxes or radio buttons.
	 *
	 * @param array  $tag      Parsed tag.
	 * @param string $target   SubtleForms type.
	 * @param string $key      Field key.
	 * @param string $label    Label.
	 * @param bool   $required Required.
	 * @return array
	 */
	private function choiceField( array $tag, string $target, string $key, string $label, bool $required ): array {
		$choices = array();
		foreach ( (array) $tag['values'] as $value ) {
			$choices[] = Cf7Parser::pipe( (string) $value );
		}
		$extra = array();
		if ( 'select' === $tag['basetype'] ) {
			if ( Cf7Parser::option( $tag, 'first_as_label' ) && $choices ) {
				$first                = array_shift( $choices );
				$extra['placeholder'] = $first['label'];
			} elseif ( Cf7Parser::option( $tag, 'include_blank' ) ) {
				$extra['placeholder'] = __( 'Please choose an option', 'subtleforms' );
			}
			if ( Cf7Parser::option( $tag, 'multiple' ) ) {
				$target                 = 'multiple_choice';
				$extra['allowMultiple'] = true;
				unset( $extra['placeholder'] );
				$this->notes->changed(
					sprintf(
						/* translators: %s: field label */
						__( '\'%s\' allowed several choices in a list, so it is shown as checkboxes.', 'subtleforms' ),
						$label
					)
				);
			}
		}
		if ( 'checkbox' === $tag['basetype'] && Cf7Parser::option( $tag, 'exclusive' ) ) {
			$target = 'radio';
			$this->notes->changed(
				sprintf(
					/* translators: %s: field label */
					__( '\'%s\' allowed only one ticked box, so it is shown as radio buttons.', 'subtleforms' ),
					$label
				)
			);
		}
		if ( Cf7Parser::option( $tag, 'free_text' ) ) {
			$this->notes->skipped(
				sprintf(
					/* translators: %s: field label */
					__( 'The free text box after the last choice of \'%s\' was not copied.', 'subtleforms' ),
					$label
				)
			);
		}
		$options = SchemaBuilder::options( $choices );
		$extra['options'] = $options;

		$default = Cf7Parser::option( $tag, 'default' );
		$picked  = array();
		if ( is_string( $default ) && preg_match( '/^[\d_]+$/', $default ) ) {
			foreach ( explode( '_', $default ) as $n ) {
				$index = (int) $n - 1;
				if ( isset( $options[ $index ] ) ) {
					$picked[] = $options[ $index ]['value'];
				}
			}
		}
		if ( 'radio' === $tag['basetype'] ) {
			// Contact Form 7 radio buttons always have one ticked: the first
			// unless another is chosen. They cannot be left empty.
			$required = true;
			if ( ! $picked && $options ) {
				$picked[] = $options[0]['value'];
			}
		}
		if ( $picked ) {
			$extra['defaultValue'] = 'multiple_choice' === $target ? implode( ', ', $picked ) : $picked[0];
		}
		return $this->build->field( $target, $key, $label, $required, $extra );
	}

	/**
	 * `1mb`, `500kb` or a number of bytes.
	 *
	 * @param string $limit Limit.
	 * @return int Bytes, 0 when unreadable.
	 */
	public static function bytes( string $limit ): int {
		if ( ! preg_match( '/^(\d+)\s*(kb|mb|gb)?$/i', trim( $limit ), $m ) ) {
			return 0;
		}
		$units = array(
			''   => 1,
			'kb' => 1024,
			'mb' => 1048576,
			'gb' => 1073741824,
		);
		return (int) $m[1] * $units[ strtolower( $m[2] ?? '' ) ];
	}

	/**
	 * `name: value` lines of the Additional Settings tab.
	 *
	 * @param string $text Settings text.
	 * @return array<string, string>
	 */
	public static function settings( string $text ): array {
		$out = array();
		foreach ( preg_split( '/\r\n|\r|\n/', $text ) as $line ) {
			if ( preg_match( '/^\s*([a-zA-Z0-9_]+)\s*:\s*(.*)$/', (string) $line, $m ) ) {
				$out[ strtolower( $m[1] ) ] = trim( $m[2] );
			}
		}
		return $out;
	}

	/**
	 * @param string $value on, true, 1.
	 * @return bool
	 */
	private function truthy( string $value ): bool {
		return in_array( strtolower( trim( $value, " \"'" ) ), array( 'on', 'true', '1', 'yes' ), true );
	}

	/**
	 * Whether the original form sent no mail (skip_mail or demo_mode).
	 *
	 * @param array $settings Additional settings.
	 * @return bool
	 */
	private function mailSwitchedOff( array $settings ): bool {
		foreach ( array( 'skip_mail', 'demo_mode' ) as $name ) {
			if ( $this->truthy( $settings[ $name ] ?? '' ) ) {
				$this->notes->changed(
					sprintf(
						/* translators: %s: setting name */
						__( 'The form had %s on, so its emails were imported switched off.', 'subtleforms' ),
						$name
					)
				);
				return true;
			}
		}
		return false;
	}

	/**
	 * Mail and Mail (2) as email notifications.
	 *
	 * @param array $raw     Raw form.
	 * @param bool  $mailOff The form sent no mail.
	 * @return array
	 */
	private function emails( array $raw, bool $mailOff ): array {
		$actions = array();
		$index   = 1;
		foreach ( array(
			'mail'   => __( 'Mail', 'subtleforms' ),
			'mail_2' => __( 'Mail (2)', 'subtleforms' ),
		) as $slot => $name ) {
			$mail = $raw[ $slot ] ?? null;
			if ( ! is_array( $mail ) ) {
				continue;
			}
			if ( 'mail_2' === $slot && empty( $mail['active'] ) ) {
				continue;
			}
			if ( '' === trim( (string) ( $mail['recipient'] ?? '' ) ) && '' === trim( (string) ( $mail['body'] ?? '' ) ) ) {
				continue;
			}
			$headers = array();
			$sender  = trim( (string) ( $mail['sender'] ?? '' ) );
			if ( '' !== $sender ) {
				$headers['From'] = array( $this->tags( $sender, true ), $sender );
			}
			foreach ( preg_split( '/\r\n|\r|\n/', (string) ( $mail['additional_headers'] ?? '' ) ) as $line ) {
				if ( preg_match( '/^\s*([A-Za-z-]+)\s*:\s*(.+)$/', (string) $line, $m ) ) {
					$headers[ $m[1] ] = array( $this->tags( trim( $m[2] ), true ), trim( $m[2] ) );
				}
			}
			if ( '' !== trim( (string) ( $mail['attachments'] ?? '' ) ) ) {
				$this->notes->skipped(
					sprintf(
						/* translators: %s: email name */
						__( 'The file attachments of the email \'%s\' were not copied.', 'subtleforms' ),
						$name
					)
				);
			}
			$actions[] = SchemaBuilder::email(
				$index,
				array(
					'to'      => $this->tags( (string) ( $mail['recipient'] ?? '' ), false ),
					'subject' => $this->tags( (string) ( $mail['subject'] ?? '' ), false ),
					'message' => $this->tags( (string) ( $mail['body'] ?? '' ), false ),
					'format'  => empty( $mail['use_html'] ) ? 'text' : 'html',
					'replyTo' => SchemaBuilder::replyTo( $headers, $name, $this->notes ),
					'headers' => SchemaBuilder::headers( $headers, $name, $this->notes ),
				),
				! $mailOff
			);
			++$index;
		}
		if ( $actions ) {
			$this->notes->info(
				sprintf(
					/* translators: %d: number of emails */
					_n( '%d email notification was copied.', '%d email notifications were copied.', count( $actions ), 'subtleforms' ),
					count( $actions )
				)
			);
		}
		return $actions;
	}

	/**
	 * Rewrite Contact Form 7 mail-tags (`[your-name]`, `[_site_title]`) as
	 * SubtleForms merge tags. In a header, site facts are written out as text
	 * because headers are sent as typed.
	 *
	 * @param string $text   Text with mail-tags.
	 * @param bool   $header Whether the text is an email header.
	 * @return string
	 */
	public function tags( string $text, bool $header ): string {
		$out = preg_replace_callback(
			'/\[\s*([a-zA-Z_][0-9a-zA-Z:._-]*)(?:\s+[^\]]*)?\s*\]/',
			function ( array $m ) use ( $header ): string {
				$name = $m[1];
				if ( isset( $this->keys[ $name ] ) ) {
					return '{field:' . $this->keys[ $name ] . '}';
				}
				foreach ( array( '_raw_', '_format_' ) as $prefix ) {
					if ( 0 === strpos( $name, $prefix ) && isset( $this->keys[ substr( $name, strlen( $prefix ) ) ] ) ) {
						return '{field:' . $this->keys[ substr( $name, strlen( $prefix ) ) ] . '}';
					}
				}
				switch ( $name ) {
					case '_site_title':
						return $header ? (string) ( $this->context['site_title'] ?? '' ) : '{site_name}';
					case '_site_admin_email':
						return $header ? (string) ( $this->context['admin_email'] ?? '' ) : '{admin_email}';
					case '_site_url':
						return (string) ( $this->context['site_url'] ?? '' );
					case '_date':
						return '{date}';
					case '_time':
						$this->notes->changed( __( 'The mail-tag [_time] was removed: {date} already gives the date and time.', 'subtleforms' ) );
						return '';
					case '_serial_number':
						return '{entry_id}';
				}
				if ( '_' === $name[0] ) {
					$this->notes->skipped(
						sprintf(
							/* translators: %s: mail-tag such as [_remote_ip] */
							__( 'The mail-tag %s has no SubtleForms equivalent and was left as typed.', 'subtleforms' ),
							'[' . $name . ']'
						)
					);
					return $m[0];
				}
				$this->notes->skipped(
					sprintf(
						/* translators: %s: mail-tag such as [your-quiz] */
						__( 'The mail-tag %s points at a field that was not imported and was left as typed.', 'subtleforms' ),
						'[' . $name . ']'
					)
				);
				return $m[0];
			},
			$text
		);
		return is_string( $out ) ? trim( (string) preg_replace( '/[ \t]+\n/', "\n", $out ) ) : $text;
	}
}
