package com.training.tracking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * One step of a planned progression; a null {@code sets} or {@code reps} keeps the plan's own. The
 * {@code target} is the value aimed for per set in the exercise's unit, null when the step sets none.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExerciseStepDto(
        @NotNull @Size(max = 32) String name,
        @Min(0) @Max(99) Integer sets,
        @Size(max = 64) String reps,
        @Size(max = 500) String text,
        @Size(max = 64) String target
) {
}
