package com.training.tracking.repository;

import com.training.tracking.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

/**
 * Email lookups take an already lower-cased address and compare it with lower(email), so accounts
 * registered with capitals before addresses were normalised are still found. lower(), not the
 * upper() that Spring's IgnoreCase generates, so Postgres can use uq_user_email_lower.
 */
public interface UserRepository extends JpaRepository<User, Long> {
    @Query("select u from User u where lower(u.email) = :email")
    Optional<User> findByNormalizedEmail(String email);

    @Query("select count(u) > 0 from User u where lower(u.email) = :email")
    boolean existsByNormalizedEmail(String email);
}
