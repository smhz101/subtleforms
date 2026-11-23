<?php

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
        $images             = $embedded['images'];

        // HTML mail also gets a plain text alternative, so spam filters do not
        // score it as HTML only.
        $text    = '';
        $is_html = false;
        foreach ( (array) $mail_args['headers'] as $h ) {
            if ( is_string( $h ) && preg_match( '#^\s*content-type\s*:\s*text/html#i', $h ) ) {
                $is_html = true;
                break;
            }
        }
        if ( $is_html ) {
            /**
             * Filters the plain text alternative of an HTML notification email.
             * Return an empty string to send no alternative part.
             *
             * @param string $text      Plain text built from the HTML message.
             * @param array  $mail_args Final mail arguments (to, subject, message, headers, attachments).
             */
            $text = (string) apply_filters( 'subtleforms/mail/plain_text', self::plainText( (string) $mail_args['message'] ), $mail_args );
        }

        $init = null;
        if ( $images || '' !== $text ) {
            $init = static function ( $phpmailer ) use ( $images, $text ) {
                foreach ( $images as $cid => $image ) {
                    $phpmailer->addStringEmbeddedImage( $image['data'], $cid, $image['name'], 'base64', $image['mime'] );
                }
                if ( '' !== $text && empty( $phpmailer->AltBody ) ) {
                    $phpmailer->AltBody = $text;
                }
            };
            add_action( 'phpmailer_init', $init );
        }

        try {
            $sent = wp_mail( $mail_args['to'], $mail_args['subject'], $mail_args['message'], $mail_args['headers'], $mail_args['attachments'] );
        } finally {
            if ( $init ) {
                remove_action( 'phpmailer_init', $init );
            }
        }

        // Allow filter on send result
        return (bool) apply_filters( 'subtleforms/mail/sent', $sent, $mail_args );
    }

    /**
     * Build a plain text version of an HTML email body.
     *
     * @param string $html Email body.
     * @return string
     */
    public static function plainText( string $html ): string {
        $t = (string) preg_replace( '#<(style|script|head)\b[^>]*>.*?</\1\s*>#is', '', $html );
        // Raw line breaks mean nothing in HTML (nl2br output carries one after
        // every <br />), so only tags make lines below.
        $t = (string) preg_replace( '/\s+/', ' ', $t );
        $t = (string) preg_replace_callback(
            '#<a\s[^>]*?href\s*=\s*(["\'])(.*?)\1[^>]*>(.*?)</a\s*>#is',
            static function ( $m ) {
                $label = trim( html_entity_decode( wp_strip_all_tags( $m[3] ), ENT_QUOTES, 'UTF-8' ) );
                $url   = trim( html_entity_decode( $m[2], ENT_QUOTES, 'UTF-8' ) );
                if ( ! preg_match( '#^(https?://|mailto:)#i', $url ) ) {
                    return htmlspecialchars( $label, ENT_QUOTES, 'UTF-8' );
                }
                $shown = (string) preg_replace( '#^mailto:#i', '', $url );
                if ( '' === $label ) {
                    $out = $shown;
                } else {
                    $out = ( $label === $shown || $label === $url ) ? $label : $label . ' (' . $shown . ')';
                }
                // Stay escaped until the final strip and decode, so literal
                // markup in a label (an escaped "<button>") is not stripped.
                return htmlspecialchars( $out, ENT_QUOTES, 'UTF-8' );
            },
            $t
        );
        $t = (string) preg_replace( '#<br\s*/?>|</(p|div|tr|li|h[1-6]|table)\s*>#i', "\n", $t );
        $t = (string) preg_replace( '#</t[dh]\s*>#i', ' ', $t );
        $t = html_entity_decode( wp_strip_all_tags( $t ), ENT_QUOTES, 'UTF-8' );
        $t = str_replace( array( "\r", "\xC2\xA0" ), array( '', ' ' ), $t );
        $t = (string) preg_replace( '/[ \t]+/', ' ', $t );
        $t = implode( "\n", array_map( 'trim', explode( "\n", $t ) ) );
        return trim( (string) preg_replace( "/\n{3,}/", "\n\n", $t ) );
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
