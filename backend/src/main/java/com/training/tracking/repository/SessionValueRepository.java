package com.training.tracking.repository;

import com.training.tracking.domain.SessionValue;
import com.training.tracking.domain.SessionValueId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SessionValueRepository extends JpaRepository<SessionValue, SessionValueId> {
    List<SessionValue> findAllBySession_UserId(Long userId);

    List<SessionValue> findAllBySession_UserIdAndRepsNotNull(Long userId);

    /** See {@link SessionWarmupRepository#deleteAllByUserId}. */
    @Modifying
    @Query("DELETE FROM SessionValue sv WHERE sv.session.id IN "
            + "(SELECT s.id FROM Session s WHERE s.userId = :userId)")
    void deleteAllByUserId(@Param("userId") Long userId);
}
