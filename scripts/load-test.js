#!/usr/bin/env node
/**
 * Load Testing Script for SubtleForms
 *
 * Tests concurrent form submissions to validate system stability under load.
 *
 * Usage: node scripts/load-test.js [options]
 *
 * Options:
 *   --forms <number>        Number of concurrent forms to create (default: 5)
 *   --submissions <number>  Number of submissions per form (default: 10)
 *   --concurrent <number>   Number of concurrent requests (default: 5)
 *   --base-url <url>        WordPress base URL (default: http://localhost)
 *   --username <user>       WP admin username (default: admin)
 *   --password <pass>       WP admin password (default: password)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};

const config = {
  forms: parseInt(getArg('--forms', '5')),
  submissions: parseInt(getArg('--submissions', '10')),
  concurrent: parseInt(getArg('--concurrent', '5')),
  baseURL: getArg('--base-url', 'http://localhost'),
  username: getArg('--username', 'admin'),
  password: getArg('--password', 'password'),
};

console.log('🚀 SubtleForms Load Testing');
console.log('============================');
console.log(`Forms to create: ${config.forms}`);
console.log(`Submissions per form: ${config.submissions}`);
console.log(`Concurrent requests: ${config.concurrent}`);
console.log(`Base URL: ${config.baseURL}`);
console.log('');

let nonce = null;
let cookies = [];
const results = {
  formsCreated: 0,
  formsFailed: 0,
  submissionsSuccess: 0,
  submissionsFailed: 0,
  totalTime: 0,
  errors: [],
};

// Helper to make HTTP requests
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(options.url, config.baseURL);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      rejectUnauthorized: false, // For local dev with self-signed certs
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        // Save cookies from response
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          setCookie.forEach((cookie) => {
            const cookieName = cookie.split('=')[0];
            // Replace existing cookie or add new
            const index = cookies.findIndex((c) => c.startsWith(cookieName + '='));
            if (index !== -1) {
              cookies[index] = cookie.split(';')[0];
            } else {
              cookies.push(cookie.split(';')[0]);
            }
          });
        }

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }

    req.end();
  });
}

// Login and get nonce
async function authenticate() {
  console.log('🔐 Authenticating...');

  // Get login page to get cookies
  await makeRequest({ url: '/wp-login.php' });

  // Perform login
  const loginBody = new URLSearchParams({
    log: config.username,
    pwd: config.password,
    'wp-submit': 'Log In',
    redirect_to: config.baseURL + '/wp-admin/',
    testcookie: '1',
  }).toString();

  const loginRes = await makeRequest(
    {
      url: '/wp-login.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginBody),
        Cookie: cookies.join('; '),
      },
    },
    loginBody
  );

  if (loginRes.statusCode !== 302) {
    throw new Error('Login failed');
  }

  // Get nonce from admin page
  const adminRes = await makeRequest({
    url: '/wp-admin/',
    headers: {
      Cookie: cookies.join('; '),
    },
  });

  const nonceMatch = adminRes.body.match(/"nonce":"([^"]+)"/);
  if (nonceMatch) {
    nonce = nonceMatch[1];
  } else {
    // Try to get from wpApiSettings
    const apiMatch = adminRes.body.match(/wpApiSettings\s*=\s*\{[^}]*"nonce":"([^"]+)"/);
    if (apiMatch) {
      nonce = apiMatch[1];
    }
  }

  if (!nonce) {
    throw new Error('Could not extract nonce');
  }

  console.log('✅ Authenticated successfully\n');
}

// Create a test form
async function createForm(formNumber) {
  const formData = {
    name: `Load Test Form ${formNumber}`,
    schema: {
      fields: [
        {
          key: `field_name_${Date.now()}`,
          type: 'text',
          label: 'Name',
          required: true,
        },
        {
          key: `field_email_${Date.now()}`,
          type: 'email',
          label: 'Email',
          required: true,
        },
      ],
    },
    settings: {
      submitButtonText: 'Submit',
    },
    status: 'published',
  };

  try {
    const res = await makeRequest(
      {
        url: '/wp-json/subtleforms/v1/forms',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
          Cookie: cookies.join('; '),
        },
      },
      formData
    );

    if (res.statusCode === 201) {
      const data = JSON.parse(res.body);
      results.formsCreated++;
      return data.id;
    } else {
      results.formsFailed++;
      results.errors.push(`Form creation failed: ${res.statusCode}`);
      return null;
    }
  } catch (error) {
    results.formsFailed++;
    results.errors.push(`Form creation error: ${error.message}`);
    return null;
  }
}

// Submit to a form
async function submitForm(formId, submissionNumber) {
  const submissionData = {
    data: {
      [`field_name_${Date.now()}`]: `User ${submissionNumber}`,
      [`field_email_${Date.now()}`]: `user${submissionNumber}@test.com`,
    },
  };

  try {
    const res = await makeRequest(
      {
        url: `/wp-json/subtleforms/v1/forms/${formId}/submit`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      submissionData
    );

    if (res.statusCode === 200) {
      results.submissionsSuccess++;
    } else {
      results.submissionsFailed++;
      results.errors.push(`Submission failed: ${res.statusCode}`);
    }
  } catch (error) {
    results.submissionsFailed++;
    results.errors.push(`Submission error: ${error.message}`);
  }
}

// Run concurrent requests
async function runConcurrent(tasks, concurrency) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const promise = task().then((result) => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });

    results.push(promise);
    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// Main test execution
async function runLoadTest() {
  const startTime = Date.now();

  try {
    // Step 1: Authenticate
    await authenticate();

    // Step 2: Create forms concurrently
    console.log(`📝 Creating ${config.forms} forms...`);
    const formTasks = [];
    for (let i = 1; i <= config.forms; i++) {
      formTasks.push(() => createForm(i));
    }

    const formIds = await runConcurrent(formTasks, config.concurrent);
    const validFormIds = formIds.filter((id) => id !== null);

    console.log(`✅ Created ${validFormIds.length}/${config.forms} forms\n`);

    if (validFormIds.length === 0) {
      throw new Error('No forms were created successfully');
    }

    // Step 3: Submit to forms concurrently
    console.log(
      `📨 Submitting ${config.submissions} submissions to each of ${validFormIds.length} forms...`
    );
    const submissionTasks = [];

    for (const formId of validFormIds) {
      for (let i = 1; i <= config.submissions; i++) {
        submissionTasks.push(() => submitForm(formId, i));
      }
    }

    await runConcurrent(submissionTasks, config.concurrent);

    results.totalTime = Date.now() - startTime;

    // Print results
    console.log('\n📊 Load Test Results');
    console.log('====================');
    console.log(`Total time: ${(results.totalTime / 1000).toFixed(2)}s`);
    console.log(`Forms created: ${results.formsCreated}/${config.forms}`);
    console.log(`Forms failed: ${results.formsFailed}`);
    console.log(
      `Submissions successful: ${results.submissionsSuccess}/${
        config.submissions * validFormIds.length
      }`
    );
    console.log(`Submissions failed: ${results.submissionsFailed}`);
    console.log(
      `Average submission time: ${(
        results.totalTime /
        (results.submissionsSuccess + results.submissionsFailed)
      ).toFixed(2)}ms`
    );

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      results.errors.slice(0, 10).forEach((error) => console.log(`  - ${error}`));
      if (results.errors.length > 10) {
        console.log(`  ... and ${results.errors.length - 10} more`);
      }
    }

    // Determine success
    const successRate =
      results.submissionsSuccess / (results.submissionsSuccess + results.submissionsFailed);

    if (successRate >= 0.95) {
      console.log('\n✅ Load test PASSED (>95% success rate)');
      process.exit(0);
    } else {
      console.log(`\n❌ Load test FAILED (${(successRate * 100).toFixed(1)}% success rate)`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Load test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runLoadTest();
