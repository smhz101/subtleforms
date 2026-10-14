<?php
/**
 * Server render for the Throughline block.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Inner content (unused).
 * @var WP_Block $block      Block instance.
 */

$presets = sf_site_path_presets();
$preset  = isset( $presets[ $attributes['preset'] ] ) ? $presets[ $attributes['preset'] ] : $presets['divider'];
$color   = in_array( $attributes['color'], array( 'lime', 'mint', 'forest', 'sand' ), true ) ? $attributes['color'] : 'lime';
$speed   = max( 0.5, min( 20, (float) $attributes['speed'] ) );
$label   = trim( (string) $attributes['label'] );

$classes = array(
	'sf-path',
	'sf-path--' . sanitize_html_class( $attributes['preset'] ),
	'has-' . $color . '-path',
	$attributes['reverse'] ? 'is-reversed' : '',
	$attributes['animate'] ? 'is-animated' : 'is-static',
);
$wrapper = get_block_wrapper_attributes(
	array(
		'class' => implode( ' ', array_filter( $classes ) ),
		'style' => '--sf-path-speed:' . $speed . 's;',
		'role'  => $label ? 'img' : 'presentation',
	)
);
?>
<div <?php echo $wrapper; // phpcs:ignore WordPress.Security.EscapeOutput ?><?php echo $label ? ' aria-label="' . esc_attr( $label ) . '"' : ' aria-hidden="true"'; ?>>
	<svg class="sf-path__svg" viewBox="<?php echo esc_attr( $preset['viewBox'] ); ?>" preserveAspectRatio="<?php echo 'hero' === $attributes['preset'] ? 'none' : 'xMidYMid meet'; ?>" focusable="false">
		<?php foreach ( $preset['paths'] as $i => $d ) : ?>
			<path class="sf-path__line" d="<?php echo esc_attr( $d ); ?>" pathLength="1" style="--sf-i:<?php echo (int) $i; ?>" />
		<?php endforeach; ?>
		<?php foreach ( $preset['nodes'] as $n ) : ?>
			<circle class="sf-path__node" cx="<?php echo (int) $n[0]; ?>" cy="<?php echo (int) $n[1]; ?>" r="5" />
		<?php endforeach; ?>
		<?php foreach ( $preset['ends'] as $e ) : ?>
			<circle class="sf-path__end" cx="<?php echo (int) $e[0]; ?>" cy="<?php echo (int) $e[1]; ?>" r="5" />
		<?php endforeach; ?>
		<?php foreach ( $preset['paths'] as $i => $d ) : ?>
			<circle class="sf-path__dot" r="6" style="--sf-i:<?php echo (int) $i; ?>;offset-path:path('<?php echo esc_attr( $d ); ?>')" />
		<?php endforeach; ?>
	</svg>
</div>
