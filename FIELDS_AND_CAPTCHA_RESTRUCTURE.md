# SubtleForms - Fields List & CAPTCHA Restructuring Plan

## Complete Field List (46 Total)

### Basic Input Fields (15)

1. `text` - Single-line text input
2. `email` - Email address with RFC validation
3. `textarea` - Multi-line text area
4. `number` - Numeric input with min/max/step
5. `phone` - Phone number field
6. `url` - URL/website address
7. `password` - Password field (masked)
8. `checkbox` - Single checkbox
9. `radio` - Radio button group
10. `multiple_choice` - Multiple checkboxes
11. `dropdown` - Select dropdown
12. `country` - Country selector
13. `chained_select` - Dependent dropdown chains
14. `date` - Date picker
15. `time` - Time picker

### Advanced Fields (17)

16. `datetime` - Combined date and time
17. `image_upload` - Image file uploader
18. `file_upload` - Generic file uploader
19. `rating` - Star rating (1-5 or custom)
20. `range_slider` - Numeric range slider
21. `color_picker` - Color selection
22. `rich_text` - WYSIWYG editor
23. `net_promoter_score` - NPS rating (0-10)
24. `checkbox_grid` - Matrix of checkboxes
25. `dynamic_field` - Dynamic content insertion
26. `post_selection` - WordPress post/page selector
27. `html` - Static HTML content block
28. `hidden` - Hidden field (not visible)
29. `address` - Address fields group
30. `section_break` - Visual section divider
31. `form_step` - Multi-step form step marker
32. `repeat_field` - Single repeatable field

### Container/Layout Fields (5)

33. `2_column_container` - Two-column layout
34. `3_column_container` - Three-column layout
35. `4_column_container` - Four-column layout
36. `repeat_container` - Repeating field group
37. `group_container` - Field grouping container
38. `step` - Step container for multi-step forms

### CAPTCHA Fields (4)

39. `recaptcha` - Google reCAPTCHA (v2/v3)
40. `hcaptcha` - hCaptcha
41. `turnstile` - Cloudflare Turnstile
42. `captcha` - Generic CAPTCHA (fallback)

### Special/Action Fields (6)

43. `action_hook` - Custom WordPress action hook
44. `save_resume` - Save & resume later functionality
45. `payment_amount` - Payment amount input
46. `payment_summary` - Payment breakdown display
47. `payment_coupon` - Coupon code input
48. `payment_hidden_price` - Hidden pricing field

---

## CAPTCHA Restructuring Plan

### Current Problem

- Users can only configure **ONE** CAPTCHA provider via dropdown
- Setting: `captcha_provider` = 'recaptcha' | 'hcaptcha' | 'turnstile'
- If user wants to use different providers in different forms, they must reconfigure settings each time
- Keys for unused providers are stored but ignored

### Proposed Solution

#### 1. Settings Structure Change

Remove the `captcha_provider` dropdown. Instead:

- Keep all provider-specific keys as-is
- Let users configure ANY or ALL providers
- Each provider can be independently enabled/disabled
- Form builder will show only configured providers

#### 2. New Settings Structure

```php
// OLD (Current)
'captcha_enabled' => true/false,  // Global toggle
'captcha_provider' => 'recaptcha', // SINGLE provider dropdown
'captcha_recaptcha_site_key' => '...',
'captcha_recaptcha_secret_key' => '...',
'captcha_recaptcha_version' => 'v2',
'captcha_hcaptcha_site_key' => '...',
'captcha_hcaptcha_secret_key' => '...',
'captcha_turnstile_site_key' => '...',
'captcha_turnstile_secret_key' => '...',

// NEW (Proposed)
'captcha_enabled' => true/false,  // Global toggle
// Remove 'captcha_provider' completely
'captcha_recaptcha_enabled' => true/false,  // NEW
'captcha_recaptcha_site_key' => '...',
'captcha_recaptcha_secret_key' => '...',
'captcha_recaptcha_version' => 'v2',
'captcha_hcaptcha_enabled' => true/false,  // NEW
'captcha_hcaptcha_site_key' => '...',
'captcha_hcaptcha_secret_key' => '...',
'captcha_turnstile_enabled' => true/false,  // NEW
'captcha_turnstile_site_key' => '...',
'captcha_turnstile_secret_key' => '...',
```

#### 3. UI Changes (SettingsPage.jsx)

**Before:**

```jsx
<select name="captcha_provider">
  <option value="">None</option>
  <option value="recaptcha">reCAPTCHA</option>
  <option value="hcaptcha">hCaptcha</option>
  <option value="turnstile">Turnstile</option>
</select>

{settings.captcha_provider === 'recaptcha' && (
  // Show reCAPTCHA fields
)}
```

**After:**

```jsx
// Section 1: reCAPTCHA
<h3>Google reCAPTCHA</h3>
<Toggle
  value={settings.captcha_recaptcha_enabled}
  onChange={(v) => updateSetting('captcha_recaptcha_enabled', v)}
/>
{settings.captcha_recaptcha_enabled && (
  // Show reCAPTCHA fields (site key, secret, version)
)}

// Section 2: hCaptcha
<h3>hCaptcha</h3>
<Toggle
  value={settings.captcha_hcaptcha_enabled}
  onChange={(v) => updateSetting('captcha_hcaptcha_enabled', v)}
/>
{settings.captcha_hcaptcha_enabled && (
  // Show hCaptcha fields
)}

// Section 3: Turnstile
<h3>Cloudflare Turnstile</h3>
<Toggle
  value={settings.captcha_turnstile_enabled}
  onChange={(v) => updateSetting('captcha_turnstile_enabled', v)}
/>
{settings.captcha_turnstile_enabled && (
  // Show Turnstile fields
)}
```

#### 4. Form Builder Field Picker Changes

- When user clicks "Add CAPTCHA field"
- Show dropdown with ONLY configured providers:
  - If only reCAPTCHA is configured → auto-insert reCAPTCHA field
  - If multiple configured → show picker: "reCAPTCHA | hCaptcha | Turnstile"
- User can add multiple different CAPTCHA types in the same form (though typically they'd use one)

#### 5. CaptchaManager Changes

**Current:**

```php
public function getActiveProviderName() {
    return $this->settings->get('captcha_provider', '');
}
```

**New Approach:**

```php
public function getConfiguredProviders() {
    $configured = [];

    if ($this->settings->get('captcha_recaptcha_enabled') &&
        $this->isProviderConfigured('recaptcha')) {
        $configured[] = 'recaptcha';
    }

    if ($this->settings->get('captcha_hcaptcha_enabled') &&
        $this->isProviderConfigured('hcaptcha')) {
        $configured[] = 'hcaptcha';
    }

    if ($this->settings->get('captcha_turnstile_enabled') &&
        $this->isProviderConfigured('turnstile')) {
        $configured[] = 'turnstile';
    }

    return $configured;
}

public function getProvider($providerName) {
    // Get specific provider instance by name
    return $this->providers[$providerName] ?? null;
}
```

#### 6. Form Schema Changes

Each CAPTCHA field stores its provider type:

```json
{
	"type": "recaptcha", // or "hcaptcha", "turnstile"
	"key": "captcha_field_1",
	"config": {
		"label": "Verify you're human",
		"required": true
	}
}
```

#### 7. Verification Changes

```php
// Current: Verify using active provider
public function verify($payload) {
    $provider = $this->getActiveProvider();
    // ...
}

// New: Verify based on field type in schema
public function verifyField($fieldType, $payload) {
    $provider = $this->getProvider($fieldType);
    if (!$provider || !$this->isProviderEnabled($fieldType)) {
        return ['success' => false, 'error' => 'Provider not configured'];
    }
    // ...
}
```

---

## Migration Strategy

1. **Add new settings** (keep old for backwards compatibility)
2. **Update Settings.php** - add new fields to DEFAULTS and VALIDATION_RULES
3. **Update SettingsPage.jsx** - new UI with separate sections
4. **Update CaptchaManager.php** - new provider detection methods
5. **Update field definitions** - each CAPTCHA type is independent
6. **Update verification logic** - per-field provider checking
7. **Migration script** - convert `captcha_provider` to new `*_enabled` flags
8. **Update documentation** - explain new multi-provider setup

---

## Benefits of New Approach

✅ **Flexibility**: Configure all providers once, use any in any form  
✅ **Clarity**: Each provider has its own section with clear enable/disable  
✅ **No Reconfiguration**: Switch between forms using different providers without changing settings  
✅ **Future-Proof**: Easy to add new CAPTCHA providers  
✅ **Better UX**: Field picker only shows what's actually configured

---

## Files to Modify

### Backend (PHP)

- `src/Support/Settings.php` - Add new settings fields
- `src/Support/Captcha/CaptchaManager.php` - Multi-provider support
- `src/Api/RestController.php` - Update verification logic
- `src/Fields/CoreFields.php` - Update field definitions if needed

### Frontend (React)

- `resources/admin/pages/SettingsPage.jsx` - New CAPTCHA UI
- `resources/admin/utils/validation.js` - Update validation rules
- `resources/admin/hooks/builder/useBuilderBoot.js` - Update provider detection

### Migration

- Create upgrade routine to convert old settings to new format
