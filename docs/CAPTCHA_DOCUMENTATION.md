# CAPTCHA System Documentation

## Overview

SubtleForms includes a flexible, extensible CAPTCHA system supporting multiple providers:

- **Google reCAPTCHA** (v2 checkbox and v3 invisible)
- **hCaptcha**
- **Cloudflare Turnstile**

The system is designed for:
- **WordPress.org compliance** (no external libraries)
- **Clean architecture** (provider-based, extensible)
- **Simple UX** (one CAPTCHA per form, global configuration)

---

## Architecture

### Core Components

```
src/Contracts/
  └── CaptchaProviderInterface.php   # Provider contract

src/Support/Captcha/
  ├── CaptchaManager.php              # Main service
  ├── RecaptchaProvider.php           # Google reCAPTCHA
  ├── HCaptchaProvider.php            # hCaptcha
  └── TurnstileProvider.php           # Cloudflare Turnstile
```

### Provider Interface

```php
interface CaptchaProviderInterface {
    public function getName();                    // Provider identifier
    public function isConfigured();               // Check if keys are set
    public function render( $config );            // Generate HTML widget
    public function verify( $response, $secret, $ip ); // Verify token
    public function getScriptUrl( $config );      // JS library URL
}
```

### CaptchaManager

The `CaptchaManager` is the central service that:
- Registers and manages providers
- Checks if CAPTCHA is enabled/configured
- Renders widgets for frontend
- Verifies submissions
- Provides extensibility via filters

---

## Configuration

### Admin Settings

Navigate to **SubtleForms → Settings → Advanced**:

1. **Enable CAPTCHA** - Master toggle
2. **CAPTCHA Provider** - Select provider
3. **Provider-specific fields**:
   - Site Key
   - Secret Key
   - Version (for reCAPTCHA)

### Getting API Keys

#### Google reCAPTCHA
1. Visit: https://www.google.com/recaptcha/admin
2. Register your site
3. Choose v2 or v3
4. Copy Site Key and Secret Key

#### hCaptcha
1. Visit: https://dashboard.hcaptcha.com/
2. Create account and site
3. Copy Site Key and Secret Key

#### Cloudflare Turnstile
1. Visit: https://dash.cloudflare.com/?to=/:account/turnstile
2. Add site
3. Copy Site Key and Secret Key

---

## Usage

### Builder

1. Open Form Builder
2. CAPTCHA field appears in **Advanced** category (only if enabled)
3. Drag CAPTCHA field into form
4. Only one CAPTCHA allowed per form
5. Field cannot be duplicated

### Frontend

- CAPTCHA widget renders automatically
- Provider script loaded conditionally
- Submission validates CAPTCHA before processing
- User sees error if verification fails

---

## Extensibility

### Register Custom Provider

```php
add_filter( 'subtleforms_captcha_providers', function( $providers ) {
    $providers['my_captcha'] = new MyCustomCaptchaProvider();
    return $providers;
} );
```

### Override Active Provider

```php
add_filter( 'subtleforms_captcha_provider', function( $provider ) {
    return 'my_captcha'; // Force specific provider
} );
```

### Modify Provider Config

```php
add_filter( 'subtleforms_captcha_provider_config', function( $config, $provider_name ) {
    if ( $provider_name === 'recaptcha' ) {
        $config['version'] = 'v3'; // Force v3
    }
    return $config;
}, 10, 2 );
```

### Programmatically Enable/Disable

```php
add_filter( 'subtleforms_captcha_enabled', function( $enabled ) {
    // Disable CAPTCHA for logged-in users
    return is_user_logged_in() ? false : $enabled;
} );
```

---

## Custom Provider Implementation

### Step 1: Create Provider Class

```php
<?php
namespace MyPlugin\Captcha;

use SubtleForms\Contracts\CaptchaProviderInterface;

class MyCustomProvider implements CaptchaProviderInterface {
    
    public function getName() {
        return 'my_captcha';
    }
    
    public function isConfigured() {
        $settings = get_option( 'subtleforms_settings', [] );
        return !empty( $settings['captcha_my_site_key'] )
            && !empty( $settings['captcha_my_secret_key'] );
    }
    
    public function render( $config ) {
        $site_key = $config['site_key'] ?? '';
        return sprintf(
            '<div class="my-captcha" data-sitekey="%s"></div>',
            esc_attr( $site_key )
        );
    }
    
    public function verify( $response, $secret_key, $remote_ip ) {
        if ( empty( $response ) ) {
            return [
                'success' => false,
                'error' => __( 'CAPTCHA response missing.', 'my-plugin' )
            ];
        }
        
        // Call your verification API
        $result = wp_remote_post( 'https://api.mycaptcha.com/verify', [
            'body' => [
                'secret' => $secret_key,
                'response' => $response,
                'remoteip' => $remote_ip,
            ]
        ] );
        
        if ( is_wp_error( $result ) ) {
            return [
                'success' => false,
                'error' => __( 'Verification failed.', 'my-plugin' )
            ];
        }
        
        $data = json_decode( wp_remote_retrieve_body( $result ), true );
        
        return [
            'success' => !empty( $data['success'] ),
            'error' => $data['error'] ?? null
        ];
    }
    
    public function getScriptUrl( $config ) {
        return 'https://cdn.mycaptcha.com/widget.js';
    }
}
```

### Step 2: Register Provider

```php
add_filter( 'subtleforms_captcha_providers', function( $providers ) {
    $providers['my_captcha'] = new \MyPlugin\Captcha\MyCustomProvider();
    return $providers;
} );
```

### Step 3: Add Settings Fields

```php
add_filter( 'subtleforms_settings_defaults', function( $defaults ) {
    $defaults['captcha_my_site_key'] = '';
    $defaults['captcha_my_secret_key'] = '';
    return $defaults;
} );

add_filter( 'subtleforms_settings_validation_rules', function( $rules ) {
    $rules['captcha_my_site_key'] = [ 'string', 'max' => 200 ];
    $rules['captcha_my_secret_key'] = [ 'string', 'max' => 200 ];
    return $rules;
} );
```

### Step 4: Add Admin UI (Optional)

Extend `SettingsPage.jsx` to add custom provider fields.

---

## Security Considerations

### Secret Key Protection
- Secret keys stored in `wp_options` (not exposed to frontend)
- Only used server-side during verification
- Never sent to client

### IP Address Handling
- Client IP retrieved with multiple fallback methods
- Sent to provider for additional verification
- Respects proxy headers (`X-Forwarded-For`)

### Verification Flow
1. Client submits form with CAPTCHA response token
2. Server extracts token from payload
3. Server calls provider verification API
4. Provider validates token with secret key
5. Submission proceeds only if verification succeeds

### Rate Limiting
Providers implement their own rate limiting. Consider adding custom limits via WordPress filters if needed.

---

## Troubleshooting

### CAPTCHA Not Showing in Builder

**Check:**
- Is CAPTCHA enabled in Settings?
- Are Site Key and Secret Key configured?
- Is correct provider selected?

**Fix:**
- Go to Settings → Advanced
- Enable CAPTCHA toggle
- Select provider and enter keys
- Save settings

### CAPTCHA Not Rendering on Frontend

**Check:**
- Is form published?
- Is provider script loading? (Check browser console)
- Is schema served with `captchaHtml` in field config?

**Debug:**
```php
add_filter( 'subtleforms_captcha_enabled', function() {
    error_log( 'CAPTCHA enabled check' );
    return true;
} );
```

### Verification Failing

**Check:**
- Are keys correct? (Test in provider dashboard)
- Is domain whitelisted in provider settings?
- Check server error logs for API errors

**Debug:**
```php
add_action( 'rest_api_init', function() {
    error_log( 'CAPTCHA Config: ' . json_encode(
        get_option( 'subtleforms_settings' )
    ) );
} );
```

### Script Loading Errors

**Check:**
- Is script URL correct in Network tab?
- Are there CSP (Content Security Policy) restrictions?
- Is CDN accessible from your server?

**Fix CSP:**
Add to `.htaccess` or headers:
```
Content-Security-Policy: script-src 'self' https://www.google.com https://js.hcaptcha.com https://challenges.cloudflare.com;
```

---

## Performance

### Script Loading
- Provider scripts loaded only when form rendered
- Scripts cached by browser
- Async/defer loading supported

### Verification
- Single HTTP request per submission
- 10-second timeout configured
- Failures logged but don't crash submission

### Optimization Tips
- Use reCAPTCHA v3 for invisible CAPTCHA
- Implement caching for repeated verifications (out of scope)
- Consider skip for logged-in users via filter

---

## Internationalization

All user-facing strings are translatable:

```php
__( 'CAPTCHA verification failed.', 'subtleforms' )
__( 'Only one CAPTCHA field is allowed per form.', 'subtleforms' )
```

Translate via:
- POT file in `languages/subtleforms.pot`
- WordPress translation plugins
- Loco Translate, WPML, etc.

---

## Testing

### Unit Tests (Example)

```php
class CaptchaManagerTest extends WP_UnitTestCase {
    
    public function test_captcha_disabled_by_default() {
        $manager = new CaptchaManager( new Settings() );
        $this->assertFalse( $manager->isEnabled() );
    }
    
    public function test_captcha_renders_when_configured() {
        update_option( 'subtleforms_settings', [
            'captcha_enabled' => true,
            'captcha_provider' => 'recaptcha',
            'captcha_recaptcha_site_key' => 'test-key',
            'captcha_recaptcha_secret_key' => 'test-secret',
        ] );
        
        $manager = new CaptchaManager( new Settings() );
        $html = $manager->render();
        $this->assertStringContainsString( 'g-recaptcha', $html );
    }
}
```

### Manual Testing
See `docs/CAPTCHA_QA.md` for comprehensive checklist.

---

## Changelog

### Version 1.5.0
- Initial CAPTCHA system implementation
- Support for reCAPTCHA, hCaptcha, Turnstile
- Builder integration with duplicate prevention
- Frontend rendering and validation
- Extensibility via filters

---

## Support

For issues or questions:
- GitHub: https://github.com/smhz101/subtleforms/issues
- Documentation: https://subtleforms.com/docs/captcha
- Email: support@subtleforms.com
