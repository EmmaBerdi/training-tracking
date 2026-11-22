package com.training.tracking.web;

import com.training.tracking.dto.IntervalTimerDto;
import com.training.tracking.dto.IntervalTimerRequest;
import com.training.tracking.security.UserPrincipal;
import com.training.tracking.service.IntervalTimerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/timers")
public class IntervalTimerController {

    private final IntervalTimerService timerService;

    public IntervalTimerController(IntervalTimerService timerService) {
        this.timerService = timerService;
    }

    @GetMapping
    public List<IntervalTimerDto> listTimers(@AuthenticationPrincipal UserPrincipal principal) {
        return timerService.listTimers(principal.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IntervalTimerDto createTimer(@AuthenticationPrincipal UserPrincipal principal,
                                        @Valid @RequestBody IntervalTimerRequest request) {
        return timerService.createTimer(principal.id(), request);
    }

    @PutMapping("/{id}")
    public IntervalTimerDto updateTimer(@AuthenticationPrincipal UserPrincipal principal,
                                        @PathVariable Long id,
                                        @Valid @RequestBody IntervalTimerRequest request) {
        return timerService.updateTimer(principal.id(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTimer(@AuthenticationPrincipal UserPrincipal principal,
                                            @PathVariable Long id) {
        timerService.deleteTimer(principal.id(), id);
        return ResponseEntity.noContent().build();
    }
}
