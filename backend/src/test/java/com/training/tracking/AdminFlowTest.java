package com.training.tracking;

import com.training.tracking.domain.Invitation;
import com.training.tracking.domain.User;
import com.training.tracking.dto.CreatePlannedSessionRequest;
import com.training.tracking.dto.CreateRecurringRuleRequest;
import com.training.tracking.dto.CreateSessionTypeRequest;
import com.training.tracking.dto.DayDto;
import com.training.tracking.dto.IntervalTimerRequest;
import com.training.tracking.dto.PlanDto;
import com.training.tracking.dto.SessionDto;
import com.training.tracking.dto.SessionTypeDto;
import com.training.tracking.dto.StateDto;
import com.training.tracking.dto.TimerStepDto;
import com.training.tracking.dto.admin.AdminUserDto;
import com.training.tracking.dto.admin.CreateUserRequest;
import com.training.tracking.dto.admin.InviteResponse;
import com.training.tracking.dto.auth.AcceptInvitationRequest;
import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.dto.auth.InvitationDto;
import com.training.tracking.dto.auth.InvitationTokenRequest;
import com.training.tracking.dto.auth.LoginRequest;
import com.training.tracking.dto.auth.PasswordResetRequest;
import com.training.tracking.dto.auth.RefreshRequest;
import com.training.tracking.repository.IntervalTimerRepository;
import com.training.tracking.repository.InvitationRepository;
import com.training.tracking.repository.PlannedSessionRepository;
import com.training.tracking.repository.RecurringRuleRepository;
import com.training.tracking.repository.SessionTypeRepository;
import com.training.tracking.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Account management and invitations, through the real filter chain like AuthFlowTest. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.mail.host=localhost")
class AdminFlowTest {

    private static final Pattern INVITE_TOKEN = Pattern.compile("[?&]invite=([A-Za-z0-9_-]+)");

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InvitationRepository invitationRepository;

    @Autowired
    private SessionTypeRepository sessionTypeRepository;

    @Autowired
    private PlannedSessionRepository plannedSessionRepository;

    @Autowired
    private RecurringRuleRepository recurringRuleRepository;

    @Autowired
    private IntervalTimerRepository intervalTimerRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockBean
    private JavaMailSender mailSender;

    @BeforeEach
    void mockSenderBuildsRealMessages() {
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
    }

    @Test
    void onlyActiveAdminsReachTheAdminApi() {
        assertThat(get("/api/admin/users", null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        AuthResponse member = session(createAccount("plain", false));
        assertThat(get("/api/admin/users", member).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(post("/api/admin/users", new CreateUserRequest("sneaky@example.com", null), member)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(userRepository.existsByNormalizedEmail("sneaky@example.com")).isFalse();

        User admin = createAccount("admin-rights", true);
        AuthResponse adminSession = session(admin);
        assertThat(get("/api/admin/users", adminSession).getStatusCode()).isEqualTo(HttpStatus.OK);

        // Checked against the database, so losing the flag takes effect before the token expires.
        admin.setAdmin(false);
        userRepository.save(admin);
        assertThat(get("/api/admin/users", adminSession).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void anInvitationIsAcceptedOnceAndOnlyThenTheAccountCanLogIn() {
        AuthResponse admin = session(createAccount("admin-invite", true));

        ResponseEntity<InviteResponse> invited = post("/api/admin/users",
                Map.of("email", " New.Person@Example.com ", "displayName", "Neu"), admin, InviteResponse.class);
        assertThat(invited.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(invited.getBody().inviteUrl()).isNull();
        AdminUserDto user = invited.getBody().user();
        assertThat(user.email()).isEqualTo("new.person@example.com");
        assertThat(user.status()).isEqualTo(User.STATUS_INVITED);
        assertThat(user.invitationExpiresAt()).isAfter(Instant.now().plusSeconds(6 * 24 * 3600));
        String token = lastMailedToken();

        // Same address again is a conflict, whatever its casing.
        assertThat(post("/api/admin/users", new CreateUserRequest("NEW.person@example.com", null), admin)
                .getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // Until accepted the account can neither log in nor ask for a reset code.
        assertThat(login("new.person@example.com", "any-password").getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        clearInvocations(mailSender);
        restTemplate.postForEntity("/api/auth/password-reset/request",
                new PasswordResetRequest("new.person@example.com"), String.class);
        // Reset mails go out asynchronously, so give a wrongly sent one the time to show up.
        verify(mailSender, after(500).never()).send(any(MimeMessage.class));

        ResponseEntity<InvitationDto> lookup = restTemplate.postForEntity("/api/auth/invitation/lookup",
                new InvitationTokenRequest(token), InvitationDto.class);
        assertThat(lookup.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(lookup.getBody()).isEqualTo(new InvitationDto("new.person@example.com", "Neu"));

        ResponseEntity<AuthResponse> accepted = accept(token, "chosen-password", "Neue Person");
        assertThat(accepted.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accepted.getBody().email()).isEqualTo("new.person@example.com");
        assertThat(accepted.getBody().displayName()).isEqualTo("Neue Person");
        assertThat(accepted.getBody().admin()).isFalse();

        assertThat(accept(token, "other-password", null).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(restTemplate.postForEntity("/api/auth/invitation/lookup",
                new InvitationTokenRequest(token), String.class).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(login("new.person@example.com", "chosen-password").getStatusCode()).isEqualTo(HttpStatus.OK);

        // An active account has nothing left to resend.
        assertThat(post("/api/admin/users/" + user.id() + "/invitation", null, admin).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void resendingRetiresTheEarlierLink() {
        AuthResponse admin = session(createAccount("admin-resend", true));
        Long id = post("/api/admin/users", new CreateUserRequest("resend@example.com", null), admin,
                InviteResponse.class).getBody().user().id();
        String first = lastMailedToken();

        assertThat(post("/api/admin/users/" + id + "/invitation", null, admin).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        String second = lastMailedToken();
        assertThat(second).isNotEqualTo(first);

        assertThat(accept(first, "chosen-password", null).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(accept(second, "chosen-password", null).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void anExpiredOrUnknownLinkIsRejected() {
        AuthResponse admin = session(createAccount("admin-expired", true));
        Long id = post("/api/admin/users", new CreateUserRequest("expired@example.com", null), admin,
                InviteResponse.class).getBody().user().id();
        String token = lastMailedToken();

        Invitation invitation = invitationRepository.findFirstByUserIdOrderByCreatedAtDescIdDesc(id).orElseThrow();
        invitation.setExpiresAt(Instant.now().minusSeconds(1));
        invitationRepository.save(invitation);

        assertThat(accept(token, "chosen-password", null).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(accept("not-a-real-token", "chosen-password", null).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        // An expired invitation can be sent again.
        post("/api/admin/users/" + id + "/invitation", null, admin);
        assertThat(accept(lastMailedToken(), "chosen-password", null).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void anUndeliveredInvitationHandsTheLinkToTheAdmin() {
        AuthResponse admin = session(createAccount("admin-nomail", true));
        doThrow(new MailSendException("down")).when(mailSender).send(any(MimeMessage.class));

        InviteResponse invited = post("/api/admin/users", new CreateUserRequest("nomail@example.com", null),
                admin, InviteResponse.class).getBody();
        assertThat(invited.inviteUrl()).startsWith("http://localhost:5500/?invite=");

        Matcher matcher = INVITE_TOKEN.matcher(invited.inviteUrl());
        assertThat(matcher.find()).isTrue();
        assertThat(accept(matcher.group(1), "chosen-password", null).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void deactivatingEndsSessionsUntilReactivated() {
        User adminUser = createAccount("admin-deactivate", true);
        AuthResponse admin = session(adminUser);
        User member = createAccount("deactivated", false);
        AuthResponse memberSession = session(member);

        assertThat(post("/api/admin/users/" + adminUser.getId() + "/deactivate", null, admin).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);

        ResponseEntity<AdminUserDto> deactivated =
                post("/api/admin/users/" + member.getId() + "/deactivate", null, admin, AdminUserDto.class);
        assertThat(deactivated.getBody().status()).isEqualTo(User.STATUS_DEACTIVATED);
        assertThat(restTemplate.postForEntity("/api/auth/refresh",
                new RefreshRequest(memberSession.refreshToken()), String.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(login(member.getEmail(), "correct-password").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        assertThat(post("/api/admin/users/" + member.getId() + "/reactivate", null, admin).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(login(member.getEmail(), "correct-password").getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void deletingRemovesTheAccountWithAllItsDataWithoutShowingIt() {
        User adminUser = createAccount("admin-delete", true);
        AuthResponse admin = session(adminUser);
        User member = createAccount("deleted", false);
        AuthResponse memberSession = session(member);
        fillWithTrainingData(memberSession);

        String list = get("/api/admin/users", admin).getBody();
        assertThat(list).contains(member.getEmail()).doesNotContain("Geheimplan", "Intervalle");

        assertThat(delete(member.getId(), "someone-else@example.com", admin).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(delete(adminUser.getId(), adminUser.getEmail(), admin).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);

        assertThat(delete(member.getId(), member.getEmail().toUpperCase(), admin).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(userRepository.findById(member.getId())).isEmpty();
        assertThat(sessionTypeRepository.findAll()).noneMatch(t -> member.getId().equals(t.getUserId()));
        assertThat(plannedSessionRepository.findAll()).noneMatch(p -> member.getId().equals(p.getUserId()));
        assertThat(recurringRuleRepository.findAll()).noneMatch(r -> member.getId().equals(r.getUserId()));
        assertThat(intervalTimerRepository.findAllByUserIdOrderById(member.getId())).isEmpty();
        assertThat(login(member.getEmail(), "correct-password").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    /** A plan under a custom type, a log, a series, a one-off session and a timer. */
    private void fillWithTrainingData(AuthResponse owner) {
        Long typeId = post("/api/session-types", new CreateSessionTypeRequest("Klettern", null, null),
                owner, SessionTypeDto.class).getBody().id();
        DayDto day = new DayDto("geheim", "GEH", typeId, "Geheimplan", List.of());
        SessionDto log = new SessionDto("2026-08-20", "geheim", Map.of(), List.of(), null, null);
        assertThat(exchange(HttpMethod.PUT, "/api/state",
                new StateDto(new PlanDto(List.of("Hüfte kreisen"), List.of(day)), List.of(log)), owner, String.class)
                .getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(post("/api/recurring-rules", new CreateRecurringRuleRequest(typeId, "geheim", null, null,
                "weekly", 1, null, "2026-08-03", null, "fixed", List.of()), owner).getStatusCode().is2xxSuccessful())
                .isTrue();
        assertThat(post("/api/planned-sessions",
                new CreatePlannedSessionRequest("2026-08-05", null, typeId, "geheim", null), owner)
                .getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(post("/api/timers", new IntervalTimerRequest("Intervalle", 10,
                List.of(new TimerStepDto(30, 15, null))), owner).getStatusCode().is2xxSuccessful()).isTrue();
    }

    private User createAccount(String name, boolean admin) {
        User user = new User();
        user.setEmail(name + "-" + System.nanoTime() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.setCreatedAt(Instant.now());
        user.setAdmin(admin);
        return userRepository.save(user);
    }

    private AuthResponse session(User user) {
        ResponseEntity<AuthResponse> res = restTemplate.postForEntity("/api/auth/login",
                new LoginRequest(user.getEmail(), "correct-password"), AuthResponse.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().admin()).isEqualTo(user.isAdmin());
        return res.getBody();
    }

    private ResponseEntity<String> login(String email, String password) {
        return restTemplate.postForEntity("/api/auth/login", new LoginRequest(email, password), String.class);
    }

    private ResponseEntity<AuthResponse> accept(String token, String password, String displayName) {
        return restTemplate.postForEntity("/api/auth/invitation/accept",
                new AcceptInvitationRequest(token, password, displayName), AuthResponse.class);
    }

    private ResponseEntity<String> get(String path, AuthResponse as) {
        return exchange(HttpMethod.GET, path, null, as, String.class);
    }

    private ResponseEntity<String> post(String path, Object body, AuthResponse as) {
        return post(path, body, as, String.class);
    }

    private <T> ResponseEntity<T> post(String path, Object body, AuthResponse as, Class<T> type) {
        return exchange(HttpMethod.POST, path, body, as, type);
    }

    private ResponseEntity<String> delete(Long id, String confirmEmail, AuthResponse as) {
        return exchange(HttpMethod.DELETE, "/api/admin/users/" + id + "?confirmEmail={email}", null, as,
                String.class, confirmEmail);
    }

    private <T> ResponseEntity<T> exchange(HttpMethod method, String path, Object body, AuthResponse as,
                                           Class<T> type, Object... uriVariables) {
        HttpHeaders headers = new HttpHeaders();
        if (as != null) {
            headers.setBearerAuth(as.accessToken());
        }
        return restTemplate.exchange(path, method, new HttpEntity<>(body, headers), type, uriVariables);
    }

    /** The token in the plain-text part of the newest invitation mail so far. */
    private String lastMailedToken() {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, atLeastOnce()).send(captor.capture());
        String text;
        try {
            text = (String) ((MimeMultipart) captor.getValue().getContent()).getBodyPart(0).getContent();
        } catch (IOException | MessagingException e) {
            throw new AssertionError(e);
        }
        Matcher matcher = INVITE_TOKEN.matcher(text);
        assertThat(matcher.find()).as("mail carries an invitation link").isTrue();
        return matcher.group(1);
    }
}
