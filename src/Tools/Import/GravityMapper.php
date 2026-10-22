<?php
/**
 * Gravity Forms form to SubtleForms schema.
 *
 * Reads the same shape whether it came from the database (display_meta with
 * notifications and confirmations added) or from a Gravity Forms export file.
 * Pure: writes nothing.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map one Gravity Forms form.
 */
final class GravityMapper {

	private const SOURCE = 'gravity';

	/** Gravity condition operators that SubtleForms logic has. */
	private const OPERATORS = array(
		'is'          => 'equals',
		'isnot'       => 'not_equals',
		'>'           => 'greater_than',
		'<'           => 'less_than',
		'contains'    => 'contains',
		'starts_with' => 'starts_with',
		'ends_with'   => 'ends_with',
	);

	/** Name inputs: Gravity input suffix => SubtleForms part. */
	private const NAME_PARTS = array(
		'3' => 'first_name',
		'4' => 'middle_name',
		'6' => 'last_name',
		'8' => 'suffix',
	);

	/** Address inputs: Gravity input suffix => SubtleForms part. */
	private const ADDRESS_PARTS = array(
		'1' => 'street',
		'2' => 'street2',
		'3' => 'city',
		'4' => 'state',
		'5' => 'postal',
		'6' => 'country',
	);

	/** @var ImportNotes */
	private $notes;

	/** @var SchemaBuilder */
	private $build;

	/** @var array<string, string> Gravity field id => SubtleForms key. */
	private $keys = array();

	/** @var array<string, string> Gravity field id => label. */
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
	 * @param array $form    Gravity form (display_meta plus notifications and confirmations).
	 * @param array $context Site facts.
	 * @return array{title: string, schema: array, notes: ImportNotes}
	 */
	public static function map( array $form, array $context = array() ): array {
		return ( new self( $context ) )->run( $form );
	}

	/**
	 * @param array $form Gravity form.
	 * @return array{title: string, schema: array, notes: ImportNotes}
	 */
	private function run( array $form ): array {
		$title     = SchemaBuilder::title( (string) ( $form['title'] ?? '' ) );
		$rawFields = array_values( array_filter( (array) ( $form['fields'] ?? array() ), 'is_array' ) );

		foreach ( $rawFields as $field ) {
			$id                  = (string) ( $field['id'] ?? '' );
			$type                = $this->type( $field );
			$this->labels[ $id ] = self::label( $field );
			if ( '' !== FieldMap::target( self::SOURCE, $type ) && FieldMap::STEP !== FieldMap::target( self::SOURCE, $type ) ) {
				$this->keys[ $id ] = $this->build->key( (string) ( $field['inputName'] ?? '' ), $this->labels[ $id ], $id );
			}
		}

		$items = array();
		foreach ( $rawFields as $field ) {
			$mapped = $this->field( $field );
			if ( $mapped ) {
				$items[] = $mapped;
			}
		}
		$pages  = (array) ( $form['pagination']['pages'] ?? array() );
		$fields = $this->build->assemble( $items, array_map( 'strval', $pages ) );

		$metadata = array();
		$button   = trim( (string) ( $form['button']['text'] ?? '' ) );
		if ( '' !== $button ) {
			$metadata['submitText'] = SchemaBuilder::cut( $button, SchemaBuilder::MAX_SUBMIT );
		}
		$confirmation = $this->confirmation( (array) ( $form['confirmations'] ?? array() ) );
		if ( $confirmation ) {
			$metadata['confirmation'] = $confirmation;
		}
		$restrictions = $this->restrictions( $form );
		if ( $restrictions ) {
			$metadata['restrictions'] = $restrictions;
		}
		if ( ! empty( $form['save']['enabled'] ) ) {
			$this->notes->skipped( __( 'Save and continue later was not copied.', 'subtleforms' ) );
		}
		if ( ! empty( $form['scheduleForm'] ) ) {
			$this->notes->skipped( __( 'The form schedule was not copied. Set opening and closing times in the form settings.', 'subtleforms' ) );
		}

		$actions = $this->emails( (array) ( $form['notifications'] ?? array() ) );
		$schema  = SchemaBuilder::schema( $title, (string) ( $form['description'] ?? '' ), $fields, $actions, $metadata );
		return array(
			'title'  => $title,
			'schema' => $schema,
			'notes'  => $this->notes,
		);
	}

	/**
	 * Field type, with fields shown to admins only or hidden treated as hidden.
	 *
	 * @param array $field Gravity field.
	 * @return string
	 */
	private function type( array $field ): string {
		return strtolower( (string) ( $field['type'] ?? '' ) );
	}

	/**
	 * The label a Gravity field keeps: its label, else its admin label.
	 *
	 * @param array $field Gravity field.
	 * @return string
	 */
	public static function label( array $field ): string {
		foreach ( array( 'label', 'adminLabel' ) as $name ) {
			$value = SchemaBuilder::plain( (string) ( $field[ $name ] ?? '' ) );
			if ( '' !== $value ) {
				return $value;
			}
		}
		return '';
	}

	/**
	 * One Gravity field, or a step marker for a page break.
	 *
	 * @param array $field Gravity field.
	 * @return array|null
	 */
	private function field( array $field ): ?array {
		$id       = (string) ( $field['id'] ?? '' );
		$type     = $this->type( $field );
		$label    = $this->labels[ $id ] ?? self::label( $field );
		$target   = FieldMap::target( self::SOURCE, $type );
		$required = ! empty( $field['isRequired'] );

		if ( '' === $target ) {
			$this->notes->skipped( FieldMap::skippedLine( self::SOURCE, $label, $type ) );
			return null;
		}
		if ( FieldMap::STEP === $target ) {
			return SchemaBuilder::stepMarker( '', $this->logic( $field, $label ) );
		}
		$key = $this->keys[ $id ];

		$visibility = strtolower( (string) ( $field['visibility'] ?? 'visible' ) );
		if ( in_array( $visibility, array( 'hidden', 'administrative' ), true ) && 'hidden' !== $target ) {
			$this->notes->changed(
				sprintf(
					/* translators: %s: field label */
					__( '\'%s\' was not shown to visitors, so it was imported as a Hidden field.', 'subtleforms' ),
					$label
				)
			);
			return $this->build->field( 'hidden', $key, $label, false, array( 'value' => $this->defaultValue( $field, $label ) ) );
		}

		$extra = array(
			'placeholder' => SchemaBuilder::plain( (string) ( $field['placeholder'] ?? '' ) ),
			'description' => SchemaBuilder::plain( (string) ( $field['description'] ?? '' ) ),
		);

		switch ( $target ) {
			case 'dropdown':
			case 'radio':
			case 'multiple_choice':
				$extra['options'] = self::choices( $field );
				$picked           = array();
				foreach ( (array) ( $field['choices'] ?? array() ) as $choice ) {
					if ( is_array( $choice ) && ! empty( $choice['isSelected'] ) ) {
						$picked[] = (string) ( $choice['value'] ?? $choice['text'] ?? '' );
					}
				}
				if ( $picked ) {
					$extra['defaultValue'] = 'multiple_choice' === $target ? implode( ', ', $picked ) : $picked[0];
				}
				if ( 'multiselect' === $type ) {
					$extra['allowMultiple'] = true;
					$this->notes->changed(
						sprintf(
							/* translators: %s: field label */
							__( '\'%s\' allowed several choices in a list, so it is shown as checkboxes.', 'subtleforms' ),
							$label
						)
					);
				}
				if ( ! empty( $field['enableOtherChoice'] ) ) {
					$this->notes->skipped(
						sprintf(
							/* translators: %s: field label */
							__( 'The "Other" choice of \'%s\' was not copied.', 'subtleforms' ),
							$label
						)
					);
				}
				break;

			case 'name_group':
			case 'address_group':
				if ( 'name_group' === $target && 'simple' === ( $field['nameFormat'] ?? '' ) ) {
					// A one-box name is a text field.
					$target = 'text';
					break;
				}
				$extra['fields'] = $this->parts( $field, $target, $label );
				unset( $extra['placeholder'] );
				break;

			case 'html':
				$built            = $this->build->field( 'html', $key, $label, false );
				$built['content'] = (string) ( $field['content'] ?? '' );
				return $this->withLogic( $built, $field, $label );

			case 'section_break':
				$built = $this->build->field( 'section_break', $key, $label, false, array( 'title' => $label, 'description' => $extra['description'] ) );
				if ( ! empty( $field['conditionalLogic']['enabled'] ) ) {
					$this->notes->changed(
						sprintf(
							/* translators: %s: section label */
							__( 'The conditions on section \'%s\' now show or hide only its heading. Add them to the fields in it if needed.', 'subtleforms' ),
							$label
						)
					);
				}
				return $this->withLogic( $built, $field, $label );

			case 'consent':
				$text = SchemaBuilder::plain( (string) ( $field['checkboxLabel'] ?? '' ) );
				if ( '' === $text && isset( $field['inputs'][0]['label'] ) ) {
					$text = SchemaBuilder::plain( (string) $field['inputs'][0]['label'] );
				}
				$extra['checkboxLabel'] = $text;
				break;

			case 'hidden':
				return $this->withLogic( $this->build->field( 'hidden', $key, $label, false, array( 'value' => $this->defaultValue( $field, $label ) ) ), $field, $label );

			case 'number':
				foreach ( array( 'rangeMin' => 'min', 'rangeMax' => 'max' ) as $from => $to ) {
					if ( isset( $field[ $from ] ) && is_numeric( $field[ $from ] ) ) {
						$extra[ $to ] = $field[ $from ] + 0;
					}
				}
				if ( in_array( (string) ( $field['numberFormat'] ?? '' ), array( 'currency' ), true ) ) {
					$this->notes->changed(
						sprintf(
							/* translators: %s: field label */
							__( '\'%s\' was a currency number and is now a plain number.', 'subtleforms' ),
							$label
						)
					);
				}
				break;

			case 'text':
			case 'textarea':
				if ( isset( $field['maxLength'] ) && (int) $field['maxLength'] > 0 ) {
					$extra['maxLength'] = (int) $field['maxLength'];
				}
				if ( 'text' === $target && ! empty( $field['enablePasswordInput'] ) ) {
					$target = 'password';
				}
				break;

			case 'email':
				if ( ! empty( $field['emailConfirmEnabled'] ) ) {
					$this->notes->skipped(
						sprintf(
							/* translators: %s: field label */
							__( 'The "confirm email" box of \'%s\' was not copied.', 'subtleforms' ),
							$label
						)
					);
				}
				break;

			case 'file_upload':
				$types = array();
				foreach ( preg_split( '/[\s,]+/', (string) ( $field['allowedExtensions'] ?? '' ) ) as $ext ) {
					$ext = strtolower( ltrim( trim( (string) $ext ), '.' ) );
					if ( preg_match( '/^[a-z0-9]+$/', $ext ) ) {
						$types[] = $ext;
					}
				}
				if ( $types ) {
					$extra['allowedExtensions'] = implode( ', ', $types );
				}
				if ( isset( $field['maxFileSize'] ) && (float) $field['maxFileSize'] > 0 ) {
					$extra['maxSize'] = (int) round( (float) $field['maxFileSize'] * 1048576 );
				}
				if ( ! empty( $field['multipleFiles'] ) ) {
					$extra['multiple'] = true;
					if ( isset( $field['maxFiles'] ) && (int) $field['maxFiles'] > 0 ) {
						$extra['maxFiles'] = min( 20, (int) $field['maxFiles'] );
					}
				}
				break;
		}

		if ( ! isset( $extra['defaultValue'] ) && ! in_array( $target, array( 'name_group', 'address_group', 'consent', 'file_upload' ), true ) ) {
			$extra['defaultValue'] = $this->defaultValue( $field, $label );
		}
		return $this->withLogic( $this->build->field( $target, $key, $label, $required, $extra ), $field, $label );
	}

	/**
	 * A default value, with the Gravity tags SubtleForms has turned into its
	 * own tokens. Other tags are dropped and reported.
	 *
	 * @param array  $field Gravity field.
	 * @param string $label Label.
	 * @return string
	 */
	private function defaultValue( array $field, string $label ): string {
		$value = (string) ( $field['defaultValue'] ?? '' );
		if ( '' === $value || false === strpos( $value, '{' ) ) {
			return $value;
		}
		$map = array(
			'{user:user_email}'   => '{user_email}',
			'{user:display_name}' => '{user_name}',
			'{date_mdy}'          => '{date}',
			'{date_dmy}'          => '{date}',
		);
		$value = strtr( $value, $map );
		if ( preg_match( '/\{(?!user_email\}|user_name\}|date\})[^{}]+\}/', $value ) ) {
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
	 * Choices with their values.
	 *
	 * @param array $field Gravity field.
	 * @return array<int, array{label: string, value: string}>
	 */
	public static function choices( array $field ): array {
		$choices = array();
		foreach ( (array) ( $field['choices'] ?? array() ) as $choice ) {
			if ( is_array( $choice ) ) {
				$choices[] = array(
					'label' => (string) ( $choice['text'] ?? $choice['label'] ?? '' ),
					'value' => (string) ( $choice['value'] ?? $choice['text'] ?? '' ),
				);
			}
		}
		return SchemaBuilder::options( $choices );
	}

	/**
	 * Name or Address parts: which are shown, their labels and placeholders.
	 *
	 * @param array  $field  Gravity field.
	 * @param string $target name_group or address_group.
	 * @param string $label  Label.
	 * @return array<string, array>
	 */
	private function parts( array $field, string $target, string $label ): array {
		$map   = 'name_group' === $target ? self::NAME_PARTS : self::ADDRESS_PARTS;
		$parts = array();
		foreach ( $map as $part ) {
			$parts[ $part ] = array( 'enabled' => false );
		}
		$seen = false;
		foreach ( (array) ( $field['inputs'] ?? array() ) as $input ) {
			if ( ! is_array( $input ) ) {
				continue;
			}
			$suffix = (string) substr( strrchr( '.' . (string) ( $input['id'] ?? '' ), '.' ), 1 );
			$hidden = ! empty( $input['isHidden'] );
			if ( 'name_group' === $target && '2' === $suffix && ! $hidden ) {
				$this->notes->skipped(
					sprintf(
						/* translators: %s: field label */
						__( 'The Prefix part of \'%s\' was not copied.', 'subtleforms' ),
						$label
					)
				);
				continue;
			}
			if ( ! isset( $map[ $suffix ] ) ) {
				continue;
			}
			$seen = true;
			$part = array( 'enabled' => ! $hidden );
			$text = SchemaBuilder::plain( (string) ( $input['customLabel'] ?? $input['label'] ?? '' ) );
			if ( '' !== $text ) {
				$part['label'] = $text;
			}
			$placeholder = SchemaBuilder::plain( (string) ( $input['placeholder'] ?? '' ) );
			if ( '' !== $placeholder ) {
				$part['placeholder'] = $placeholder;
			}
			$parts[ $map[ $suffix ] ] = $part;
		}
		if ( ! $seen ) {
			// No inputs listed: the parts Gravity shows by default.
			$defaults = 'name_group' === $target ? array( 'first_name', 'last_name' ) : array( 'street', 'street2', 'city', 'state', 'postal', 'country' );
			foreach ( $defaults as $part ) {
				$parts[ $part ]['enabled'] = true;
			}
		}
		return $parts;
	}

	/**
	 * Add Gravity conditional logic to a field.
	 *
	 * @param array  $built Mapped field.
	 * @param array  $field Gravity field.
	 * @param string $label Label.
	 * @return array
	 */
	private function withLogic( array $built, array $field, string $label ): array {
		$logic = $this->logic( $field, $label );
		if ( $logic ) {
			$built['logic'] = $logic;
		}
		return $built;
	}

	/**
	 * Gravity conditional logic as a SubtleForms logic object. Rules that do
	 * not map are reported; when none map, there is no logic.
	 *
	 * @param array  $owner Field, page or notification with `conditionalLogic`.
	 * @param string $label What the logic belongs to, for the report.
	 * @return array
	 */
	private function logic( array $owner, string $label ): array {
		$logic = $owner['conditionalLogic'] ?? null;
		if ( ! is_array( $logic ) || ( isset( $logic['enabled'] ) && ! $logic['enabled'] ) || empty( $logic['rules'] ) ) {
			return array();
		}
		$rules   = array();
		$skipped = 0;
		foreach ( (array) $logic['rules'] as $rule ) {
			if ( ! is_array( $rule ) ) {
				continue;
			}
			$fieldId = (string) ( $rule['fieldId'] ?? '' );
			$base    = strtok( $fieldId, '.' );
			$key     = $this->keys[ (string) $base ] ?? '';
			$op      = self::OPERATORS[ strtolower( (string) ( $rule['operator'] ?? 'is' ) ) ] ?? '';
			if ( '' === $key || '' === $op || $fieldId !== (string) $base ) {
				++$skipped;
				continue;
			}
			$rules[] = array(
				'field'    => $key,
				'operator' => $op,
				'value'    => (string) ( $rule['value'] ?? '' ),
			);
		}
		if ( $skipped ) {
			$this->notes->skipped(
				sprintf(
					/* translators: %s: field label */
					__( 'Some conditions on \'%s\' were not copied: they use a part of a field, a field that was not imported, or a comparison SubtleForms does not have.', 'subtleforms' ),
					'' !== $label ? $label : __( 'a field', 'subtleforms' )
				)
			);
		}
		if ( ! $rules ) {
			return array();
		}
		return array(
			'action' => 'hide' === strtolower( (string) ( $logic['actionType'] ?? 'show' ) ) ? 'hide' : 'show',
			'groups' => array(
				array(
					'match' => 'any' === strtolower( (string) ( $logic['logicType'] ?? 'all' ) ) ? 'any' : 'all',
					'rules' => $rules,
				),
			),
		);
	}

	/**
	 * Login and entry limits.
	 *
	 * @param array $form Gravity form.
	 * @return array
	 */
	private function restrictions( array $form ): array {
		$out = array();
		if ( ! empty( $form['requireLogin'] ) ) {
			$out['requireLogin'] = true;
			$message             = SchemaBuilder::plain( (string) ( $form['requireLoginMessage'] ?? '' ) );
			if ( '' !== $message ) {
				$out['loginMessage'] = SchemaBuilder::cut( $message, 500 );
			}
		}
		if ( ! empty( $form['limitEntries'] ) && (int) ( $form['limitEntriesCount'] ?? 0 ) > 0 ) {
			$period = (string) ( $form['limitEntriesPeriod'] ?? '' );
			if ( '' === $period ) {
				$out['entryLimit'] = (int) $form['limitEntriesCount'];
				$message           = SchemaBuilder::plain( (string) ( $form['limitEntriesMessage'] ?? '' ) );
				if ( '' !== $message ) {
					$out['limitMessage'] = SchemaBuilder::cut( $message, 500 );
				}
			} else {
				$this->notes->skipped( __( 'The entry limit per day, week, month or year was not copied.', 'subtleforms' ) );
			}
		}
		return $out;
	}

	/**
	 * The default confirmation. Others, chosen by conditions, are reported.
	 *
	 * @param array $confirmations Gravity confirmations keyed by id.
	 * @return array
	 */
	private function confirmation( array $confirmations ): array {
		$chosen = null;
		$others = 0;
		foreach ( $confirmations as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			if ( ! empty( $item['isDefault'] ) ) {
				if ( null !== $chosen ) {
					++$others;
				}
				$chosen = $item;
			} elseif ( null === $chosen ) {
				$chosen = $item;
			} else {
				++$others;
			}
		}
		if ( ! $chosen ) {
			return array();
		}
		if ( $others > 0 ) {
			$this->notes->skipped(
				sprintf(
					/* translators: %d: number of confirmations */
					_n( '%d conditional confirmation was not copied; the default one was.', '%d conditional confirmations were not copied; the default one was.', $others, 'subtleforms' ),
					$others
				)
			);
		}
		$type = (string) ( $chosen['type'] ?? 'message' );
		if ( 'page' === $type ) {
			$pageId = (int) ( $chosen['pageId'] ?? $chosen['page_id'] ?? 0 );
			if ( $pageId > 0 ) {
				$query = ltrim( $this->tags( (string) ( $chosen['queryString'] ?? '' ), false ), '?&' );
				return array(
					'type'        => 'redirect',
					'redirectUrl' => '/?page_id=' . $pageId . ( '' !== $query ? '&' . $query : '' ),
				);
			}
			$this->notes->changed( __( 'The page confirmation had no page, so the message is used instead.', 'subtleforms' ) );
		}
		if ( 'redirect' === $type ) {
			$url = trim( $this->tags( (string) ( $chosen['url'] ?? '' ), false ) );
			if ( '' !== $url ) {
				$query = ltrim( $this->tags( (string) ( $chosen['queryString'] ?? '' ), false ), '?&' );
				return array(
					'type'        => 'redirect',
					'redirectUrl' => $url . ( '' !== $query ? ( false === strpos( $url, '?' ) ? '?' : '&' ) . $query : '' ),
				);
			}
			$this->notes->changed( __( 'The redirect confirmation had no address, so the default message is used.', 'subtleforms' ) );
			return array();
		}
		$message = trim( $this->tags( (string) ( $chosen['message'] ?? '' ), false ) );
		if ( '' === $message ) {
			return array();
		}
		return array(
			'type'    => 'message',
			'message' => SchemaBuilder::cut( $message, SchemaBuilder::MAX_MESSAGE ),
		);
	}

	/**
	 * Notifications as email actions.
	 *
	 * @param array $notifications Gravity notifications keyed by id.
	 * @return array
	 */
	private function emails( array $notifications ): array {
		$actions = array();
		$index   = 1;
		foreach ( $notifications as $note ) {
			if ( ! is_array( $note ) ) {
				continue;
			}
			$name    = SchemaBuilder::plain( (string) ( $note['name'] ?? '' ) );
			$name    = '' !== $name ? $name : sprintf( /* translators: %d: number */ __( 'Notification %d', 'subtleforms' ), $index );
			$enabled = ! isset( $note['isActive'] ) || (bool) $note['isActive'];
			$toType  = (string) ( $note['toType'] ?? 'email' );
			$to      = (string) ( $note['to'] ?? '{admin_email}' );

			if ( 'field' === $toType ) {
				$key = $this->keys[ (string) strtok( $to, '.' ) ] ?? '';
				if ( '' !== $key ) {
					$to = '{field:' . $key . '}';
				} else {
					$to      = '{admin_email}';
					$enabled = false;
					$this->notes->changed(
						sprintf(
							/* translators: %s: notification name */
							__( 'The email \'%s\' went to an address typed in a field that was not imported. It was imported switched off.', 'subtleforms' ),
							$name
						)
					);
				}
			} elseif ( 'routing' === $toType ) {
				$to      = '{admin_email}';
				$enabled = false;
				$this->notes->changed(
					sprintf(
						/* translators: %s: notification name */
						__( 'The email \'%s\' chose its address with routing rules, which were not copied. It was imported switched off and sends to the site admin email until you change it.', 'subtleforms' ),
						$name
					)
				);
			} else {
				$to = $this->tags( $to, false );
			}

			$event = (string) ( $note['event'] ?? 'form_submission' );
			if ( '' !== $event && 'form_submission' !== $event ) {
				$enabled = false;
				$this->notes->changed(
					sprintf(
						/* translators: 1: notification name, 2: event name */
						__( 'The email \'%1$s\' was sent on %2$s, not when the form is sent. It was imported switched off.', 'subtleforms' ),
						$name,
						$event
					)
				);
			}

			$settings = array(
				'to'      => $to,
				'subject' => $this->tags( (string) ( $note['subject'] ?? '' ), false ),
				'message' => $this->tags( (string) ( $note['message'] ?? '' ), false ),
				'format'  => 'text' === ( $note['message_format'] ?? '' ) ? 'text' : 'html',
			);
			$logic = $this->logic( $note, $name );
			if ( $logic ) {
				$settings['logic'] = $logic;
			} elseif ( ! empty( $note['conditionalLogic']['rules'] ) && ( ! isset( $note['conditionalLogic']['enabled'] ) || $note['conditionalLogic']['enabled'] ) ) {
				$enabled = false;
				$this->notes->changed(
					sprintf(
						/* translators: %s: notification name */
						__( 'The email \'%s\' had conditions that could not be copied, so it was imported switched off.', 'subtleforms' ),
						$name
					)
				);
			}

			$headers  = array();
			$from     = trim( $this->tags( (string) ( $note['from'] ?? '' ), true ) );
			$fromName = trim( $this->tags( (string) ( $note['fromName'] ?? '' ), true ) );
			if ( '' !== $from ) {
				$headers['From'] = '' !== $fromName ? $fromName . ' <' . $from . '>' : $from;
			}
			foreach ( array( 'replyTo' => 'Reply-To', 'cc' => 'Cc', 'bcc' => 'Bcc' ) as $from_key => $header ) {
				$raw   = trim( (string) ( $note[ $from_key ] ?? '' ) );
				$value = trim( $this->tags( $raw, true ) );
				if ( '' !== $value ) {
					$headers[ $header ] = array( $value, $raw );
				}
			}
			$settings['replyTo'] = SchemaBuilder::replyTo( $headers, $name, $this->notes );
			$settings['headers'] = SchemaBuilder::headers( $headers, $name, $this->notes );
			if ( ! empty( $note['enableAttachments'] ) ) {
				$this->notes->skipped(
					sprintf(
						/* translators: %s: notification name */
						__( 'The file attachments of the email \'%s\' were not copied.', 'subtleforms' ),
						$name
					)
				);
			}

			$actions[] = SchemaBuilder::email( $index, $settings, $enabled );
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
	 * Gravity merge tags (`{Name (First):1.3}`, `{admin_email}`) as SubtleForms
	 * merge tags. In a header, site facts are written out because headers are
	 * sent as typed.
	 *
	 * @param string $text   Text.
	 * @param bool   $header Whether the text is an email header.
	 * @return string
	 */
	public function tags( string $text, bool $header ): string {
		$out = preg_replace_callback(
			'/\{([^{}]*)\}/',
			function ( array $m ) use ( $header ): string {
				$inner = $m[1];
				if ( preg_match( '/^[^{}]*:(\d+)(?:\.(\d+))?(?::[^{}]*)?$/', $inner, $id ) ) {
					$key = $this->keys[ $id[1] ] ?? '';
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
					if ( isset( $id[2] ) && '' !== $id[2] ) {
						$this->notes->changed(
							sprintf(
								/* translators: 1: merge tag, 2: field label */
								__( 'The merge tag %1$s now gives the whole answer to \'%2$s\', not one part of it.', 'subtleforms' ),
								$m[0],
								$this->labels[ $id[1] ] ?? $key
							)
						);
					}
					return '{field:' . $key . '}';
				}
				$name = strtolower( (string) strtok( $inner, ':' ) );
				switch ( $name ) {
					case 'all_fields':
						return '{all_fields}';
					case 'form_title':
						return '{form_title}';
					case 'entry_id':
						return '{entry_id}';
					case 'date_mdy':
					case 'date_dmy':
					case 'date_created':
						return '{date}';
					case 'admin_email':
						return $header ? (string) ( $this->context['admin_email'] ?? '{admin_email}' ) : '{admin_email}';
					case 'site_title':
						return $header ? (string) ( $this->context['site_title'] ?? '' ) : '{site_name}';
					case 'site_url':
						return (string) ( $this->context['site_url'] ?? '' );
				}
				if ( preg_match( '/^[a-z_:]+$/i', $inner ) ) {
					$this->notes->skipped(
						sprintf(
							/* translators: %s: merge tag such as {ip} */
							__( 'The merge tag %s has no SubtleForms equivalent and was left as typed.', 'subtleforms' ),
							$m[0]
						)
					);
				}
				return $m[0];
			},
			$text
		);
		return is_string( $out ) ? SchemaBuilder::collapseTags( $out ) : $text;
	}
}
