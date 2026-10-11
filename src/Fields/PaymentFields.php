<?php
/**
 * Payment field types added in 2.1: Product, Priced Choice and Card.
 *
 * Prices live in the form schema, so the server can always recompute the order
 * (see SubtleForms\Payments\Pricing). Card collects the payment details through
 * the active gateway (Stripe in SubtleForms Pro).
 *
 * @package SubtleForms\Fields
 * @since   2.1.0
 */

namespace SubtleForms\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class PaymentFields {

	const CAP = 'actions.payment';

	public static function register( FieldRegistry $registry ): void {

		// Product: a named item with a price and an optional quantity box.
		self::add(
			$registry,
			new FieldDefinition(
				type: 'payment_product',
				label: __( 'Product', 'subtleforms' ),
				category: 'payment',
				icon: 'dashicons-cart',
				kind: 'input',
				requiredCapabilities: array( self::CAP ),
				fieldSpecificAttributes: array(
					'productName'   => '',
					'price'         => 10,
					'allowQuantity' => true,
					'minQuantity'   => 0,
					'maxQuantity'   => 0,
					'defaultValue'  => '1',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'productName',
						'label' => __( 'Name on the order', 'subtleforms' ),
						'help'  => __( 'Shown in the summary and receipts. Defaults to the label.', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'price',
						'label' => __( 'Price', 'subtleforms' ),
						'min'   => 0,
						'step'  => 0.01,
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'allowQuantity',
						'label' => __( 'Let visitors choose a quantity', 'subtleforms' ),
					),
					array(
						'type'    => 'number',
						'name'    => 'minQuantity',
						'label'   => __( 'Minimum quantity', 'subtleforms' ),
						'min'     => 0,
						'section' => 'validation',
					),
					array(
						'type'    => 'number',
						'name'    => 'maxQuantity',
						'label'   => __( 'Maximum quantity', 'subtleforms' ),
						'help'    => __( '0 means no limit.', 'subtleforms' ),
						'min'     => 0,
						'section' => 'validation',
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Priced choice: options that each add their own price.
		self::add(
			$registry,
			new FieldDefinition(
				type: 'payment_choice',
				label: __( 'Priced Options', 'subtleforms' ),
				category: 'payment',
				icon: 'dashicons-tickets-alt',
				kind: 'input',
				requiredCapabilities: array( self::CAP ),
				fieldSpecificAttributes: array(
					'displayAs' => 'radio',
					'showPrice' => true,
					'options'   => array(
						array(
							'label' => __( 'Basic', 'subtleforms' ),
							'value' => 'basic',
							'price' => 19,
						),
						array(
							'label' => __( 'Standard', 'subtleforms' ),
							'value' => 'standard',
							'price' => 49,
						),
						array(
							'label' => __( 'Premium', 'subtleforms' ),
							'value' => 'premium',
							'price' => 99,
						),
					),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'    => 'select',
						'name'    => 'displayAs',
						'label'   => __( 'Show as', 'subtleforms' ),
						'options' => array(
							array(
								'value' => 'radio',
								'label' => __( 'Radio buttons (pick one)', 'subtleforms' ),
							),
							array(
								'value' => 'cards',
								'label' => __( 'Cards (pick one)', 'subtleforms' ),
							),
							array(
								'value' => 'dropdown',
								'label' => __( 'Dropdown (pick one)', 'subtleforms' ),
							),
							array(
								'value' => 'checkbox',
								'label' => __( 'Checkboxes (pick any)', 'subtleforms' ),
							),
						),
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'showPrice',
						'label' => __( 'Show prices next to options', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Card: secure payment details from the active gateway.
		self::add(
			$registry,
			new FieldDefinition(
				type: 'payment_card',
				label: __( 'Card Payment', 'subtleforms' ),
				category: 'payment',
				icon: 'dashicons-id',
				kind: 'input',
				requiredCapabilities: array( self::CAP ),
				fieldSpecificAttributes: array(
					'label' => __( 'Payment details', 'subtleforms' ),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
						'help'  => __( 'Card, wallet and bank details are collected by your payment gateway and never touch your server.', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);
	}

	private static function add( FieldRegistry $registry, FieldDefinition $definition ): void {
		if ( ! $registry->has( $definition->type ) ) {
			$registry->register( $definition );
		}
	}
}
