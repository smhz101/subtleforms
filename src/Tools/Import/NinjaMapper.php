<?php
/**
 * Ninja Forms form to SubtleForms schema.
 *
 * Reads the shape both the database and the export file give once they are
 * folded together by NinjaSource: `settings`, `fields` and `actions`, each
 * with its settings flat. Pure: writes nothing.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.8.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map one Ninja Forms form, and turn its entries into answers.
 */
final class NinjaMapper {

	private const SOURCE = 'ninja';

	/** Ninja Forms comparators SubtleForms logic evaluates. */
	private const COMPARATORS = array(
		'equal'       => 'equals',
		'notequal'    => 'not_equals',
		'contains'    => 'contains',
		'notcontains' => 'not_contains',
		'greater'     => 'greater_than',
		'less'        => 'less_than',
	);

	/** @var ImportNotes */
	private $notes;

	/** @var SchemaBuilder */
	private $build;

	/** @var array<string, string> Ninja field key or id => SubtleForms key. */
	private $keys = array();

	/** @var array<string, array> Field id => entry map row. */
	private $entryMap = array();

	/** @var array<string, array> SubtleForms key => logic. */
	private $logicFor = array();

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
	 * @param array $form    Ninja form: id, title, settings, fields, actions.
	 * @param array $context Site facts.
	 * @return array{title: string, schema: array, notes: ImportNotes, entry_map: array}
	 */
	public static function map( array $form, array $context = array() ): array {
		return ( new self( $context ) )->run( self::normalize( $form ) );
	}

	/**
	 * Fields in order, settings decoded.
	 *
	 * @param array $form Form.
	 * @return array
	 */
	public static function normalize( array $form ): array {
		$settings = is_array( $form['settings'] ?? null ) ? $form['settings'] : array();
		if ( '' === trim( (string) ( $form['title'] ?? '' ) ) ) {
			$form['title'] = (string) ( $settings['title'] ?? '' );
		}
		// Export files may keep each field's settings one level down.
		$flat = static function ( $list ): array {
			$out = array();
			foreach ( (array) $list as $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}
				if ( isset( $item['settings'] ) && is_array( $item['settings'] ) ) {
					$item = array_merge( $item, $item['settings'] );
					unset( $item['settings'] );
				}
				$out[] = $item;
			}
			return $out;
		};
		$fields          = $flat( $form['fields'] ?? array() );
		$form['actions'] = $flat( $form['actions'] ?? array() );
		usort(
			$fields,
			static function ( array $a, array $b ): int {
				return (int) ( $a['order'] ?? 0 ) <=> (int) ( $b['order'] ?? 0 );
			}
		);
		$form['settings'] = $settings;
		$form['fields']   = $fields;
		return $form;
	}

	/**
	 * @param array $form Normalised form.
	 * @return array{title: string, schema: array, notes: ImportNotes, entry_map: array}
	 */
	private function run( array $form ): array {
		$title = SchemaBuilder::title( (string) ( $form['title'] ?? '' ) );

		foreach ( $form['fields'] as $field ) {
			$this->reserveKey( $field );
		}
		$this->collectLogic( $form['fields'] );

		$items  = array();
		$submit = '';
		foreach ( $form['fields'] as $field ) {
			$type = strtolower( (string) ( $field['type'] ?? '' ) );
			if ( FieldMap::SUBMIT === FieldMap::target( self::SOURCE, $type ) ) {
				$submit = trim( (string) ( $field['label'] ?? '' ) );
				continue;
			}
			foreach ( $this->field( $field ) as $mapped ) {
				$items[] = $mapped;
			}
		}
		$fields = $this->build->assemble( $items );

		$metadata = array();
		if ( '' !== $submit ) {
			$metadata['submitText'] = SchemaBuilder::cut( $submit, SchemaBuilder::MAX_SUBMIT );
		}
		list( $actions, $confirmation ) = $this->actions( $form['actions'] );
		if ( $confirmation ) {
			$metadata['confirmation'] = $confirmation;
		}
		$limit = (int) ( $form['settings']['sub_limit_number'] ?? 0 );
		if ( $limit > 0 ) {
			$metadata['restrictions']                = array( 'entryLimit' => $limit );
			$message                                 = SchemaBuilder::plain( (string) ( $form['settings']['sub_limit_msg'] ?? '' ) );
			if ( '' !== $message ) {
				$metadata['restrictions']['limitMessage'] = SchemaBuilder::cut( $message, 500 );
			}
		}
		if ( ! empty( $form['settings']['logged_in'] ) && '0' !== (string) $form['settings']['logged_in'] ) {
			$metadata['restrictions']['requireLogin'] = true;
		}
		if ( ! empty( $form['settings']['calculations'] ) ) {
			$this->notes->skipped( __( 'The calculations of this form were not copied.', 'subtleforms' ) );
		}

		$schema = SchemaBuilder::schema( $title, '', $fields, $actions, $metadata );
		return array(
			'title'     => $title,
			'schema'    => $schema,
			'notes'     => $this->notes,
			'entry_map' => $this->entryMap,
		);
	}

	/**
	 * @param array $field Field.
	 */
	private function reserveKey( array $field ): void {
		$type   = strtolower( (string) ( $field['type'] ?? '' ) );
		$target = FieldMap::target( self::SOURCE, $type );
		if ( '' === $target || FieldMap::SUBMIT === $target ) {
			return;
		}
		$id  = (string) ( $field['id'] ?? '' );
		$own = (string) ( $field['key'] ?? '' );
		$key = $this->build->key( $own, self::label( $field ), $id );
		if ( '' !== $own ) {
			$this->keys[ $own ] = $key;
		}
		if ( '' !== $id ) {
			$this->keys[ $id ] = $key;
		}
	}

	/**
	 * @param array $field Field.
	 * @return string
	 */
	public static function label( array $field ): string {
		return SchemaBuilder::plain( (string) ( $field['label'] ?? '' ) );
	}

	/**
	 * Conditional logic (an add-on) sits on the field that is watched and
	 * names the fields it shows or hides. Fold it onto the fields it affects.
	 *
	 * @param array $fields Ninja fields.
	 */
	private function collectLogic( array $fields ): void {
		foreach ( $fields as $field ) {
			$blocks = $field['conditions'] ?? array();
			if ( ! is_array( $blocks ) || ! $blocks ) {
				continue;
			}
			if ( isset( $blocks['when'] ) ) {
				$blocks = array( $blocks );
			}
			foreach ( $blocks as $block ) {
				if ( ! is_array( $block ) || empty( $block['then'] ) ) {
					continue;
				}
				$rules = $this->rules( (array) ( $block['when'] ?? array() ) );
				foreach ( (array) $block['then'] as $then ) {
					$target  = is_array( $then ) ? (string) ( $then['key'] ?? '' ) : '';
					$trigger = is_array( $then ) ? (string) ( $then['trigger'] ?? '' ) : '';
					$name    = $this->keys[ $target ] ?? $target;
					if ( ! in_array( $trigger, array( 'show_field', 'hide_field' ), true ) ) {
						$this->notes->skipped(
							sprintf(
								/* translators: %s: field key */
								__( 'A condition on \'%s\' does something other than show or hide it. It was not copied.', 'subtleforms' ),
								$name
							)
						);
						continue;
					}
					if ( null === $rules || ! $rules || 'any' === ( $block['connector'] ?? 'all' ) && count( $rules ) > 1 ) {
						$this->notes->skipped(
							sprintf(
								/* translators: %s: field key */
								__( 'The conditional logic on \'%s\' uses a comparison, a field or an OR that SubtleForms does not have. It was not copied.', 'subtleforms' ),
								$name
							)
						);
						continue;
					}
					if ( isset( $this->logicFor[ $name ] ) ) {
						$this->notes->skipped(
							sprintf(
								/* translators: %s: field key */
								__( '\'%s\' had more than one condition. Only the first was copied.', 'subtleforms' ),
								$name
							)
						);
						continue;
					}
					$this->logicFor[ $name ] = array(
						'action' => 'hide_field' === $trigger ? 'hide' : 'show',
						'groups' => array(
							array(
								'match' => 'all',
								'rules' => $rules,
							),
						),
					);
				}
			}
		}
	}

	/**
	 * Rules from `when` entries, or null when one cannot be evaluated.
	 *
	 * @param array $when Conditions.
	 * @return array|null
	 */
	private function rules( array $when ): ?array {
		$rules = array();
		foreach ( $when as $cond ) {
			if ( ! is_array( $cond ) ) {
				continue;
			}
			$key = $this->keys[ (string) ( $cond['key'] ?? '' ) ] ?? '';
			$cmp = (string) ( $cond['comparator'] ?? '' );
			$op  = self::COMPARATORS[ $cmp ] ?? '';
			if ( '' === $key || '' === $op || 'field' !== ( $cond['type'] ?? 'field' ) ) {
				return null;
			}
			$rules[] = array(
				'field'    => $key,
				'operator' => $op,
				'value'    => (string) ( $cond['value'] ?? '' ),
			);
		}
		return $rules;
	}

	/**
	 * @param array $field Field.
	 * @return array<int, array>
	 */
	private function field( array $field ): array {
		$type   = strtolower( (string) ( $field['type'] ?? '' ) );
		$label  = self::label( $field );
		$target = FieldMap::target( self::SOURCE, $type );
		if ( '' === $target ) {
			$this->notes->skipped( FieldMap::skippedLine( self::SOURCE, $label, $type ) );
			return array();
		}
		$id       = (string) ( $field['id'] ?? '' );
		$key      = $this->keys[ $id ] ?? $this->build->key( '', $label, $id );
		$required = ! empty( $field['required'] ) && '0' !== (string) $field['required'];
		$extra    = array(
			'placeholder' => SchemaBuilder::plain( (string) ( $field['placeholder'] ?? '' ) ),
			'description' => SchemaBuilder::plain( (string) ( $field['desc_text'] ?? '' ) ),
		);
		$value    = (string) ( $field['default'] ?? $field['default_value'] ?? '' );
		$entry    = array( 'key' => $key, 'type' => $target );

		switch ( $target ) {
			case 'dropdown':
			case 'radio':
			case 'multiple_choice':
				$options = array();
				$ticked  = array();
				foreach ( (array) ( $field['options'] ?? array() ) as $option ) {
					if ( ! is_array( $option ) ) {
						continue;
					}
					$text   = SchemaBuilder::plain( (string) ( $option['label'] ?? '' ) );
					$stored = (string) ( $option['value'] ?? '' );
					$options[] = array(
						'label' => $text,
						'value' => '' !== $stored ? $stored : $text,
					);
					if ( ! empty( $option['selected'] ) ) {
						$ticked[] = '' !== $stored ? $stored : $text;
					}
				}
				$extra['options'] = SchemaBuilder::options( $options );
				$value            = $ticked ? implode( ', ', 'multiple_choice' === $target ? $ticked : array( $ticked[0] ) ) : '';
				if ( 'listmultiselect' === $type ) {
					$extra['allowMultiple'] = true;
					$this->notes->changed(
						sprintf(
							/* translators: %s: field label */
							__( '\'%s\' allowed several choices in a list, so it is shown as checkboxes.', 'subtleforms' ),
							$label
						)
					);
				}
				if ( 'dropdown' !== $target ) {
					unset( $extra['placeholder'] );
				}
				if ( 'liststate' === $type && ! $extra['options'] ) {
					$this->notes->info(
						sprintf(
							/* translators: %s: field label */
							__( '\'%s\' is a list of states without choices. Add the choices in the builder.', 'subtleforms' ),
							$label
						)
					);
				}
				break;

			case 'checkbox':
				$value = 'checked' === (string) ( $field['default_value'] ?? '' ) ? '1' : '';
				unset( $extra['placeholder'] );
				break;

			case 'html':
				$built            = $this->build->field( 'html', $key, $label, false );
				$built['content'] = (string) ( $field['default'] ?? $field['value'] ?? '' );
				return array( $this->withLogic( $built, $key ) );

			case 'section_break':
				$built = $this->build->field( 'section_break', $key, $label, false, array( 'title' => $label ) );
				return array( $this->withLogic( $built, $key ) );

			case 'hidden':
				$this->entryMap[ $id ] = $entry;
				return array( $this->build->field( 'hidden', $key, '' !== $label ? $label : $key, false, array( 'value' => $this->defaultValue( $value, $label ) ) ) );

			case 'number':
				foreach ( array( 'num_min' => 'min', 'num_max' => 'max', 'num_step' => 'step' ) as $from => $to ) {
					if ( isset( $field[ $from ] ) && is_numeric( $field[ $from ] ) ) {
						$extra[ $to ] = $field[ $from ] + 0;
					}
				}
				break;

			case 'text':
			case 'textarea':
				if ( (int) ( $field['input_limit'] ?? 0 ) > 0 ) {
					if ( 'characters' === (string) ( $field['input_limit_type'] ?? 'characters' ) ) {
						$extra['maxLength'] = (int) $field['input_limit'];
					} else {
						$this->notes->skipped(
							sprintf(
								/* translators: %s: field label */
								__( 'The word limit of \'%s\' was not copied.', 'subtleforms' ),
								$label
							)
						);
					}
				}
				if ( ! empty( $field['mask'] ) ) {
					$this->notes->skipped(
						sprintf(
							/* translators: %s: field label */
							__( 'The input mask of \'%s\' was not copied.', 'subtleforms' ),
							$label
						)
					);
				}
				if ( ! empty( $field['textarea_rte'] ) ) {
					$this->notes->changed(
						sprintf(
							/* translators: %s: field label */
							__( '\'%s\' used a rich text editor. It is now a plain paragraph box.', 'subtleforms' ),
							$label
						)
					);
				}
				break;

			case 'date':
				if ( 'date_and_time' === (string) ( $field['date_mode'] ?? '' ) ) {
					$target = 'datetime';
				}
				$entry = array(
					'key'         => $key,
					'type'        => $target,
					'date_format' => (string) ( $field['date_format'] ?? 'MM/DD/YYYY' ),
				);
				$value = '';
				break;

			case 'rating':
				if ( (int) ( $field['number_of_stars'] ?? 0 ) > 0 ) {
					$extra['max'] = min( 10, (int) $field['number_of_stars'] );
				}
				$value = '';
				break;

			case 'file_upload':
				$types = array();
				foreach ( preg_split( '/[\s,|]+/', (string) ( $field['upload_types'] ?? '' ) ) as $ext ) {
					$ext = strtolower( trim( $ext, " .\t" ) );
					if ( preg_match( '/^[a-z0-9]+$/', $ext ) ) {
						$types[] = $ext;
					}
				}
				if ( $types ) {
					$extra['allowedExtensions'] = implode( ', ', array_values( array_unique( $types ) ) );
				}
				if ( is_numeric( $field['max_file_size'] ?? null ) && $field['max_file_size'] > 0 ) {
					$extra['maxSize'] = (int) ( $field['max_file_size'] * 1048576 );
				}
				$value = '';
				break;

			case 'country':
				$value = '';
				break;
		}

		if ( '' !== $value ) {
			$extra['defaultValue'] = $this->defaultValue( $value, $label );
		}
		$this->entryMap[ $id ] = $entry;
		return array( $this->withLogic( $this->build->field( $target, $key, $label, $required, $extra ), $key ) );
	}

	/**
	 * @param array  $built Field.
	 * @param string $key   Key.
	 * @return array
	 */
	private function withLogic( array $built, string $key ): array {
		if ( isset( $this->logicFor[ $key ] ) ) {
			$built['logic'] = $this->logicFor[ $key ];
		}
		return $built;
	}

	/**
	 * @param string $value Default value.
	 * @param string $label Label.
	 * @return string
	 */
	private function defaultValue( string $value, string $label ): string {
		if ( false === strpos( $value, '{' ) ) {
			return $value;
		}
		$value = strtr(
			$value,
			array(
				'{wp:user_email}'        => '{user_email}',
				'{wp:user_display_name}' => '{user_name}',
			)
		);
		if ( preg_match( '/\{(?!user_email\}|user_name\})[^{}]+\}/', $value ) ) {
			$this->notes->skipped(
				sprintf(
					/* translators: 1: default value, 2: field label */
					__( 'The default value %1$s of \'%2$s\' was not copied.', 'subtleforms' ),
					$value,
					$label
				)
			);
			return '';
		}
		return $value;
	}

	/**
	 * Emails, and the confirmation from the success message or redirect.
	 *
	 * @param array $list Actions.
	 * @return array{0: array, 1: array}
	 */
	private function actions( array $list ): array {
		$emails       = array();
		$confirmation = array();
		$index        = 1;
		foreach ( $list as $action ) {
			$type    = strtolower( (string) ( $action['type'] ?? '' ) );
			$name    = SchemaBuilder::plain( (string) ( $action['label'] ?? $action['title'] ?? '' ) );
			$enabled = ! isset( $action['active'] ) || ( '' !== (string) $action['active'] && '0' !== (string) $action['active'] );
			if ( 'save' === $type ) {
				continue;
			}
			if ( 'successmessage' === $type ) {
				if ( $enabled && ! $confirmation ) {
					$message = trim( $this->tags( (string) ( $action['success_msg'] ?? $action['success_message'] ?? '' ), false ) );
					if ( '' !== $message ) {
						$confirmation = array(
							'type'    => 'message',
							'message' => SchemaBuilder::cut( $message, SchemaBuilder::MAX_MESSAGE ),
						);
					}
				}
				continue;
			}
			if ( 'redirect' === $type ) {
				$url = trim( $this->tags( (string) ( $action['redirect_url'] ?? '' ), false ) );
				if ( $enabled && '' !== $url ) {
					// A redirect wins over the message: it is what visitors saw.
					$confirmation = array(
						'type'        => 'redirect',
						'redirectUrl' => $url,
					);
				}
				continue;
			}
			if ( 'email' !== $type ) {
				$this->notes->skipped(
					sprintf(
						/* translators: 1: action name, 2: action type */
						__( 'The action \'%1$s\' (type %2$s) was not copied.', 'subtleforms' ),
						'' !== $name ? $name : $type,
						'' !== $type ? $type : '?'
					)
				);
				continue;
			}
			$name = '' !== $name ? $name : sprintf( /* translators: %d: number */ __( 'Notification %d', 'subtleforms' ), $index );
			$out  = array(
				'to'      => $this->tags( (string) ( $action['to'] ?? '' ), false ),
				'subject' => $this->tags( (string) ( $action['email_subject'] ?? $action['subject'] ?? '' ), false ),
				'message' => $this->tags( (string) ( $action['email_message'] ?? $action['message'] ?? '' ), false ),
				'format'  => 'plain' === (string) ( $action['email_format'] ?? 'html' ) ? 'text' : 'html',
			);
			$conditions = $action['conditions'] ?? array();
			if ( is_array( $conditions ) && ! empty( $conditions['when'] ) && ! empty( $conditions['process'] ) ) {
				$rules = $this->rules( (array) $conditions['when'] );
				if ( $rules && ( 'any' !== ( $conditions['connector'] ?? 'all' ) || 1 === count( $rules ) ) ) {
					$out['logic'] = array(
						'action' => 'show',
						'groups' => array( array( 'match' => 'all', 'rules' => $rules ) ),
					);
				} else {
					$enabled = false;
					$this->notes->changed(
						sprintf(
							/* translators: %s: notification name */
							__( 'The email \'%s\' had conditions that could not be copied, so it was imported switched off.', 'subtleforms' ),
							$name
						)
					);
				}
			}
			$headers  = array();
			$from     = trim( $this->tags( (string) ( $action['from_address'] ?? '' ), true ) );
			$fromName = trim( $this->tags( (string) ( $action['from_name'] ?? '' ), true ) );
			if ( '' !== $from ) {
				$headers['From'] = '' !== $fromName ? $fromName . ' <' . $from . '>' : $from;
			}
			foreach ( array( 'reply_to' => 'Reply-To', 'cc' => 'Cc', 'bcc' => 'Bcc' ) as $from_key => $header ) {
				$raw   = trim( (string) ( $action[ $from_key ] ?? '' ) );
				$value = trim( $this->tags( $raw, true ) );
				if ( '' !== $value ) {
					$headers[ $header ] = array( $this->tags( $raw, false ), $raw );
				}
			}
			$out['replyTo'] = SchemaBuilder::replyTo( $headers, $name, $this->notes );
			$out['headers'] = SchemaBuilder::headers( $headers, $name, $this->notes );
			if ( ! empty( $action['attach_csv'] ) && '0' !== (string) $action['attach_csv'] ) {
				$this->notes->skipped(
					sprintf(
						/* translators: %s: notification name */
						__( 'The file attachments of the email \'%s\' were not copied.', 'subtleforms' ),
						$name
					)
				);
			}
			$emails[] = SchemaBuilder::email( $index, $out, $enabled );
			++$index;
		}
		if ( $emails ) {
			$this->notes->info(
				sprintf(
					/* translators: %d: number of emails */
					_n( '%d email notification was copied.', '%d email notifications were copied.', count( $emails ), 'subtleforms' ),
					count( $emails )
				)
			);
		}
		return array( $emails, $confirmation );
	}

	/**
	 * Ninja Forms merge tags as SubtleForms merge tags.
	 *
	 * @param string $text   Text.
	 * @param bool   $header Whether the text is an email header.
	 * @return string
	 */
	public function tags( string $text, bool $header ): string {
		$out = preg_replace_callback(
			'/\{([a-z_]+):([^{}]+)\}|\{(fields_table|all_fields_table|all_fields)\}/i',
			function ( array $m ) use ( $header ): string {
				if ( isset( $m[3] ) && '' !== $m[3] ) {
					return '{all_fields}';
				}
				$group = strtolower( $m[1] );
				$name  = trim( $m[2] );
				if ( 'field' === $group ) {
					$base = explode( ':', $name )[0];
					if ( 'all_fields' === $base ) {
						return '{all_fields}';
					}
					$key = $this->keys[ $base ] ?? '';
					if ( '' === $key ) {
						$this->notes->skipped(
							sprintf(
								/* translators: %s: merge tag */
								__( 'The merge tag %s points at a field that was not imported and was left as typed.', 'subtleforms' ),
								$m[0]
							)
						);
						return $m[0];
					}
					return '{field:' . $key . '}';
				}
				$pair = $group . ':' . strtolower( $name );
				switch ( $pair ) {
					case 'wp:admin_email':
					case 'system:admin_email':
						return $header ? (string) ( $this->context['admin_email'] ?? '' ) : '{admin_email}';
					case 'wp:site_title':
					case 'system:site_title':
						return $header ? (string) ( $this->context['site_title'] ?? '' ) : '{site_name}';
					case 'wp:site_url':
					case 'system:site_url':
						return (string) ( $this->context['site_url'] ?? '' );
					case 'system:date':
						return '{date}';
					case 'wp:user_email':
						return '{user_email}';
					case 'wp:user_display_name':
						return '{user_name}';
					case 'submission:sequence':
					case 'submission:count':
					case 'submission:id':
						return '{entry_id}';
					case 'form:title':
						return '{form_title}';
				}
				$this->notes->skipped(
					sprintf(
						/* translators: %s: merge tag such as {post:id} */
						__( 'The merge tag %s has no SubtleForms equivalent and was left as typed.', 'subtleforms' ),
						$m[0]
					)
				);
				return $m[0];
			},
			$text
		);
		return is_string( $out ) ? SchemaBuilder::collapseTags( $out ) : $text;
	}

	/**
	 * Turn one stored Ninja Forms entry into answers keyed by SubtleForms key.
	 *
	 * @param array $entryMap `entry_map` from map().
	 * @param array $values   Field id => stored value (arrays already unserialized).
	 * @param int   $files    Number of file links, by reference.
	 * @return array<string, mixed>
	 */
	public static function payload( array $entryMap, array $values, int &$files = 0 ): array {
		$payload = array();
		foreach ( $entryMap as $id => $spec ) {
			if ( ! array_key_exists( $id, $values ) && ! array_key_exists( (string) $id, $values ) ) {
				continue;
			}
			$raw  = $values[ $id ] ?? $values[ (string) $id ];
			$type = (string) $spec['type'];
			if ( 'multiple_choice' === $type ) {
				$list = is_array( $raw ) ? $raw : ( '' === trim( (string) $raw ) ? array() : array( (string) $raw ) );
				$list = array_values( array_filter( array_map( 'strval', $list ), 'strlen' ) );
				if ( $list ) {
					$payload[ $spec['key'] ] = $list;
				}
				continue;
			}
			if ( is_array( $raw ) ) {
				$raw = implode( ', ', array_map( 'strval', array_filter( $raw, 'is_scalar' ) ) );
			}
			$text = trim( (string) $raw );
			if ( '' === $text ) {
				continue;
			}
			switch ( $type ) {
				case 'checkbox':
					$payload[ $spec['key'] ] = '1' === $text || 'checked' === $text;
					break;
				case 'date':
				case 'datetime':
					$payload[ $spec['key'] ] = self::dateValue( $text, (string) ( $spec['date_format'] ?? '' ), 'datetime' === $type );
					break;
				case 'file_upload':
					$urls = array_filter( array_map( 'trim', preg_split( '/[\s,]+/', $text ) ), static function ( $u ) {
						return preg_match( '#^https?://#i', $u );
					} );
					if ( $urls ) {
						$files += count( $urls );
						$payload[ $spec['key'] ] = implode( "\n", $urls );
					}
					break;
				default:
					$payload[ $spec['key'] ] = $text;
			}
		}
		return $payload;
	}

	/**
	 * A date written in a Ninja Forms (moment style) format as Y-m-d.
	 *
	 * @param string $text     Stored text.
	 * @param string $format   Format such as DD/MM/YYYY.
	 * @param bool   $withTime Keep the time.
	 * @return string
	 */
	private static function dateValue( string $text, string $format, bool $withTime ): string {
		$php = strtr(
			$format,
			array(
				'YYYY' => 'Y',
				'YY'   => 'y',
				'MMMM' => 'F',
				'MMM'  => 'M',
				'MM'   => 'm',
				'DD'   => 'd',
				'dddd' => 'l',
			)
		);
		$parsed = '' !== $format ? \DateTime::createFromFormat( '!' . $php, $text ) : false;
		if ( ! $parsed ) {
			$stamp  = strtotime( $text );
			$parsed = false !== $stamp ? new \DateTime( '@' . $stamp ) : false;
		}
		if ( ! $parsed ) {
			return $text;
		}
		return $parsed->format( $withTime ? 'Y-m-d H:i' : 'Y-m-d' );
	}
}
