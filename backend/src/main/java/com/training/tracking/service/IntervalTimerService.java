package com.training.tracking.service;

import com.training.tracking.domain.IntervalTimer;
import com.training.tracking.domain.TimerStep;
import com.training.tracking.dto.IntervalTimerDto;
import com.training.tracking.dto.IntervalTimerRequest;
import com.training.tracking.dto.TimerStepDto;
import com.training.tracking.repository.ExerciseRepository;
import com.training.tracking.repository.IntervalTimerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class IntervalTimerService {

    private final IntervalTimerRepository timerRepository;
    private final ExerciseRepository exerciseRepository;

    public IntervalTimerService(IntervalTimerRepository timerRepository, ExerciseRepository exerciseRepository) {
        this.timerRepository = timerRepository;
        this.exerciseRepository = exerciseRepository;
    }

    @Transactional(readOnly = true)
    public List<IntervalTimerDto> listTimers(Long userId) {
        return timerRepository.findAllByUserIdOrderById(userId).stream()
                .map(IntervalTimerService::toDto)
                .toList();
    }

    @Transactional
    public IntervalTimerDto createTimer(Long userId, IntervalTimerRequest request) {
        IntervalTimer timer = new IntervalTimer();
        timer.setUserId(userId);
        apply(timer, request);
        return toDto(timerRepository.save(timer));
    }

    @Transactional
    public IntervalTimerDto updateTimer(Long userId, Long timerId, IntervalTimerRequest request) {
        IntervalTimer timer = owned(userId, timerId);
        apply(timer, request);
        return toDto(timer);
    }

    /** The exercises that ran this timer stay in the plan, without one. */
    @Transactional
    public void deleteTimer(Long userId, Long timerId) {
        IntervalTimer timer = owned(userId, timerId);
        exerciseRepository.clearTimer(timerId);
        timerRepository.delete(timer);
    }

    /** Refuses a plan that links a timer this user doesn't own, so one account can't run another's. */
    public void requireOwnership(Long userId, Collection<Long> ids) {
        if (ids.isEmpty()) {
            return;
        }
        Set<Long> owned = new HashSet<>(timerRepository.findOwnedIds(userId, ids));
        for (Long id : ids) {
            if (!owned.contains(id)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown timer " + id);
            }
        }
    }

    /** Someone else's timer reads as not found, like one that doesn't exist. */
    private IntervalTimer owned(Long userId, Long timerId) {
        return timerRepository.findByIdAndUserId(timerId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "timer not found"));
    }

    private static void apply(IntervalTimer timer, IntervalTimerRequest request) {
        timer.setName(request.name().strip());
        timer.setPrepareSec(request.prepareSec());
        timer.setSteps(new ArrayList<>(request.steps().stream()
                .map(s -> new TimerStep(s.workSec(), s.restSec()))
                .toList()));
    }

    private static IntervalTimerDto toDto(IntervalTimer timer) {
        return new IntervalTimerDto(timer.getId(), timer.getName(), timer.getPrepareSec(),
                timer.getSteps().stream().map(s -> new TimerStepDto(s.getWorkSec(), s.getRestSec())).toList());
    }
}
