<?php
/**
 * SubtleForms 2.0 field additions.
 *
 * Fields that close the gap with the form builders people compare us to:
 * a toggle, an opinion scale, picture choices, signature and calculations.
 * Free fields are registered for everyone. Pro fields are registered for
 * everyone too, with `requiredCapabilities`, so the builder can show them as
 * locked previews until SubtleForms Pro unlocks them.
 *
 * @package SubtleForms\Fields
 * @since   2.0.0
 */

namespace SubtleForms\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the 2.0 field types.
 */
final class FieldsV2 {

	/**
	 * Capability that unlocks the advanced (Pro) field types.
	 */
	const PRO_FIELDS_CAP = 'fields.advanced';

	/**
	 * Register the new field types.
	 *
	 * @param FieldRegistry $registry Registry.
	 * @return void
	 */
	public static function register( FieldRegistry $registry ): void {

		// Toggle — a yes/no switch. Stores true/false.
		self::add(
			$registry,
			new FieldDefinition(
				type: 'toggle',
				label: __( 'Toggle', 'subtleforms' ),
				category: 'choices',
				icon: 'dashicons-controls-play',
				kind: 'input',
				fieldSpecificAttributes: array(
					'toggleLabel' => __( 'Yes', 'subtleforms' ),
					'onValue'     => 'yes',
					'offValue'    => 'no',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'toggleLabel',
						'label' => __( 'Text beside the switch', 'subtleforms' ),
					),
					array(
						'type'    => 'text',
						'name'    => 'onValue',
						'label'   => __( 'Saved value when on', 'subtleforms' ),
						'section' => 'advanced',
					),
					array(
						'type'    => 'text',
						'name'    => 'offValue',
						'label'   => __( 'Saved value when off', 'subtleforms' ),
						'section' => 'advanced',
					),
				),
			)
		);

		// Opinion scale — a row of numbered buttons with end labels.
		self::add(
			$registry,
			new FieldDefinition(
				type: 'scale',
				label: __( 'Opinion Scale', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-chart-bar',
				kind: 'input',
				fieldSpecificAttributes: array(
					'scaleMin' => 1,
					'scaleMax' => 5,
					'minLabel' => __( 'Not likely', 'subtleforms' ),
					'maxLabel' => __( 'Very likely', 'subtleforms' ),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'    => 'select',
						'name'    => 'scaleMin',
						'label'   => __( 'Start at', 'subtleforms' ),
						'options' => array(
							array( 'value' => 0, 'label' => '0' ),
							array( 'value' => 1, 'label' => '1' ),
						),
					),
					array(
						'type' => 'number',
						'name' => 'scaleMax',
						'label' => __( 'End at', 'subtleforms' ),
						'min'  => 3,
						'max'  => 10,
					),
					array(
						'type'  => 'text',
						'name'  => 'minLabel',
						'label' => __( 'Low end label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'maxLabel',
						'label' => __( 'High end label', 'subtleforms' ),
					),
				),
			)
		);

		// Picture choice — options with images (Pro).
		self::add(
			$registry,
			new FieldDefinition(
				type: 'picture_choice',
				label: __( 'Picture Choice', 'subtleforms' ),
				category: 'choices',
				icon: 'dashicons-format-gallery',
				kind: 'input',
				fieldSpecificAttributes: array(
					'options'       => array(
						array( 'label' => __( 'First choice', 'subtleforms' ), 'value' => 'first', 'image' => '' ),
						array( 'label' => __( 'Second choice', 'subtleforms' ), 'value' => 'second', 'image' => '' ),
					),
					'allowMultiple' => false,
					'pictureColumns' => 3,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'allowMultiple',
						'label' => __( 'Allow more than one choice', 'subtleforms' ),
					),
					array(
						'type'    => 'select',
						'name'    => 'pictureColumns',
						'label'   => __( 'Columns', 'subtleforms' ),
						'options' => array(
							array( 'value' => 2, 'label' => '2' ),
							array( 'value' => 3, 'label' => '3' ),
							array( 'value' => 4, 'label' => '4' ),
						),
					),
				),
				requiredCapabilities: array( self::PRO_FIELDS_CAP ),
			)
		);

		// Signature — draw-to-sign pad (Pro). The renderer already supports it.
		self::add(
			$registry,
			new FieldDefinition(
				type: 'signature',
				label: __( 'Signature', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-edit',
				kind: 'input',
				fieldSpecificAttributes: array(
					'clearLabel' => __( 'Clear', 'subtleforms' ),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'clearLabel',
						'label' => __( 'Clear button text', 'subtleforms' ),
					),
				),
				requiredCapabilities: array( self::PRO_FIELDS_CAP ),
			)
		);

		// Calculation — a read-only result computed from other fields (Pro).
		self::add(
			$registry,
			new FieldDefinition(
				type: 'calculation',
				label: __( 'Calculation', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-calculator',
				kind: 'input',
				fieldSpecificAttributes: array(
					'formula'  => '',
					'decimals' => 2,
					'prefix'   => '',
					'suffix'   => '',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'        => 'formula',
						'name'        => 'formula',
						'label'       => __( 'Formula', 'subtleforms' ),
						'help'        => __( 'Use field keys in braces, for example {quantity} * {price}. Supports + − × ÷, brackets, round(), min(), max().', 'subtleforms' ),
						'placeholder' => '{quantity} * {price}',
					),
					array(
						'type'  => 'number',
						'name'  => 'decimals',
						'label' => __( 'Decimal places', 'subtleforms' ),
						'min'   => 0,
						'max'   => 6,
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'usePrice',
						'label' => __( 'Charge this amount', 'subtleforms' ),
						'help'  => __( 'Adds the result to the order total on payment forms.', 'subtleforms' ),
					),
				),
				requiredCapabilities: array( self::PRO_FIELDS_CAP ),
			)
		);
	}

	/**
	 * Register unless another plugin already owns the type.
	 *
	 * @param FieldRegistry   $registry   Registry.
	 * @param FieldDefinition $definition Definition.
	 */
	private static function add( FieldRegistry $registry, FieldDefinition $definition ): void {
		if ( ! $registry->has( $definition->type ) ) {
			$registry->register( $definition );
		}
	}
}
