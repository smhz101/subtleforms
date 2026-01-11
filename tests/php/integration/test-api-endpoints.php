<?php
/**
 * API Endpoints Integration Tests
 *
 * @package SubtleForms
 */

use PHPUnit\Framework\TestCase;

class API_Endpoints_Test extends WP_UnitTestCase {
    private $admin_user_id;
    private $test_form_id;
    private $forms_repo;

    public function setUp(): void {
        parent::setUp();

        // Ensure plugin tables exist
        \SubtleForms\Activator::activate();

        $this->forms_repo = new \SubtleForms\Repositories\FormsRepository();
        
        // Create admin user
        $this->admin_user_id = $this->factory->user->create([
            'role' => 'administrator'
        ]);
        
        // Create a test form + active schema
        $this->test_form_id = $this->forms_repo->create([
            'title' => 'API Test Form',
            'config' => [],
            'status' => 'draft',
        ]);

        $schema = [
            'schema_version' => 1,
            'metadata' => [
                'title' => 'API Test Form',
                'name' => 'form_schema',
                'description' => '',
                'type' => 'regular',
            ],
            'fields' => [
                [
                    'key' => 'field_1',
                    'type' => 'text',
                    'config' => [
                        'label' => 'Name',
                        'required' => true,
                    ],
                ],
            ],
            'actions' => [],
        ];

        $this->forms_repo->saveSchemaVersion($this->test_form_id, $schema, true);
    }

    public function tearDown(): void {
        if ($this->forms_repo && $this->test_form_id) {
            $this->forms_repo->delete($this->test_form_id);
        }
        parent::tearDown();
    }

    /**
     * Test GET /subtleforms/v1/forms endpoint
     */
    public function test_get_forms_endpoint() {
        wp_set_current_user($this->admin_user_id);
        
        $request = new WP_REST_Request('GET', '/subtleforms/v1/forms');
        $response = rest_do_request($request);
        
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        
        $this->assertIsArray($data);
        $this->assertNotEmpty($data);
        
        // Find our test form
        $test_form = null;
        foreach ($data as $form) {
            if ($form['id'] == $this->test_form_id) {
                $test_form = $form;
                break;
            }
        }
        
        $this->assertNotNull($test_form);
        $this->assertEquals('API Test Form', $test_form['title']);
    }

    /**
     * Test GET /subtleforms/v1/forms/{id} endpoint
     */
    public function test_get_single_form_endpoint() {
        wp_set_current_user($this->admin_user_id);
        
        $request = new WP_REST_Request('GET', '/subtleforms/v1/forms/' . $this->test_form_id);
        $response = rest_do_request($request);
        
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        
        $this->assertEquals($this->test_form_id, $data['id']);
        $this->assertEquals('API Test Form', $data['title']);
    }

    /**
     * Test POST /subtleforms/v1/forms endpoint (create form)
     */
    public function test_create_form_endpoint() {
        wp_set_current_user($this->admin_user_id);
        
        $request = new WP_REST_Request('POST', '/subtleforms/v1/forms');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'title' => 'New API Form',
            'status' => 'draft',
            'schema' => [
                'schema_version' => 1,
                'metadata' => [
                    'title' => 'New API Form',
                    'name' => 'form_schema',
                    'description' => '',
                    'type' => 'regular',
                ],
                'fields' => [
                    [
                        'key' => 'field_1',
                        'type' => 'email',
                        'config' => [
                            'label' => 'Email',
                            'required' => true,
                        ],
                    ],
                ],
                'actions' => [],
            ],
        ]));
        
        $response = rest_do_request($request);
        
        $this->assertEquals(201, $response->get_status());
        $data = $response->get_data();
        
        $this->assertArrayHasKey('id', $data);

        $request2 = new WP_REST_Request('GET', '/subtleforms/v1/forms/' . $data['id']);
        $response2 = rest_do_request($request2);
        $this->assertEquals(200, $response2->get_status());
        $formData = $response2->get_data();
        $this->assertEquals('New API Form', $formData['title']);
        
        // Cleanup
        $this->forms_repo->delete($data['id']);
    }

    /**
     * Test PUT /subtleforms/v1/forms/{id} endpoint (update form)
     */
    public function test_update_form_endpoint() {
        wp_set_current_user($this->admin_user_id);
        
        $request = new WP_REST_Request('PUT', '/subtleforms/v1/forms/' . $this->test_form_id);
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'title' => 'Updated API Form',
        ]));
        
        $response = rest_do_request($request);
        
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();

        $this->assertTrue($data['success']);

        $request2 = new WP_REST_Request('GET', '/subtleforms/v1/forms/' . $this->test_form_id);
        $response2 = rest_do_request($request2);
        $this->assertEquals(200, $response2->get_status());
        $formData = $response2->get_data();
        $this->assertEquals('Updated API Form', $formData['title']);
    }

    /**
     * Test DELETE /subtleforms/v1/forms/{id} endpoint
     */
    public function test_delete_form_endpoint() {
        wp_set_current_user($this->admin_user_id);
        
        // Create a form to delete
        $form_id = $this->forms_repo->create([
            'title' => 'Form to Delete',
            'config' => [],
            'status' => 'draft',
        ]);
        
        $request = new WP_REST_Request('DELETE', '/subtleforms/v1/forms/' . $form_id);
        $response = rest_do_request($request);
        
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        $this->assertTrue($data['success']);
        
        // Verify deletion
        $form = $this->forms_repo->find($form_id);
        $this->assertNull($form);
    }

    /**
     * Test unauthorized access
     */
    public function test_unauthorized_access() {
        wp_set_current_user(0); // Not logged in
        
        $request = new WP_REST_Request('POST', '/subtleforms/v1/forms');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'title' => 'Unauthorized Form',
            'status' => 'draft',
        ]));
        
        $response = rest_do_request($request);
        
        $this->assertEquals(401, $response->get_status());
    }

    /**
     * Test submission endpoint
     */
    public function test_submit_form_endpoint() {
        $request = new WP_REST_Request('POST', '/subtleforms/v1/submit');
        $request->set_body_params([
            'form_id' => $this->test_form_id,
            'data' => [
                'field_1' => 'John Doe'
            ],
        ]);
        
        $response = rest_do_request($request);
        
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        
        $this->assertArrayHasKey('success', $data);
        $this->assertTrue($data['success']);
        $this->assertArrayHasKey('submission_id', $data);
        
        // Verify submission was stored
        global $wpdb;
        $submission = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}subtleforms_submissions WHERE id = %d",
                $data['submission_id']
            )
        );
        
        $this->assertNotNull($submission);
        $submission_payload = json_decode($submission->payload, true);
        $this->assertEquals('John Doe', $submission_payload['field_1']);
        
        // Cleanup
        $wpdb->delete($wpdb->prefix . 'subtleforms_submissions', ['id' => $submission->id]);
    }

    /**
     * Test creating a conversational form via API
     */
    public function test_create_conversational_form_via_api() {
        wp_set_current_user($this->admin_user_id);
        
        $request = new WP_REST_Request('POST', '/subtleforms/v1/forms');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'title' => 'Conversational Form',
            'schema' => [
                'schema_version' => 1,
                'fields' => [
                    [
                        'key' => 'name',
                        'type' => 'text',
                        'config' => [
                            'label' => 'What is your name?',
                            'required' => true
                        ]
                    ],
                    [
                        'key' => 'email',
                        'type' => 'email',
                        'config' => [
                            'label' => 'What is your email?',
                            'required' => true
                        ]
                    ]
                ],
                'metadata' => [
                    'name' => 'form_schema',
                    'type' => 'conversational',
                    'title' => 'Conversational Test Form',
                ],
                'actions' => [],
            ],
            'status' => 'draft'
        ]));
        
        $response = rest_do_request($request);
        
        $this->assertEquals(201, $response->get_status());
        $data = $response->get_data();
        
        $this->assertArrayHasKey('id', $data);
        $form_id = $data['id'];
        
        // Verify form type is conversational via schema endpoint
        $schemaReq = new WP_REST_Request('GET', '/subtleforms/v1/forms/' . $form_id . '/schema');
        $schemaRes = rest_do_request($schemaReq);
        $this->assertEquals(200, $schemaRes->get_status());
        $schemaData = $schemaRes->get_data();
        $this->assertEquals('conversational', $schemaData['schema']['metadata']['type']);
        
        // Cleanup
        $this->forms_repo->delete($form_id);
    }

    /**
     * Test creating a payment form via API
     */
    public function test_create_payment_form_via_api() {
        wp_set_current_user($this->admin_user_id);
        
        $request = new WP_REST_Request('POST', '/subtleforms/v1/forms');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'title' => 'Payment Form',
            'schema' => [
                'schema_version' => 1,
                'fields' => [
                    [
                        'key' => 'name',
                        'type' => 'text',
                        'config' => [
                            'label' => 'Name',
                            'required' => true
                        ]
                    ],
                    [
                        'key' => 'amount',
                        'type' => 'payment_amount',
                        'config' => [
                            'label' => 'Amount',
                            'required' => true,
                            'min' => 5,
                            'max' => 1000,
                            'currency' => 'USD'
                        ]
                    ]
                ],
                'metadata' => [
                    'name' => 'form_schema',
                    'type' => 'payment',
                    'title' => 'Payment Test Form',
                    'payment' => [
                        'enabled' => true,
                        'mode' => 'test',
                        'currency' => 'USD',
                        'amountType' => 'field',
                        'amountField' => 'amount'
                    ]
                ],
                'actions' => [],
            ],
            'status' => 'draft'
        ]));
        
        $response = rest_do_request($request);
        
        $this->assertEquals(201, $response->get_status());
        $data = $response->get_data();
        
        $this->assertArrayHasKey('id', $data);
        $form_id = $data['id'];
        
        // Verify form type is payment with settings via schema endpoint
        $schemaReq = new WP_REST_Request('GET', '/subtleforms/v1/forms/' . $form_id . '/schema');
        $schemaRes = rest_do_request($schemaReq);
        $this->assertEquals(200, $schemaRes->get_status());
        $schemaData = $schemaRes->get_data();
        $this->assertEquals('payment', $schemaData['schema']['metadata']['type']);
        $this->assertTrue($schemaData['schema']['metadata']['payment']['enabled']);
        $this->assertEquals('test', $schemaData['schema']['metadata']['payment']['mode']);
        
        // Cleanup
        $this->forms_repo->delete($form_id);
    }

    /**
     * Test updating form to conversational type via API
     */
    public function test_update_form_to_conversational_via_api() {
        wp_set_current_user($this->admin_user_id);
        
        // Get current schema
        $schemaReq = new WP_REST_Request('GET', '/subtleforms/v1/forms/' . $this->test_form_id . '/schema');
        $schemaRes = rest_do_request($schemaReq);
        $this->assertEquals(200, $schemaRes->get_status());
        $schemaData = $schemaRes->get_data();
        $schema = $schemaData['schema'];
        
        // Update to conversational
        $schema['metadata']['type'] = 'conversational';
        
        $request = new WP_REST_Request('POST', '/subtleforms/v1/forms/' . $this->test_form_id . '/schema');
                $request->set_header('Content-Type', 'application/json');
                $request->set_body(wp_json_encode([
            'schema' => $schema,
            'activate' => true,
                ]));
        
        $response = rest_do_request($request);
        $this->assertEquals(201, $response->get_status());
        
        // Verify update
        $schemaReq2 = new WP_REST_Request('GET', '/subtleforms/v1/forms/' . $this->test_form_id . '/schema');
        $schemaRes2 = rest_do_request($schemaReq2);
        $this->assertEquals(200, $schemaRes2->get_status());
        $schemaData2 = $schemaRes2->get_data();
        $this->assertEquals('conversational', $schemaData2['schema']['metadata']['type']);
    }

    /**
     * Test submission to payment form via API (with payment metadata)
     */
    public function test_submit_payment_form_via_api() {
        global $wpdb;

        // Create payment form + active schema
        $payment_form_id = $this->forms_repo->create([
            'title' => 'API Payment Form',
            'config' => [],
            'status' => 'draft',
        ]);

        $paymentSchema = [
            'schema_version' => 1,
            'metadata' => [
                'title' => 'API Payment Form',
                'name' => 'form_schema',
                'description' => '',
                'type' => 'payment',
                'payment' => [
                    'enabled' => true,
                    'mode' => 'test',
                    'currency' => 'USD',
                    'amountType' => 'field',
                    'amountField' => 'amount',
                ],
            ],
            'fields' => [
                [
                    'key' => 'name',
                    'type' => 'text',
                    'config' => [
                        'label' => 'Name',
                        'required' => true,
                    ],
                ],
                [
                    'key' => 'amount',
                    'type' => 'payment_amount',
                    'config' => [
                        'label' => 'Amount',
                        'required' => true,
                        'min' => 1,
                        'currency' => 'USD',
                    ],
                ],
            ],
            'actions' => [],
        ];

        $this->forms_repo->saveSchemaVersion($payment_form_id, $paymentSchema, true);
        
        // Submit to payment form
        $request = new WP_REST_Request('POST', '/subtleforms/v1/submit');
        $request->set_body_params([
            'form_id' => $payment_form_id,
            'data' => [
                'name' => 'John Doe',
                'amount' => '50.00'
            ]
        ]);
        
        $response = rest_do_request($request);
        
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        
        $this->assertTrue($data['success']);
        
        // Verify submission has payment metadata
        $submission = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1",
                $payment_form_id
            )
        );
        
        $this->assertNotNull($submission);
        $meta = json_decode($submission->meta, true);
        
        // Check for payment metadata
        $this->assertArrayHasKey('payment', $meta);
        $this->assertEquals('pending', $meta['payment']['status']);
        $this->assertEquals(50.0, (float) $meta['payment']['amount']);
        $this->assertEquals('USD', $meta['payment']['currency']);
        $this->assertEquals('test', $meta['payment']['mode']);
        
        // Cleanup
        $wpdb->delete($wpdb->prefix . 'subtleforms_submissions', ['id' => $submission->id]);
        $this->forms_repo->delete($payment_form_id);
    }
}