package com.training.tracking.web;

import com.training.tracking.domain.ExerciseImage;
import com.training.tracking.dto.ExerciseImageDto;
import com.training.tracking.security.UserPrincipal;
import com.training.tracking.service.ExerciseImageService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;

@RestController
@RequestMapping("/api/exercise-images")
public class ExerciseImageController {

    private final ExerciseImageService exerciseImageService;

    public ExerciseImageController(ExerciseImageService exerciseImageService) {
        this.exerciseImageService = exerciseImageService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExerciseImageDto upload(@AuthenticationPrincipal UserPrincipal principal,
                                    @RequestParam("file") MultipartFile file) {
        ExerciseImage image = exerciseImageService.store(principal.id(), file);
        return new ExerciseImageDto(image.getId().toString(), image.getWidth(), image.getHeight());
    }

    /**
     * An image is never edited in place — replacing a picture uploads a new one under a new id — so
     * a response can be cached for as long as the browser cares to. Private, because it is one
     * user's photo behind a bearer token and must not land in a shared cache.
     */
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> download(@AuthenticationPrincipal UserPrincipal principal,
                                            @PathVariable String id) {
        ExerciseImage image = exerciseImageService.load(principal.id(), ExerciseImageService.parseId(id));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate().immutable())
                .body(image.getData());
    }
}
