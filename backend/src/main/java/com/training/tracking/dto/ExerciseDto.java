package com.training.tracking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExerciseDto(
        @NotBlank @Size(max = 32) String id,
        @NotNull @Size(max = 255) String name,
        @NotNull @Pattern(regexp = "kg|band|sek|bw|cm|m|min|kcal", message = "must be a known exercise type")
        String type,
        boolean uni,
        @Min(0) @Max(99) Integer sets,
        @Min(0) @Max(99) Integer setsL,
        @Min(0) @Max(99) Integer setsR,
        @NotNull @Size(max = 64) String reps,
        @Size(max = 2000) String note,
        @Size(max = 20000) String desc,
        @Size(max = MAX_IMAGES) List<@NotBlank @Size(max = 36) String> imageIds,
        /**
         * The single photo of clients that predate {@link #imageIds}, and the first photo for them on
         * the way out. An installed PWA can run the old code until it next reloads, and its save
         * would otherwise drop every picture it doesn't know how to send.
         */
        @Size(max = 36) String imageId,
        /**
         * The planned progression, in order; empty without one. Null only from a client that
         * predates steps, whose save keeps the stored ones — see {@code StateService#saveState}.
         */
        @Size(max = MAX_STEPS) List<@Valid @NotNull ExerciseStepDto> steps,
        /** Index into {@link #steps} of the step the exercise is at; null without steps. */
        @Min(0) Integer step
) {

    public static final int MAX_IMAGES = 10;
    public static final int MAX_STEPS = 20;

    /** The photos this exercise carries, whichever of the two fields the client sent them in. */
    public List<String> images() {
        if (imageIds != null) {
            return imageIds;
        }
        return imageId == null ? List.of() : List.of(imageId);
    }
}
