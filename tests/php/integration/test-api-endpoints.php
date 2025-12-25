<?php
/**
 * API Endpoints Integration Tests
 *
 * @package SubtleForms
 */

class API_Endpoints_Test extends WP_UnitTestCase {
    private $admin_user_id;
    private $test_form_id;

    public function setUp(): void {
        parent::setUp();
        
        // Create admin user
        $this->admin_user_id = $this->factory->user->create([
            'role' => 'administrator'
        ]);
        
        // Create a test form
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'subtleforms_forms',
            [
                'name' => 'API Test Form',
                'schema' => json_encode([
                    'fields' => [
                        [
                            'key' => 'field_1',
                            'type' => 'text',
                            'label' => 'Name',
                            'required' => true
                        ]
                    ]
                ]),
                'settings' => json_encode([]),
                'status' => 'published',
                'created_at' => current_time('mysql'),
                'updated_at' => current_time('mysql')
            ]
        );
        $this->test_form_id = $wpdb->insert_id;
    }

    public function tearDown(): void {
        global $wpdb;
        $wpdb->delete($wpdb->prefix . 'subtleforms_forms', ['id' => $this->test_form_id]);
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
            if ($form['id'] === $this->test_form_id) {
                $test_form = $form;
                break;
            }
        }
        
        $this->assertNotNull($test_form);
        $this->assertEquals('API Test Form', $test_form['name']);
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
        $this->assertEquals('API Test Form', $data['name']);
        $this->assertArrayHasKey('schema', $data);
    }

    /**
     * Test POST /subtleforms/v1/forms endpoint (create form)
     */
    public function test_create_form_endpoint() {
        wp_set_current_user($this->admin_user_id);
        
        $request = new WP_REST_Request('POST', '/subtleforms/v1/forms');
        $request->set_body_params([
            'name' => 'New API Form',
            'schema' => [
                'fields' => [
                    [
                        'key' => 'field_1',
                        'type' => 'email',
                        'label' => 'Email',
                        'required' => true
                    ]
                ]
            ],
            'settings' => []
        ]);
        
        $response = rest_do_request($request);
        
        $this->assertEquals(201, $response->get_status());
        $data = $response->get_data();
        
        $this->assertArrayHasKey('id', $data);
        $this->assertEquals('New API Form', $data['name']);
        
        // Cleanup
        global $wpdb;
        $wpdb->delete($wpdb->prefix . 'subtleforms_forms', ['id' => $data['id']]);
    }

    /**
     * Test PUT /subtleforms/v1/forms/{id} endpoint (update form)
     */
    public function test_update_form_endpoint() {
        wp_set_current_user($this->admin_user_id);
        
        $request = new WP_REST_Request('PUT', '/subtleforms/v1/forms/' . $this->test_form_id);
        $request->set_body_params([
            'name' => 'Updated API Form',
            'schema' => [
                'fields' => [
                    [
                        'key' => 'field_1',
                        'type' => 'text',
                        'label' => 'Full Name',
                        'required' => true
                    ]
                ]
            ]
        ]);
        
        $response = rest_do_request($request);
        
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        
        $this->assertEquals('Updated API Form', $data['name']);
    }

    /**
     * Test DELETE /subtleforms/v1/forms/{id} endpoint
     */
    public function test_delete_form_endpoint() {
        wp_set_current_user($this->admin_user_id);
        
        // Create a form to delete
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'subtleforms_forms',
            [
                'name' => 'Form to Delete',
                'schema' => json_encode(['fields' => []]),
                'settings' => json_encode([]),
                'status' => 'draft',
                'created_at' => current_time('mysql'),
                'updated_at' => current_time('mysql')
            ]
        );
        $form_id = $wpdb->insert_id;
        
        $request = new WP_REST_Request('DELETE', '/subtleforms/v1/forms/' . $form_id);
        $response = rest_do_request($request);
        
        $this->assertEquals(200, $response->get_status());
        
        // Verify deletion
        $form = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}subtleforms_forms WHERE id = %d",
            $form_id
        ));
        $this->assertNull($form);
    }

    /**
     * Test unauthorized access
     */
    public function test_unauthorized_access() {
        wp_set_current_user(0); // Not logged in
        
        $request = new WP_REST_Request('POST', '/subtleforms/v1/forms');
        $request->set_body_params([
            'name' => 'Unauthorized Form',
            'schema' => ['fields' => []],
            'settings' => []
        ]);
        
        $response = rest_do_request($request);
        
        $this->assertEquals(401, $response->get_status());
    }

    /**
     * Test submission endpoint
     */
    public function test_submit_form_endpoint() {
        $request = new WP_REST_Request('POST', '/subtleforms/v1/forms/' . $this->test_form_id . '/submit');
        $request->set_body_params([
            'data' => [
                'field_1' => 'John Doe'
            ]
        ]);
        
        $response = rest_do_request($request);
        
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        
        $this->assertArrayHasKey('success', $data);
        $this->assertTrue($data['success']);
        
        // Verify submission was stored
        global $wpdb;
        $submission = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1",
            $this->test_form_id
        ));
        
        $this->assertNotNull($submission);
        $submission_data = json_decode($submission->data, true);
        $this->assertEquals('John Doe', $submission_data['field_1']);
        
        // Cleanup
        $wpdb->delete($wpdb->prefix . 'subtleforms_submissions', ['id' => $submission->id]);
    }
}
