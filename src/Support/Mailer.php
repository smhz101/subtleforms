<?php
namespace SubtleForms\Support;

/**
 * Simple Mailer wrapper around wp_mail() to centralize behavior and testing.
 */
class Mailer {

    /**
     * Send an email using WordPress wp_mail and standard headers.
     * Returns true on success, false on failure.
     *
     * @param string|array $to
     * @param string $subject
     * @param string $message
     * @param array|string $headers
     * @param array $attachments
     * @return bool
     */
    public static function send( $to, $subject, $message, $headers = array(), $attachments = array() ) {
        // Ensure headers array
        if ( is_string( $headers ) ) {
            $headers = array( $headers );
        }

        // Ensure Content-Type header for UTF-8
        $has_content_type = false;
        foreach ( (array) $headers as $h ) {
            if ( stripos( $h, 'content-type' ) === 0 ) {
                $has_content_type = true;
                break;
            }
        }

        if ( ! $has_content_type ) {
            $headers[] = 'Content-Type: text/plain; charset=UTF-8';
        }

        // Allow filtering of mail args
        $mail_args = apply_filters( 'subtleforms/mail/args', array(
            'to' => $to,
            'subject' => $subject,
            'message' => $message,
            'headers' => $headers,
            'attachments' => $attachments,
        ) );

        // Inline images such as signatures travel as embedded attachments
        // (cid:) because most mail apps refuse data: image sources (2.3.3).
        $embedded           = self::extractInlineImages( (string) $mail_args['message'] );
        $mail_args['message'] = $embedded['html'];
        $embed              = null;
        if ( $embedded['images'] ) {
            $images = $embedded['images'];
            $embed  = static function ( $phpmailer ) use ( $images ) {
                foreach ( $images as $cid => $image ) {
                    $phpmailer->addStringEmbeddedImage( $image['data'], $cid, $image['name'], 'base64', $image['mime'] );
                }
            };
            add_action( 'phpmailer_init', $embed );
        }

        $sent = wp_mail( $mail_args['to'], $mail_args['subject'], $mail_args['message'], $mail_args['headers'], $mail_args['attachments'] );

        if ( $embed ) {
            remove_action( 'phpmailer_init', $embed );
        }

        // Allow filter on send result
        return (bool) apply_filters( 'subtleforms/mail/sent', $sent, $mail_args );
    }

    /**
     * Swap data: PNG/JPEG image sources in an HTML body for cid: references.
     *
     * @param string $html Email body.
     * @return array{html:string,images:array<string,array{data:string,mime:string,name:string}>}
     */
    public static function extractInlineImages( string $html ): array {
        $images = array();
        if ( false === strpos( $html, 'data:image/' ) ) {
            return array( 'html' => $html, 'images' => $images );
        }
        $html = (string) preg_replace_callback(
            '#src=(["\'])data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)\1#',
            static function ( $m ) use ( &$images ) {
                $data = base64_decode( $m[3], true );
                if ( false === $data || '' === $data ) {
                    return $m[0];
                }
                $cid            = 'sf-inline-' . ( count( $images ) + 1 ) . '-' . substr( md5( $m[3] ), 0, 8 );
                $images[ $cid ] = array(
                    'data' => $data,
                    'mime' => 'image/' . $m[2],
                    'name' => $cid . ( 'png' === $m[2] ? '.png' : '.jpg' ),
                );
                return 'src=' . $m[1] . 'cid:' . $cid . $m[1];
            },
            $html
        );
        return array( 'html' => $html, 'images' => $images );
    }
}
