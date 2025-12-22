# SubtleForms - WordPress Form Plugin

A professional WordPress form plugin with advanced conditional logic, drag-and-drop form builder, and comprehensive submissions management.

## Features

### 🎨 Visual Form Builder

- **Drag & Drop Interface**: Build forms visually with an intuitive interface
- **Real-time Preview**: See your forms as you build them
- **Field Inspector**: Configure field properties, validation, and styling
- **Multi-step Support**: Create complex multi-step forms
- **Responsive Design**: Forms work seamlessly across all devices

### 📋 Rich Field Types

- Text, Email, Textarea, Number inputs
- Select dropdowns, Radio buttons, Checkboxes
- File uploads with size and type validation
- Date/Time pickers
- Rich text editor integration
- Custom field types via extensions

### 🧠 Smart Conditional Logic

- **Show/Hide Fields**: Display fields based on user input
- **Dynamic Validation**: Rules that adapt to form state
- **Multi-condition Support**: Complex AND/OR logic chains
- **Real-time Updates**: Instant form behavior changes

### 📊 Submissions Management

- **Advanced Filtering**: Filter by form, status, date range
- **Search Functionality**: Search across all submission data
- **Status Tracking**: Unread/Read status with auto-marking
- **Export Options**: CSV, Excel export capabilities
- **Bulk Operations**: Mass actions on submissions

### 🔌 REST API

- Full REST API for headless implementations
- Secure authentication with WordPress nonces
- CRUD operations for forms and submissions
- Webhook support for real-time integrations

### 🛠 Developer-Friendly

- **Extension System**: Plugin architecture for custom functionality
- **Action Hooks**: WordPress-style hooks and filters
- **Template Overrides**: Customize form rendering
- **Field Registry**: Register custom field types
- **Modern Stack**: React, REST API, PHP 8.1+

## Requirements

- **WordPress**: 6.0 or higher
- **PHP**: 8.1 or higher
- **MySQL**: 5.7 or higher
- **Node.js**: 20+ (for development)

## Installation

### From WordPress Admin

1. Download the latest release from GitHub
2. Upload the plugin zip file via WordPress admin
3. Activate the plugin through the 'Plugins' menu

### From Source

```bash
# Clone the repository
git clone https://github.com/smhz101/subtleforms.git

# Install dependencies
cd subtleforms
composer install --no-dev
npm install

# Build assets
npm run build

# Upload to wp-content/plugins/
```

## Quick Start

### 1. Create Your First Form

1. Navigate to **SubtleForms > Forms** in your WordPress admin
2. Click **"Add New Form"**
3. Use the drag-and-drop builder to add fields
4. Configure field properties in the inspector panel
5. Save and publish your form

### 2. Display Forms

Use the shortcode to display forms anywhere:

```php
[subtleform id="123"]
```

Or use the block editor:

1. Add a **SubtleForms** block
2. Select your form from the dropdown
3. Customize display options

### 3. Manage Submissions

- View submissions in **SubtleForms > Submissions**
- Filter by form, status, or search terms
- Click any submission to view detailed information
- Export data for analysis or backup

## Development

### Setup Development Environment

```bash
# Clone and setup
git clone https://github.com/smhz101/subtleforms.git
cd subtleforms

# Install dependencies
composer install
npm install

# Start development
npm run dev
```

### Build for Production

```bash
npm run build
```

### Code Quality

```bash
# PHP Code Standards
composer run phpcs

# JavaScript Linting
npm run lint

# Run Tests
composer run test
```

## Configuration

### Form Settings

Configure global form settings in **SubtleForms > Settings**:

- Default email notifications
- reCAPTCHA integration
- Submission storage options
- Export formats

### Conditional Logic

Build complex form behavior:

```javascript
// Example: Show "Other" field when "Other" is selected
{
  "field": "other_text",
  "condition": "show",
  "rules": [{
    "field": "choice_field",
    "operator": "equals",
    "value": "other"
  }]
}
```

## Extending SubtleForms

### Custom Field Types

```php
class CustomFieldType {
    public function render($field, $value) {
        // Field rendering logic
    }

    public function validate($value, $field) {
        // Validation logic
    }
}

// Register the field type
add_action('subtleforms_register_fields', function($registry) {
    $registry->register('custom_field', CustomFieldType::class);
});
```

### Custom Actions

```php
class EmailAction implements ActionInterface {
    public function execute($submission, $form) {
        // Send email logic
    }
}

// Register the action
add_action('subtleforms_register_actions', function($manager) {
    $manager->register('email', EmailAction::class);
});
```

## Hooks and Filters

### Action Hooks

```php
// Before form submission
do_action('subtleforms_before_submission', $data, $form);

// After form submission
do_action('subtleforms_after_submission', $submission, $form);

// Form rendered
do_action('subtleforms_form_rendered', $form);
```

### Filter Hooks

```php
// Modify form data before processing
$data = apply_filters('subtleforms_submission_data', $data, $form);

// Customize field rendering
$html = apply_filters('subtleforms_field_html', $html, $field, $value);

// Modify validation rules
$rules = apply_filters('subtleforms_validation_rules', $rules, $form);
```

## API Reference

### REST Endpoints

#### Forms

- `GET /wp-json/subtleforms/v1/forms` - List all forms
- `POST /wp-json/subtleforms/v1/forms` - Create new form
- `GET /wp-json/subtleforms/v1/forms/{id}` - Get specific form
- `PUT /wp-json/subtleforms/v1/forms/{id}` - Update form
- `DELETE /wp-json/subtleforms/v1/forms/{id}` - Delete form

#### Submissions

- `GET /wp-json/subtleforms/v1/submissions` - List submissions
- `POST /wp-json/subtleforms/v1/submissions` - Create submission
- `GET /wp-json/subtleforms/v1/submissions/{id}` - Get submission
- `PUT /wp-json/subtleforms/v1/submissions/{id}` - Update submission

### JavaScript API

```javascript
// Initialize form
const form = new SubtleForm('#my-form');

// Handle submission
form.onSubmit((data) => {
	console.log('Form submitted:', data);
});

// Add custom validation
form.addValidator('custom_rule', (value, field) => {
	return value.length > 5;
});
```

## Troubleshooting

### Common Issues

**Forms not displaying**

- Check if form is published
- Verify shortcode ID is correct
- Ensure plugin is activated

**Submissions not saving**

- Check database permissions
- Verify REST API is accessible
- Review PHP error logs

**Builder not loading**

- Clear browser cache
- Check for JavaScript errors
- Verify WordPress version compatibility

### Debug Mode

Enable debug mode in wp-config.php:

```php
define('SUBTLEFORMS_DEBUG', true);
```

## Performance

### Optimization Tips

- Enable object caching for better performance
- Use CDN for form assets
- Optimize images in file uploads
- Regular database maintenance

### Caching

SubtleForms is compatible with:

- WP Super Cache
- W3 Total Cache
- WP Rocket
- LiteSpeed Cache

## Security

### Best Practices

- Regular plugin updates
- Secure file upload validation
- Input sanitization and validation
- SQL injection prevention
- XSS protection

### Permissions

- Form creation: `manage_options`
- Submission viewing: `edit_posts`
- Export data: `export`

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Reporting Issues

- Use GitHub Issues for bug reports
- Include WordPress and PHP versions
- Provide steps to reproduce
- Include relevant error messages

## License

This project is licensed under the GPL v3 License - see the [LICENSE](LICENSE) file for details.

## Changelog

### Version 0.9.4 (Current)

- ✨ Enhanced submissions management with status tracking
- ✨ Added browser/device detection in submissions
- ✨ Implemented previous/next navigation for submissions
- ✨ Added search functionality across submissions
- ✨ Auto-mark submissions as read when viewed
- 🐛 Fixed PHP 8.1 deprecation warnings
- 🚀 Improved performance with better caching

### Version 0.9.1

- ✨ Advanced conditional logic system
- ✨ Drag-and-drop form builder
- ✨ REST API implementation
- ✨ Multi-step form support
- 🐛 Various bug fixes and improvements

## Support

- **Documentation**: [GitHub Wiki](https://github.com/smhz101/subtleforms/wiki)
- **Issues**: [GitHub Issues](https://github.com/smhz101/subtleforms/issues)
- **Discussions**: [GitHub Discussions](https://github.com/smhz101/subtleforms/discussions)

## Credits

Built with ❤️ using:

- WordPress REST API
- React and WordPress Components
- PHP 8.1+ features
- Modern JavaScript (ES6+)

---

**Made by developers, for developers** 🚀
