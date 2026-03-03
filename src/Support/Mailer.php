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

        $sent = wp_mail( $mail_args['to'], $mail_args['subject'], $mail_args['message'], $mail_args['headers'], $mail_args['attachments'] );

        // Allow filter on send result
        return (bool) apply_filters( 'subtleforms/mail/sent', $sent, $mail_args );
    }
}
