<?php
/**
 * SubtleForms 2.0 field additions.
 *
 * A toggle and an opinion scale. Signature, Calculation and Picture Choice
 * fields are registered by SubtleForms Pro through the
 * `subtleforms/fields/register` action (see docs/hooks.md).
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
	 * Register the new field types.
	 *
	 * @param FieldRegistry $registry Registry.
	 * @return void
	 */
	public static function register( FieldRegistry $registry ): void {

		// Toggle, a yes/no switch. Stores true/false.
		self::add(
			$registry,
			new FieldDefinition(
				type: 'toggle',
				label: __( 'Toggle', 'subtleforms' ),
				category: 'choices',
				icon: 'dashicons-controls-play',
				kind: 'input',
				fieldSpecificAttributes: array(
					'toggleLabel'  => __( 'Yes', 'subtleforms' ),
					'onValue'      => 'yes',
					'offValue'     => 'no',
					'defaultState' => 'off',
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
						'type'    => 'select',
						'name'    => 'defaultState',
						'label'   => __( 'Default state', 'subtleforms' ),
						'section' => 'appearance',
						'options' => array(
							array( 'value' => 'off', 'label' => __( 'Disabled', 'subtleforms' ) ),
							array( 'value' => 'on', 'label' => __( 'Enabled', 'subtleforms' ) ),
						),
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

		// Opinion scale, a row of numbered buttons with end labels.
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
