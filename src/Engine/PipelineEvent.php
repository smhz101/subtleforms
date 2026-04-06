<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

/**
 * Structured execution event for pipeline steps.
 */
final class PipelineEvent {

	/**
	 * @var int
	 */
	public $submissionId;

	/**
	 * @var int|null
	 */
	public $schemaVersion;

	/**
	 * @var string
	 */
	public $stepId;

	/**
	 * @var string
	 */
	public $actionType;

	/**
	 * @var string
	 */
	public $status;

	/**
	 * @var string|null
	 */
	public $error;

	/**
	 * @var int
	 */
	public $ts;

        /**
         * Action-specific output data captured during step execution.
         * e.g. fields saved, email recipient/subject, webhook URL/HTTP status.
         *
         * @var array
         */
        public $data;

        public function __construct(
                $submissionId,
                $schemaVersion,
                $stepId,
                $actionType,
                $status,
                $error,
                $ts,
                array $data = array()
        ) {
                $this->submissionId  = $submissionId;
                $this->schemaVersion = $schemaVersion;
                $this->stepId        = $stepId;
                $this->actionType    = $actionType;
                $this->status        = $status;
                $this->error         = $error;
                $this->ts            = $ts;
                $this->data          = $data;
        }

        public function toArray(): array {
                return array(
                        'submission_id'  => $this->submissionId,
                        'schema_version' => $this->schemaVersion,
                        'step_id'        => $this->stepId,
                        'action_type'    => $this->actionType,
                        'status'         => $this->status,
                        'error'          => $this->error,
                        'ts'             => $this->ts,
                        'data'           => $this->data,
                );
        }
}
