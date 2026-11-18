package com.training.tracking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record SessionDto(
        @NotBlank @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}", message = "must be an ISO date") String date,
        @NotBlank @Size(max = 16) String dayId,
        /** Exercise client id -> side ('B' | 'L' | 'R') -> value per set index. */
        Map<String, Map<String, List<String>>> vals,
        List<Boolean> warm,
        /**
         * Same shape as {@code vals}: the reps done per set, {@code ""} where none were logged. Null
         * when the client predates reps, which is not the same as having logged none — see
         * {@code StateService#saveState}.
         */
        @JsonInclude(JsonInclude.Include.NON_NULL)
        Map<String, Map<String, List<String>>> reps
) {
}
