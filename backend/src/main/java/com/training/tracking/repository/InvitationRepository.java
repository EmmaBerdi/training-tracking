package com.training.tracking.repository;

import com.training.tracking.domain.Invitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InvitationRepository extends JpaRepository<Invitation, Long> {
    Optional<Invitation> findByTokenHash(String tokenHash);

    Optional<Invitation> findFirstByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    /** Every invitation of these accounts, for the admin list to pick each one's newest. */
    List<Invitation> findAllByUserIdIn(Collection<Long> userIds);

    @Modifying
    @Query("DELETE FROM Invitation i WHERE i.userId = :userId")
    void deleteAllByUserId(@Param("userId") Long userId);
}
