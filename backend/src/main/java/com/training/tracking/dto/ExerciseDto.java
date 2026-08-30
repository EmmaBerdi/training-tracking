package com.training.tracking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExerciseDto(
        @NotBlank @Size(max = 32) String id,
        @NotNull @Size(max = 255) String name,
        @NotNull @Pattern(regexp = "kg|band|sek|bw|cm|m|min", message = "must be a known exercise type")
        String type,
        boolean uni,
        @Min(0) @Max(99) Integer sets,
        @Min(0) @Max(99) Integer setsL,
        @Min(0) @Max(99) Integer setsR,
        @NotNull @Size(max = 64) String reps,
        @Size(max = 2000) String note,
        @Size(max = 20000) String desc,
        @Size(max = 36) String imageId
) {
}
