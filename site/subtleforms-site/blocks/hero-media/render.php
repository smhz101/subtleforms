<?php
/**
 * Server render for the hero media block.
 *
 * @var array $attributes Block attributes.
 */

$poster = esc_url( $attributes['posterUrl'] );
$mp4    = esc_url( $attributes['mp4Url'] );
$webm   = esc_url( $attributes['webmUrl'] );
$dim    = max( 0, min( 90, (int) $attributes['dim'] ) );
$alt    = $attributes['decorative'] ? '' : (string) $attributes['posterAlt'];

$classes = array( 'sf-hero-media', $attributes['grain'] ? 'has-grain' : '', $poster ? 'has-poster' : 'is-atmosphere' );
$wrapper = get_block_wrapper_attributes(
	array(
		'class'               => implode( ' ', array_filter( $classes ) ),
		'style'               => '--sf-dim:' . ( $dim / 100 ) . ';',
		'data-wp-interactive' => 'subtleforms/hero-media',
		'data-wp-init'        => 'callbacks.init',
		'data-mp4'            => $mp4,
		'data-webm'           => $webm,
		'aria-hidden'         => $attributes['decorative'] ? 'true' : 'false',
	)
);
?>
<div <?php echo $wrapper; // phpcs:ignore WordPress.Security.EscapeOutput ?>>
	<?php if ( $poster ) : ?>
		<?php if ( $attributes['posterId'] ) : ?>
			<?php echo wp_get_attachment_image( (int) $attributes['posterId'], 'full', false, array( 'class' => 'sf-hero-media__poster', 'alt' => $alt, 'loading' => 'eager', 'fetchpriority' => 'high', 'decoding' => 'async' ) ); ?>
		<?php else : ?>
			<img class="sf-hero-media__poster" src="<?php echo $poster; // phpcs:ignore WordPress.Security.EscapeOutput ?>" alt="<?php echo esc_attr( $alt ); ?>" loading="eager" fetchpriority="high" decoding="async">
		<?php endif; ?>
	<?php endif; ?>
	<div class="sf-hero-media__atmosphere"></div>
	<div class="sf-hero-media__dim"></div>
</div>
