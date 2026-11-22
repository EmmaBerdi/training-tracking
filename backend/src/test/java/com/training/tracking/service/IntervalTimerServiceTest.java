package com.training.tracking.service;

import com.training.tracking.domain.SessionType;
import com.training.tracking.domain.User;
import com.training.tracking.dto.BlockDto;
import com.training.tracking.dto.DayDto;
import com.training.tracking.dto.ExerciseDto;
import com.training.tracking.dto.IntervalTimerDto;
import com.training.tracking.dto.IntervalTimerRequest;
import com.training.tracking.dto.PlanDto;
import com.training.tracking.dto.StateDto;
import com.training.tracking.dto.TimerStepDto;
import com.training.tracking.repository.SessionTypeRepository;
import com.training.tracking.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class IntervalTimerServiceTest {

    @Autowired
    private IntervalTimerService timerService;

    @Autowired
    private StateService stateService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SessionTypeRepository sessionTypeRepository;

    private Long userId;
    private Long typeId;

    @BeforeEach
    void createUser() {
        userId = createUser("timer");
        SessionType type = new SessionType();
        type.setUserId(userId);
        type.setLabel("HIIT");
        type.setCreatedAt(Instant.now());
        typeId = sessionTypeRepository.save(type).getId();
    }

    private Long createUser(String prefix) {
        User user = new User();
        user.setEmail(prefix + "-" + System.nanoTime() + "@example.com");
        user.setPasswordHash("hash");
        user.setCreatedAt(Instant.now());
        return userRepository.save(user).getId();
    }

    private static IntervalTimerRequest tabata() {
        return new IntervalTimerRequest("Tabata", 10, List.of(new TimerStepDto(20, 10)));
    }

    private StateDto planWith(Long timerId) {
        ExerciseDto burpees = new ExerciseDto("ex1", "Burpees", "interval", false, 8, null, null, "",
                null, null, null, null, null, null, timerId);
        DayDto day = new DayDto("mo", "MO", typeId, "HIIT",
                List.of(new BlockDto("ausdauer", "Intervalle", List.of(burpees))));
        return new StateDto(new PlanDto(List.of(), List.of(day)), List.of());
    }

    private Long linkedTimer() {
        return stateService.getState(userId).plan().days().get(0).blocks().get(0).ex().get(0).timerId();
    }

    private static void assertStatus(Runnable call, HttpStatus status) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(status));
    }

    @Test
    void createsListsUpdatesAndDeletesATimer() {
        IntervalTimerDto created = timerService.createTimer(userId, tabata());
        assertThat(timerService.listTimers(userId)).containsExactly(created);

        List<TimerStepDto> pyramid = List.of(new TimerStepDto(40, 10), new TimerStepDto(60, 10),
                new TimerStepDto(40, 0));
        IntervalTimerDto updated = timerService.updateTimer(userId, created.id(),
                new IntervalTimerRequest("  Ski 40/60/40 ", 5, pyramid));
        assertThat(updated).isEqualTo(new IntervalTimerDto(created.id(), "Ski 40/60/40", 5, pyramid));
        // The intervals come back in the order they were given.
        assertThat(timerService.listTimers(userId)).containsExactly(updated);

        timerService.deleteTimer(userId, created.id());
        assertThat(timerService.listTimers(userId)).isEmpty();
    }

    @Test
    void someoneElsesTimerIsInvisibleAndUntouchable() {
        Long other = createUser("other");
        IntervalTimerDto theirs = timerService.createTimer(other, tabata());

        assertThat(timerService.listTimers(userId)).isEmpty();
        assertStatus(() -> timerService.updateTimer(userId, theirs.id(), tabata()), HttpStatus.NOT_FOUND);
        assertStatus(() -> timerService.deleteTimer(userId, theirs.id()), HttpStatus.NOT_FOUND);
        assertThat(timerService.listTimers(other)).containsExactly(theirs);
    }

    @Test
    void anIntervalExerciseKeepsItsTimerAcrossASave() {
        Long timerId = timerService.createTimer(userId, tabata()).id();

        stateService.saveState(userId, planWith(timerId));

        assertThat(linkedTimer()).isEqualTo(timerId);
    }

    @Test
    void refusesAPlanLinkingSomeoneElsesTimer() {
        Long theirs = timerService.createTimer(createUser("other"), tabata()).id();

        assertStatus(() -> stateService.saveState(userId, planWith(theirs)), HttpStatus.BAD_REQUEST);
    }

    @Test
    void deletingATimerLeavesItsExerciseWithoutOne() {
        Long timerId = timerService.createTimer(userId, tabata()).id();
        stateService.saveState(userId, planWith(timerId));

        timerService.deleteTimer(userId, timerId);

        assertThat(stateService.getState(userId).plan().days().get(0).blocks().get(0).ex()).hasSize(1);
        assertThat(linkedTimer()).isNull();
    }
}
