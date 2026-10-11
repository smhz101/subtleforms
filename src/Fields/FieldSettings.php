<?php
/**
 * Field settings v2.
 *
 * Gives every field type a complete, consistent set of settings without
 * repeating them in each definition, and organises the field library:
 *
 * - Common settings (help text, default value, read-only, admin label, CSS
 *   class, custom required message) are appended to every input type.
 * - Validation-type settings (min/max, length, pattern) are tagged so the
 *   builder shows them on the Validation tab instead of mixed into General.
 * - Library labels, categories and order are normalised, and duplicate or
 *   unfinished types are hidden from the library. Hidden types stay
 *   registered, so forms that already use them keep working.
 *
 * @package SubtleForms\Fields
 * @since   2.0.0
 */

namespace SubtleForms\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Decorates field definitions with the 2.0 settings model.
 */
final class FieldSettings {

	/**
	 * Library order. Unlisted types sort after listed ones, in registration order.
	 *
	 * @var array<string, array<int, string>>
	 */
	const LIBRARY = array(
		'basic'    => array( 'text', 'textarea', 'email', 'number', 'phone', 'url', 'name_group', 'address_group', 'password' ),
		'choices'  => array( 'dropdown', 'radio', 'multiple_choice', 'checkbox', 'toggle', 'picture_choice', 'country', 'chained_select', 'consent' ),
		'advanced' => array( 'date', 'time', 'datetime', 'rating', 'scale', 'net_promoter_score', 'range_slider', 'checkbox_grid', 'calculation', 'signature', 'color_picker', 'rich_text', 'hidden' ),
		'media'    => array( 'file_upload', 'image_upload' ),
		'layout'   => array( 'section_break', 'html', 'disclaimer', 'step', 'group_container', 'two_column_container', 'three_column_container', 'four_column_container', 'repeat_container' ),
		'payment'  => array( 'payment_amount', 'payment_summary', 'payment_coupon', 'payment_hidden_price' ),
		'system'   => array( 'recaptcha', 'hcaptcha', 'turnstile', 'action_hook' ),
	);

	/**
	 * Library labels for types whose registered label is unclear.
	 *
	 * @return array<string, string>
	 */
	private static function labels(): array {
		return array(
			'text'                   => __( 'Text', 'subtleforms' ),
			'textarea'               => __( 'Paragraph', 'subtleforms' ),
			'url'                    => __( 'Website', 'subtleforms' ),
			'radio'                  => __( 'Radio Buttons', 'subtleforms' ),
			'multiple_choice'        => __( 'Checkboxes', 'subtleforms' ),
			'checkbox'               => __( 'Single Checkbox', 'subtleforms' ),
			'consent'                => __( 'Consent / GDPR', 'subtleforms' ),
			'checkbox_grid'          => __( 'Matrix', 'subtleforms' ),
			'range_slider'           => __( 'Slider', 'subtleforms' ),
			'rich_text'              => __( 'Rich Text', 'subtleforms' ),
			'html'                   => __( 'Custom HTML', 'subtleforms' ),
			'disclaimer'             => __( 'Notice', 'subtleforms' ),
			'section_break'          => __( 'Section Heading', 'subtleforms' ),
			'step'                   => __( 'Page Break', 'subtleforms' ),
			'group_container'        => __( 'Group', 'subtleforms' ),
			'two_column_container'   => __( '2 Columns', 'subtleforms' ),
			'three_column_container' => __( '3 Columns', 'subtleforms' ),
			'four_column_container'  => __( '4 Columns', 'subtleforms' ),
			'repeat_container'       => __( 'Repeater', 'subtleforms' ),
			'name_group'             => __( 'Name', 'subtleforms' ),
			'address_group'          => __( 'Address', 'subtleforms' ),
			'net_promoter_score'     => __( 'NPS', 'subtleforms' ),
			'action_hook'            => __( 'Action Hook', 'subtleforms' ),
		);
	}

	/**
	 * Types hidden from the library: duplicates of another type, or types the
	 * public renderer does not draw yet. Existing forms that use them still work.
	 *
	 * @var array<int, string>
	 */
	const HIDDEN = array(
		'tel',                     // Duplicate of Phone.
		'select',                  // Duplicate of Dropdown.
		'form_step',               // Duplicate of Page Break (step).
		'repeat_field',            // Superseded by Repeater (repeat_container).
		'one_column_container',    // A single column is the form itself.
		'five_column_container',   // Too narrow to be usable on most themes.
		'six_column_container',
		'two_column_container',    // 2.1: fields have their own width (½, ⅓, ¼…), which
		'three_column_container',  // lays them out side by side without nesting.
		'four_column_container',   // Existing forms that use columns keep working.
		'group_container',
		'dynamic_field',           // Not rendered on the frontend yet.
		'post_selection',          // Not rendered on the frontend yet.
		'save_resume',             // Not rendered on the frontend yet.
	);

	/**
	 * Controls that belong on the Validation tab.
	 *
	 * @var array<int, string>
	 */
	const VALIDATION_CONTROLS = array(
		'maxLength',
		'minLength',
		'min',
		'max',
		'minDate',
		'maxDate',
		'rfcValidation',
		'maxSize',
		'allowedTypes',
		'pattern',
		'patternMessage',
		'requireConfirmation',
	);

	/**
	 * Types that collect a value from the visitor.
	 *
	 * @var array<int, string>
	 */
	const NON_INPUT_CATEGORIES = array( 'layout', 'structure', 'system' );

	/**
	 * Text-like inputs: support placeholder, default, read-only, prefix/suffix.
	 *
	 * @var array<int, string>
	 */
	const TEXT_LIKE = array( 'text', 'email', 'number', 'phone', 'tel', 'url', 'textarea' );

	/**
	 * Types that accept a simple default value.
	 *
	 * @var array<int, string>
	 */
	const DEFAULTABLE = array( 'text', 'email', 'number', 'phone', 'tel', 'url', 'textarea', 'dropdown', 'select', 'radio', 'country', 'date', 'time', 'range_slider', 'color_picker', 'hidden', 'scale' );

	/**
	 * Decorate every registered definition.
	 *
	 * @param FieldRegistry $registry Registry.
	 * @return void
	 */
	public static function decorateAll( FieldRegistry $registry ): void {
		$labels = self::labels();
		$order  = self::orderMap();

		foreach ( $registry->all() as $type => $definition ) {
			self::decorate( $definition, $labels, $order );
		}
	}

	/**
	 * Position of each type in the library (category index * 100 + position).
	 *
	 * @return array<string, array{category: string, order: int}>
	 */
	private static function orderMap(): array {
		$map = array();
		$ci  = 0;
		foreach ( self::LIBRARY as $category => $types ) {
			foreach ( array_values( $types ) as $i => $type ) {
				$map[ $type ] = array(
					'category' => $category,
					'order'    => ( $ci * 100 ) + $i,
				);
			}
			++$ci;
		}
		return $map;
	}

	/**
	 * Decorate one definition in place.
	 *
	 * @param FieldDefinition                                 $definition Definition.
	 * @param array<string,string>                            $labels     Label overrides.
	 * @param array<string,array{category:string,order:int}> $order      Library order.
	 * @return void
	 */
	public static function decorate( FieldDefinition $definition, array $labels = array(), array $order = array() ): void {
		$type = $definition->type;

		// ── Library placement ────────────────────────────────────────────────
		if ( isset( $labels[ $type ] ) ) {
			$definition->label = $labels[ $type ];
		}

		if ( isset( $order[ $type ] ) ) {
			$definition->category       = $order[ $type ]['category'];
			$definition->meta['order']  = $order[ $type ]['order'];
		} elseif ( ! isset( $definition->meta['order'] ) ) {
			$definition->meta['order'] = 10000;
		}

		if ( in_array( $type, self::HIDDEN, true ) ) {
			$definition->paletteHidden = true;
		}

		// Short descriptions for the library tooltip / search.
		$definition->meta['description'] = $definition->meta['description'] ?? self::describe( $type );

		// ── Settings ─────────────────────────────────────────────────────────
		$isInput = ! in_array( $definition->category, self::NON_INPUT_CATEGORIES, true )
			&& ! in_array( $definition->kind, array( 'structure', 'system' ), true )
			&& ( $definition->meta['category'] ?? 'regular' ) !== 'layout';

		$controls = is_array( $definition->inspectorControls ) ? $definition->inspectorControls : array();

		// Tag existing controls with a section.
		foreach ( $controls as &$control ) {
			if ( ! is_array( $control ) || isset( $control['section'] ) ) {
				continue;
			}
			$name               = $control['name'] ?? '';
			$isConfigRange      = in_array( $type, array( 'rating', 'range_slider', 'scale' ), true ) && in_array( $name, array( 'min', 'max' ), true );
			$control['section'] = ( in_array( $name, self::VALIDATION_CONTROLS, true ) && ! $isConfigRange ) ? 'validation' : 'general';
			if ( $type === 'rating' && $name === 'max' ) {
				$control['label'] = __( 'Number of stars', 'subtleforms' );
			}
		}
		unset( $control );

		$names = array_map(
			static fn( $c ) => is_array( $c ) ? ( $c['name'] ?? '' ) : '',
			$controls
		);
		$has   = static fn( string $name ) => in_array( $name, $names, true );
		$add   = static function ( array $control ) use ( &$controls, &$names ) {
			$controls[] = $control;
			$names[]    = $control['name'];
		};

		if ( $isInput ) {
			// General.
			if ( ! $has( 'label' ) ) {
				array_unshift(
					$controls,
					array(
						'type'    => 'text',
						'name'    => 'label',
						'label'   => __( 'Label', 'subtleforms' ),
						'section' => 'general',
					)
				);
				array_unshift( $names, 'label' );
			}

			if ( in_array( $type, self::TEXT_LIKE, true ) && ! $has( 'placeholder' ) ) {
				$add(
					array(
						'type'    => 'text',
						'name'    => 'placeholder',
						'label'   => __( 'Placeholder', 'subtleforms' ),
						'section' => 'general',
					)
				);
			}

			$add(
				array(
					'type'    => 'textarea',
					'name'    => 'description',
					'label'   => __( 'Help text', 'subtleforms' ),
					'help'    => __( 'Shown under the field to guide the visitor.', 'subtleforms' ),
					'rows'    => 2,
					'section' => 'general',
				)
			);

			if ( in_array( $type, self::DEFAULTABLE, true ) && ! $has( 'defaultValue' ) ) {
				$add(
					array(
						'type'    => 'text',
						'name'    => 'defaultValue',
						'label'   => __( 'Default value', 'subtleforms' ),
						'help'    => __( 'Prefilled when the form loads. Supports {user_email}, {user_name}, {date} and {get:param}.', 'subtleforms' ),
						'section' => 'general',
					)
				);
			}

			// Prefix / suffix for short text inputs.
			if ( in_array( $type, array( 'text', 'number', 'url' ), true ) ) {
				if ( ! $has( 'prefix' ) ) {
					$add(
						array(
							'type'        => 'text',
							'name'        => 'prefix',
							'label'       => __( 'Prefix', 'subtleforms' ),
							'placeholder' => '$',
							'section'     => 'general',
						)
					);
				}
				if ( ! $has( 'suffix' ) ) {
					$add(
						array(
							'type'        => 'text',
							'name'        => 'suffix',
							'label'       => __( 'Suffix', 'subtleforms' ),
							'placeholder' => 'kg',
							'section'     => 'general',
						)
					);
				}
			}

			// Choice layout.
			if ( in_array( $type, array( 'radio', 'multiple_choice' ), true ) && ! $has( 'optionLayout' ) ) {
				$add(
					array(
						'type'    => 'select',
						'name'    => 'optionLayout',
						'label'   => __( 'Layout', 'subtleforms' ),
						'options' => array(
							array( 'value' => 'stacked', 'label' => __( 'Stacked', 'subtleforms' ) ),
							array( 'value' => 'inline', 'label' => __( 'Inline', 'subtleforms' ) ),
							array( 'value' => 'columns-2', 'label' => __( 'Two columns', 'subtleforms' ) ),
							array( 'value' => 'columns-3', 'label' => __( 'Three columns', 'subtleforms' ) ),
							array( 'value' => 'buttons', 'label' => __( 'Buttons', 'subtleforms' ) ),
						),
						'section' => 'general',
					)
				);
			}

			// Validation.
			if ( in_array( $type, array( 'text', 'textarea', 'password' ), true ) && ! $has( 'minLength' ) ) {
				$add(
					array(
						'type'    => 'number',
						'name'    => 'minLength',
						'label'   => __( 'Minimum characters', 'subtleforms' ),
						'min'     => 0,
						'section' => 'validation',
					)
				);
			}
			if ( in_array( $type, array( 'text', 'textarea' ), true ) && ! $has( 'maxLength' ) ) {
				$add(
					array(
						'type'    => 'number',
						'name'    => 'maxLength',
						'label'   => __( 'Maximum characters', 'subtleforms' ),
						'min'     => 0,
						'section' => 'validation',
					)
				);
			}
			if ( $type === 'text' && ! $has( 'pattern' ) ) {
				$add(
					array(
						'type'        => 'text',
						'name'        => 'pattern',
						'label'       => __( 'Pattern (regular expression)', 'subtleforms' ),
						'placeholder' => '^[A-Z]{2}[0-9]{4}$',
						'section'     => 'validation',
					)
				);
				$add(
					array(
						'type'    => 'text',
						'name'    => 'patternMessage',
						'label'   => __( 'Message when the pattern does not match', 'subtleforms' ),
						'section' => 'validation',
					)
				);
			}
			if ( in_array( $type, array( 'multiple_choice', 'picture_choice' ), true ) ) {
				if ( ! $has( 'minChoices' ) ) {
					$add(
						array(
							'type'    => 'number',
							'name'    => 'minChoices',
							'label'   => __( 'Minimum selections', 'subtleforms' ),
							'min'     => 0,
							'section' => 'validation',
						)
					);
				}
				if ( ! $has( 'maxChoices' ) ) {
					$add(
						array(
							'type'    => 'number',
							'name'    => 'maxChoices',
							'label'   => __( 'Maximum selections', 'subtleforms' ),
							'min'     => 0,
							'section' => 'validation',
						)
					);
				}
			}
			if ( $type === 'checkbox_grid' ) {
				// New matrices default to one answer per row (Likert style).
				$definition->fieldSpecificAttributes['multiplePerRow'] = false;
				if ( ! $has( 'rows' ) ) {
					$add(
						array(
							'type'    => 'lines',
							'name'    => 'rows',
							'label'   => __( 'Rows', 'subtleforms' ),
							'help'    => __( 'One per line. These are the questions.', 'subtleforms' ),
							'section' => 'general',
						)
					);
				}
				if ( ! $has( 'columns' ) ) {
					$add(
						array(
							'type'    => 'lines',
							'name'    => 'columns',
							'label'   => __( 'Columns', 'subtleforms' ),
							'help'    => __( 'One per line. These are the answers.', 'subtleforms' ),
							'section' => 'general',
						)
					);
				}
				$add(
					array(
						'type'    => 'checkbox',
						'name'    => 'multiplePerRow',
						'label'   => __( 'Allow several answers per row', 'subtleforms' ),
						'section' => 'general',
					)
				);
			}

			if ( ! in_array( $type, array( 'calculation', 'payment_summary', 'payment_hidden_price', 'hidden' ), true ) ) {
			$add(
				array(
					'type'        => 'text',
					'name'        => 'requiredMessage',
					'label'       => __( 'Message when left empty', 'subtleforms' ),
					'placeholder' => __( 'This field is required.', 'subtleforms' ),
					'section'     => 'validation',
				)
			);
			}

			// Advanced.
			$add(
				array(
					'type'    => 'text',
					'name'    => 'adminLabel',
					'label'   => __( 'Admin label', 'subtleforms' ),
					'help'    => __( 'Used in submissions, exports and emails instead of the public label.', 'subtleforms' ),
					'section' => 'advanced',
				)
			);
			if ( in_array( $type, self::TEXT_LIKE, true ) || in_array( $type, array( 'date', 'time', 'datetime' ), true ) ) {
				$add(
					array(
						'type'    => 'checkbox',
						'name'    => 'readOnly',
						'label'   => __( 'Read-only', 'subtleforms' ),
						'help'    => __( 'Visitors can see but not change the value.', 'subtleforms' ),
						'section' => 'advanced',
					)
				);
			}
		}

		if ( $isInput || in_array( $type, array( 'html', 'section_break', 'disclaimer', 'group_container' ), true ) ) {
			$add(
				array(
					'type'        => 'text',
					'name'        => 'cssClass',
					'label'       => __( 'CSS class', 'subtleforms' ),
					'placeholder' => 'my-field',
					'section'     => 'advanced',
				)
			);
		}

		$definition->inspectorControls = array_values( $controls );
	}

	/**
	 * One-line description for the field library.
	 *
	 * @param string $type Field type.
	 * @return string
	 */
	private static function describe( string $type ): string {
		$map = array(
			'text'               => __( 'Short answer on one line', 'subtleforms' ),
			'textarea'           => __( 'Longer answer over several lines', 'subtleforms' ),
			'email'              => __( 'Validated email address', 'subtleforms' ),
			'number'             => __( 'Numbers with optional limits', 'subtleforms' ),
			'phone'              => __( 'Phone number', 'subtleforms' ),
			'url'                => __( 'Website address', 'subtleforms' ),
			'name_group'         => __( 'First, middle and last name', 'subtleforms' ),
			'address_group'      => __( 'Street, city, region and country', 'subtleforms' ),
			'password'           => __( 'Hidden input with strength meter', 'subtleforms' ),
			'dropdown'           => __( 'Pick one from a list', 'subtleforms' ),
			'radio'              => __( 'Pick one, all options visible', 'subtleforms' ),
			'multiple_choice'    => __( 'Pick any number of options', 'subtleforms' ),
			'checkbox'           => __( 'A single tick box', 'subtleforms' ),
			'toggle'             => __( 'Yes / no switch', 'subtleforms' ),
			'picture_choice'     => __( 'Choices shown as images', 'subtleforms' ),
			'country'            => __( 'Searchable country list', 'subtleforms' ),
			'chained_select'     => __( 'Dependent dropdowns', 'subtleforms' ),
			'consent'            => __( 'Terms or privacy agreement', 'subtleforms' ),
			'date'               => __( 'Calendar date picker', 'subtleforms' ),
			'time'               => __( 'Time of day', 'subtleforms' ),
			'datetime'           => __( 'Date and time together', 'subtleforms' ),
			'rating'             => __( 'Star rating', 'subtleforms' ),
			'scale'              => __( 'Numbered opinion scale', 'subtleforms' ),
			'net_promoter_score' => __( '0–10 likelihood to recommend', 'subtleforms' ),
			'range_slider'       => __( 'Drag to pick a value', 'subtleforms' ),
			'checkbox_grid'      => __( 'Rows × columns of options', 'subtleforms' ),
			'calculation'        => __( 'Live total from other fields', 'subtleforms' ),
			'signature'          => __( 'Draw a signature', 'subtleforms' ),
			'color_picker'       => __( 'Pick a colour', 'subtleforms' ),
			'rich_text'          => __( 'Formatted text editor', 'subtleforms' ),
			'hidden'             => __( 'Invisible value sent with the form', 'subtleforms' ),
			'file_upload'        => __( 'Upload documents', 'subtleforms' ),
			'image_upload'       => __( 'Upload images', 'subtleforms' ),
			'section_break'      => __( 'Heading and intro text', 'subtleforms' ),
			'html'               => __( 'Any HTML content', 'subtleforms' ),
			'disclaimer'         => __( 'Highlighted notice box', 'subtleforms' ),
			'step'               => __( 'Split the form into pages', 'subtleforms' ),
			'group_container'    => __( 'Group fields together', 'subtleforms' ),
			'repeat_container'   => __( 'Let visitors add rows', 'subtleforms' ),
			'payment_amount'     => __( 'Fixed or custom amount', 'subtleforms' ),
			'payment_summary'    => __( 'Order summary with totals', 'subtleforms' ),
			'payment_coupon'     => __( 'Discount code', 'subtleforms' ),
			'recaptcha'          => __( 'Google reCAPTCHA', 'subtleforms' ),
			'hcaptcha'           => __( 'hCaptcha challenge', 'subtleforms' ),
			'turnstile'          => __( 'Cloudflare Turnstile', 'subtleforms' ),
		);

		if ( strpos( $type, '_column_container' ) !== false ) {
			return __( 'Place fields side by side', 'subtleforms' );
		}

		return $map[ $type ] ?? '';
	}
}
