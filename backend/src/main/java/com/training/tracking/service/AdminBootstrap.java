package com.training.tracking.service;

import com.training.tracking.domain.User;
import com.training.tracking.dto.auth.Emails;
import com.training.tracking.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/**
 * Makes the accounts named in {@code app.admin.emails} admins on startup — the only way to get the
 * first one, since accounts are otherwise created by an admin. An address without an account yet
 * gets an invited admin account and an invitation mail. A start finding that link still open leaves
 * it alone, so a restart doesn't retire the link in the inbox; a mail that couldn't be sent, or a
 * link that expired, is replaced on the next start. Never takes the flag away:
 * removing an address from the list leaves that admin as is.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository userRepository;
    private final InvitationService invitationService;
    private final TransactionTemplate transactionTemplate;
    private final List<String> adminEmails;

    public AdminBootstrap(UserRepository userRepository,
                          InvitationService invitationService,
                          TransactionTemplate transactionTemplate,
                          @Value("${app.admin.emails:}") String adminEmails) {
        this.userRepository = userRepository;
        this.invitationService = invitationService;
        this.transactionTemplate = transactionTemplate;
        this.adminEmails = Arrays.stream(adminEmails.split(","))
                .map(Emails::normalize)
                .filter(email -> !email.isEmpty())
                .distinct()
                .toList();
    }

    @Override
    public void run(ApplicationArguments args) {
        for (String email : adminEmails) {
            InvitationService.Issued issued = transactionTemplate.execute(status -> grantAdmin(email));
            if (issued != null && !invitationService.mail(issued)) {
                // Withdrawn, so the next start finds no open link and sends a fresh one.
                invitationService.withdraw(issued);
                log.warn("Invitation for admin {} could not be mailed; a new one is sent on the next start", email);
            }
        }
    }

    /**
     * @return a new invitation to mail once committed, or null when none is needed: the account is
     *         active, or the link mailed on an earlier start is still open
     */
    private InvitationService.Issued grantAdmin(String email) {
        User user = userRepository.findByNormalizedEmail(email).orElseGet(() -> createInvited(email));
        if (!user.isAdmin()) {
            user.setAdmin(true);
            userRepository.save(user);
            log.info("Granted admin to {}", email);
        }
        if (!User.STATUS_INVITED.equals(user.getStatus()) || invitationService.hasOpenInvitation(user.getId())) {
            return null;
        }
        return invitationService.issue(user);
    }

    private User createInvited(String email) {
        User user = new User();
        user.setEmail(email);
        user.setStatus(User.STATUS_INVITED);
        user.setCreatedAt(Instant.now());
        return userRepository.save(user);
    }
}
