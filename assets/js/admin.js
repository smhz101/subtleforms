/**
 * SubtleForms Admin JavaScript
 *
 * @package SubtleForms
 * @version 0.1.0
 */

(function ($) {
  'use strict';

  /**
   * Main admin object
   */
  const SubtleFormsAdmin = {
    /**
     * Initialize
     */
    init: function () {
      this.bindEvents();
      this.initComponents();
      console.log('SubtleForms Admin initialized');
    },

    /**
     * Bind events
     */
    bindEvents: function () {
      // Confirm delete actions
      $(document).on('click', '[data-confirm]', this.confirmAction);

      // Form submission via AJAX
      $(document).on('submit', '.subtleforms-ajax-form', this.handleAjaxForm);

      // Dismiss notices
      $(document).on('click', '.notice-dismiss', this.dismissNotice);
    },

    /**
     * Initialize components
     */
    initComponents: function () {
      this.initTooltips();
      this.initTabs();
      this.initSelect2();
    },

    /**
     * Confirm action
     */
    confirmAction: function (e) {
      const message = $(this).data('confirm') || subtleformsAdmin.i18n.confirmDelete;

      if (!confirm(message)) {
        e.preventDefault();
        return false;
      }
    },

    /**
     * Handle AJAX form submission
     */
    handleAjaxForm: function (e) {
      e.preventDefault();

      const $form = $(this);
      const $button = $form.find('[type="submit"]');
      const buttonText = $button.text();

      // Disable button and show loading
      $button.prop('disabled', true).text('Processing...');

      $.ajax({
        url: subtleformsAdmin.ajaxUrl,
        type: 'POST',
        data: $form.serialize(),
        success: function (response) {
          if (response.success) {
            SubtleFormsAdmin.showNotice(
              'success',
              response.data.message || subtleformsAdmin.i18n.success
            );

            // Trigger custom event
            $(document).trigger('subtleforms:form-submitted', [response.data]);

            // Reset form if specified
            if ($form.data('reset')) {
              $form[0].reset();
            }
          } else {
            SubtleFormsAdmin.showNotice(
              'error',
              response.data.message || subtleformsAdmin.i18n.error
            );
          }
        },
        error: function () {
          SubtleFormsAdmin.showNotice('error', subtleformsAdmin.i18n.error);
        },
        complete: function () {
          $button.prop('disabled', false).text(buttonText);
        },
      });
    },

    /**
     * Show admin notice
     */
    showNotice: function (type, message) {
      const $notice = $('<div>')
        .addClass('notice notice-' + type + ' is-dismissible')
        .html('<p>' + message + '</p>');

      $('.wrap').prepend($notice);

      // Auto dismiss after 5 seconds
      setTimeout(function () {
        $notice.fadeOut(function () {
          $(this).remove();
        });
      }, 5000);
    },

    /**
     * Dismiss notice
     */
    dismissNotice: function () {
      $(this)
        .closest('.notice')
        .fadeOut(function () {
          $(this).remove();
        });
    },

    /**
     * Initialize tooltips
     */
    initTooltips: function () {
      if ($.fn.tooltip) {
        $('[data-tooltip]').tooltip();
      }
    },

    /**
     * Initialize tabs
     */
    initTabs: function () {
      $('.subtleforms-tabs').each(function () {
        const $tabs = $(this);
        const $navItems = $tabs.find('.subtleforms-tabs__nav-item');
        const $panels = $tabs.find('.subtleforms-tabs__panel');

        $navItems.on('click', function (e) {
          e.preventDefault();

          const target = $(this).attr('href');

          $navItems.removeClass('is-active');
          $(this).addClass('is-active');

          $panels.removeClass('is-active');
          $(target).addClass('is-active');
        });
      });
    },

    /**
     * Initialize Select2 if available
     */
    initSelect2: function () {
      if ($.fn.select2) {
        $('.subtleforms-select2').select2({
          width: '100%',
        });
      }
    },

    /**
     * REST API helper
     */
    api: {
      /**
       * Make API request
       */
      request: function (endpoint, method, data) {
        method = method || 'GET';

        return $.ajax({
          url: subtleformsAdmin.restUrl + endpoint,
          type: method,
          data: method === 'GET' ? data : JSON.stringify(data),
          contentType: 'application/json',
          beforeSend: function (xhr) {
            xhr.setRequestHeader('X-WP-Nonce', subtleformsAdmin.restNonce);
          },
        });
      },

      /**
       * Get forms
       */
      getForms: function () {
        return this.request('/forms');
      },

      /**
       * Get form by ID
       */
      getForm: function (id) {
        return this.request('/forms/' + id);
      },

      /**
       * Create form
       */
      createForm: function (data) {
        return this.request('/forms', 'POST', data);
      },

      /**
       * Update form
       */
      updateForm: function (id, data) {
        return this.request('/forms/' + id, 'PUT', data);
      },

      /**
       * Delete form
       */
      deleteForm: function (id) {
        return this.request('/forms/' + id, 'DELETE');
      },

      /**
       * Get submissions
       */
      getSubmissions: function (formId) {
        return this.request('/forms/' + formId + '/submissions');
      },
    },
  };

  /**
   * Initialize when DOM is ready
   */
  $(document).ready(function () {
    SubtleFormsAdmin.init();
  });

  /**
   * Expose to global scope
   */
  window.SubtleFormsAdmin = SubtleFormsAdmin;
})(jQuery);
