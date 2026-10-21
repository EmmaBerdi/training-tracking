package com.training.tracking;

import com.training.tracking.dto.CreatePlannedSessionRequest;
import com.training.tracking.dto.CreateRecurringRuleRequest;
import com.training.tracking.dto.CreateSessionTypeRequest;
import com.training.tracking.dto.DayDto;
import com.training.tracking.dto.PlanDto;
import com.training.tracking.dto.PlannedSessionDto;
import com.training.tracking.dto.RecurringRuleDto;
import com.training.tracking.dto.RulePlanEntry;
import com.training.tracking.dto.SessionTypeDto;
import com.training.tracking.dto.StateDto;
import com.training.tracking.dto.UpdatePlannedSessionRequest;
import com.training.tracking.dto.UpdateRecurringRuleRequest;
import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.dto.auth.RegisterRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * How a series decides which workout each of its dates gets, through the endpoints the app actually
 * calls. A rule row only ever describes one stretch of a series — every "alle künftigen Termine"
 * edit splits off another — so these cases run the edits in the order a user would and check what
 * the calendar ends up showing, which is the only place the halves are visible as one series.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SeriesPlanModeTest {

    /** 03.08.2026 is a Monday, so the series starts on one. */
    private static final String MONDAY = "2026-08-03";
    private static final String THURSDAY = "2026-08-06";
    private static final int MO_AND_DO = 1 | 8;
    private static final String FROM = "2026-08-01";
    private static final String TO = "2026-09-30";

    @Autowired
    private TestRestTemplate restTemplate;

    private HttpHeaders headers;
    private Long gymTypeId;

    @BeforeEach
    void signUpWithThreePlans() {
        ResponseEntity<AuthResponse> registered = restTemplate.postForEntity("/api/auth/register",
                new RegisterRequest("series-" + System.nanoTime() + "@example.com", "correct-password", null),
                AuthResponse.class);
        headers = new HttpHeaders();
        headers.setBearerAuth(registered.getBody().accessToken());

        gymTypeId = post("/api/session-types", new CreateSessionTypeRequest("Gym", null, null),
                SessionTypeDto.class).getBody().id();
        put("/api/state", new StateDto(new PlanDto(List.of(),
                List.of(day("beine", "Beine"), day("arme", "Arme"), day("push", "Push"))), List.of()));
    }

    @Test
    void aSeriesCanBeSwitchedToOnePlanPerWeekdayAfterItWasEditedOnce() {
        RecurringRuleDto rule = createSeries("fixed", "beine", List.of());
        assertThat(plansByDate()).containsEntry(MONDAY, "beine").containsEntry(THURSDAY, "beine");

        // "Plan übernehmen -> alle künftigen Termine" on 17.08. splits the series in two.
        PlannedSessionDto august17 = occurrenceOn("2026-08-17");
        ResponseEntity<Void> reassigned = put("/api/planned-sessions/" + august17.id(),
                new UpdatePlannedSessionRequest(gymTypeId, "push", null, "future"));
        assertThat(reassigned.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(plansByDate()).containsEntry(THURSDAY, "beine").containsEntry("2026-08-20", "push");

        // Now Mondays and Thursdays are to differ, edited from an occurrence in the *first* half.
        PlannedSessionDto august6 = occurrenceOn(THURSDAY);
        ResponseEntity<RecurringRuleDto> switched = put("/api/recurring-rules/" + august6.ruleId(),
                weekdayPlans(THURSDAY), RecurringRuleDto.class);
        assertThat(switched.getStatusCode()).isEqualTo(HttpStatus.OK);

        List<PlannedSessionDto> sessions = sessions();
        // The half that took over reaches to the end of the series, not just to the next split.
        assertThat(sessions.stream().map(PlannedSessionDto::date).distinct().count())
                .isEqualTo(sessions.size());
        Map<String, String> plans = plansByDate();
        assertThat(plans).containsEntry(MONDAY, "beine")        // before the edit: untouched
                .containsEntry(THURSDAY, "arme")
                .containsEntry("2026-08-10", "beine")
                .containsEntry("2026-08-20", "arme")            // used to belong to the second half
                .containsEntry("2026-09-28", "beine");
        assertThat(rule.planMode()).isEqualTo("fixed");
    }

    @Test
    void endingASeriesEndsEveryHalfOfIt() {
        createSeries("fixed", "beine", List.of());
        PlannedSessionDto august17 = occurrenceOn("2026-08-17");
        put("/api/planned-sessions/" + august17.id(),
                new UpdatePlannedSessionRequest(gymTypeId, "push", null, "future"));

        // Ended from the first half: the second half must not keep generating September.
        PlannedSessionDto august10 = occurrenceOn("2026-08-10");
        restTemplate.exchange("/api/planned-sessions/" + august10.id() + "?scope=future",
                HttpMethod.DELETE, new HttpEntity<>(headers), Void.class);

        assertThat(sessions().stream().map(PlannedSessionDto::date))
                .containsExactly(MONDAY, THURSDAY);
    }

    /** A rotation is a series-level decision too, so it survives the same second edit. */
    @Test
    void aSeriesCanBeSwitchedToARotationAfterItWasEditedOnce() {
        createSeries("fixed", "beine", List.of());
        PlannedSessionDto august17 = occurrenceOn("2026-08-17");
        put("/api/planned-sessions/" + august17.id(),
                new UpdatePlannedSessionRequest(gymTypeId, "push", null, "future"));

        PlannedSessionDto august6 = occurrenceOn(THURSDAY);
        put("/api/recurring-rules/" + august6.ruleId(),
                new UpdateRecurringRuleRequest(gymTypeId, null, null, null, "weekly", MO_AND_DO, null,
                        THURSDAY, null, "rotation",
                        List.of(new RulePlanEntry(null, "beine"), new RulePlanEntry(null, "arme"),
                                new RulePlanEntry(null, "push"))),
                RecurringRuleDto.class);

        List<PlannedSessionDto> sessions = sessions();
        assertThat(sessions.stream().map(PlannedSessionDto::date).distinct().count())
                .isEqualTo(sessions.size());
        assertThat(plansByDate()).containsEntry(MONDAY, "beine")   // before the edit: untouched
                .containsEntry(THURSDAY, "beine")                  // the cycle starts here
                .containsEntry("2026-08-10", "arme")
                .containsEntry("2026-08-13", "push")
                .containsEntry("2026-08-17", "beine");
    }

    /** A one-off is nobody's series, so it must survive an edit to the series around it. */
    @Test
    void aSingleSessionIsUntouchedByASeriesEdit() {
        createSeries("fixed", "beine", List.of());
        PlannedSessionDto oneOff = post("/api/planned-sessions",
                new CreatePlannedSessionRequest("2026-08-11", null, gymTypeId, "push", null),
                PlannedSessionDto.class).getBody();

        PlannedSessionDto august6 = occurrenceOn(THURSDAY);
        put("/api/recurring-rules/" + august6.ruleId(), weekdayPlans(THURSDAY), RecurringRuleDto.class);

        assertThat(sessions()).anySatisfy(s -> {
            assertThat(s.id()).isEqualTo(oneOff.id());
            assertThat(s.dayId()).isEqualTo("push");
            assertThat(s.ruleId()).isNull();
        });
    }

    private UpdateRecurringRuleRequest weekdayPlans(String from) {
        return new UpdateRecurringRuleRequest(gymTypeId, null, null, null, "weekly", MO_AND_DO, null,
                from, null, "weekday",
                List.of(new RulePlanEntry(0, "beine"), new RulePlanEntry(3, "arme")));
    }

    private RecurringRuleDto createSeries(String planMode, String dayId, List<RulePlanEntry> plans) {
        return post("/api/recurring-rules",
                new CreateRecurringRuleRequest(gymTypeId, dayId, null, null, "weekly", MO_AND_DO, null,
                        MONDAY, null, planMode, plans),
                RecurringRuleDto.class).getBody();
    }

    private List<PlannedSessionDto> sessions() {
        ResponseEntity<PlannedSessionDto[]> res = restTemplate.exchange(
                "/api/planned-sessions?from=" + FROM + "&to=" + TO,
                HttpMethod.GET, new HttpEntity<>(headers), PlannedSessionDto[].class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        return Arrays.asList(res.getBody());
    }

    private Map<String, String> plansByDate() {
        return sessions().stream().collect(Collectors.toMap(
                PlannedSessionDto::date, s -> String.valueOf(s.dayId()), (a, b) -> a + "+" + b));
    }

    private PlannedSessionDto occurrenceOn(String date) {
        return sessions().stream().filter(s -> s.date().equals(date)).findFirst().orElseThrow();
    }

    private DayDto day(String id, String title) {
        return new DayDto(id, title.substring(0, 3).toUpperCase(), gymTypeId, title, List.of());
    }

    private <T> ResponseEntity<T> post(String path, Object body, Class<T> type) {
        return restTemplate.exchange(path, HttpMethod.POST, new HttpEntity<>(body, headers), type);
    }

    private ResponseEntity<Void> put(String path, Object body) {
        return put(path, body, Void.class);
    }

    private <T> ResponseEntity<T> put(String path, Object body, Class<T> type) {
        return restTemplate.exchange(path, HttpMethod.PUT, new HttpEntity<>(body, headers), type);
    }
}
