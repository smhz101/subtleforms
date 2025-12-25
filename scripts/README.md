# SubtleForms Load Testing

This directory contains load testing scripts to validate system performance under concurrent load.

## Load Test Script

The `load-test.js` script simulates concurrent form creation and submissions to test system stability.

### Usage

```bash
node scripts/load-test.js [options]
```

### Options

- `--forms <number>` - Number of concurrent forms to create (default: 5)
- `--submissions <number>` - Number of submissions per form (default: 10)
- `--concurrent <number>` - Number of concurrent requests (default: 5)
- `--base-url <url>` - WordPress base URL (default: http://localhost)
- `--username <user>` - WP admin username (default: admin)
- `--password <pass>` - WP admin password (default: password)

### Examples

#### Light Load Test

```bash
node scripts/load-test.js --forms 5 --submissions 10 --concurrent 3
```

#### Medium Load Test

```bash
node scripts/load-test.js --forms 10 --submissions 20 --concurrent 5
```

#### Heavy Load Test

```bash
node scripts/load-test.js --forms 20 --submissions 50 --concurrent 10
```

#### Custom Environment

```bash
node scripts/load-test.js \
  --forms 10 \
  --submissions 20 \
  --concurrent 5 \
  --base-url https://theme-wp.test \
  --username admin \
  --password password
```

### Success Criteria

The test is considered successful if:

- At least 95% of form creations succeed
- At least 95% of submissions succeed
- No critical errors occur during execution

### Output

The script provides:

- Real-time progress updates
- Total execution time
- Success/failure counts for forms and submissions
- Average submission time
- Error details (if any)

### Example Output

```
🚀 SubtleForms Load Testing
============================
Forms to create: 10
Submissions per form: 20
Concurrent requests: 5
Base URL: https://theme-wp.test

🔐 Authenticating...
✅ Authenticated successfully

📝 Creating 10 forms...
✅ Created 10/10 forms

📨 Submitting 20 submissions to each of 10 forms...

📊 Load Test Results
====================
Total time: 45.23s
Forms created: 10/10
Forms failed: 0
Submissions successful: 200/200
Submissions failed: 0
Average submission time: 226.15ms

✅ Load test PASSED (>95% success rate)
```

## CI/CD Integration

You can integrate this into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run Load Tests
  run: node scripts/load-test.js --forms 5 --submissions 10 --concurrent 3
```

## Troubleshooting

### Connection Errors

If you get connection errors, ensure:

- WordPress is running and accessible
- The base URL is correct
- SSL certificates are valid (or use HTTP for local testing)

### Authentication Errors

If authentication fails:

- Verify the username and password are correct
- Check that the user has admin privileges
- Ensure REST API is enabled in WordPress

### Timeout Errors

If requests timeout:

- Reduce the number of concurrent requests (`--concurrent`)
- Reduce the number of forms or submissions
- Check server resources (CPU, memory, database connections)

## Performance Benchmarks

Recommended targets for different environments:

### Development (Local)

- Forms: 5-10
- Submissions per form: 10-20
- Concurrent: 3-5
- Expected completion: < 30 seconds

### Staging

- Forms: 10-20
- Submissions per form: 20-50
- Concurrent: 5-10
- Expected completion: < 60 seconds

### Production

- Forms: 20-50
- Submissions per form: 50-100
- Concurrent: 10-20
- Expected completion: < 120 seconds
