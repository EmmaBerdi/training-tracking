package com.training.tracking.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Creates or replaces a timer; the ranges mirror the CHECKs on {@code interval_timer}. */
public record IntervalTimerRequest(
        @NotBlank @Size(max = 64) String name,
        @Min(0) @Max(3600) int prepareSec,
        @NotEmpty @Size(max = MAX_STEPS) List<@Valid @NotNull TimerStepDto> steps
) {

    public static final int MAX_STEPS = 20;
}
