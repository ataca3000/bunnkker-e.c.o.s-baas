<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\Enums;

/**
 * All typed reasons a ManufacturingPlan can fail pipeline validation.
 *
 * Failures are returned as ValidationFailure objects — never thrown directly.
 * PipelineException is reserved for unrecoverable pipeline-internal errors.
 */
enum ValidationFailureCode: string
{
    /** Plan's should_manufacture flag is false — nothing to execute. */
    case PlanNotExecutable = 'plan_not_executable';

    /** Plan carries no RecipeSnapshot but manufacturing is required. */
    case SnapshotMissing = 'snapshot_missing';

    /** Plan carries a snapshot but no hash to verify it against. */
    case SnapshotHashMissing = 'snapshot_hash_missing';

    /** Re-computed hash of RecipeSnapshot does not match plan.recipe_snapshot_hash. */
    case SnapshotHashMismatch = 'snapshot_hash_mismatch';

    /** Plan has no bom_version_number or it is < 1. */
    case PlanVersionMissing = 'plan_version_missing';

    /** plan.bom_version_number differs from recipe_snapshot.bom_version_number. */
    case RecipeVersionMismatch = 'recipe_version_mismatch';

    /** recipe_id is null on an executable plan — decision key cannot be derived. */
    case DecisionKeyUnderivable = 'decision_key_underivable';

    /** A transaction for this plan_id already exists in the system. */
    case AlreadyExecuted = 'already_executed';

    /** Plan was created too long ago and has passed its execution window. */
    case PlanExpired = 'plan_expired';

    /** Component list in the plan is inconsistent with the recipe snapshot. */
    case ComponentInconsistency = 'component_inconsistency';

    /** One or more required identity fields on the plan are empty. */
    case MissingRequiredMetadata = 'missing_required_metadata';
}
