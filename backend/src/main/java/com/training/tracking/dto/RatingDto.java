package com.training.tracking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** How hard an exercise felt in one workout, and the progression step it was done at. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RatingDto(
        /** Mirrors the CHECK on {@code session_rating.effort}. */
        @NotNull @Pattern(regexp = "leicht|mittel|schwer", message = "must be a known effort")
        String effort,
        @Size(max = 32) String step
) {
}
